/**
 * SuttaCentral suttaplex parallels provider.
 *
 * Calls `https://suttacentral.net/api/parallels/{uid}` and projects the
 * response into the `ParallelRef[]` shape consumed by
 * `PhaseView.parallels`. Handles both work-level parallels (top-level
 * `uid` key in the response) and segment-level parallels (keys like
 * `mn10#44.1`, with `#` separator instead of bilara's `:`).
 *
 * License: SC suttaplex is CC-BY.
 */

import { fetchJsonViaProxies } from '../compiler/dictionary';
import { citationIdFor } from './citationHelpers';
import type { ParallelRef } from '../../types/suttaStudio';
import type {
  LookupOptions,
  ParallelProvider,
  ParallelProviderId,
  ProviderResponseBase,
} from './types';

const SUTTAPLEX_LICENSE =
  'SuttaCentral parallels endpoint (CC-BY). Parallel attestations sourced from canonical text-reuse research catalogued by SC.';

const PARALLEL_URL = (uid: string): string =>
  `https://suttacentral.net/api/parallels/${encodeURIComponent(uid)}`;

interface SuttaplexParallelTo {
  to?: string;
  uid?: string;
  acronym?: string;
  original_title?: string;
  translated_title?: string;
  type?: string;
}

interface SuttaplexParallelEntry {
  to?: SuttaplexParallelTo;
  enumber?: number;
}

export interface SuttaplexParallelRef extends ParallelRef, ProviderResponseBase {}

/**
 * Convert a suttaplex API key (which uses `#` for segment separators) into
 * a bilara-compatible canonical segment id (which uses `:`). Returns
 * `undefined` if the key is work-level (no `#`).
 *
 *   "mn10"       → undefined  (work-level)
 *   "mn10#44.1"  → "mn10:44.1"
 */
const suttaplexKeyToCanonicalSegmentId = (key: string): string | undefined => {
  const hashIdx = key.indexOf('#');
  if (hashIdx < 0) return undefined;
  return key.slice(0, hashIdx) + ':' + key.slice(hashIdx + 1);
};

export class SuttaCentralSuttaplexParallelProvider implements ParallelProvider {
  readonly id: ParallelProviderId = 'sc-suttaplex';
  readonly label = 'SC suttaplex';
  readonly license = SUTTAPLEX_LICENSE;

  private readonly cache = new Map<string, SuttaplexParallelRef[]>();

  async getParallels(workId: string, opts?: LookupOptions): Promise<SuttaplexParallelRef[]> {
    const key = workId.toLowerCase().trim();
    if (!key) return [];
    const cached = this.cache.get(key);
    if (cached) return cached;

    try {
      if (opts?.throttle) await opts.throttle(opts.signal);
      const raw = await fetchJsonViaProxies(PARALLEL_URL(key), opts?.signal);
      if (raw == null || typeof raw !== 'object') {
        this.cache.set(key, []);
        return [];
      }

      const refs: SuttaplexParallelRef[] = [];
      for (const [sourceKey, entriesRaw] of Object.entries(raw as Record<string, unknown>)) {
        if (!Array.isArray(entriesRaw)) continue;
        const fromSegmentId = suttaplexKeyToCanonicalSegmentId(sourceKey);
        for (const entryRaw of entriesRaw as SuttaplexParallelEntry[]) {
          const to = entryRaw?.to;
          if (!to) continue;
          const targetUid = to.uid ?? to.to;
          if (!targetUid) continue;
          const parallelType = to.type ?? 'full';
          const noteParts: string[] = [parallelType];
          if (to.translated_title) noteParts.push(to.translated_title);
          else if (to.original_title) noteParts.push(to.original_title);
          if (to.acronym) noteParts.push(to.acronym);
          const sourceId = `${sourceKey}→${targetUid}`;
          refs.push({
            workId: targetUid,
            segmentId: fromSegmentId,
            note: noteParts.join(' · '),
            sourceId,
            citationId: citationIdFor('sc-suttaplex', sourceId, workId),
          });
        }
      }
      this.cache.set(key, refs);
      return refs;
    } catch {
      this.cache.set(key, []);
      return [];
    }
  }

  /** Test/debug helper. */
  clearCache(): void {
    this.cache.clear();
  }
}

export const suttaCentralSuttaplexParallelProvider = new SuttaCentralSuttaplexParallelProvider();
