import OpenAI from 'openai';
import { extractBalancedJson } from './ai/textUtils';
import { supportsStructuredOutputs } from './capabilityService';
import { getDefaultApiKey } from './defaultApiKeyService';
import { getEnvVar } from './env';
import { dlog, dlogFull, aiDebugFullEnabled } from './ai/debug';
import type { AppSettings } from '../types';
import type {
  CanonicalSegment,
  DeepLoomPacket,
  PhaseView,
  SourceRef,
} from '../types/suttaStudio';
import { PROXIES } from './adapters';
import { getAveragePhaseDuration, recordPhaseDuration } from './suttaStudioTelemetry';
import { buildRetrievalContext } from './suttaStudioRetrieval';
import { validatePacket, validatePhase } from './suttaStudioValidator';
import {
  SUTTA_STUDIO_PHASE_EXAMPLE_JSON,
  SUTTA_STUDIO_SKELETON_EXAMPLE_JSON,
  SUTTA_STUDIO_MORPH_EXAMPLE_JSON,
} from '../config/suttaStudioExamples';
import {
  SUTTA_STUDIO_BASE_CONTEXT,
  SUTTA_STUDIO_PHASE_CONTEXT,
  SUTTA_STUDIO_SKELETON_CONTEXT,
  SUTTA_STUDIO_MORPH_CONTEXT,
} from '../config/suttaStudioPromptContext';

const log = (message: string, ...args: any[]) =>
  console.log(`[SuttaStudioCompiler] ${message}`, ...args);
const warn = (message: string, ...args: any[]) =>
  console.warn(`[SuttaStudioCompiler] ${message}`, ...args);
const err = (message: string, ...args: any[]) =>
  console.error(`[SuttaStudioCompiler] ${message}`, ...args);

export const SUTTA_STUDIO_PROMPT_VERSION = 'sutta-studio-v5';

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

const dedupeEnglishStructure = (
  english: PhaseView['englishStructure'],
  paliWords: PhaseView['paliWords']
): PhaseView['englishStructure'] => {
  if (!english || english.length === 0) return [];
  const resolveText = (item: PhaseView['englishStructure'][number]) => {
    if (item.linkedPaliId) {
      const word = paliWords.find((w) => w.id === item.linkedPaliId);
      return (word?.senses?.[0]?.english || '').trim().toLowerCase();
    }
    return (item.label || '').trim().toLowerCase();
  };
  const deduped: PhaseView['englishStructure'] = [];
  let prevText = '';
  for (const item of english) {
    const text = resolveText(item);
    if (text && text === prevText) {
      continue;
    }
    deduped.push(item);
    prevText = text;
  }
  return deduped;
};

const resolveApiKey = (settings: AppSettings): { apiKey?: string; baseURL?: string } => {
  switch (settings.provider) {
    case 'OpenAI':
      return { apiKey: settings.apiKeyOpenAI || getEnvVar('OPENAI_API_KEY'), baseURL: 'https://api.openai.com/v1' };
    case 'DeepSeek':
      return { apiKey: settings.apiKeyDeepSeek || getEnvVar('DEEPSEEK_API_KEY'), baseURL: 'https://api.deepseek.com/v1' };
    case 'OpenRouter': {
      const userKey = (settings as any).apiKeyOpenRouter;
      const envKey = getEnvVar('OPENROUTER_API_KEY');
      const trialKey = getDefaultApiKey();
      return { apiKey: userKey || envKey || trialKey || undefined, baseURL: 'https://openrouter.ai/api/v1' };
    }
    case 'Gemini':
    case 'Claude':
    default: {
      const fallback = (settings as any).apiKeyOpenRouter || getEnvVar('OPENROUTER_API_KEY') || getDefaultApiKey();
      warn(`Provider ${settings.provider} not supported for compiler; falling back to OpenRouter.`);
      return { apiKey: fallback, baseURL: 'https://openrouter.ai/api/v1' };
    }
  }
};

const getTimeoutSignal = (ms: number, external?: AbortSignal): AbortSignal | undefined => {
  if (external && typeof AbortSignal !== 'undefined' && 'any' in AbortSignal) {
    // @ts-expect-error AbortSignal.any is not in TS lib yet
    return AbortSignal.any([external, AbortSignal.timeout(ms)]);
  }
  if (external) return external;
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(ms);
  }
  return undefined;
};

const fetchJsonViaProxies = async (url: string, signal?: AbortSignal): Promise<any> => {
  const timeoutMs = 12000;
  const errors: string[] = [];

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

  // Direct fetch fallback
  try {
    log(`Direct fetch fallback: ${url}`);
    const resp = await fetch(url, { signal: getTimeoutSignal(timeoutMs, signal) });
    if (!resp.ok) throw new Error(`Direct fetch responded ${resp.status}`);
    const text = await resp.text();
    return JSON.parse(text);
  } catch (e: any) {
    const msg = e?.message || String(e);
    errors.push(msg);
    throw new Error(`All proxy attempts failed for ${url}. Errors: ${errors.join(' | ')}`);
  }
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

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const callCompilerLLM = async (
  settings: AppSettings,
  messages: ChatMessage[],
  signal?: AbortSignal,
  maxTokens = 4000,
  options?: { schemaName?: string; schema?: any; structuredOutputs?: boolean }
): Promise<string> => {
  const { apiKey, baseURL } = resolveApiKey(settings);
  if (!apiKey || !baseURL) throw new Error('No API key configured for compiler calls.');

  const client = new OpenAI({ apiKey, baseURL, dangerouslyAllowBrowser: true });
  const requestOptions: any = {
    model: settings.model,
    messages,
    temperature: 0.2,
    max_tokens: maxTokens,
  };

  if (options?.schema && options.structuredOutputs) {
    requestOptions.response_format = {
      type: 'json_schema',
      json_schema: {
        name: options.schemaName || 'sutta_studio_response',
        schema: options.schema,
        strict: true,
      },
    };
    if (settings.provider === 'OpenRouter') {
      requestOptions.provider = { require_parameters: true };
    }
  } else {
    requestOptions.response_format = { type: 'json_object' };
  }

  dlog('[SuttaStudioCompiler] LLM request params', {
    provider: settings.provider,
    model: settings.model,
    maxTokens,
    structuredOutputs: !!options?.schema && !!options?.structuredOutputs,
    responseFormat: requestOptions.response_format?.type,
  });
  if (aiDebugFullEnabled()) {
    dlogFull('[SuttaStudioCompiler] Full request body:', JSON.stringify(requestOptions, null, 2));
  }

  let resp;
  try {
    resp = await client.chat.completions.create(requestOptions, { signal });
  } catch (error: any) {
    const message = error?.message || String(error);
    if (options?.schema && options.structuredOutputs && /response_format|structured_outputs|not supported/i.test(message)) {
      warn(`Structured outputs not supported; retrying without schema. Error: ${message}`);
      const fallbackOptions = {
        ...requestOptions,
        response_format: { type: 'json_object' },
      };
      resp = await client.chat.completions.create(fallbackOptions, { signal });
    } else {
      throw error;
    }
  }

  if (aiDebugFullEnabled()) {
    dlogFull('[SuttaStudioCompiler] Full response body:', JSON.stringify(resp, null, 2));
  }

  const content = resp.choices[0]?.message?.content || '';
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

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_SKELETON_CONTEXT}\n${boundaryContext}\nTask: Group the following SuttaCentral segments into study phases (6-12 segments per phase). Keep the original order. Each segment must appear exactly once.\n\nReturn JSON ONLY with this shape:\n{\n  "phases": [\n    { "id": "phase-1", "title": "<short title or empty>", "segmentIds": ["${examplePrefix}:1.1", "${examplePrefix}:1.2"] }\n  ]\n}\n\nEXAMPLE (do NOT copy ids):\n${SUTTA_STUDIO_SKELETON_EXAMPLE_JSON}\n\nSegments:\n${lines.join('\n')}`;
};

const buildPhasePrompt = (
  phaseId: string,
  segments: CanonicalSegment[],
  studyDefaults: { ghostOpacity: number; englishVisible: boolean; studyToggleDefault: boolean },
  retrievalContext?: string
) => {
  const lines = segments.map((seg) =>
    `${seg.ref.segmentId} | pali: ${seg.pali}${seg.baseEnglish ? ` | english: ${seg.baseEnglish}` : ''}`
  );
  const retrievalBlock = retrievalContext
    ? `\nReference context (adjacent segments; use to disambiguate, do not copy):\n${retrievalContext}\n`
    : '';

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_PHASE_CONTEXT}\n\nTask: Build a PhaseView JSON for the segment list below.\n\nRules:\n- Output JSON ONLY.\n- Use the exact phase id: ${phaseId}.\n- Create paliWords with segments (type: root|suffix|prefix|stem). If unsure, use a single segment with type "stem".\n- Provide at least 1 sense per word; if possible, give 2-3 senses with short nuance labels.\n- englishStructure should be an ordered token list that maps to pali words (linkedPaliId) and includes ghost tokens for English glue (isGhost true, ghostKind required).\n- Keep it minimal and readable.\n- Avoid markdown or extra commentary.\n\nEXAMPLE (do NOT copy ids):\n${SUTTA_STUDIO_PHASE_EXAMPLE_JSON}\n\nRender defaults for context: ghostOpacity=${studyDefaults.ghostOpacity}, englishVisible=${studyDefaults.englishVisible}, studyToggleDefault=${studyDefaults.studyToggleDefault}.${retrievalBlock}\nSegments:\n${lines.join('\n')}`;
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
  const structuredOutputs = await supportsStructuredOutputs(settings.provider, settings.model);
  log(`Structured outputs supported: ${structuredOutputs}`);
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

  onProgress?.({ packet, stage: 'init', message: 'Fetched canonical segments.' });

  // Skeleton pass
  let phaseSkeleton: Array<{ id: string; title?: string; segmentIds: string[] }> = [];
  try {
    log('Running skeleton pass...');
    const skeletonPrompt = buildSkeletonPrompt(canonicalWithOrder, {
      exampleSegmentId: canonicalWithOrder[0]?.ref.segmentId,
      boundaries,
      allowCrossChapter: Boolean(allowCrossChapter),
    });
    const raw = await callCompilerLLM(
      settings,
      [
        { role: 'system', content: 'Return JSON only.' },
        { role: 'user', content: skeletonPrompt },
      ],
      signal,
      2000,
      { schemaName: 'sutta_studio_skeleton', schema: skeletonResponseSchema, structuredOutputs }
    );
    const parsed = parseJsonResponse<{ phases?: Array<{ id: string; title?: string; segmentIds: string[] }> }>(raw);
    if (parsed.phases && parsed.phases.length) {
      phaseSkeleton = parsed.phases;
    } else {
      warn('Skeleton response missing phases; falling back to chunking.');
    }
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
      currentPhaseId: undefined,
      lastProgressAt: Date.now(),
      avgPhaseMs: seededAvgPhaseMs,
      etaMs: seededEtaMs,
    },
  };
  onProgress?.({ packet, stage: 'skeleton', message: 'Skeleton ready.' });

  for (let i = 0; i < phaseSkeleton.length; i++) {
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
      const phasePrompt = buildPhasePrompt(phase.id, phaseSegments, renderDefaults, retrievalContext || undefined);
      const raw = await callCompilerLLM(
        settings,
        [
          { role: 'system', content: 'Return JSON only.' },
          { role: 'user', content: phasePrompt },
        ],
        signal,
        4000,
        { schemaName: `sutta_studio_${phase.id}`, schema: phaseResponseSchema, structuredOutputs }
      );

      const parsed = parseJsonResponse<PhaseView>(raw);
      const phaseMs = Math.max(0, Math.round(performance.now() - phaseStart));
      recordPhaseDuration(uidKey, phaseMs);
      const avgPhaseMs = getAveragePhaseDuration(uidKey) ?? phaseMs;
      const remaining = phaseSkeleton.length - (i + 1);
      const etaMs = avgPhaseMs * remaining;
      readySegments += phase.segmentIds.length;
      const fallbackSegments = new Map(
        (parsed.paliWords || []).map((word) => [word.id, word.segments])
      );
      let normalized: PhaseView = {
        ...parsed,
        id: phase.id,
        title: parsed.title || phase.title,
        sourceSpan: buildSourceRefs(phase.segmentIds, segmentIdToWorkId, uidList[0]),
        paliWords: parsed.paliWords || [],
        englishStructure: dedupeEnglishStructure(parsed.englishStructure || [], parsed.paliWords || []),
      };

      try {
        log(`Morphology pass for ${phase.id}...`);
        const morphPrompt = buildMorphologyPrompt(phase.id, normalized, phaseSegments, retrievalContext || undefined);
        const morphRaw = await callCompilerLLM(
          settings,
          [
            { role: 'system', content: 'Return JSON only.' },
            { role: 'user', content: morphPrompt },
          ],
          signal,
          3000,
          { schemaName: `sutta_studio_morph_${phase.id}`, schema: morphResponseSchema, structuredOutputs }
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
    } catch (e: any) {
      err(`Phase ${phase.id} failed`, e);
      packet = {
        ...packet,
        progress: {
          totalPhases: phaseSkeleton.length,
          readyPhases: i,
          totalSegments,
          readySegments,
          state: 'error',
          currentPhaseId: phase.id,
          lastProgressAt: Date.now(),
          avgPhaseMs: getAveragePhaseDuration(uidKey) ?? undefined,
        },
      };
      onProgress?.({ packet, stage: 'error', message: e?.message || 'Phase compile failed' });
      return packet;
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
  log('Compiler completed successfully.');
  return packet;
};
