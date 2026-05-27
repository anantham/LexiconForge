/**
 * services/perWordTranslation.ts — Issue #15 Phase 2
 *
 * Per-source-word lookup for the InterleavedReader hover tooltip.
 * Returns ordered alternative renderings (Sense[]) from multiple providers:
 *   - glossary: in-memory match against the active novel's GlossaryEntry[]
 *   - deepl: DeepL Free/Pro API
 *   - google: Google Cloud Translate API
 *
 * Cache: per-(sourceWord, sourceLang, targetLang, provider) tuple. In-memory
 * for now (Phase 2.5 will move to IDB-backed cache).
 *
 * Cost model: lookups are per-word-on-hover, not bulk. Typical word is
 * 1-3 chars in CJK or 1-12 chars in space-delimited languages. At DeepL
 * Pro rates (~$25/M chars) one word ≈ $0.000025. Per-user-session cost
 * stays in the cents.
 */
import type { GlossaryEntry } from '../types';

export type SenseProvider = 'glossary' | 'deepl' | 'google' | 'cache';

export interface Sense {
  english: string;
  provider: SenseProvider;
  /** Optional note (e.g., glossary explanation, provider confidence) */
  note?: string;
  /** Optional citation (e.g., glossary entry source, provider URL) */
  citation?: { url?: string; source?: string };
}

export interface PerWordRequest {
  sourceWord: string;
  sourceLang: string;
  targetLang?: string;
  /** Optional glossary entries to consult (passed in by the reader) */
  glossary?: GlossaryEntry[];
  /** Provider order. Default: glossary first, then deepl, then google. */
  providers?: SenseProvider[];
  /** API keys (per-provider). If absent, that provider is skipped. */
  apiKeys?: { deepl?: string; google?: string };
  abortSignal?: AbortSignal;
}

const DEFAULT_PROVIDERS: SenseProvider[] = ['glossary', 'deepl', 'google'];

// In-memory cache: key = `${provider}:${sourceLang}:${targetLang}:${sourceWord}`
// Phase 2.5 will swap this for IDB persistence.
const cache = new Map<string, Sense[]>();
const cacheKey = (p: SenseProvider, sl: string, tl: string, w: string) => `${p}:${sl}:${tl}:${w}`;

/** Test-only: clear the in-memory cache between tests. */
export const __resetPerWordCache = () => {
  cache.clear();
};

const lookupGlossary = (
  word: string,
  glossary: GlossaryEntry[] | undefined,
): Sense[] => {
  if (!glossary || glossary.length === 0) return [];
  const lower = word.toLowerCase();
  return glossary
    .filter((e) => e.source && (e.source === word || e.source.toLowerCase() === lower))
    .map((e) => ({
      english: e.target,
      provider: 'glossary' as const,
      note: e.note || undefined,
    }));
};

const DEEPL_LANG_CODE: Record<string, string> = {
  zh: 'ZH',
  ko: 'KO',
  ja: 'JA',
  en: 'EN',
  fr: 'FR',
  de: 'DE',
  // Add more as needed
};

const lookupDeepL = async (
  word: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string | undefined,
  abortSignal?: AbortSignal,
): Promise<Sense[]> => {
  if (!apiKey) return [];
  const sl = DEEPL_LANG_CODE[sourceLang.toLowerCase()];
  const tl = DEEPL_LANG_CODE[targetLang.toLowerCase()] || 'EN';
  if (!sl) return []; // unsupported source language

  const isFreeKey = apiKey.endsWith(':fx');
  const endpoint = isFreeKey
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  const body = new URLSearchParams({
    text: word,
    source_lang: sl,
    target_lang: tl,
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      signal: abortSignal,
    });
  } catch {
    return [];
  }

  if (!response.ok) return [];

  let json: any;
  try {
    json = await response.json();
  } catch {
    return [];
  }

  const translations = Array.isArray(json?.translations) ? json.translations : [];
  return translations
    .filter((t: any) => typeof t?.text === 'string' && t.text.length > 0)
    .map((t: any) => ({
      english: t.text,
      provider: 'deepl' as const,
      note: t.detected_source_language ? `detected: ${t.detected_source_language}` : undefined,
      citation: { source: 'DeepL', url: 'https://www.deepl.com/translator' },
    }));
};

const lookupGoogle = async (
  word: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string | undefined,
  abortSignal?: AbortSignal,
): Promise<Sense[]> => {
  if (!apiKey) return [];

  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;
  const body = JSON.stringify({
    q: word,
    source: sourceLang,
    target: targetLang,
    format: 'text',
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: abortSignal,
    });
  } catch {
    return [];
  }

  if (!response.ok) return [];

  let json: any;
  try {
    json = await response.json();
  } catch {
    return [];
  }

  const translations = json?.data?.translations;
  if (!Array.isArray(translations)) return [];
  return translations
    .filter((t: any) => typeof t?.translatedText === 'string' && t.translatedText.length > 0)
    .map((t: any) => ({
      english: t.translatedText,
      provider: 'google' as const,
      citation: { source: 'Google Translate', url: 'https://translate.google.com' },
    }));
};

/**
 * Look up alternative English renderings for a single source word.
 * Returns Sense[] in the order specified by req.providers (default:
 * glossary → deepl → google). Cache hits are returned immediately.
 */
export async function lookupWord(req: PerWordRequest): Promise<Sense[]> {
  const targetLang = req.targetLang || 'en';
  const providers = req.providers || DEFAULT_PROVIDERS;
  const results: Sense[] = [];

  for (const p of providers) {
    let senses: Sense[] = [];

    if (p === 'glossary') {
      // No cache for glossary: lookup is in-memory list filter (free), and
      // caching the empty-result blocks new lookups when the user adds
      // glossary entries after first hover. Re-run on every call.
      senses = lookupGlossary(req.sourceWord, req.glossary);
    } else {
      // Network providers: cache hits skip the network entirely.
      const key = cacheKey(p, req.sourceLang, targetLang, req.sourceWord);
      const cached = cache.get(key);
      if (cached) {
        results.push(...cached);
        continue;
      }
      if (p === 'deepl') {
        senses = await lookupDeepL(
          req.sourceWord,
          req.sourceLang,
          targetLang,
          req.apiKeys?.deepl,
          req.abortSignal,
        );
      } else if (p === 'google') {
        senses = await lookupGoogle(
          req.sourceWord,
          req.sourceLang,
          targetLang,
          req.apiKeys?.google,
          req.abortSignal,
        );
      }
      // Cache network results (empty-results too — saves repeat API calls for missing terms).
      cache.set(key, senses);
    }

    results.push(...senses);
  }

  return results;
}
