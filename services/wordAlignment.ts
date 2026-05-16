/**
 * services/wordAlignment.ts — Issue #15 Phase 1
 *
 * Produces word-level alignment between a source-language paragraph and its
 * English translation, via a single structured-output LLM call. Caches per
 * (chapterId, translationVersionId) tuple — alignment is a function of the
 * specific source+target text pair and never changes for that pair.
 *
 * Used by the InterleavedReader (Phase 3) to render aligned source↔target
 * tokens with hover-tooltip lookups.
 *
 * Cost model: ~$0.005 per chapter alignment (one structured-output call,
 * cached forever per translation version). Per-word lookups (Phase 2) are
 * separate and on-demand.
 */
import type { AppSettings } from '../types';
import type { ChatMessage } from '../adapters/providers/Provider';
import { initializeProviders } from '../adapters/providers';
import { getProvider } from '../adapters/providers/registry';
import { extractBalancedJson } from './ai/textUtils';

export interface WordPair {
  /** Source-language word/phrase (e.g., "李逍遥", "satipaṭṭhāna") */
  source: string;
  /** English (or target-language) rendering */
  target: string;
  /** Char offset in raw source text where this token begins */
  sourceStart: number;
  /** Char offset (exclusive) where this token ends */
  sourceEnd: number;
  /** Char offset in target translation where this token begins */
  targetStart: number;
  /** Char offset (exclusive) where this token ends */
  targetEnd: number;
}

export interface WordAlignment {
  pairs: WordPair[];
  /** Translation version this alignment was computed against. Cache invalidates
   *  when translationResult.id changes. */
  translationVersionId: string | null;
  /** ISO timestamp when alignment was computed */
  alignedAt: string;
  /** Model used for alignment LLM call */
  modelUsed: string;
  /** Number of pairs (cached for cheap UI access) */
  pairCount: number;
}

export interface AlignmentRequest {
  source: string;
  target: string;
  sourceLang?: string;
  targetLang?: string;
  settings: AppSettings;
  /** ID of the translation result this alignment is for (for cache key) */
  translationVersionId?: string | null;
  /** Optional model override; defaults to settings.model */
  modelOverride?: string;
  abortSignal?: AbortSignal;
}

const ALIGNMENT_SCHEMA = {
  type: 'object',
  properties: {
    pairs: {
      type: 'array',
      description:
        'Ordered list of word-pair alignments. Each pair maps a source-language word ' +
        'or short phrase to its corresponding English token(s). Char offsets are ' +
        'relative to the input strings.',
      items: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Source-language token (1-3 words)' },
          target: { type: 'string', description: 'English token(s) corresponding to source' },
          sourceStart: { type: 'integer', description: 'Char offset start in source (inclusive)' },
          sourceEnd: { type: 'integer', description: 'Char offset end in source (exclusive)' },
          targetStart: { type: 'integer', description: 'Char offset start in target (inclusive)' },
          targetEnd: { type: 'integer', description: 'Char offset end in target (exclusive)' },
        },
        required: ['source', 'target', 'sourceStart', 'sourceEnd', 'targetStart', 'targetEnd'],
      },
    },
  },
  required: ['pairs'],
};

const buildAlignmentPrompt = (sourceLang?: string, targetLang?: string) => {
  const sl = sourceLang || 'the source language';
  const tl = targetLang || 'English';
  return `You are a precise word-alignment tool. You will receive a paragraph in ${sl} and its translation in ${tl}.

Your job: produce a word-by-word alignment as JSON. Each entry maps a source token (1-3 words) to its corresponding target token(s). Provide character offsets relative to the input strings (sourceStart/End point into the source string, targetStart/End point into the target string; offsets are 0-indexed, end is exclusive).

Rules:
- Cover every meaningful content word in BOTH source and target. Function words can be grouped (e.g., articles + nouns together) when alignment is natural.
- Order pairs in source reading order.
- Source spans should not overlap. Target spans may be slightly out-of-order to match natural translation reordering.
- If a source word has no clean target equivalent (e.g., a particle that disappears in translation), include it with target="" and targetStart=targetEnd=0.
- If a target word is interpretive (added by translator with no source equivalent), skip it — don't fabricate a source span.
- Verify your offsets actually point at the substrings you wrote.`;
};

const validateAlignment = (pairs: WordPair[], source: string, target: string): WordPair[] => {
  // Filter pairs whose offsets don't actually match the substring.
  // This guards against LLM hallucination of offsets.
  return pairs.filter((p) => {
    if (p.sourceStart < 0 || p.sourceEnd > source.length || p.sourceStart > p.sourceEnd) return false;
    if (p.targetStart < 0 || p.targetEnd > target.length || p.targetStart > p.targetEnd) return false;
    const actualSource = source.slice(p.sourceStart, p.sourceEnd);
    if (actualSource !== p.source) return false;
    if (p.target === '') return true; // dropped-in-translation case
    const actualTarget = target.slice(p.targetStart, p.targetEnd);
    if (actualTarget !== p.target) return false;
    return true;
  });
};

export async function alignWords(req: AlignmentRequest): Promise<WordAlignment> {
  const { source, target, sourceLang, targetLang, settings, translationVersionId, modelOverride, abortSignal } = req;

  if (!source || !target) {
    return {
      pairs: [],
      translationVersionId: translationVersionId ?? null,
      alignedAt: new Date().toISOString(),
      modelUsed: '(no-input)',
      pairCount: 0,
    };
  }

  await initializeProviders();
  const providerName = settings.provider === 'OpenAI' ? 'OpenRouter' : settings.provider;
  let provider;
  try {
    provider = getProvider(providerName as any);
  } catch {
    provider = getProvider('OpenRouter');
  }

  const model = modelOverride || settings.model;
  const messages: ChatMessage[] = [
    { role: 'system', content: buildAlignmentPrompt(sourceLang, targetLang) },
    {
      role: 'user',
      content: `SOURCE (${sourceLang || 'unknown'}):\n${source}\n\nTARGET (${targetLang || 'English'}):\n${target}\n\nProduce the JSON alignment.`,
    },
  ];

  const response = await provider.chatJSON({
    settings: { ...settings, model } as AppSettings,
    messages,
    schema: ALIGNMENT_SCHEMA,
    schemaName: 'WordAlignment',
    structuredOutputs: true,
    abortSignal,
    apiType: 'translation',
  });

  let parsed: { pairs: WordPair[] };
  try {
    parsed = JSON.parse(response.text);
  } catch {
    // Fallback: extract balanced JSON if the model wrapped output in fences
    const extracted = extractBalancedJson(response.text);
    parsed = JSON.parse(extracted);
  }

  const validated = validateAlignment(parsed.pairs ?? [], source, target);

  return {
    pairs: validated,
    translationVersionId: translationVersionId ?? null,
    alignedAt: new Date().toISOString(),
    modelUsed: model || providerName,
    pairCount: validated.length,
  };
}

/**
 * Returns true if the provided alignment is still valid for the given
 * translation version. Used by callers to decide whether to re-fetch.
 */
export const isAlignmentFresh = (
  alignment: WordAlignment | null | undefined,
  currentTranslationVersionId: string | null | undefined,
): boolean => {
  if (!alignment) return false;
  if (!currentTranslationVersionId) return false;
  return alignment.translationVersionId === currentTranslationVersionId;
};
