/**
 * SuttaCentral bilara-data variant-readings provider.
 *
 * Fetches `variant-pli-ms.json` from the bilara-data published branch on
 * GitHub for a given sutta and exposes per-segment lookup. Variant readings
 * record where different witnesses (Burmese/Sinhala/PTS/Mr) disagree on the
 * Pāli wording. Critical for the audit trail when curating segments that
 * have multiple attested readings.
 *
 * Output shape is compatible with `DeepLoomPacket.provenance.segmentVariants`.
 *
 * License: bilara-data root + variants are CC BY-SA 4.0.
 */

import { fetchJsonViaProxies } from '../compiler/dictionary';
import { citationIdFor } from './citationHelpers';
import type { LookupOptions, ProviderResponseBase } from './types';

const BILARA_VARIANT_URL = (workId: string, basket: string): string =>
  `https://raw.githubusercontent.com/suttacentral/bilara-data/published/variant/pli/ms/sutta/${basket}/${workId}_variant-pli-ms.json`;

const BILARA_LICENSE =
  'SuttaCentral bilara-data variant readings, CC BY-SA 4.0. Witness abbreviations: bj=Burmese, sya=Sinhala, pts1ed=PTS 1st ed, mr=Marquand.';

const basketFor = (uid: string): string =>
  uid.startsWith('mn') ? 'mn'
    : uid.startsWith('sn') ? 'sn'
    : uid.startsWith('an') ? 'an'
    : uid.startsWith('dn') ? 'dn'
    : 'mn';

/** A single variant reading attested by one or more witnesses. */
export interface VariantReading extends ProviderResponseBase {
  /** Canonical segment id this variant applies to. */
  segmentId: string;
  /** The reading in the main edition (Mahāsaṅgīti). */
  original: string;
  /** The variant reading. */
  reading: string;
  /** Witness abbreviations that carry this variant (e.g., ['bj', 'sya-all']). */
  witnesses: string[];
  /** Raw note string from bilara, preserved verbatim. */
  rawExcerpt: string;
}

/**
 * Parse a single bilara variant string. The format is one or more
 *   `<original> → <reading> (<witness1>, <witness2>, …)`
 * entries separated by `|`. Returns the parsed structured list.
 */
const parseBilaraVariantString = (raw: string): Array<{ original: string; reading: string; witnesses: string[] }> => {
  return raw.split('|').map((part) => {
    const m = part.match(/^\s*(.+?)\s*→\s*(.+?)\s*\(([^)]+)\)\s*$/);
    if (!m) return null;
    return {
      original: m[1].trim(),
      reading: m[2].trim(),
      witnesses: m[3].split(',').map((w) => w.trim()).filter(Boolean),
    };
  }).filter((v): v is NonNullable<typeof v> => v !== null);
};

export class SuttaCentralBilaraVariantsProvider {
  readonly id = 'sc-bilara' as const;
  readonly label = 'SC bilara variants';
  readonly license = BILARA_LICENSE;

  /** Per-sutta cache of the parsed variant data. */
  private readonly cache = new Map<string, Record<string, VariantReading[]>>();

  /**
   * Fetch (and cache) all variant readings for a sutta. Returns a map of
   * canonical segment id → array of VariantReading (often length 0 or 1, but
   * one segment can have multiple variants).
   */
  async loadAllForSutta(workId: string, opts?: LookupOptions): Promise<Record<string, VariantReading[]>> {
    const cached = this.cache.get(workId);
    if (cached) return cached;
    const url = BILARA_VARIANT_URL(workId, basketFor(workId));
    try {
      if (opts?.throttle) await opts.throttle(opts.signal);
      const raw = await fetchJsonViaProxies(url, opts?.signal);
      if (raw == null || typeof raw !== 'object') {
        this.cache.set(workId, {});
        return {};
      }
      const result: Record<string, VariantReading[]> = {};
      for (const [segmentId, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof value !== 'string') continue;
        const parsed = parseBilaraVariantString(value);
        result[segmentId] = parsed.map((v, idx) => {
          const sourceId = `${segmentId}#${idx}`;
          return {
            segmentId,
            original: v.original,
            reading: v.reading,
            witnesses: v.witnesses,
            rawExcerpt: value,
            sourceId,
            citationId: citationIdFor('sc-bilara', sourceId, segmentId),
          };
        });
      }
      this.cache.set(workId, result);
      return result;
    } catch {
      // Missing variant files are normal for stable openings (e.g., mn10:1.1).
      // Cache the empty result so we don't keep refetching.
      this.cache.set(workId, {});
      return {};
    }
  }

  /**
   * Look up variants for a single canonical segment id (e.g., `mn10:4.3`).
   * Returns an empty array when there are no recorded variants.
   */
  async getVariantsForSegment(canonicalSegmentId: string, opts?: LookupOptions): Promise<VariantReading[]> {
    const workId = canonicalSegmentId.split(':')[0];
    if (!workId) return [];
    const all = await this.loadAllForSutta(workId, opts);
    return all[canonicalSegmentId] ?? [];
  }

  /** Test/debug helper — flush the cache. */
  clearCache(): void {
    this.cache.clear();
  }
}

export const suttaCentralBilaraVariantsProvider = new SuttaCentralBilaraVariantsProvider();
