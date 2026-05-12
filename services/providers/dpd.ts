/**
 * Digital Pāli Dictionary lexicon provider.
 *
 * Pure / isomorphic module — works in browser, Node, and test environments.
 * Loading of static JSON shards is the caller's responsibility; see
 * `dpd-loader-fs.ts` for the Node helper or wire Vite's `import.meta.glob`
 * for the browser.
 *
 * Data shape mirrors what `scripts/build-dpd.ts` produces:
 *   headwords.json — lemma → LexiconEntry[]   (one per DPD homonym row)
 *   forms.json     — surface → string[]       (candidate lemmas resolved by
 *                                              the ingestion script's
 *                                              stem-stripping heuristics)
 *
 * Lookup strategy:
 *   1. Direct lemma match against `headwords` — preferred (DPD-grade data)
 *   2. Surface-form match via `forms` → try each candidate lemma
 *
 * The provider does NOT re-run stem-stripping at lookup time; that work was
 * already done at ingestion. If a surface form is missing from `forms`, the
 * caller should pass the candidate lemma directly (hand-curation flow).
 */

import type { LexiconEntry, LexiconProvider, LookupOptions } from './types';

export type DpdHeadwords = Record<string, LexiconEntry[]>;
export type DpdForms = Record<string, string[]>;

/**
 * In-memory shape consumed by `DpdProvider`. Either field may be absent —
 * the lookup gracefully degrades to whatever is available.
 */
export interface DpdData {
  headwords: DpdHeadwords;
  forms?: DpdForms;
}

const DPD_LICENSE =
  'CC BY-NC-SA 4.0 — Digital Pāli Dictionary by Bryan Levman et al. See data/LICENSE-DATA.md.';

const normalize = (s: string): string => s.trim().toLowerCase();

export class DpdProvider implements LexiconProvider {
  readonly id = 'dpd' as const;
  readonly label = 'DPD';
  readonly license = DPD_LICENSE;

  constructor(private readonly data: DpdData) {}

  async lookup(lemma: string, _opts?: LookupOptions): Promise<LexiconEntry[]> {
    const query = normalize(lemma);
    if (!query) return [];

    // 1. Direct headword match.
    const direct = this.data.headwords[query];
    if (direct && direct.length > 0) return direct;

    // 2. Surface-form match — the script's ingestion-time stem-stripping
    //    resolved this surface to one or more lemma candidates; try each.
    const candidates = this.data.forms?.[query];
    if (candidates && candidates.length > 0) {
      const merged: LexiconEntry[] = [];
      const seen = new Set<string>();
      for (const cand of candidates) {
        const entries = this.data.headwords[cand];
        if (!entries) continue;
        for (const entry of entries) {
          const key = entry.sourceId ?? `${entry.lemma}:${entry.senses[0]?.english ?? ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(entry);
        }
      }
      return merged;
    }

    return [];
  }

  /** Test / debug helper — number of lemma keys currently loaded. */
  size(): number {
    return Object.keys(this.data.headwords).length;
  }
}

/**
 * Merge multiple DpdData sources into one. Later sources override earlier
 * ones on lemma conflicts; forms are unioned by surface form.
 *
 * Use case: hand-curation tooling may load multiple per-sutta subsets
 * (data/dpd/mn10/, data/dpd/sn22.59/, …) and present a unified provider.
 */
export const mergeDpdData = (...sources: DpdData[]): DpdData => {
  const headwords: DpdHeadwords = {};
  const forms: DpdForms = {};
  for (const src of sources) {
    for (const [lemma, entries] of Object.entries(src.headwords)) {
      headwords[lemma] = entries;
    }
    if (src.forms) {
      for (const [surface, lemmas] of Object.entries(src.forms)) {
        forms[surface] = lemmas;
      }
    }
  }
  return { headwords, forms };
};
