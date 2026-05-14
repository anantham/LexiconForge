/**
 * Translator-Bank — per-verse translator citations from SuttaCentral bilara-data.
 *
 * Phase 3 of docs/sutta-studio/GROUNDING.md. Complements ContestedTermProvider
 * (which is term-keyed) with verse-keyed translator renderings. Where the
 * contested-terms registry says "Bodhi renders satipaṭṭhāna as X across MN10",
 * this provider says "Bodhi translates MN10:3.2 as Y" — the actual prose, not
 * the term-level claim.
 *
 * Data source: SuttaCentral's bilara-data JSON API.
 *   GET https://suttacentral.net/api/bilarasuttas/{uid}/{translator}
 *   → { translation_text: { 'mn10:1.1': '...', 'mn10:1.2': '...', ... } }
 *
 * Supported translators (as of 2026-05-14):
 *   - sujato     — full MN coverage, bilara-native
 *   - bodhi      — partial coverage (200 OK on MN10; 404 on some other suttas)
 *   - anandajoti — partial coverage
 *
 * Anti-patterns this module refuses:
 *   - Synthetic citations: every translator rendering is fetched from the
 *     bilara API. If the fetch fails, no citation is emitted.
 *   - Cross-translator inference: we never "guess" what Bodhi says based on
 *     Sujato. Each translator's renderings come from their own API endpoint.
 */

import type { Citation, PhaseView } from '../../../types/suttaStudio';

export type TranslatorSlug = 'sujato' | 'bodhi' | 'anandajoti';

export type BilaraTranslation = {
  /** Mapping from canonical segment ID (e.g. 'mn10:3.2') to English text. */
  translationBySegment: Map<string, string>;
  /** Translator's full attribution (e.g., 'Bhikkhu Sujato'). */
  translatorName: string;
  /** Translator slug used in URLs. */
  slug: TranslatorSlug;
  /** Sutta unique identifier (e.g., 'mn10'). */
  workId: string;
};

const TRANSLATOR_NAMES: Record<TranslatorSlug, string> = {
  sujato: 'Bhikkhu Sujato',
  bodhi: 'Bhikkhu Bodhi',
  anandajoti: 'Anandajoti Bhikkhu',
};

const BILARA_API_URL = (workId: string, slug: TranslatorSlug): string =>
  `https://suttacentral.net/api/bilarasuttas/${workId}/${slug}`;

const READER_URL = (workId: string, slug: TranslatorSlug, segmentId?: string): string => {
  const base = `https://suttacentral.net/${workId}/en/${slug}`;
  if (!segmentId) return base;
  // Bilara segment IDs are 'mn10:3.2' format; SC anchors are '#3.2'
  const anchor = segmentId.includes(':') ? segmentId.split(':')[1] : segmentId;
  return `${base}#${anchor}`;
};

/**
 * Fetches one translator's MN/SN/AN/DN bilara translation. Returns null if
 * the translator doesn't cover this sutta (404 from API).
 */
export async function fetchTranslatorBilara(
  workId: string,
  slug: TranslatorSlug,
  fetchFn: typeof fetch = fetch
): Promise<BilaraTranslation | null> {
  const url = BILARA_API_URL(workId, slug);
  let response: Response;
  try {
    response = await fetchFn(url);
  } catch (e) {
    // Network / DNS failure — non-fatal; caller proceeds without this translator
    return null;
  }
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`bilara fetch ${url} returned ${response.status}`);
  }
  const data = await response.json();
  const translationText: Record<string, string> = data?.translation_text ?? {};
  const translationBySegment = new Map<string, string>();
  for (const [segId, text] of Object.entries(translationText)) {
    if (typeof text === 'string' && text.trim()) {
      translationBySegment.set(segId, text);
    }
  }
  return {
    translationBySegment,
    translatorName: TRANSLATOR_NAMES[slug],
    slug,
    workId,
  };
}

/**
 * Fetches multiple translators in parallel; returns only those that resolved
 * (skips 404s silently).
 */
export async function fetchTranslatorBank(
  workId: string,
  slugs: TranslatorSlug[] = ['sujato', 'bodhi'],
  fetchFn: typeof fetch = fetch
): Promise<BilaraTranslation[]> {
  const results = await Promise.all(
    slugs.map((slug) => fetchTranslatorBilara(workId, slug, fetchFn))
  );
  return results.filter((x): x is BilaraTranslation => x !== null);
}

/**
 * Stable citation ID: `cite:verse:<workId>:<segmentId-suffix>:<translator>`.
 * Same convention as contested-term citation IDs — used for idempotent
 * application across multiple ground-packet runs.
 */
function citationId(workId: string, segmentId: string, slug: TranslatorSlug): string {
  // Strip workId prefix from segmentId if present (mn10:3.2 → 3.2)
  const segSuffix = segmentId.startsWith(`${workId}:`)
    ? segmentId.slice(workId.length + 1)
    : segmentId;
  return `cite:verse:${workId}:${segSuffix}:${slug}`;
}

/**
 * Builds Citation objects for a phase, one per (segment × translator) pair
 * where the bilara bank has a translation. Each citation links to the
 * canonical SC reader page with an anchor to the specific segment.
 */
export function buildPhaseVerseCitations(
  phase: PhaseView,
  bank: BilaraTranslation[]
): Citation[] {
  const citations: Citation[] = [];
  const segmentIds = phase.canonicalSegmentIds ?? [];
  if (segmentIds.length === 0 || bank.length === 0) return citations;

  for (const segmentId of segmentIds) {
    for (const translation of bank) {
      const text = translation.translationBySegment.get(segmentId);
      if (!text) continue;
      const id = citationId(translation.workId, segmentId, translation.slug);
      citations.push({
        id,
        short: `${translation.translatorName} — ${segmentId}`,
        url: READER_URL(translation.workId, translation.slug, segmentId),
        excerpt: text.trim(),
        provenance: 'sc-bilara',
        query: segmentId,
        fetchedAt: new Date().toISOString().slice(0, 10),
        license:
          'SuttaCentral bilara-data, CC BY-SA 4.0 (Sujato) / publisher-specific (Bodhi/Anandajoti)',
      });
    }
  }
  return citations;
}

/**
 * Determines the workId for a phase by inspecting its first canonical
 * segment ID (e.g. 'mn10:3.2' → 'mn10'). Returns null if the phase has
 * no canonical segments or the first segment has no workId prefix.
 */
export function inferWorkId(phase: PhaseView): string | null {
  const first = phase.canonicalSegmentIds?.[0];
  if (!first || !first.includes(':')) return null;
  return first.split(':')[0];
}
