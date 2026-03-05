/**
 * SuttaStudio compiler orchestrator.
 *
 * Extracted concerns live in:
 *   schemas.ts    — JSON response schemas for structured outputs
 *   utils.ts      — Parsing, throttling, chunking, source ref utilities
 *   dictionary.ts — Dictionary fetching via proxies
 *   segments.ts   — Canonical segment fetching from SuttaCentral
 *   llm.ts        — LLM call infrastructure (callCompilerLLM, resolveCompilerProvider)
 *   prompts.ts    — All prompt builder functions
 *   skeleton.ts   — runSkeletonPass (chunked skeleton phase)
 */

import { supportsStructuredOutputs } from '../capabilityService';
import type { AppSettings } from '../../types';
import type {
  AnatomistPass,
  CanonicalSegment,
  DeepLoomPacket,
  LexicographerPass,
  PhaseView,
  WeaverPass,
  TypesetterPass,
} from '../../types/suttaStudio';
import { getAveragePhaseDuration, recordPhaseDuration } from '../suttaStudioTelemetry';
import { buildRetrievalContext } from '../suttaStudioRetrieval';
import { validatePacket, validatePhase } from '../suttaStudioValidator';
import { logPipelineEvent } from '../suttaStudioPipelineLog';
import { DictionaryCache } from '../localDictionaryCache';
import {
  segmentCache,
  resetSegmentCache,
  getPipelineCacheStats,
  initializePipelineCaches,
} from '../suttaStudioPipelineCache';
import {
  buildSegmentsMapFromAnatomist,
  rehydratePhase,
  dedupeEnglishStructure,
  buildDegradedPhaseView,
} from '../suttaStudioRehydrator';
import {
  tokenizeEnglish,
  getWordTokens,
  type EnglishTokenInput,
} from '../suttaStudioTokenizer';
import { SUTTA_STUDIO_PROMPT_VERSION } from '../suttaStudioPromptVersion';
import { fetchCanonicalSegmentsForUid } from './segments';
import { fetchDictionaryEntry } from './dictionary';
import { callCompilerLLM } from './llm';
import {
  buildAnatomistPrompt,
  buildLexicographerPrompt,
  buildMorphologyPrompt,
  buildPhasePrompt,
  buildTypesetterPrompt,
  buildWeaverPrompt,
} from './prompts';
import { runSkeletonPass } from './skeleton';
import {
  anatomistResponseSchema,
  lexicographerResponseSchema,
  morphResponseSchema,
  phaseResponseSchema,
  typesetterResponseSchema,
  weaverResponseSchema,
} from './schemas';
import {
  applyWordRangeToSegments,
  buildPhaseStateEnvelope,
  buildSourceRefs,
  chunkPhases,
  computeSourceDigest,
  parseJsonResponse,
  createCompilerThrottle,
  type BoundaryNote,
  type SkeletonPhase,
} from './utils';

export { SUTTA_STUDIO_PROMPT_VERSION } from '../suttaStudioPromptVersion';

const log = (message: string, ...args: any[]) =>
  console.log(`[SuttaStudioCompiler] ${message}`, ...args);
const warn = (message: string, ...args: any[]) =>
  console.warn(`[SuttaStudioCompiler] ${message}`, ...args);
const err = (message: string, ...args: any[]) =>
  console.error(`[SuttaStudioCompiler] ${message}`, ...args);

const COMPILER_MIN_CALL_GAP_MS = 1000;
/// DEBUG: Limit phases for testing (set to 0 for unlimited)
const DEBUG_PHASE_LIMIT = 0;

export type CompileProgress = {
  packet: DeepLoomPacket;
  stage: 'fetching' | 'init' | 'skeleton' | 'phase' | 'complete' | 'error';
  message?: string;
};

export const compileSuttaStudioPacket = async (options: {
  uid: string;
  uids?: string[];
  lang: string;
  author: string;
  settings: AppSettings;
  onProgress?: (progress: CompileProgress) => void;
  signal?: AbortSignal;
  allowCrossChapter?: boolean;
}): Promise<DeepLoomPacket> => {
  const { uid, uids, lang, author, settings, onProgress, signal, allowCrossChapter } = options;
  const uidList = Array.from(new Set([uid, ...(uids || [])].filter(Boolean)));
  const uidKey = uidList.join('+');
  log(`Starting compiler for ${uidKey} (${lang}/${author})`);

  // Initialize and reset caches
  await initializePipelineCaches();
  resetSegmentCache();
  if (!settings?.model) {
    throw new Error('No model selected for Sutta Studio compiler. Please select a model in Settings.');
  }
  const structuredOutputProvider = settings.provider === 'OpenAI' ? 'OpenRouter' : settings.provider;
  const structuredOutputs = await supportsStructuredOutputs(structuredOutputProvider, settings.model);
  log(`Structured outputs supported: ${structuredOutputs}`);
  logPipelineEvent({
    level: 'info',
    stage: 'compile',
    message: 'compile.start',
    data: { uidKey, lang, author, model: settings.model, provider: settings.provider, structuredOutputs },
  });
  const throttle = createCompilerThrottle(COMPILER_MIN_CALL_GAP_MS);

  // Emit early progress so UI shows "building" state immediately
  const earlyPacket: DeepLoomPacket = {
    packetId: `sutta-${uidKey}-pending`,
    source: { provider: 'suttacentral', workId: uidKey, workIds: uidList },
    canonicalSegments: [],
    phases: [],
    citations: [],
    progress: { totalPhases: 0, readyPhases: 0, state: 'building', currentStage: 'fetching' },
    renderDefaults: { ghostOpacity: 0.3, englishVisible: true, studyToggleDefault: true },
    compiler: {
      provider: settings.provider === 'OpenAI' ? 'openai' : settings.provider === 'OpenRouter' ? 'openrouter' : 'openrouter',
      model: settings.model,
      promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
      createdAtISO: new Date().toISOString(),
      sourceDigest: '',
      validatorVersion: 'v1',
      validationIssues: [],
    },
  };
  onProgress?.({ packet: earlyPacket, stage: 'fetching', message: 'Fetching canonical segments...' });

  const bundles: Array<{ uid: string; segments: CanonicalSegment[] }> = [];
  for (const entry of uidList) {
    const segments = await fetchCanonicalSegmentsForUid(entry, author, signal);
    bundles.push({ uid: entry, segments });
  }

  const boundaries: BoundaryNote[] = [];
  bundles.forEach((bundle, index) => {
    if (index === 0) return;
    const previous = bundles[index - 1];
    const startSegment = bundle.segments[0];
    if (!startSegment) return;
    boundaries.push({
      workId: bundle.uid,
      startSegmentId: startSegment.ref.segmentId,
      afterSegmentId: previous.segments[previous.segments.length - 1]?.ref.segmentId,
    });
  });

  const canonicalSegments = bundles.flatMap((bundle) => bundle.segments);
  const canonicalWithOrder = canonicalSegments.map((seg, index) => ({ ...seg, order: index }));
  const segmentIdToWorkId = new Map<string, string>();
  canonicalWithOrder.forEach((seg) => segmentIdToWorkId.set(seg.ref.segmentId, seg.ref.workId));

  const sourceDigest = computeSourceDigest(canonicalWithOrder);
  const packetId = `sutta-${uidKey}-${sourceDigest}`;

  const renderDefaults = { ghostOpacity: 0.3, englishVisible: true, studyToggleDefault: true };

  let packet: DeepLoomPacket = {
    packetId,
    source: { provider: 'suttacentral', workId: uidKey, workIds: uidList },
    canonicalSegments: canonicalWithOrder,
    phases: [],
    citations: [],
    progress: { totalPhases: 0, readyPhases: 0, state: 'building' },
    renderDefaults,
    compiler: {
      provider: settings.provider === 'OpenAI' ? 'openai' : settings.provider === 'OpenRouter' ? 'openrouter' : 'openrouter',
      model: settings.model,
      promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
      createdAtISO: new Date().toISOString(),
      sourceDigest,
      validatorVersion: 'v1',
      validationIssues: [],
    },
  };

  packet.progress = { ...packet.progress, currentStage: 'skeleton' };
  onProgress?.({ packet, stage: 'init', message: 'Fetched canonical segments.' });

  // Skeleton pass
  let phaseSkeleton: SkeletonPhase[] = [];
  try {
    log('Running skeleton pass (chunked)...');
    phaseSkeleton = await runSkeletonPass({
      segments: canonicalWithOrder,
      boundaries,
      allowCrossChapter: Boolean(allowCrossChapter),
      settings,
      structuredOutputs,
      signal,
      throttle,
      chunkSize: 50,
      onChunkProgress: (chunkIndex, chunkCount, segmentCount) => {
        const stageMessage = `Analyzing structure (chunk ${chunkIndex + 1}/${chunkCount}, ${segmentCount} segments)...`;
        packet = { ...packet, progress: { ...packet.progress, stageMessage } };
        onProgress?.({ packet, stage: 'skeleton', message: stageMessage });
      },
    });
  } catch (e) {
    warn('Skeleton pass failed; falling back to chunked phases.', e);
  }

  if (!phaseSkeleton.length) {
    const boundaryStarts =
      !allowCrossChapter && boundaries.length
        ? new Set(boundaries.map((b) => b.startSegmentId))
        : undefined;
    phaseSkeleton = chunkPhases(canonicalWithOrder, 8, boundaryStarts);
  }

  let readySegments = 0;
  const totalSegments = canonicalWithOrder.length;
  const phaseLimit = DEBUG_PHASE_LIMIT > 0 ? Math.min(DEBUG_PHASE_LIMIT, phaseSkeleton.length) : phaseSkeleton.length;
  if (DEBUG_PHASE_LIMIT > 0) {
    log(`DEBUG MODE: Limiting to ${phaseLimit} phases (set DEBUG_PHASE_LIMIT=0 for full compilation)`);
  }

  const seededAvgPhaseMs = getAveragePhaseDuration(uidKey) ?? undefined;
  const seededEtaMs = seededAvgPhaseMs && phaseLimit > 0 ? seededAvgPhaseMs * phaseLimit : undefined;
  packet = {
    ...packet,
    progress: {
      totalPhases: phaseLimit,
      readyPhases: 0,
      totalSegments,
      readySegments,
      state: 'building',
      currentStage: 'phases',
      currentPhaseId: undefined,
      lastProgressAt: Date.now(),
      avgPhaseMs: seededAvgPhaseMs,
      etaMs: seededEtaMs,
    },
  };
  onProgress?.({ packet, stage: 'skeleton', message: 'Skeleton ready.' });
  logPipelineEvent({
    level: 'info',
    stage: 'skeleton',
    message: 'skeleton.ready',
    data: { phaseCount: phaseSkeleton.length, phaseLimit },
  });

  for (let i = 0; i < phaseLimit; i++) {
    const phase = phaseSkeleton[i];
    const segmentSet = new Set(phase.segmentIds);
    const phaseSegments = canonicalWithOrder.filter((seg) => segmentSet.has(seg.ref.segmentId));
    const effectiveSegments = applyWordRangeToSegments(phaseSegments, phase.wordRange);
    if (phase.wordRange) {
      log(`  wordRange: [${phase.wordRange[0]}, ${phase.wordRange[1]}) applied - Pali: "${effectiveSegments[0]?.pali}"`);
    }

    try {
      log(`Compiling ${phase.id} (${i + 1}/${phaseSkeleton.length})...`);
      const phaseStart = performance.now();

      const paliText = effectiveSegments.map((s) => s.pali).join(' ');
      const cachedSegment = segmentCache.get(paliText);
      const cacheHit = !!cachedSegment;
      logPipelineEvent({
        level: 'info',
        stage: 'cache',
        phaseId: phase.id,
        message: cacheHit ? 'segment_cache.hit' : 'segment_cache.miss',
        data: {
          paliLength: paliText.length,
          paliPreview: paliText.slice(0, 50) + (paliText.length > 50 ? '...' : ''),
          hasCachedAnatomist: !!cachedSegment?.anatomist,
          hasCachedLexicographer: !!cachedSegment?.lexicographer,
          hasCachedWeaver: !!cachedSegment?.weaver,
          hasCachedTypesetter: !!cachedSegment?.typesetter,
        },
      });

      const retrievalContext = buildRetrievalContext({
        canonicalSegments: canonicalWithOrder,
        phaseSegments,
        allowCrossChapter: Boolean(allowCrossChapter),
      });
      let anatomistOutput: AnatomistPass | null = cachedSegment?.anatomist || null;
      let lexicographerOutput: LexicographerPass | null = cachedSegment?.lexicographer || null;

      // Anatomist pass
      if (!anatomistOutput) {
        try {
          log(`Anatomist pass for ${phase.id}...`);
          packet = { ...packet, progress: { ...packet.progress, currentPassName: 'Anatomist' } };
          onProgress?.({ packet, stage: 'phase', message: `${phase.id}: Anatomist` });
          const phaseState = buildPhaseStateEnvelope({
            workId: uidKey, phaseId: phase.id, segments: effectiveSegments,
            currentStageLabel: 'Anatomist (1/4)', currentStageKey: 'anatomist', completed: {},
          });
          const anatomistPrompt = buildAnatomistPrompt(phase.id, effectiveSegments, phaseState, retrievalContext || undefined);
          await throttle(signal);
          const anatomistRaw = await callCompilerLLM(
            settings,
            [{ role: 'system', content: 'Return JSON only.' }, { role: 'user', content: anatomistPrompt }],
            signal, 8000,
            { schemaName: `sutta_studio_anatomist_${phase.id.replace(/-/g, '_')}`, schema: anatomistResponseSchema, structuredOutputs, meta: { stage: 'anatomist', phaseId: phase.id, requestName: 'anatomist' } }
          );
          anatomistOutput = parseJsonResponse<AnatomistPass>(anatomistRaw);
          logPipelineEvent({ level: 'info', stage: 'anatomist', phaseId: phase.id, message: 'anatomist.complete', data: { wordCount: anatomistOutput.words.length, segmentCount: anatomistOutput.segments.length } });
          segmentCache.setAnatomist(paliText, anatomistOutput);
        } catch (e) {
          warn(`Anatomist pass failed for ${phase.id}; continuing without it.`, e);
          logPipelineEvent({ level: 'warn', stage: 'anatomist', phaseId: phase.id, message: 'anatomist.failed', data: { error: e instanceof Error ? e.message : String(e) } });
        }
      } else {
        log(`  Using cached anatomist output for ${phase.id}`);
      }

      // Lexicographer pass
      if (anatomistOutput) {
        if (cachedSegment?.lexicographer) {
          lexicographerOutput = cachedSegment.lexicographer;
          log(`  Using cached lexicographer output for ${phase.id}`);
        } else {
          try {
            const contentWords = anatomistOutput.words.filter((word) => word.wordClass === 'content');
            const lexStart = performance.now();
            const dictionaryEntries: Record<string, unknown | null> = {};
            const cacheMisses: typeof contentWords = [];

            for (const word of contentWords) {
              const cached = DictionaryCache.get(word.surface);
              if (cached !== undefined) {
                dictionaryEntries[word.id] = cached;
              } else {
                cacheMisses.push(word);
              }
            }

            const cacheHits = contentWords.length - cacheMisses.length;
            log(`Lexicographer pass for ${phase.id} - ${cacheHits} cached, ${cacheMisses.length} to fetch (parallel)...`);
            packet = { ...packet, progress: { ...packet.progress, currentPassName: 'Lexicographer' } };
            onProgress?.({ packet, stage: 'phase', message: `${phase.id}: Lexicographer` });

            if (cacheMisses.length > 0) {
              const fetchPromises = cacheMisses.map(async (word) => {
                try {
                  const result = await fetchDictionaryEntry({ surface: word.surface, wordId: word.id, phaseId: phase.id, signal });
                  return { word, result };
                } catch (e) {
                  return { word, result: null };
                }
              });
              const results = await Promise.all(fetchPromises);
              const newEntries: Array<{ word: string; definition: unknown | null }> = [];
              for (const { word, result } of results) {
                dictionaryEntries[word.id] = result;
                newEntries.push({ word: word.surface, definition: result });
              }
              await DictionaryCache.setMany(newEntries);
            }

            const dictMs = Math.round(performance.now() - lexStart);
            log(`  Dictionary done: ${cacheHits} cached + ${cacheMisses.length} fetched = ${dictMs}ms. Calling LLM...`);

            const phaseState = buildPhaseStateEnvelope({
              workId: uidKey, phaseId: phase.id, segments: effectiveSegments,
              currentStageLabel: 'Lexicographer (2/4)', currentStageKey: 'lexicographer', completed: { anatomist: true },
            });
            const lexicographerPrompt = buildLexicographerPrompt(phase.id, effectiveSegments, phaseState, anatomistOutput, dictionaryEntries, retrievalContext || undefined);
            await throttle(signal);
            const lexRaw = await callCompilerLLM(
              settings,
              [{ role: 'system', content: 'Return JSON only.' }, { role: 'user', content: lexicographerPrompt }],
              signal, 8000,
              { schemaName: `sutta_studio_lexico_${phase.id.replace(/-/g, '_')}`, schema: lexicographerResponseSchema, structuredOutputs, meta: { stage: 'lexicographer', phaseId: phase.id, requestName: 'lexicographer' } }
            );
            lexicographerOutput = parseJsonResponse<LexicographerPass>(lexRaw);
            logPipelineEvent({ level: 'info', stage: 'lexicographer', phaseId: phase.id, message: 'lexicographer.complete', data: { senseEntries: lexicographerOutput.senses.length } });
            segmentCache.setLexicographer(paliText, lexicographerOutput);
          } catch (e) {
            warn(`Lexicographer pass failed for ${phase.id}; continuing without it.`, e);
            logPipelineEvent({ level: 'warn', stage: 'lexicographer', phaseId: phase.id, message: 'lexicographer.failed', data: { error: e instanceof Error ? e.message : String(e) } });
          }
        }
      }

      // Weaver pass
      let weaverOutput: WeaverPass | null = cachedSegment?.weaver || null;
      let englishTokens: EnglishTokenInput[] = [];
      if (anatomistOutput && lexicographerOutput) {
        if (weaverOutput) {
          log(`  Using cached weaver output for ${phase.id}`);
          const englishText = effectiveSegments.map((seg) => seg.baseEnglish || '').filter(Boolean).join(' ');
          if (englishText) englishTokens = tokenizeEnglish(englishText);
        } else {
          try {
            const englishText = effectiveSegments.map((seg) => seg.baseEnglish || '').filter(Boolean).join(' ');
            if (englishText) {
              englishTokens = tokenizeEnglish(englishText);
              log(`Weaver pass for ${phase.id} (${getWordTokens(englishTokens).length} word tokens)...`);
              packet = { ...packet, progress: { ...packet.progress, currentPassName: 'Weaver' } };
              onProgress?.({ packet, stage: 'phase', message: `${phase.id}: Weaver` });
              const weaverPhaseState = buildPhaseStateEnvelope({
                workId: uidKey, phaseId: phase.id, segments: effectiveSegments,
                currentStageLabel: 'Weaver (3/4)', currentStageKey: 'weaver', completed: { anatomist: true, lexicographer: true },
              });
              const weaverPrompt = buildWeaverPrompt(phase.id, effectiveSegments, weaverPhaseState, anatomistOutput, lexicographerOutput, englishTokens);
              await throttle(signal);
              const weaverRaw = await callCompilerLLM(
                settings,
                [{ role: 'system', content: 'Return JSON only.' }, { role: 'user', content: weaverPrompt }],
                signal, 4000,
                { schemaName: `sutta_studio_weaver_${phase.id.replace(/-/g, '_')}`, schema: weaverResponseSchema, structuredOutputs, meta: { stage: 'weaver', phaseId: phase.id, requestName: 'weaver' } }
              );
              weaverOutput = parseJsonResponse<WeaverPass>(weaverRaw);
              logPipelineEvent({ level: 'info', stage: 'weaver', phaseId: phase.id, message: 'weaver.complete', data: { tokenCount: weaverOutput.tokens.length } });
              segmentCache.setWeaver(paliText, weaverOutput);
            } else {
              log(`Skipping Weaver pass for ${phase.id} (no English text).`);
            }
          } catch (e) {
            warn(`Weaver pass failed for ${phase.id}; continuing without it.`, e);
            logPipelineEvent({ level: 'warn', stage: 'weaver', phaseId: phase.id, message: 'weaver.failed', data: { error: e instanceof Error ? e.message : String(e) } });
          }
        }
      }

      // Typesetter pass
      let typesetterOutput: TypesetterPass | null = cachedSegment?.typesetter || null;
      if (anatomistOutput && weaverOutput) {
        if (typesetterOutput) {
          log(`  Using cached typesetter output for ${phase.id}`);
        } else {
          try {
            log(`Typesetter pass for ${phase.id}...`);
            packet = { ...packet, progress: { ...packet.progress, currentPassName: 'Typesetter' } };
            onProgress?.({ packet, stage: 'phase', message: `${phase.id}: Typesetter` });
            const typesetterPhaseState = buildPhaseStateEnvelope({
              workId: uidKey, phaseId: phase.id, segments: effectiveSegments,
              currentStageLabel: 'Typesetter (4/4)', currentStageKey: 'typesetter', completed: { anatomist: true, lexicographer: true, weaver: true },
            });
            const typesetterPrompt = buildTypesetterPrompt(phase.id, typesetterPhaseState, anatomistOutput, weaverOutput, effectiveSegments);
            const wordIds = anatomistOutput.words.map((w) => w.id).join(', ');
            const englishOrderDebug = weaverOutput.tokens
              .filter((t) => !t.isGhost && (t.linkedPaliId || t.linkedSegmentId))
              .map((t) => t.linkedPaliId || t.linkedSegmentId)
              .join(' → ');
            logPipelineEvent({ level: 'debug', stage: 'typesetter', phaseId: phase.id, message: 'typesetter.input', data: { wordIds, englishOrder: englishOrderDebug } });
            await throttle(signal);
            const typesetterRaw = await callCompilerLLM(
              settings,
              [{ role: 'system', content: 'Return JSON only.' }, { role: 'user', content: typesetterPrompt }],
              signal, 3000,
              { schemaName: `sutta_studio_typesetter_${phase.id.replace(/-/g, '_')}`, schema: typesetterResponseSchema, structuredOutputs, meta: { stage: 'typesetter', phaseId: phase.id, requestName: 'typesetter' } }
            );
            typesetterOutput = parseJsonResponse<TypesetterPass>(typesetterRaw);
            logPipelineEvent({ level: 'info', stage: 'typesetter', phaseId: phase.id, message: 'typesetter.complete', data: { blockCount: typesetterOutput.layoutBlocks.length, layoutBlocks: typesetterOutput.layoutBlocks, handoff: typesetterOutput.handoff } });
            segmentCache.setTypesetter(paliText, typesetterOutput);
          } catch (e) {
            warn(`Typesetter pass failed for ${phase.id}; continuing without it.`, e);
            logPipelineEvent({ level: 'warn', stage: 'typesetter', phaseId: phase.id, message: 'typesetter.failed', data: { error: e instanceof Error ? e.message : String(e) } });
          }
        }
      }

      // PhaseView assembly
      const phaseState = buildPhaseStateEnvelope({
        workId: uidKey, phaseId: phase.id, segments: effectiveSegments,
        currentStageLabel: 'PhaseView (fallback)',
        completed: { anatomist: Boolean(anatomistOutput), lexicographer: Boolean(lexicographerOutput), weaver: Boolean(weaverOutput), typesetter: Boolean(typesetterOutput) },
      });
      const phasePrompt = buildPhasePrompt(phase.id, effectiveSegments, renderDefaults, retrievalContext || undefined, { anatomist: anatomistOutput || undefined, lexicographer: lexicographerOutput || undefined, phaseState });
      await throttle(signal);
      const raw = await callCompilerLLM(
        settings,
        [{ role: 'system', content: 'Return JSON only.' }, { role: 'user', content: phasePrompt }],
        signal, 4000,
        { schemaName: `sutta_studio_${phase.id.replace(/-/g, '_')}`, schema: phaseResponseSchema, structuredOutputs, meta: { stage: 'phase', phaseId: phase.id, requestName: 'phase_view' } }
      );

      const parsed = parseJsonResponse<PhaseView>(raw);
      const phaseMs = Math.max(0, Math.round(performance.now() - phaseStart));
      recordPhaseDuration(uidKey, phaseMs);
      const avgPhaseMs = getAveragePhaseDuration(uidKey) ?? phaseMs;
      const remaining = phaseSkeleton.length - (i + 1);
      const etaMs = avgPhaseMs * remaining;
      readySegments += phase.segmentIds.length;
      const sourceSpan = buildSourceRefs(phase.segmentIds, segmentIdToWorkId, uidList[0]);
      let normalized: PhaseView;

      if (anatomistOutput && lexicographerOutput) {
        normalized = rehydratePhase({
          phaseId: phase.id,
          title: parsed.title || phase.title,
          sourceSpan,
          anatomist: anatomistOutput,
          lexicographer: lexicographerOutput,
          weaver: weaverOutput || undefined,
          englishTokens: englishTokens.length > 0 ? englishTokens : undefined,
          typesetter: typesetterOutput || undefined,
          fallbackPhaseView: parsed,
        });
        logPipelineEvent({ level: 'info', stage: 'phase', phaseId: phase.id, message: 'rehydrator.complete', data: { wordCount: normalized.paliWords.length } });
      } else {
        normalized = {
          ...parsed,
          id: phase.id,
          title: parsed.title || phase.title,
          sourceSpan,
          paliWords: parsed.paliWords || [],
          englishStructure: dedupeEnglishStructure(parsed.englishStructure || [], parsed.paliWords || []),
        };
      }

      const fallbackSegments = anatomistOutput
        ? buildSegmentsMapFromAnatomist(anatomistOutput)
        : new Map((parsed.paliWords || []).map((word) => [word.id, word.segments]));

      if (!anatomistOutput) {
        try {
          log(`Morphology pass for ${phase.id}...`);
          const morphPrompt = buildMorphologyPrompt(phase.id, normalized, effectiveSegments, retrievalContext || undefined);
          await throttle(signal);
          const morphRaw = await callCompilerLLM(
            settings,
            [{ role: 'system', content: 'Return JSON only.' }, { role: 'user', content: morphPrompt }],
            signal, 3000,
            { schemaName: `sutta_studio_morph_${phase.id.replace(/-/g, '_')}`, schema: morphResponseSchema, structuredOutputs, meta: { stage: 'morph', phaseId: phase.id, requestName: 'morphology' } }
          );
          const morphParsed = parseJsonResponse<{ paliWords?: Array<{ id: string; segments: PhaseView['paliWords'][number]['segments'] }> }>(morphRaw);
          if (morphParsed?.paliWords?.length) {
            const morphMap = new Map(morphParsed.paliWords.map((w) => [w.id, w.segments]));
            normalized = { ...normalized, paliWords: normalized.paliWords.map((word) => { const segs = morphMap.get(word.id); return segs ? { ...word, segments: segs } : word; }) };
          }
        } catch (e) {
          warn(`Morphology pass failed for ${phase.id}; keeping base segments.`, e);
        }
      } else {
        log(`Skipping morphology pass for ${phase.id} (anatomist output present).`);
      }

      const validation = validatePhase(normalized, { fallbackSegments });
      if (validation.issues.length) warn(`Validation reported ${validation.issues.length} issue(s) for ${phase.id}.`);
      normalized = validation.phase;
      const validationIssues = [...(packet.compiler?.validationIssues || []), ...validation.issues];
      const updatedCompiler = packet.compiler ? { ...packet.compiler, validationIssues } : undefined;

      packet = {
        ...packet,
        phases: [...packet.phases, normalized],
        compiler: updatedCompiler,
        progress: { totalPhases: phaseLimit, readyPhases: i + 1, totalSegments, readySegments, state: 'building', currentPhaseId: phase.id, lastProgressAt: Date.now(), lastPhaseMs: phaseMs, avgPhaseMs, etaMs },
      };

      onProgress?.({ packet, stage: 'phase', message: `${phase.id} complete` });
      logPipelineEvent({ level: 'info', stage: 'phase', phaseId: phase.id, message: 'phase.complete', data: { phaseMs, readyPhases: i + 1, totalPhases: phaseLimit } });
    } catch (e: any) {
      err(`Phase ${phase.id} failed, creating degraded view`, e);
      const degradedSourceSpan = buildSourceRefs(phase.segmentIds, segmentIdToWorkId, uidList[0]);
      const paliTexts = effectiveSegments.map((seg) => ({ surface: seg.pali }));
      const englishTexts = effectiveSegments.map((seg) => seg.baseEnglish).filter((text): text is string => Boolean(text));
      const degradedPhase = buildDegradedPhaseView({ phaseId: phase.id, title: phase.title, sourceSpan: degradedSourceSpan, paliTexts, englishTexts, reason: e?.message || 'Phase compilation failed' });

      readySegments += phase.segmentIds.length;
      packet = {
        ...packet,
        phases: [...packet.phases, degradedPhase],
        progress: { totalPhases: phaseLimit, readyPhases: i + 1, totalSegments, readySegments, state: 'building', currentPhaseId: phase.id, lastProgressAt: Date.now(), avgPhaseMs: getAveragePhaseDuration(uidKey) ?? undefined },
      };
      onProgress?.({ packet, stage: 'phase', message: `${phase.id} degraded` });
      logPipelineEvent({ level: 'warn', stage: 'phase', phaseId: phase.id, message: 'phase.degraded', data: { error: e?.message || String(e) } });
    }
  }

  const packetValidation = validatePacket(packet);
  if (packetValidation.issues.length) warn(`Packet validation reported ${packetValidation.issues.length} issue(s).`);
  const finalValidationIssues = [...(packet.compiler?.validationIssues || []), ...packetValidation.issues];
  const finalCompiler = packet.compiler ? { ...packet.compiler, validationIssues: finalValidationIssues } : undefined;

  packet = {
    ...packetValidation.packet,
    compiler: finalCompiler,
    progress: {
      totalPhases: phaseLimit,
      readyPhases: phaseSkeleton.length,
      totalSegments,
      readySegments: totalSegments,
      state: 'complete',
      currentPhaseId: phaseSkeleton[phaseSkeleton.length - 1]?.id,
      lastProgressAt: Date.now(),
      avgPhaseMs: getAveragePhaseDuration(uidKey) ?? undefined,
      etaMs: 0,
    },
  };

  onProgress?.({ packet, stage: 'complete', message: 'Compilation complete' });

  const cacheStats = getPipelineCacheStats();
  logPipelineEvent({ level: 'info', stage: 'cache', message: 'cache.stats', data: { morphology: cacheStats.morphology, segment: cacheStats.segment, estimatedSavingsPercent: cacheStats.estimatedSavingsPercent } });
  log(`Cache stats: Segment cache ${cacheStats.segment.hitRate} hit rate (${cacheStats.segment.hits} hits, ${cacheStats.segment.misses} misses)`);
  log(`Cache stats: Morphology cache ${cacheStats.morphology.hitRate} hit rate (${cacheStats.morphology.hits} hits, ${cacheStats.morphology.misses} misses)`);
  log(`Estimated savings: ~${cacheStats.estimatedSavingsPercent}%`);

  logPipelineEvent({ level: 'info', stage: 'compile', message: 'compile.complete', data: { totalPhases: phaseSkeleton.length, cacheStats } });
  log('Compiler completed successfully.');
  return packet;
};
