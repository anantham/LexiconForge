import { extractBalancedJson } from './ai/textUtils';
import { supportsStructuredOutputs } from './capabilityService';
import { dlog, dlogFull, aiDebugFullEnabled } from './ai/debug';
import type { AppSettings } from '../types';
import type { ChatMessage, ProviderName } from '../adapters/providers/Provider';
import { initializeProviders } from '../adapters/providers';
import { getProvider } from '../adapters/providers/registry';
import type {
  AnatomistPass,
  CanonicalSegment,
  DeepLoomPacket,
  LexicographerPass,
  PhaseView,
  SourceRef,
  WordSegment,
  WeaverPass,
  TypesetterPass,
} from '../types/suttaStudio';
import { PROXIES } from './adapters';
import { getAveragePhaseDuration, recordPhaseDuration } from './suttaStudioTelemetry';
import { buildRetrievalContext } from './suttaStudioRetrieval';
import { validatePacket, validatePhase } from './suttaStudioValidator';
import {
  SUTTA_STUDIO_ANATOMIST_EXAMPLE_JSON,
  SUTTA_STUDIO_LEXICO_EXAMPLE_JSON,
  SUTTA_STUDIO_PHASE_EXAMPLE_JSON,
  SUTTA_STUDIO_SKELETON_EXAMPLE_JSON,
  SUTTA_STUDIO_MORPH_EXAMPLE_JSON,
  SUTTA_STUDIO_WEAVER_EXAMPLE_JSON,
  SUTTA_STUDIO_TYPESETTER_EXAMPLE_JSON,
} from '../config/suttaStudioExamples';
import {
  SUTTA_STUDIO_BASE_CONTEXT,
  SUTTA_STUDIO_ANATOMIST_CONTEXT,
  SUTTA_STUDIO_LEXICO_CONTEXT,
  SUTTA_STUDIO_PHASE_CONTEXT,
  SUTTA_STUDIO_SKELETON_CONTEXT,
  SUTTA_STUDIO_MORPH_CONTEXT,
  SUTTA_STUDIO_WEAVER_CONTEXT,
  SUTTA_STUDIO_TYPESETTER_CONTEXT,
} from '../config/suttaStudioPromptContext';
import { logPipelineEvent } from './suttaStudioPipelineLog';
import { DictionaryCache } from './localDictionaryCache';
import {
  buildSegmentsMapFromAnatomist,
  rehydratePhase,
  dedupeEnglishStructure,
  buildDegradedPhaseView,
} from './suttaStudioRehydrator';
import {
  tokenizeEnglish,
  buildTokenListForPrompt,
  getWordTokens,
  type EnglishTokenInput,
} from './suttaStudioTokenizer';

const log = (message: string, ...args: any[]) =>
  console.log(`[SuttaStudioCompiler] ${message}`, ...args);
const warn = (message: string, ...args: any[]) =>
  console.warn(`[SuttaStudioCompiler] ${message}`, ...args);
const err = (message: string, ...args: any[]) =>
  console.error(`[SuttaStudioCompiler] ${message}`, ...args);

export const SUTTA_STUDIO_PROMPT_VERSION = 'sutta-studio-v9-tooltips';
const COMPILER_MIN_CALL_GAP_MS = 1000;

// DEBUG: Limit phases for testing (set to 0 for unlimited)
const DEBUG_PHASE_LIMIT = 8;
const DICTIONARY_LOOKUP_BASE = 'https://suttacentral.net/api/dictionaries/lookup?from=pali&to=en&q=';

const skeletonResponseSchema = {
  type: 'object',
  properties: {
    phases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          segmentIds: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['id', 'segmentIds'],
        additionalProperties: false,
      },
    },
  },
  required: ['phases'],
  additionalProperties: false,
};

const anatomistResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    words: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          surface: { type: 'string' },
          wordClass: { type: 'string', enum: ['content', 'function'] },
          segmentIds: { type: 'array', items: { type: 'string' } },
          isAnchor: { type: 'boolean' },
        },
        required: ['id', 'surface', 'wordClass', 'segmentIds'],
        additionalProperties: false,
      },
    },
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          wordId: { type: 'string' },
          text: { type: 'string' },
          type: { type: 'string', enum: ['root', 'suffix', 'prefix', 'stem'] },
          tooltips: { type: 'array', items: { type: 'string' } },
          morph: {
            type: 'object',
            properties: {
              case: { type: 'string', enum: ['gen', 'dat', 'loc', 'ins', 'acc', 'nom', 'voc'] },
              number: { type: 'string', enum: ['sg', 'pl'] },
              note: { type: 'string' },
            },
            additionalProperties: false,
          },
        },
        required: ['id', 'wordId', 'text', 'type'],
        additionalProperties: false,
      },
    },
    relations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          fromSegmentId: { type: 'string' },
          targetWordId: { type: 'string' },
          type: { type: 'string', enum: ['ownership', 'direction', 'location', 'action'] },
          label: { type: 'string' },
          status: { type: 'string', enum: ['confirmed', 'pending'] },
        },
        required: ['id', 'fromSegmentId', 'targetWordId', 'type', 'label'],
        additionalProperties: false,
      },
    },
    handoff: {
      type: 'object',
      properties: {
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        segmentationIssues: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  required: ['id', 'words', 'segments'],
  additionalProperties: false,
};

const lexicographerResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    senses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          wordId: { type: 'string' },
          wordClass: { type: 'string', enum: ['content', 'function'] },
          senses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                english: { type: 'string' },
                nuance: { type: 'string' },
                notes: { type: 'string' },
                citationIds: { type: 'array', items: { type: 'string' } },
                ripples: {
                  type: 'object',
                  additionalProperties: { type: 'string' },
                },
              },
              required: ['english', 'nuance'],
              additionalProperties: false,
            },
          },
        },
        required: ['wordId', 'wordClass', 'senses'],
        additionalProperties: false,
      },
    },
    handoff: {
      type: 'object',
      properties: {
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        missingDefinitions: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  required: ['id', 'senses'],
  additionalProperties: false,
};

const weaverResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    tokens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tokenIndex: { type: 'number' },
          text: { type: 'string' },
          linkedPaliId: { type: 'string' },
          isGhost: { type: 'boolean' },
          ghostKind: { type: 'string', enum: ['required', 'interpretive'] },
        },
        required: ['tokenIndex', 'text', 'isGhost'],
        additionalProperties: false,
      },
    },
    handoff: {
      type: 'object',
      properties: {
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        unmappedTokens: { type: 'array', items: { type: 'number' } },
        notes: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  required: ['id', 'tokens'],
  additionalProperties: false,
};

const typesetterResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    layoutBlocks: {
      type: 'array',
      items: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    handoff: {
      type: 'object',
      properties: {
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        notes: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  required: ['id', 'layoutBlocks'],
  additionalProperties: false,
};

const phaseResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    layoutBlocks: {
      type: 'array',
      items: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    paliWords: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          color: { type: 'string' },
          segments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                type: { type: 'string', enum: ['root', 'suffix', 'prefix', 'stem'] },
                tooltips: { type: 'array', items: { type: 'string' } },
                tooltip: { type: 'string' },
                tooltipsBySense: {
                  type: 'object',
                  additionalProperties: { type: 'string' },
                },
                relation: {
                  type: 'object',
                  properties: {
                    targetId: { type: 'string' },
                    type: { type: 'string', enum: ['ownership', 'direction', 'location', 'action'] },
                    label: { type: 'string' },
                    status: { type: 'string', enum: ['confirmed', 'pending'] },
                  },
                  required: ['targetId', 'type', 'label'],
                  additionalProperties: false,
                },
                morph: {
                  type: 'object',
                  properties: {
                    case: { type: 'string', enum: ['gen', 'dat', 'loc', 'ins', 'acc', 'nom', 'voc'] },
                    number: { type: 'string', enum: ['sg', 'pl'] },
                    note: { type: 'string' },
                  },
                  additionalProperties: false,
                },
              },
              required: ['text', 'type'],
              additionalProperties: false,
            },
          },
          senses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                english: { type: 'string' },
                nuance: { type: 'string' },
                notes: { type: 'string' },
                citationIds: { type: 'array', items: { type: 'string' } },
                ripples: {
                  type: 'object',
                  additionalProperties: { type: 'string' },
                },
              },
              required: ['english', 'nuance'],
              additionalProperties: false,
            },
          },
          isAnchor: { type: 'boolean' },
        },
        required: ['id', 'segments', 'senses'],
        additionalProperties: false,
      },
    },
    englishStructure: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          linkedPaliId: { type: 'string' },
          isGhost: { type: 'boolean' },
          ghostKind: { type: 'string', enum: ['required', 'interpretive'] },
        },
        required: ['id'],
        additionalProperties: false,
      },
    },
  },
  required: ['id', 'paliWords', 'englishStructure'],
  additionalProperties: false,
};

const morphResponseSchema = {
  type: 'object',
  properties: {
    paliWords: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          segments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                type: { type: 'string', enum: ['root', 'suffix', 'prefix', 'stem'] },
                tooltips: { type: 'array', items: { type: 'string' } },
                tooltip: { type: 'string' },
                tooltipsBySense: {
                  type: 'object',
                  additionalProperties: { type: 'string' },
                },
                relation: {
                  type: 'object',
                  properties: {
                    targetId: { type: 'string' },
                    type: { type: 'string', enum: ['ownership', 'direction', 'location', 'action'] },
                    label: { type: 'string' },
                    status: { type: 'string', enum: ['confirmed', 'pending'] },
                  },
                  required: ['targetId', 'type', 'label'],
                  additionalProperties: false,
                },
                morph: {
                  type: 'object',
                  properties: {
                    case: { type: 'string', enum: ['gen', 'dat', 'loc', 'ins', 'acc', 'nom', 'voc'] },
                    number: { type: 'string', enum: ['sg', 'pl'] },
                    note: { type: 'string' },
                  },
                  additionalProperties: false,
                },
              },
              required: ['text', 'type'],
              additionalProperties: false,
            },
          },
        },
        required: ['id', 'segments'],
        additionalProperties: false,
      },
    },
  },
  required: ['paliWords'],
  additionalProperties: false,
};

const stripCodeFences = (text: string): string => {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
};

const parseJsonResponse = <T>(raw: string): T => {
  const cleaned = stripCodeFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    const balanced = extractBalancedJson(cleaned);
    return JSON.parse(balanced) as T;
  }
};

type PhaseStageKey = 'anatomist' | 'lexicographer' | 'weaver' | 'typesetter';

const buildPhaseStateEnvelope = (params: {
  workId: string;
  phaseId: string;
  segments: CanonicalSegment[];
  currentStageLabel: string;
  currentStageKey?: PhaseStageKey;
  completed?: Partial<Record<PhaseStageKey, boolean>>;
}) => {
  const { workId, phaseId, segments, currentStageLabel, currentStageKey, completed } = params;
  const start = segments[0]?.ref.segmentId ?? 'n/a';
  const end = segments[segments.length - 1]?.ref.segmentId ?? start;
  const stages: Array<{ key: PhaseStageKey; label: string }> = [
    { key: 'anatomist', label: 'Anatomist' },
    { key: 'lexicographer', label: 'Lexicographer' },
    { key: 'weaver', label: 'Weaver' },
    { key: 'typesetter', label: 'Typesetter' },
  ];
  const statusLines = stages.map((stage) => {
    const done = Boolean(completed?.[stage.key]);
    const inProgress = !done && currentStageKey === stage.key;
    const stateLabel = done ? 'complete' : inProgress ? 'IN PROGRESS' : 'pending';
    return `${done ? '[x]' : '[ ]'} ${stage.label}: ${stateLabel}`;
  });

  return [
    '=== PHASE STATE (READ ONLY) ===',
    `• Work: ${workId}`,
    `• Phase: ${phaseId}`,
    `• Segments: ${start} — ${end}`,
    `• Current Stage: ${currentStageLabel}`,
    '',
    'STATUS CHECK:',
    ...statusLines,
    '',
    'INVARIANTS:',
    '1) Do NOT add/remove Pali IDs (p1, p2...).',
    '2) Segment texts must concatenate to the surface text exactly.',
    '3) Preserve source word order and spelling (no normalization).',
    '===============================',
  ].join('\n');
};

// buildAnatomistSegmentsMap moved to suttaStudioRehydrator.ts as buildSegmentsMapFromAnatomist

// dedupeEnglishStructure moved to suttaStudioRehydrator.ts

const getTimeoutSignal = (ms: number, external?: AbortSignal): AbortSignal | undefined => {
  if (external && typeof AbortSignal !== 'undefined' && 'any' in AbortSignal) {
    return AbortSignal.any([external, AbortSignal.timeout(ms)]);
  }
  if (external) return external;
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(ms);
  }
  return undefined;
};

const waitFor = (ms: number, signal?: AbortSignal): Promise<void> => {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new Error('Compiler throttle aborted.'));
    };
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new Error('Compiler throttle aborted.'));
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
};

const createCompilerThrottle = (minGapMs: number) => {
  let nextAllowedAt = 0;
  return async (signal?: AbortSignal) => {
    if (!minGapMs || minGapMs <= 0) return;
    const now = Date.now();
    const waitMs = Math.max(0, nextAllowedAt - now);
    if (waitMs > 0) {
      dlog('[SuttaStudioCompiler] Throttling compiler calls', { waitMs });
      await waitFor(waitMs, signal);
    }
    nextAllowedAt = Date.now() + minGapMs;
  };
};

const dictionaryCache = new Map<string, unknown>();

const normalizeDictionaryQuery = (surface: string): string => {
  return surface.trim().replace(/^[\s"'`.,;:!?()]+|[\s"'`.,;:!?()]+$/g, '');
};

const fetchDictionaryEntry = async (params: {
  surface: string;
  wordId: string;
  phaseId: string;
  signal?: AbortSignal;
  throttle?: (signal?: AbortSignal) => Promise<void>;
}): Promise<unknown | null> => {
  const { surface, wordId, phaseId, signal, throttle } = params;
  const query = normalizeDictionaryQuery(surface);
  if (!query) {
    logPipelineEvent({
      level: 'warn',
      stage: 'lexicographer',
      phaseId,
      message: 'dictionary.skip',
      data: { wordId, surface, reason: 'empty_query' },
    });
    return null;
  }
  if (dictionaryCache.has(query)) {
    logPipelineEvent({
      level: 'info',
      stage: 'lexicographer',
      phaseId,
      message: 'dictionary.cache_hit',
      data: { wordId, surface, query },
    });
    return dictionaryCache.get(query) ?? null;
  }
  const url = `${DICTIONARY_LOOKUP_BASE}${encodeURIComponent(query)}`;
  logPipelineEvent({
    level: 'info',
    stage: 'lexicographer',
    phaseId,
    message: 'dictionary.request',
    data: { wordId, surface, query, url },
  });
  try {
    await throttle?.(signal);
    const response = await fetchJsonViaProxies(url, signal);
    dictionaryCache.set(query, response);
    logPipelineEvent({
      level: 'info',
      stage: 'lexicographer',
      phaseId,
      message: 'dictionary.response',
      data: { wordId, surface, query, response },
    });
    return response;
  } catch (e: any) {
    logPipelineEvent({
      level: 'warn',
      stage: 'lexicographer',
      phaseId,
      message: 'dictionary.error',
      data: { wordId, surface, query, error: e?.message || String(e) },
    });
    return null;
  }
};

const fetchJsonViaProxies = async (url: string, signal?: AbortSignal): Promise<any> => {
  const timeoutMs = 12000;
  const errors: string[] = [];

  // Try direct fetch FIRST (SuttaCentral allows CORS from localhost)
  try {
    log(`Direct fetch: ${url}`);
    const resp = await fetch(url, { signal: getTimeoutSignal(timeoutMs, signal) });
    if (!resp.ok) throw new Error(`Direct fetch responded ${resp.status}`);
    const text = await resp.text();
    return JSON.parse(text);
  } catch (e: any) {
    const msg = e?.message || String(e);
    errors.push(`Direct: ${msg}`);
    warn(`Direct fetch failed for ${url}: ${msg}, trying proxies...`);
  }

  // Fall back to proxies if direct fails
  for (const proxy of PROXIES) {
    let fetchUrl = proxy.type === 'param'
      ? `${proxy.url}${encodeURIComponent(url)}`
      : `${proxy.url}${url}`;

    try {
      const proxyName = new URL(proxy.url).hostname;
      log(`Proxy fetch via ${proxyName}: ${url}`);
      const resp = await fetch(fetchUrl, { signal: getTimeoutSignal(timeoutMs, signal) });
      if (!resp.ok) {
        throw new Error(`Proxy ${proxyName} responded ${resp.status}`);
      }

      if (proxy.responseFormat === 'json') {
        const json = await resp.json();
        const payload = proxy.contentKey && json && typeof json === 'object'
          ? json[proxy.contentKey]
          : json;

        if (typeof payload === 'string') {
          try {
            return JSON.parse(payload);
          } catch (e) {
            throw new Error(`Proxy ${proxyName} returned non-JSON payload string`);
          }
        }
        return payload;
      }

      const text = await resp.text();
      return JSON.parse(text);
    } catch (e: any) {
      const msg = e?.message || String(e);
      errors.push(msg);
      warn(`Proxy failed for ${url}: ${msg}`);
      continue;
    }
  }

  throw new Error(`All fetch attempts failed for ${url}. Errors: ${errors.join(' | ')}`);
};

const buildCanonicalSegments = (
  uid: string,
  rootText: Record<string, string>,
  translationText: Record<string, string>
): CanonicalSegment[] => {
  const keys = Object.keys(rootText).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  return keys.map((key, order) => ({
    ref: {
      provider: 'suttacentral',
      workId: uid,
      segmentId: key,
    },
    order,
    pali: rootText[key],
    baseEnglish: translationText[key] || undefined,
  }));
};

const fetchCanonicalSegmentsForUid = async (
  uid: string,
  author: string,
  signal?: AbortSignal
): Promise<CanonicalSegment[]> => {
  const bilaraUrl = `https://suttacentral.net/api/bilarasuttas/${uid}/${author}`;
  const plexUrl = `https://suttacentral.net/api/suttaplex/${uid}`;

  const [bilaraJson] = await Promise.all([
    fetchJsonViaProxies(bilaraUrl, signal),
    fetchJsonViaProxies(plexUrl, signal).catch((e) => {
      warn('Suttaplex fetch failed, continuing without metadata.', e);
      return null;
    }),
  ]);

  if (!bilaraJson?.root_text) {
    throw new Error(`Bilara API did not return root_text for ${uid}.`);
  }

  const rootText = bilaraJson.root_text as Record<string, string>;
  const translationText = (bilaraJson.translation_text || {}) as Record<string, string>;
  return buildCanonicalSegments(uid, rootText, translationText);
};

type SkeletonPhase = { id: string; title?: string; segmentIds: string[] };

const chunkPhases = (
  segments: CanonicalSegment[],
  size = 8,
  boundaryStarts?: Set<string>
) => {
  const phases: Array<{ id: string; title?: string; segmentIds: string[] }> = [];
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

const runSkeletonPass = async ({
  segments,
  boundaries,
  allowCrossChapter,
  settings,
  structuredOutputs,
  signal,
  throttle,
  chunkSize = 50,
}: {
  segments: CanonicalSegment[];
  boundaries: BoundaryNote[];
  allowCrossChapter?: boolean;
  settings: AppSettings;
  structuredOutputs: boolean;
  signal?: AbortSignal;
  throttle?: (signal?: AbortSignal) => Promise<void>;
  chunkSize?: number;
}): Promise<SkeletonPhase[]> => {
  const phases: SkeletonPhase[] = [];
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

    try {
      log(`Running skeleton pass (chunk ${chunkIndex + 1}/${chunkCount}, ${chunkSegments.length} segments)...`);
      const skeletonPrompt = buildSkeletonPrompt(chunkSegments, {
        exampleSegmentId: chunkSegments[0]?.ref.segmentId,
        boundaries: chunkBoundaries,
        allowCrossChapter: Boolean(allowCrossChapter),
      });
      await throttle?.(signal);
      const raw = await callCompilerLLM(
        settings,
        [
          { role: 'system', content: 'Return JSON only.' },
          { role: 'user', content: skeletonPrompt },
        ],
        signal,
        4000,
        {
          schemaName: `sutta_studio_skeleton_${chunkIndex + 1}`,
          schema: skeletonResponseSchema,
          structuredOutputs,
          meta: {
            stage: 'skeleton',
            phaseId: `chunk-${chunkIndex + 1}`,
            requestName: 'skeleton',
          },
        }
      );
      const parsed = parseJsonResponse<{ phases?: SkeletonPhase[] }>(raw);
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
    } catch (e) {
      warn(`Skeleton chunk ${chunkIndex + 1}/${chunkCount} failed; falling back to chunked phases.`, e);
      phases.push(...chunkPhases(chunkSegments, 8, fallbackBoundaryStarts));
    }
  }

  return phases.map((phase, index) => ({
    ...phase,
    id: `phase-${index + 1}`,
  }));
};

const buildSourceRefs = (
  segmentIds: string[],
  segmentIdToWorkId: Map<string, string>,
  fallbackWorkId: string
): SourceRef[] =>
  segmentIds.map((id) => ({
    provider: 'suttacentral',
    workId: segmentIdToWorkId.get(id) || fallbackWorkId,
    segmentId: id,
  }));

const computeSourceDigest = (segments: CanonicalSegment[]): string => {
  const text = segments.map((seg) => seg.pali).join('\n');
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

type BoundaryNote = {
  workId: string;
  startSegmentId: string;
  afterSegmentId?: string;
};

const buildBoundaryContext = (boundaries: BoundaryNote[], allowCrossChapter: boolean) => {
  if (!boundaries.length) return '';
  const lines = boundaries
    .map((b) =>
      b.afterSegmentId
        ? `- ${b.workId} begins at ${b.startSegmentId} (after ${b.afterSegmentId})`
        : `- ${b.workId} begins at ${b.startSegmentId}`
    )
    .join('\n');
  const rule = allowCrossChapter
    ? 'Boundary map provided (cross-chapter phases are allowed).'
    : 'Boundary map provided: do not place segments from different works in the same phase.';
  return `\n${rule}\n${lines}\n`;
};

const resolveCompilerProvider = async (
  settings: AppSettings
): Promise<{ provider: { chatJSON: (input: any) => Promise<{ text: string; raw?: unknown }> }; settings: AppSettings }> => {
  await initializeProviders();
  const providerName = settings.provider === 'OpenAI' ? 'OpenRouter' : settings.provider;
  let provider;
  try {
    provider = getProvider(providerName as ProviderName);
  } catch (e) {
    warn(`Provider ${providerName} not registered for compiler; falling back to OpenRouter.`);
    provider = getProvider('OpenRouter');
  }

  const effectiveSettings =
    providerName === settings.provider
      ? settings
      : { ...settings, provider: providerName as AppSettings['provider'] };

  return { provider, settings: effectiveSettings };
};

const callCompilerLLM = async (
  settings: AppSettings,
  messages: ChatMessage[],
  signal?: AbortSignal,
  maxTokens = 4000,
  options?: {
    schemaName?: string;
    schema?: any;
    structuredOutputs?: boolean;
    meta?: { stage?: string; phaseId?: string; requestName?: string };
  }
): Promise<string> => {
  const { provider, settings: effectiveSettings } = await resolveCompilerProvider(settings);

  dlog('[SuttaStudioCompiler] LLM request params', {
    provider: effectiveSettings.provider,
    model: effectiveSettings.model,
    maxTokens,
    structuredOutputs: !!options?.schema && !!options?.structuredOutputs,
  });
  logPipelineEvent({
    level: 'info',
    stage: options?.meta?.stage,
    phaseId: options?.meta?.phaseId,
    message: 'llm.request',
    data: {
      requestName: options?.meta?.requestName,
      schemaName: options?.schemaName,
      provider: effectiveSettings.provider,
      model: effectiveSettings.model,
      maxTokens,
      messages,
    },
  });

  const start = performance.now();
  let response: { text: string; raw?: unknown };
  try {
    response = await provider.chatJSON({
      settings: effectiveSettings,
      messages,
      temperature: 0.2,
      maxTokens,
      schema: options?.schema,
      schemaName: options?.schemaName,
      structuredOutputs: options?.structuredOutputs,
      abortSignal: signal,
      apiType: 'sutta_studio',
    });
  } catch (e: any) {
    logPipelineEvent({
      level: 'error',
      stage: options?.meta?.stage,
      phaseId: options?.meta?.phaseId,
      message: 'llm.error',
      data: {
        requestName: options?.meta?.requestName,
        schemaName: options?.schemaName,
        provider: effectiveSettings.provider,
        model: effectiveSettings.model,
        error: e?.message || String(e),
      },
    });
    throw e;
  }
  const durationMs = Math.max(0, Math.round(performance.now() - start));

  if (aiDebugFullEnabled()) {
    dlogFull('[SuttaStudioCompiler] Full response body:', JSON.stringify(response.raw ?? response, null, 2));
  }
  logPipelineEvent({
    level: 'info',
    stage: options?.meta?.stage,
    phaseId: options?.meta?.phaseId,
    message: 'llm.response',
    data: {
      requestName: options?.meta?.requestName,
      schemaName: options?.schemaName,
      durationMs,
      text: response.text,
      raw: response.raw ?? null,
    },
  });

  const content = response.text || '';
  if (!content.trim()) throw new Error('Empty compiler response.');
  return content;
};

const buildSkeletonPrompt = (
  segments: CanonicalSegment[],
  options: { exampleSegmentId?: string; boundaries?: BoundaryNote[]; allowCrossChapter?: boolean }
) => {
  const lines = segments.map((seg) => {
    const english = seg.baseEnglish ? ` | english: ${seg.baseEnglish}` : '';
    return `${seg.ref.segmentId} | pali: ${seg.pali}${english}`;
  });
  const exampleSegment = options.exampleSegmentId || segments[0]?.ref.segmentId || 'mn1:1.1';
  const examplePrefix = exampleSegment.split(':')[0] || 'mn1';
  const boundaryContext = options.boundaries
    ? buildBoundaryContext(options.boundaries, Boolean(options.allowCrossChapter))
    : '';

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_SKELETON_CONTEXT}\n${boundaryContext}\nTask: Group the following SuttaCentral segments into SMALL study phases.\n\nCRITICAL RULES:\n- MAXIMUM 8 Pali words per phase (count space-separated tokens).\n- Typical phase: 1-3 segments only.\n- Title/header segments get their own phase.\n- Opening formulas get their own phase.\n- Each segment must appear exactly once.\n- Keep the original order.\n\nReturn JSON ONLY with this shape:\n{\n  "phases": [\n    { "id": "phase-1", "title": "<short title or empty>", "segmentIds": ["${examplePrefix}:1.1", "${examplePrefix}:1.2"] }\n  ]\n}\n\nEXAMPLE (do NOT copy ids):\n${SUTTA_STUDIO_SKELETON_EXAMPLE_JSON}\n\nSegments:\n${lines.join('\n')}`;
};

const buildAnatomistPrompt = (
  phaseId: string,
  segments: CanonicalSegment[],
  phaseState: string,
  retrievalContext?: string
) => {
  const lines = segments.map((seg) =>
    `${seg.ref.segmentId} | pali: ${seg.pali}${seg.baseEnglish ? ` | english: ${seg.baseEnglish}` : ''}`
  );
  const retrievalBlock = retrievalContext
    ? `\nReference context (adjacent segments; use to disambiguate, do not copy):\n${retrievalContext}\n`
    : '';

  // Count approximate words for the prompt
  const paliText = segments.map((seg) => seg.pali).join(' ');
  const approxWordCount = paliText.split(/\s+/).filter(Boolean).length;

  return `You are DeepLoomCompiler.

${SUTTA_STUDIO_BASE_CONTEXT}

${SUTTA_STUDIO_ANATOMIST_CONTEXT}

${phaseState}

Task: Build the Anatomist JSON for the segment list below.

CRITICAL WORD BOUNDARY RULE:
- Each SPACE-SEPARATED Pali token = ONE word entry.
- Example: "Evaṁ me sutaṁ" has 3 words: p1="Evaṁ", p2="me", p3="sutaṁ"
- NEVER combine multiple space-separated tokens into one word.
- Expected word count for this input: approximately ${approxWordCount} words.

Rules:
- Output JSON ONLY.
- Use the exact phase id: ${phaseId}.
- Create word IDs p1, p2, ... in surface order (one per space-separated token).
- Create segment IDs as <wordId>s1, <wordId>s2, ... and list them in word.segmentIds in order.
- Ensure concatenation of segment texts equals word.surface exactly.
- Do NOT add English senses or tokens.
- REQUIRED: For each segment, add tooltips array with 1-3 short etymology/function hints:
  - For roots: "√root: meaning" (e.g., "√bhikkh: To share / beg")
  - For suffixes: "Function: description" (e.g., "Function: Marks the Group/Owner")
  - For prefixes: "Prefix meaning" (e.g., "vi-: Intensive / Apart")
  - For stems: "Word: meaning" (e.g., "Evaṁ: Thus / In this way")

Return JSON ONLY with this shape:
{
  "id": "phase-1",
  "words": [
    { "id": "p1", "surface": "Evaṁ", "wordClass": "function", "segmentIds": ["p1s1"] }
  ],
  "segments": [
    { "id": "p1s1", "wordId": "p1", "text": "Evaṁ", "type": "stem", "tooltips": ["Evaṁ: Thus / In this way"] }
  ],
  "relations": [
    { "id": "r1", "fromSegmentId": "p2s1", "targetWordId": "p3", "type": "action", "label": "Agent", "status": "confirmed" }
  ],
  "handoff": { "confidence": "medium", "segmentationIssues": [], "notes": "" }
}

EXAMPLE (do NOT copy ids):
${SUTTA_STUDIO_ANATOMIST_EXAMPLE_JSON}
${retrievalBlock}
Segments:
${lines.join('\n')}`;
};

const buildLexicographerPrompt = (
  phaseId: string,
  segments: CanonicalSegment[],
  phaseState: string,
  anatomist: AnatomistPass,
  dictionaryEntries: Record<string, unknown | null>,
  retrievalContext?: string
) => {
  const segmentLines = segments.map((seg) =>
    `${seg.ref.segmentId} | pali: ${seg.pali}${seg.baseEnglish ? ` | english: ${seg.baseEnglish}` : ''}`
  );
  const retrievalBlock = retrievalContext
    ? `\nReference context (adjacent segments; use to disambiguate, do not copy):\n${retrievalContext}\n`
    : '';
  const wordsList = anatomist.words
    .map((word) => {
      const segments = word.segmentIds
        .map((id) => anatomist.segments.find((seg) => seg.id === id)?.text ?? '')
        .join('');
      return `${word.id} | ${word.surface} | ${word.wordClass} | segments: ${segments}`;
    })
    .join('\n');
  const dictionaryBlock = Object.entries(dictionaryEntries)
    .map(([wordId, entry]) => `- ${wordId}: ${JSON.stringify(entry)}`)
    .join('\n');

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_LEXICO_CONTEXT}\n\n${phaseState}\n\nTask: Build the Lexicographer JSON for the words below.\n\nRules:\n- Output JSON ONLY.\n- Use the exact phase id: ${phaseId}.\n- Provide senses for every wordId listed.\n- Content words must have exactly 3 senses. Function words must have 1-2 senses.\n- If dictionary data is present, use it to ground meanings; do not invent etymology.\n\nReturn JSON ONLY with this shape:\n{\n  "id": "phase-1",\n  "senses": [\n    {\n      "wordId": "p1",\n      "wordClass": "function",\n      "senses": [\n        { "english": "Thus", "nuance": "narrative opener" }\n      ]\n    }\n  ],\n  "handoff": { "confidence": "medium", "missingDefinitions": [], "notes": "" }\n}\n\nEXAMPLE (do NOT copy ids):\n${SUTTA_STUDIO_LEXICO_EXAMPLE_JSON}\n\nWords:\n${wordsList}\n\nDictionary entries (raw; do not copy verbatim):\n${dictionaryBlock || '(none)'}\n${retrievalBlock}\nSegment context:\n${segmentLines.join('\n')}`;
};

const buildWeaverPrompt = (
  phaseId: string,
  segments: CanonicalSegment[],
  phaseState: string,
  anatomist: AnatomistPass,
  lexicographer: LexicographerPass,
  englishTokens: EnglishTokenInput[]
) => {
  // Build Pali words list with senses for context
  const sensesMap = new Map(lexicographer.senses.map((e) => [e.wordId, e.senses]));
  const wordsList = anatomist.words
    .map((word) => {
      const senses = sensesMap.get(word.id) || [];
      const sensesStr = senses.map((s) => s.english).join(' / ') || '(no senses)';
      return `${word.id} | ${word.surface} | senses: ${sensesStr}`;
    })
    .join('\n');

  // Build tokenized English list (word tokens only, with indices)
  const tokenList = buildTokenListForPrompt(englishTokens);

  // Build English sentence for context
  const englishText = segments
    .map((seg) => seg.baseEnglish || '')
    .filter(Boolean)
    .join(' ');

  return `You are DeepLoomCompiler.

${SUTTA_STUDIO_BASE_CONTEXT}

${SUTTA_STUDIO_WEAVER_CONTEXT}

${phaseState}

Task: Map the English tokens below to Pali word IDs.

Rules:
- Output JSON ONLY.
- Use the exact phase id: ${phaseId}.
- For each word token (not whitespace/punctuation), provide a mapping.
- If a token maps to a Pali word, set linkedPaliId and isGhost: false.
- If a token is English scaffolding (articles, verb helpers, prepositions), set isGhost: true and ghostKind.
- Do NOT reword or change the token text.

Return JSON ONLY with this shape:
{
  "id": "phase-1",
  "tokens": [
    { "tokenIndex": 0, "text": "Thus", "linkedPaliId": "p1", "isGhost": false },
    { "tokenIndex": 2, "text": "have", "isGhost": true, "ghostKind": "required" }
  ],
  "handoff": { "confidence": "high", "notes": "" }
}

EXAMPLE (do NOT copy):
${SUTTA_STUDIO_WEAVER_EXAMPLE_JSON}

English sentence: "${englishText}"

Tokenized English (index:text):
${tokenList}

Pali words (id | surface | senses):
${wordsList}`;
};

const buildTypesetterPrompt = (
  phaseId: string,
  phaseState: string,
  anatomist: AnatomistPass,
  weaver: WeaverPass
) => {
  // Build word list with relations
  const wordsList = anatomist.words
    .map((word) => {
      const relations = (anatomist.relations || [])
        .filter((r) => anatomist.segments.some((s) => s.wordId === word.id && s.id === r.fromSegmentId))
        .map((r) => `→${r.targetWordId} (${r.type})`)
        .join(', ');
      return `${word.id} | ${word.surface}${relations ? ` | relations: ${relations}` : ''}`;
    })
    .join('\n');

  // Build English token order from Weaver (non-ghost tokens linked to Pali)
  const englishOrder = weaver.tokens
    .filter((t) => !t.isGhost && t.linkedPaliId)
    .map((t) => t.linkedPaliId)
    .join(' → ');

  return `You are DeepLoomCompiler.

${SUTTA_STUDIO_BASE_CONTEXT}

${SUTTA_STUDIO_TYPESETTER_CONTEXT}

${phaseState}

Task: Arrange the Pali words into layout blocks.

Rules:
- Output JSON ONLY.
- Use the exact phase id: ${phaseId}.
- Each block should have at most 5 word IDs.
- Order blocks to minimize crossing lines between related words.
- Consider the English token order as a guide for reading flow.
- If words are related (e.g., genitive modifier + head noun), keep them in the same or adjacent blocks.

Return JSON ONLY with this shape:
{
  "id": "phase-1",
  "layoutBlocks": [["p1", "p2"], ["p3", "p4", "p5"]],
  "handoff": { "confidence": "high", "notes": "" }
}

EXAMPLE (do NOT copy):
${SUTTA_STUDIO_TYPESETTER_EXAMPLE_JSON}

Pali words (id | surface | relations):
${wordsList}

English reading order (Pali IDs):
${englishOrder || '(no mapping available)'}`;
};

const buildPhasePrompt = (
  phaseId: string,
  segments: CanonicalSegment[],
  studyDefaults: { ghostOpacity: number; englishVisible: boolean; studyToggleDefault: boolean },
  retrievalContext?: string,
  options?: { anatomist?: AnatomistPass; lexicographer?: LexicographerPass; phaseState?: string }
) => {
  const lines = segments.map((seg) =>
    `${seg.ref.segmentId} | pali: ${seg.pali}${seg.baseEnglish ? ` | english: ${seg.baseEnglish}` : ''}`
  );
  const phaseStateBlock = options?.phaseState ? `\n${options.phaseState}\n` : '';
  const anatomistBlock = options?.anatomist
    ? `\nAnatomist output (READ ONLY; do not change ids or segmentation):\n${JSON.stringify(
        options.anatomist,
        null,
        2
      )}\n\nConstraints:\n- Use exactly these word IDs, surfaces, and segment breakdowns.\n- Only add senses, englishStructure, and layoutBlocks.\n`
    : '';
  const lexicographerBlock = options?.lexicographer
    ? `\nLexicographer output (READ ONLY; use these senses exactly):\n${JSON.stringify(
        options.lexicographer,
        null,
        2
      )}\n\nConstraints:\n- Do NOT invent new senses.\n- Apply senses to the matching word IDs.\n`
    : '';
  const retrievalBlock = retrievalContext
    ? `\nReference context (adjacent segments; use to disambiguate, do not copy):\n${retrievalContext}\n`
    : '';

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_PHASE_CONTEXT}\n${phaseStateBlock}${anatomistBlock}${lexicographerBlock}\nTask: Build a PhaseView JSON for the segment list below.\n\nRules:\n- Output JSON ONLY.\n- Use the exact phase id: ${phaseId}.\n- Create paliWords with segments (type: root|suffix|prefix|stem). If unsure, use a single segment with type "stem".\n- Provide at least 1 sense per word; if possible, give 2-3 senses with short nuance labels.\n- englishStructure should be an ordered token list that maps to pali words (linkedPaliId) and includes ghost tokens for English glue (isGhost true, ghostKind required).\n- Keep it minimal and readable.\n- Avoid markdown or extra commentary.\n\nEXAMPLE (do NOT copy ids):\n${SUTTA_STUDIO_PHASE_EXAMPLE_JSON}\n\nRender defaults for context: ghostOpacity=${studyDefaults.ghostOpacity}, englishVisible=${studyDefaults.englishVisible}, studyToggleDefault=${studyDefaults.studyToggleDefault}.${retrievalBlock}\nSegments:\n${lines.join('\n')}`;
};

const buildMorphologyPrompt = (
  phaseId: string,
  phaseView: PhaseView,
  segments: CanonicalSegment[],
  retrievalContext?: string
) => {
  const segmentLines = segments.map((seg) =>
    `${seg.ref.segmentId} | pali: ${seg.pali}${seg.baseEnglish ? ` | english: ${seg.baseEnglish}` : ''}`
  );
  const retrievalBlock = retrievalContext
    ? `\nReference context (adjacent segments; use to disambiguate, do not copy):\n${retrievalContext}\n`
    : '';
  const words = phaseView.paliWords
    .map((word) => {
      const text = word.segments.map((s) => s.text).join('');
      return `${word.id} | ${text}`;
    })
    .join('\n');

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_MORPH_CONTEXT}\n\nTask: For each word below, return updated segments with morphology hints.\n\nRules:\n- Output JSON ONLY.\n- Return ONLY { "paliWords": [ { "id": "...", "segments": [...] } ] }.\n- Do NOT add senses or englishStructure.\n- Keep segment text in the original order.\n\nEXAMPLE (do NOT copy ids):\n${SUTTA_STUDIO_MORPH_EXAMPLE_JSON}\n\nPhase: ${phaseId}\n${retrievalBlock}\nSegment context:\n${segmentLines.join('\n')}\n\nWords:\n${words}`;
};

export type CompileProgress = {
  packet: DeepLoomPacket;
  stage: 'init' | 'skeleton' | 'phase' | 'complete' | 'error';
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
    data: {
      uidKey,
      lang,
      author,
      model: settings.model,
      provider: settings.provider,
      structuredOutputs,
    },
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

  const renderDefaults = {
    ghostOpacity: 0.3,
    englishVisible: true,
    studyToggleDefault: true,
  };

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
  const seededAvgPhaseMs = getAveragePhaseDuration(uidKey) ?? undefined;
  const seededEtaMs =
    seededAvgPhaseMs && phaseSkeleton.length > 0
      ? seededAvgPhaseMs * phaseSkeleton.length
      : undefined;
  packet = {
    ...packet,
    progress: {
      totalPhases: phaseSkeleton.length,
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
    data: { phaseCount: phaseSkeleton.length },
  });

  const phaseLimit = DEBUG_PHASE_LIMIT > 0 ? Math.min(DEBUG_PHASE_LIMIT, phaseSkeleton.length) : phaseSkeleton.length;
  if (DEBUG_PHASE_LIMIT > 0) {
    log(`DEBUG MODE: Limiting to ${phaseLimit} phases (set DEBUG_PHASE_LIMIT=0 for full compilation)`);
  }

  for (let i = 0; i < phaseLimit; i++) {
    const phase = phaseSkeleton[i];
    const segmentSet = new Set(phase.segmentIds);
    const phaseSegments = canonicalWithOrder.filter((seg) => segmentSet.has(seg.ref.segmentId));

    try {
      log(`Compiling ${phase.id} (${i + 1}/${phaseSkeleton.length})...`);
      const phaseStart = performance.now();
      const retrievalContext = buildRetrievalContext({
        canonicalSegments: canonicalWithOrder,
        phaseSegments,
        allowCrossChapter: Boolean(allowCrossChapter),
      });
      let anatomistOutput: AnatomistPass | null = null;
      let lexicographerOutput: LexicographerPass | null = null;
      try {
        log(`Anatomist pass for ${phase.id}...`);
        const phaseState = buildPhaseStateEnvelope({
          workId: uidKey,
          phaseId: phase.id,
          segments: phaseSegments,
          currentStageLabel: 'Anatomist (1/4)',
          currentStageKey: 'anatomist',
          completed: {},
        });
        const anatomistPrompt = buildAnatomistPrompt(
          phase.id,
          phaseSegments,
          phaseState,
          retrievalContext || undefined
        );
        await throttle(signal);
        const anatomistRaw = await callCompilerLLM(
          settings,
          [
            { role: 'system', content: 'Return JSON only.' },
            { role: 'user', content: anatomistPrompt },
          ],
          signal,
          8000,
          {
            schemaName: `sutta_studio_anatomist_${phase.id}`,
            schema: anatomistResponseSchema,
            structuredOutputs,
            meta: { stage: 'anatomist', phaseId: phase.id, requestName: 'anatomist' },
          }
        );
        anatomistOutput = parseJsonResponse<AnatomistPass>(anatomistRaw);
        logPipelineEvent({
          level: 'info',
          stage: 'anatomist',
          phaseId: phase.id,
          message: 'anatomist.complete',
          data: { wordCount: anatomistOutput.words.length, segmentCount: anatomistOutput.segments.length },
        });
      } catch (e) {
        warn(`Anatomist pass failed for ${phase.id}; continuing without it.`, e);
        logPipelineEvent({
          level: 'warn',
          stage: 'anatomist',
          phaseId: phase.id,
          message: 'anatomist.failed',
          data: { error: e instanceof Error ? e.message : String(e) },
        });
      }

      if (anatomistOutput) {
        try {
          const contentWords = anatomistOutput.words.filter((word) => word.wordClass === 'content');
          const lexStart = performance.now();

          // Check cache first, identify misses
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

          // Fetch cache misses in parallel
          if (cacheMisses.length > 0) {
            const fetchPromises = cacheMisses.map(async (word) => {
              try {
                const result = await fetchDictionaryEntry({
                  surface: word.surface,
                  wordId: word.id,
                  phaseId: phase.id,
                  signal,
                  // No throttle for parallel - we want speed
                });
                return { word, result };
              } catch (e) {
                return { word, result: null };
              }
            });

            const results = await Promise.all(fetchPromises);

            // Store results in cache and dictionaryEntries
            const newEntries: Array<{ word: string; definition: unknown | null }> = [];
            for (const { word, result } of results) {
              dictionaryEntries[word.id] = result;
              newEntries.push({ word: word.surface, definition: result });
            }

            // Batch persist to cache
            await DictionaryCache.setMany(newEntries);
          }

          const dictMs = Math.round(performance.now() - lexStart);
          log(`  Dictionary done: ${cacheHits} cached + ${cacheMisses.length} fetched = ${dictMs}ms. Calling LLM...`);

          const phaseState = buildPhaseStateEnvelope({
            workId: uidKey,
            phaseId: phase.id,
            segments: phaseSegments,
            currentStageLabel: 'Lexicographer (2/4)',
            currentStageKey: 'lexicographer',
            completed: { anatomist: true },
          });
          const lexicographerPrompt = buildLexicographerPrompt(
            phase.id,
            phaseSegments,
            phaseState,
            anatomistOutput,
            dictionaryEntries,
            retrievalContext || undefined
          );
          await throttle(signal);
          const llmStart = performance.now();
          const lexRaw = await callCompilerLLM(
            settings,
            [
              { role: 'system', content: 'Return JSON only.' },
              { role: 'user', content: lexicographerPrompt },
            ],
            signal,
            8000,
            {
              schemaName: `sutta_studio_lexico_${phase.id}`,
              schema: lexicographerResponseSchema,
              structuredOutputs,
              meta: { stage: 'lexicographer', phaseId: phase.id, requestName: 'lexicographer' },
            }
          );
          lexicographerOutput = parseJsonResponse<LexicographerPass>(lexRaw);
          logPipelineEvent({
            level: 'info',
            stage: 'lexicographer',
            phaseId: phase.id,
            message: 'lexicographer.complete',
            data: { senseEntries: lexicographerOutput.senses.length },
          });
        } catch (e) {
          warn(`Lexicographer pass failed for ${phase.id}; continuing without it.`, e);
          logPipelineEvent({
            level: 'warn',
            stage: 'lexicographer',
            phaseId: phase.id,
            message: 'lexicographer.failed',
            data: { error: e instanceof Error ? e.message : String(e) },
          });
        }
      }

      // Weaver pass: map English tokens to Pali words
      let weaverOutput: WeaverPass | null = null;
      let englishTokens: EnglishTokenInput[] = [];
      if (anatomistOutput && lexicographerOutput) {
        try {
          // Collect English text from segments
          const englishText = phaseSegments
            .map((seg) => seg.baseEnglish || '')
            .filter(Boolean)
            .join(' ');

          if (englishText) {
            englishTokens = tokenizeEnglish(englishText);
            log(`Weaver pass for ${phase.id} (${getWordTokens(englishTokens).length} word tokens)...`);

            const weaverPhaseState = buildPhaseStateEnvelope({
              workId: uidKey,
              phaseId: phase.id,
              segments: phaseSegments,
              currentStageLabel: 'Weaver (3/4)',
              currentStageKey: 'weaver',
              completed: { anatomist: true, lexicographer: true },
            });

            const weaverPrompt = buildWeaverPrompt(
              phase.id,
              phaseSegments,
              weaverPhaseState,
              anatomistOutput,
              lexicographerOutput,
              englishTokens
            );

            await throttle(signal);
            const weaverRaw = await callCompilerLLM(
              settings,
              [
                { role: 'system', content: 'Return JSON only.' },
                { role: 'user', content: weaverPrompt },
              ],
              signal,
              4000,
              {
                schemaName: `sutta_studio_weaver_${phase.id}`,
                schema: weaverResponseSchema,
                structuredOutputs,
                meta: { stage: 'weaver', phaseId: phase.id, requestName: 'weaver' },
              }
            );

            weaverOutput = parseJsonResponse<WeaverPass>(weaverRaw);
            logPipelineEvent({
              level: 'info',
              stage: 'weaver',
              phaseId: phase.id,
              message: 'weaver.complete',
              data: { tokenCount: weaverOutput.tokens.length },
            });
          } else {
            log(`Skipping Weaver pass for ${phase.id} (no English text).`);
          }
        } catch (e) {
          warn(`Weaver pass failed for ${phase.id}; continuing without it.`, e);
          logPipelineEvent({
            level: 'warn',
            stage: 'weaver',
            phaseId: phase.id,
            message: 'weaver.failed',
            data: { error: e instanceof Error ? e.message : String(e) },
          });
        }
      }

      // Typesetter pass: arrange words into layout blocks
      let typesetterOutput: TypesetterPass | null = null;
      if (anatomistOutput && weaverOutput) {
        try {
          log(`Typesetter pass for ${phase.id}...`);
          const typesetterPhaseState = buildPhaseStateEnvelope({
            workId: uidKey,
            phaseId: phase.id,
            segments: phaseSegments,
            currentStageLabel: 'Typesetter (4/4)',
            currentStageKey: 'typesetter',
            completed: { anatomist: true, lexicographer: true, weaver: true },
          });

          const typesetterPrompt = buildTypesetterPrompt(
            phase.id,
            typesetterPhaseState,
            anatomistOutput,
            weaverOutput
          );

          await throttle(signal);
          const typesetterRaw = await callCompilerLLM(
            settings,
            [
              { role: 'system', content: 'Return JSON only.' },
              { role: 'user', content: typesetterPrompt },
            ],
            signal,
            3000,
            {
              schemaName: `sutta_studio_typesetter_${phase.id}`,
              schema: typesetterResponseSchema,
              structuredOutputs,
              meta: { stage: 'typesetter', phaseId: phase.id, requestName: 'typesetter' },
            }
          );

          typesetterOutput = parseJsonResponse<TypesetterPass>(typesetterRaw);
          logPipelineEvent({
            level: 'info',
            stage: 'typesetter',
            phaseId: phase.id,
            message: 'typesetter.complete',
            data: { blockCount: typesetterOutput.layoutBlocks.length },
          });
        } catch (e) {
          warn(`Typesetter pass failed for ${phase.id}; continuing without it.`, e);
          logPipelineEvent({
            level: 'warn',
            stage: 'typesetter',
            phaseId: phase.id,
            message: 'typesetter.failed',
            data: { error: e instanceof Error ? e.message : String(e) },
          });
        }
      }

      const phaseState = buildPhaseStateEnvelope({
        workId: uidKey,
        phaseId: phase.id,
        segments: phaseSegments,
        currentStageLabel: 'PhaseView (fallback)',
        completed: {
          anatomist: Boolean(anatomistOutput),
          lexicographer: Boolean(lexicographerOutput),
          weaver: Boolean(weaverOutput),
          typesetter: Boolean(typesetterOutput),
        },
      });
      const phasePrompt = buildPhasePrompt(
        phase.id,
        phaseSegments,
        renderDefaults,
        retrievalContext || undefined,
        {
          anatomist: anatomistOutput || undefined,
          lexicographer: lexicographerOutput || undefined,
          phaseState,
        }
      );
      await throttle(signal);
      const raw = await callCompilerLLM(
        settings,
        [
          { role: 'system', content: 'Return JSON only.' },
          { role: 'user', content: phasePrompt },
        ],
        signal,
        4000,
        {
          schemaName: `sutta_studio_${phase.id}`,
          schema: phaseResponseSchema,
          structuredOutputs,
          meta: { stage: 'phase', phaseId: phase.id, requestName: 'phase_view' },
        }
      );

      const parsed = parseJsonResponse<PhaseView>(raw);
      const phaseMs = Math.max(0, Math.round(performance.now() - phaseStart));
      recordPhaseDuration(uidKey, phaseMs);
      const avgPhaseMs = getAveragePhaseDuration(uidKey) ?? phaseMs;
      const remaining = phaseSkeleton.length - (i + 1);
      const etaMs = avgPhaseMs * remaining;
      readySegments += phase.segmentIds.length;
      // Build PhaseView using rehydrator when both passes succeeded
      const sourceSpan = buildSourceRefs(phase.segmentIds, segmentIdToWorkId, uidList[0]);
      let normalized: PhaseView;

      if (anatomistOutput && lexicographerOutput) {
        // Use rehydrator to assemble from specialist passes
        normalized = rehydratePhase({
          phaseId: phase.id,
          title: parsed.title || phase.title,
          sourceSpan,
          anatomist: anatomistOutput,
          lexicographer: lexicographerOutput,
          // Include Weaver and Typesetter outputs if available
          weaver: weaverOutput || undefined,
          englishTokens: englishTokens.length > 0 ? englishTokens : undefined,
          typesetter: typesetterOutput || undefined,
          // Use LLM's PhaseView as fallback when specialist passes are missing
          fallbackPhaseView: parsed,
        });
        logPipelineEvent({
          level: 'info',
          stage: 'phase',
          phaseId: phase.id,
          message: 'rehydrator.complete',
          data: { wordCount: normalized.paliWords.length },
        });
      } else {
        // Fall back to LLM's PhaseView when passes failed
        normalized = {
          ...parsed,
          id: phase.id,
          title: parsed.title || phase.title,
          sourceSpan,
          paliWords: parsed.paliWords || [],
          englishStructure: dedupeEnglishStructure(parsed.englishStructure || [], parsed.paliWords || []),
        };
      }

      // Build fallback segments map for validation
      const fallbackSegments = anatomistOutput
        ? buildSegmentsMapFromAnatomist(anatomistOutput)
        : new Map((parsed.paliWords || []).map((word) => [word.id, word.segments]));

      if (!anatomistOutput) {
        // Run morphology pass only when Anatomist didn't provide segments
        try {
          log(`Morphology pass for ${phase.id}...`);
          const morphPrompt = buildMorphologyPrompt(phase.id, normalized, phaseSegments, retrievalContext || undefined);
          await throttle(signal);
          const morphRaw = await callCompilerLLM(
            settings,
            [
              { role: 'system', content: 'Return JSON only.' },
              { role: 'user', content: morphPrompt },
            ],
            signal,
            3000,
            {
              schemaName: `sutta_studio_morph_${phase.id}`,
              schema: morphResponseSchema,
              structuredOutputs,
              meta: { stage: 'morph', phaseId: phase.id, requestName: 'morphology' },
            }
          );
          const morphParsed = parseJsonResponse<{ paliWords?: Array<{ id: string; segments: PhaseView['paliWords'][number]['segments'] }> }>(morphRaw);
          if (morphParsed?.paliWords?.length) {
            const morphMap = new Map(morphParsed.paliWords.map((w) => [w.id, w.segments]));
            normalized = {
              ...normalized,
              paliWords: normalized.paliWords.map((word) => {
                const segs = morphMap.get(word.id);
                return segs ? { ...word, segments: segs } : word;
              }),
            };
          }
        } catch (e) {
          warn(`Morphology pass failed for ${phase.id}; keeping base segments.`, e);
        }
      } else {
        log(`Skipping morphology pass for ${phase.id} (anatomist output present).`);
      }

      const validation = validatePhase(normalized, { fallbackSegments });
      if (validation.issues.length) {
        warn(`Validation reported ${validation.issues.length} issue(s) for ${phase.id}.`);
      }
      normalized = validation.phase;
      const validationIssues = [
        ...(packet.compiler?.validationIssues || []),
        ...validation.issues,
      ];

      const updatedCompiler = packet.compiler
        ? { ...packet.compiler, validationIssues }
        : undefined;

      packet = {
        ...packet,
        phases: [...packet.phases, normalized],
        compiler: updatedCompiler,
        progress: {
          totalPhases: phaseSkeleton.length,
          readyPhases: i + 1,
          totalSegments,
          readySegments,
          state: 'building',
          currentPhaseId: phase.id,
          lastProgressAt: Date.now(),
          lastPhaseMs: phaseMs,
          avgPhaseMs,
          etaMs,
        },
      };

      onProgress?.({ packet, stage: 'phase', message: `${phase.id} complete` });
      logPipelineEvent({
        level: 'info',
        stage: 'phase',
        phaseId: phase.id,
        message: 'phase.complete',
        data: {
          phaseMs,
          readyPhases: i + 1,
          totalPhases: phaseSkeleton.length,
        },
      });
    } catch (e: any) {
      // Graceful degradation: create a degraded phase instead of failing entirely
      err(`Phase ${phase.id} failed, creating degraded view`, e);

      const degradedSourceSpan = buildSourceRefs(phase.segmentIds, segmentIdToWorkId, uidList[0]);
      const paliTexts = phaseSegments.map((seg) => ({ surface: seg.pali }));
      const englishTexts = phaseSegments
        .map((seg) => seg.baseEnglish)
        .filter((text): text is string => Boolean(text));

      const degradedPhase = buildDegradedPhaseView({
        phaseId: phase.id,
        title: phase.title,
        sourceSpan: degradedSourceSpan,
        paliTexts,
        englishTexts,
        reason: e?.message || 'Phase compilation failed',
      });

      readySegments += phase.segmentIds.length;
      packet = {
        ...packet,
        phases: [...packet.phases, degradedPhase],
        progress: {
          totalPhases: phaseSkeleton.length,
          readyPhases: i + 1,
          totalSegments,
          readySegments,
          state: 'building',
          currentPhaseId: phase.id,
          lastProgressAt: Date.now(),
          avgPhaseMs: getAveragePhaseDuration(uidKey) ?? undefined,
        },
      };

      onProgress?.({ packet, stage: 'phase', message: `${phase.id} degraded` });
      logPipelineEvent({
        level: 'warn',
        stage: 'phase',
        phaseId: phase.id,
        message: 'phase.degraded',
        data: { error: e?.message || String(e) },
      });
      // Continue to next phase instead of returning
    }
  }

  const packetValidation = validatePacket(packet);
  if (packetValidation.issues.length) {
    warn(`Packet validation reported ${packetValidation.issues.length} issue(s).`);
  }
  const finalValidationIssues = [
    ...(packet.compiler?.validationIssues || []),
    ...packetValidation.issues,
  ];

  const finalCompiler = packet.compiler
    ? { ...packet.compiler, validationIssues: finalValidationIssues }
    : undefined;

  packet = {
    ...packetValidation.packet,
    compiler: finalCompiler,
    progress: {
      totalPhases: phaseSkeleton.length,
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
  logPipelineEvent({
    level: 'info',
    stage: 'compile',
    message: 'compile.complete',
    data: { totalPhases: phaseSkeleton.length },
  });
  log('Compiler completed successfully.');
  return packet;
};
