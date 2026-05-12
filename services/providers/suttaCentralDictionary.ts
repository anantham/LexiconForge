/**
 * SuttaCentral dictionary_full provider.
 *
 * Wraps SC's `/api/dictionary_full/{lemma}` endpoint as a LexiconProvider.
 * The endpoint aggregates entries from multiple PTS-derived dictionaries
 * (PED, NCPED, Concise PD, …); each entry is preserved as a separate
 * LexiconEntry so the renderer can surface them distinctly.
 *
 * Note: per ADR SUTTA-008, this provider is the first of many — DPD lands
 * in commit B and joins the same registry. The existing
 * `services/compiler/dictionary.ts` callsite at `services/compiler/index.ts`
 * is intentionally untouched in commit A; the abstraction is in place and
 * usable from hand-curation. Compiler wiring lands with DPD.
 */

import { fetchJsonViaProxies } from '../compiler/dictionary';
import { citationIdFor } from './citationHelpers';
import type {
  LexiconEntry,
  LexiconProvider,
  LookupOptions,
  LexiconSense,
} from './types';

const DICTIONARY_LOOKUP_BASE = 'https://suttacentral.net/api/dictionary_full/';

const normaliseQuery = (lemma: string): string =>
  lemma.trim().replace(/^[\s"'`.,;:!?()]+|[\s"'`.,;:!?()]+$/g, '');

/**
 * SC dictionary_full response is heterogeneous — sometimes a top-level array,
 * sometimes wrapped in an object with a `dictionaries` field. We preserve the
 * raw payload as `rawExcerpt` (the LLM lexicographer prompt + the UI both see
 * the unmodified attestation) and extract one LexiconEntry per item, tagging
 * each with a deterministic sourceId so citation materialisation is boring.
 */
const parseScDictionaryPayload = (raw: unknown, query: string): LexiconEntry[] => {
  if (raw == null) return [];
  let items: unknown[];
  if (Array.isArray(raw)) {
    items = raw;
  } else if (typeof raw === 'object' && raw !== null && 'dictionaries' in raw && Array.isArray((raw as { dictionaries?: unknown }).dictionaries)) {
    items = (raw as { dictionaries: unknown[] }).dictionaries;
  } else {
    return [];
  }

  return items.map((item, idx) => {
    if (item == null || typeof item !== 'object') {
      return {
        lemma: query,
        sourceId: `unknown:${idx}`,
        citationId: citationIdFor('sc-dictionary-full', `unknown:${idx}`, query),
        senses: [],
        rawExcerpt: JSON.stringify(item),
      } satisfies LexiconEntry;
    }
    const obj = item as Record<string, unknown>;
    const dictId =
      typeof obj.dictionary === 'string' ? obj.dictionary
      : typeof obj.dict === 'string' ? obj.dict
      : `entry-${idx}`;
    const headword = typeof obj.word === 'string' ? obj.word : query;
    const sourceId = `${dictId}:${headword}:${idx}`;
    // SC's "text" field holds the dictionary article body (HTML or plain). We
    // surface it as a single sense for now; downstream consumers (lexicographer
    // prompt, hand-curation helper) typically only care about rawExcerpt.
    const articleText = typeof obj.text === 'string' ? obj.text : '';
    const senses: LexiconSense[] = articleText
      ? [{ english: headword, nuance: dictId, notes: articleText }]
      : [];
    return {
      lemma: headword,
      sourceId,
      citationId: citationIdFor('sc-dictionary-full', sourceId, query),
      senses,
      rawExcerpt: JSON.stringify(item),
    } satisfies LexiconEntry;
  });
};

export class SuttaCentralDictionaryProvider implements LexiconProvider {
  readonly id = 'sc-dictionary-full' as const;
  readonly label = 'SC dictionary_full';
  readonly license =
    'SuttaCentral aggregated dictionary endpoint. Underlying dictionaries (PED, NCPED, Concise PD, etc.) carry their own licenses; PED is public domain.';

  /**
   * Per-session in-memory cache. Lemma → entries[]. Cleared on process exit.
   * For long-running curation sessions this means each lemma is fetched once.
   */
  private readonly cache = new Map<string, LexiconEntry[]>();

  async lookup(lemma: string, opts?: LookupOptions): Promise<LexiconEntry[]> {
    const query = normaliseQuery(lemma);
    if (!query) return [];
    const cached = this.cache.get(query);
    if (cached) return cached;
    const url = `${DICTIONARY_LOOKUP_BASE}${encodeURIComponent(query)}`;
    try {
      if (opts?.throttle) await opts.throttle(opts.signal);
      const raw = await fetchJsonViaProxies(url, opts?.signal);
      const entries = parseScDictionaryPayload(raw, query);
      this.cache.set(query, entries);
      return entries;
    } catch {
      // Cache the empty result too — failed lookups during a session shouldn't
      // hammer the network repeatedly for the same lemma.
      this.cache.set(query, []);
      return [];
    }
  }

  /** Test/debug helper — flush the cache. */
  clearCache(): void {
    this.cache.clear();
  }
}

/** Singleton instance for default registration. */
export const suttaCentralDictionaryProvider = new SuttaCentralDictionaryProvider();
