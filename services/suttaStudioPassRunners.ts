import type { AppSettings } from '../types';
import type { ChatMessage } from '../adapters/providers/Provider';
import type {
  AnatomistPass,
  CanonicalSegment,
  LexicographerPass,
  PhaseView,
  TypesetterPass,
  WeaverPass,
} from '../types/suttaStudio';
import { tokenizeEnglish, type EnglishTokenInput } from './suttaStudioTokenizer';
import {
  anatomistResponseSchema,
  buildAnatomistPrompt,
  buildLexicographerPrompt,
  buildMorphologyPrompt,
  buildPhaseStateEnvelope,
  buildSkeletonPrompt,
  buildTypesetterPrompt,
  buildWeaverPrompt,
  lexicographerResponseSchema,
  morphResponseSchema,
  parseJsonResponse,
  skeletonResponseSchema,
  typesetterResponseSchema,
  weaverResponseSchema,
  type BoundaryNote,
  type SkeletonPhase,
} from './suttaStudioPassPrompts';
import type { CompilerLLMOptions, CompilerLLMResult } from './suttaStudioLLM';

export type PassName = 'skeleton' | 'anatomist' | 'lexicographer' | 'weaver' | 'typesetter' | 'morphology';

export type LLMCaller = (params: {
  settings: AppSettings;
  messages: ChatMessage[];
  signal?: AbortSignal;
  maxTokens?: number;
  options?: CompilerLLMOptions;
}) => Promise<CompilerLLMResult>;

export type PassCallResult<T> = {
  output: T | null;
  llm?: CompilerLLMResult;
  error?: string;
  requestName: string;
  schemaName?: string;
  phaseId?: string;
};

export type SkeletonChunkResult = PassCallResult<SkeletonPhase[]> & {
  chunkIndex: number;
  chunkCount: number;
  segmentCount: number;
  fallbackUsed: boolean;
};

export type SkeletonRunResult = {
  phases: SkeletonPhase[];
  chunks: SkeletonChunkResult[];
};

const defaultLLMCaller: LLMCaller = async ({ settings, messages, signal, maxTokens, options }) => {
  const { callCompilerLLM } = await import('./suttaStudioLLM');
  return callCompilerLLM(settings, messages, signal, maxTokens ?? 4000, options);
};

const chunkPhases = (
  segments: CanonicalSegment[],
  size = 8,
  boundaryStarts?: Set<string>
): SkeletonPhase[] => {
  const phases: SkeletonPhase[] = [];
  let buffer: CanonicalSegment[] = [];
  const flush = () => {
    if (!buffer.length) return;
    phases.push({
      id: `phase-${phases.length + 1}`,
      title: undefined,
      segmentIds: buffer.map((seg) => seg.ref.segmentId),
    });
    buffer = [];
  };
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (boundaryStarts?.has(seg.ref.segmentId) && buffer.length) {
      flush();
    }
    buffer.push(seg);
    if (buffer.length >= size) flush();
  }
  flush();
  return phases;
};

export const runSkeletonPass = async (params: {
  segments: CanonicalSegment[];
  boundaries?: BoundaryNote[];
  allowCrossChapter?: boolean;
  settings: AppSettings;
  structuredOutputs: boolean;
  signal?: AbortSignal;
  llmCaller?: LLMCaller;
  chunkSize?: number;
  maxTokens?: number;
}): Promise<SkeletonRunResult> => {
  const {
    segments,
    boundaries = [],
    allowCrossChapter,
    settings,
    structuredOutputs,
    signal,
    llmCaller = defaultLLMCaller,
    chunkSize = 50,
    maxTokens = 16000,  // High default for reasoning models (kimi, lfm, etc.)
  } = params;

  const phases: SkeletonPhase[] = [];
  const chunks: SkeletonChunkResult[] = [];
  const safeChunkSize = Math.max(1, Math.min(chunkSize, segments.length));
  const chunkCount = Math.ceil(segments.length / safeChunkSize);

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
    const start = chunkIndex * safeChunkSize;
    const chunkSegments = segments.slice(start, start + safeChunkSize);
    const chunkSegmentIds = new Set(chunkSegments.map((seg) => seg.ref.segmentId));
    const chunkBoundaries = boundaries.filter((b) => chunkSegmentIds.has(b.startSegmentId));
    const fallbackBoundaryStarts =
      !allowCrossChapter && chunkBoundaries.length
        ? new Set(chunkBoundaries.map((b) => b.startSegmentId))
        : undefined;

    const schemaName = `sutta_studio_skeleton_${chunkIndex + 1}`;
    const requestName = 'skeleton';
    const fallback = () => chunkPhases(chunkSegments, 8, fallbackBoundaryStarts);

    try {
      const skeletonPrompt = buildSkeletonPrompt(chunkSegments, {
        exampleSegmentId: chunkSegments[0]?.ref.segmentId,
        boundaries: chunkBoundaries,
        allowCrossChapter: Boolean(allowCrossChapter),
      });

      const llm = await llmCaller({
        settings,
        messages: [
          { role: 'system', content: 'Return JSON only.' },
          { role: 'user', content: skeletonPrompt },
        ],
        signal,
        maxTokens,
        options: {
          schemaName,
          schema: skeletonResponseSchema,
          structuredOutputs,
          meta: {
            stage: 'skeleton',
            phaseId: `chunk-${chunkIndex + 1}`,
            requestName,
          },
        },
      });

      const parsed = parseJsonResponse<{ phases?: SkeletonPhase[] }>(llm.text);
      if (!parsed.phases || !parsed.phases.length) {
        throw new Error('Skeleton chunk response missing phases.');
      }

      const filtered = parsed.phases
        .map((phase) => ({
          ...phase,
          segmentIds: (phase.segmentIds || []).filter((id) => chunkSegmentIds.has(id)),
        }))
        .filter((phase) => phase.segmentIds.length > 0);

      const seen = new Set<string>();
      filtered.forEach((phase) => {
        phase.segmentIds = phase.segmentIds.filter((id) => {
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      });

      if (seen.size !== chunkSegmentIds.size) {
        throw new Error('Skeleton chunk missing or duplicate segments; falling back to chunking.');
      }

      phases.push(...filtered);
      chunks.push({
        output: filtered,
        llm,
        requestName,
        schemaName,
        phaseId: `chunk-${chunkIndex + 1}`,
        chunkIndex,
        chunkCount,
        segmentCount: chunkSegments.length,
        fallbackUsed: false,
      });
    } catch (e: any) {
      const fallbackPhases = fallback();
      phases.push(...fallbackPhases);
      chunks.push({
        output: fallbackPhases,
        error: e?.message || String(e),
        requestName,
        schemaName,
        phaseId: `chunk-${chunkIndex + 1}`,
        chunkIndex,
        chunkCount,
        segmentCount: chunkSegments.length,
        fallbackUsed: true,
      });
    }
  }

  const normalized = phases.map((phase, index) => ({
    ...phase,
    id: `phase-${index + 1}`,
  }));

  return { phases: normalized, chunks };
};

export const runAnatomistPass = async (params: {
  phaseId: string;
  workId: string;
  segments: CanonicalSegment[];
  settings: AppSettings;
  structuredOutputs: boolean;
  retrievalContext?: string;
  signal?: AbortSignal;
  llmCaller?: LLMCaller;
  maxTokens?: number;
}): Promise<PassCallResult<AnatomistPass>> => {
  const {
    phaseId,
    workId,
    segments,
    settings,
    structuredOutputs,
    retrievalContext,
    signal,
    llmCaller = defaultLLMCaller,
    maxTokens = 16000,  // High default for reasoning models
  } = params;

  const phaseState = buildPhaseStateEnvelope({
    workId,
    phaseId,
    segments,
    currentStageLabel: 'Anatomist (1/4)',
    currentStageKey: 'anatomist',
    completed: {},
  });

  const schemaName = `sutta_studio_anatomist_${phaseId.replace(/-/g, '_')}`;
  const requestName = 'anatomist';

  try {
    const prompt = buildAnatomistPrompt(phaseId, segments, phaseState, retrievalContext);
    const llm = await llmCaller({
      settings,
      messages: [
        { role: 'system', content: 'Return JSON only.' },
        { role: 'user', content: prompt },
      ],
      signal,
      maxTokens,
      options: {
        schemaName,
        schema: anatomistResponseSchema,
        structuredOutputs,
        meta: { stage: 'anatomist', phaseId, requestName },
      },
    });
    const output = parseJsonResponse<AnatomistPass>(llm.text);
    return { output, llm, requestName, schemaName, phaseId };
  } catch (e: any) {
    return {
      output: null,
      error: e?.message || String(e),
      requestName,
      schemaName,
      phaseId,
    };
  }
};

export const runLexicographerPass = async (params: {
  phaseId: string;
  workId: string;
  segments: CanonicalSegment[];
  anatomist: AnatomistPass;
  dictionaryEntries?: Record<string, unknown | null>;
  settings: AppSettings;
  structuredOutputs: boolean;
  retrievalContext?: string;
  signal?: AbortSignal;
  llmCaller?: LLMCaller;
  maxTokens?: number;
}): Promise<PassCallResult<LexicographerPass>> => {
  const {
    phaseId,
    workId,
    segments,
    anatomist,
    dictionaryEntries = {},
    settings,
    structuredOutputs,
    retrievalContext,
    signal,
    llmCaller = defaultLLMCaller,
    maxTokens = 16000,  // High default for reasoning models
  } = params;

  const phaseState = buildPhaseStateEnvelope({
    workId,
    phaseId,
    segments,
    currentStageLabel: 'Lexicographer (2/4)',
    currentStageKey: 'lexicographer',
    completed: { anatomist: true },
  });

  const schemaName = `sutta_studio_lexico_${phaseId.replace(/-/g, '_')}`;
  const requestName = 'lexicographer';

  try {
    const prompt = buildLexicographerPrompt(
      phaseId,
      segments,
      phaseState,
      anatomist,
      dictionaryEntries,
      retrievalContext
    );
    const llm = await llmCaller({
      settings,
      messages: [
        { role: 'system', content: 'Return JSON only.' },
        { role: 'user', content: prompt },
      ],
      signal,
      maxTokens,
      options: {
        schemaName,
        schema: lexicographerResponseSchema,
        structuredOutputs,
        meta: { stage: 'lexicographer', phaseId, requestName },
      },
    });
    const output = parseJsonResponse<LexicographerPass>(llm.text);
    return { output, llm, requestName, schemaName, phaseId };
  } catch (e: any) {
    return {
      output: null,
      error: e?.message || String(e),
      requestName,
      schemaName,
      phaseId,
    };
  }
};

export const runWeaverPass = async (params: {
  phaseId: string;
  workId: string;
  segments: CanonicalSegment[];
  anatomist: AnatomistPass;
  lexicographer: LexicographerPass;
  englishTokens?: EnglishTokenInput[];
  englishText?: string;
  settings: AppSettings;
  structuredOutputs: boolean;
  signal?: AbortSignal;
  llmCaller?: LLMCaller;
  maxTokens?: number;
}): Promise<PassCallResult<WeaverPass>> => {
  const {
    phaseId,
    workId,
    segments,
    anatomist,
    lexicographer,
    englishTokens,
    englishText,
    settings,
    structuredOutputs,
    signal,
    llmCaller = defaultLLMCaller,
    maxTokens = 16000,  // High default for reasoning models
  } = params;

  const phaseState = buildPhaseStateEnvelope({
    workId,
    phaseId,
    segments,
    currentStageLabel: 'Weaver (3/4)',
    currentStageKey: 'weaver',
    completed: { anatomist: true, lexicographer: true },
  });

  const tokens = englishTokens
    ? englishTokens
    : tokenizeEnglish(
        englishText ??
          segments
            .map((seg) => seg.baseEnglish || '')
            .filter(Boolean)
            .join(' ')
      );

  const schemaName = `sutta_studio_weaver_${phaseId.replace(/-/g, '_')}`;
  const requestName = 'weaver';

  try {
    const prompt = buildWeaverPrompt(
      phaseId,
      segments,
      phaseState,
      anatomist,
      lexicographer,
      tokens
    );
    const llm = await llmCaller({
      settings,
      messages: [
        { role: 'system', content: 'Return JSON only.' },
        { role: 'user', content: prompt },
      ],
      signal,
      maxTokens,
      options: {
        schemaName,
        schema: weaverResponseSchema,
        structuredOutputs,
        meta: { stage: 'weaver', phaseId, requestName },
      },
    });
    const output = parseJsonResponse<WeaverPass>(llm.text);
    return { output, llm, requestName, schemaName, phaseId };
  } catch (e: any) {
    return {
      output: null,
      error: e?.message || String(e),
      requestName,
      schemaName,
      phaseId,
    };
  }
};

export const runTypesetterPass = async (params: {
  phaseId: string;
  workId: string;
  segments: CanonicalSegment[];
  anatomist: AnatomistPass;
  weaver: WeaverPass;
  settings: AppSettings;
  structuredOutputs: boolean;
  signal?: AbortSignal;
  llmCaller?: LLMCaller;
  maxTokens?: number;
  logger?: (message: string) => void;
}): Promise<PassCallResult<TypesetterPass>> => {
  const {
    phaseId,
    workId,
    segments,
    anatomist,
    weaver,
    settings,
    structuredOutputs,
    signal,
    llmCaller = defaultLLMCaller,
    maxTokens = 16000,  // High default for reasoning models
    logger,
  } = params;

  const phaseState = buildPhaseStateEnvelope({
    workId,
    phaseId,
    segments,
    currentStageLabel: 'Typesetter (4/4)',
    currentStageKey: 'typesetter',
    completed: { anatomist: true, lexicographer: true, weaver: true },
  });

  const schemaName = `sutta_studio_typesetter_${phaseId.replace(/-/g, '_')}`;
  const requestName = 'typesetter';

  try {
    const prompt = buildTypesetterPrompt(
      phaseId,
      phaseState,
      anatomist,
      weaver,
      segments,
      logger
    );
    const llm = await llmCaller({
      settings,
      messages: [
        { role: 'system', content: 'Return JSON only.' },
        { role: 'user', content: prompt },
      ],
      signal,
      maxTokens,
      options: {
        schemaName,
        schema: typesetterResponseSchema,
        structuredOutputs,
        meta: { stage: 'typesetter', phaseId, requestName },
      },
    });
    const output = parseJsonResponse<TypesetterPass>(llm.text);
    return { output, llm, requestName, schemaName, phaseId };
  } catch (e: any) {
    return {
      output: null,
      error: e?.message || String(e),
      requestName,
      schemaName,
      phaseId,
    };
  }
};

export const runMorphologyPass = async (params: {
  phaseId: string;
  segments: CanonicalSegment[];
  phaseView: PhaseView;
  settings: AppSettings;
  structuredOutputs: boolean;
  retrievalContext?: string;
  signal?: AbortSignal;
  llmCaller?: LLMCaller;
  maxTokens?: number;
}): Promise<PassCallResult<{ paliWords: Array<{ id: string; segments: PhaseView['paliWords'][number]['segments'] }> }>> => {
  const {
    phaseId,
    segments,
    phaseView,
    settings,
    structuredOutputs,
    retrievalContext,
    signal,
    llmCaller = defaultLLMCaller,
    maxTokens = 16000,  // High default for reasoning models
  } = params;

  const schemaName = `sutta_studio_morph_${phaseId.replace(/-/g, '_')}`;
  const requestName = 'morphology';

  try {
    const prompt = buildMorphologyPrompt(phaseId, phaseView, segments, retrievalContext);
    const llm = await llmCaller({
      settings,
      messages: [
        { role: 'system', content: 'Return JSON only.' },
        { role: 'user', content: prompt },
      ],
      signal,
      maxTokens,
      options: {
        schemaName,
        schema: morphResponseSchema,
        structuredOutputs,
        meta: { stage: 'morph', phaseId, requestName },
      },
    });
    const output = parseJsonResponse<{ paliWords: Array<{ id: string; segments: PhaseView['paliWords'][number]['segments'] }> }>(llm.text);
    return { output, llm, requestName, schemaName, phaseId };
  } catch (e: any) {
    return {
      output: null,
      error: e?.message || String(e),
      requestName,
      schemaName,
      phaseId,
    };
  }
};
