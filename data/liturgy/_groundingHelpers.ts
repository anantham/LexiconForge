/**
 * Citation helpers for liturgy word data.
 *
 * Three grounding sources used across the liturgy reader:
 *  1. DPD (Digital Pāli Dictionary) — etymology + gloss per lemma.
 *  2. SuttaCentral pronunciation guide — pronunciation respelling rules.
 *  3. Contested-terms registry (data/sutta-studio/grounding/contested-terms.json)
 *     — for the 11 hand-curated terms it covers.
 *
 * Each helper mints a Citation with a deterministic id following the same
 * scheme used elsewhere in the project (see services/providers/citationHelpers.ts).
 */

import type { Citation } from '../../types/suttaStudio';

const TODAY = new Date().toISOString().slice(0, 10);

const DPD_LICENSE =
  'CC BY-NC-SA 4.0 — Digital Pāli Dictionary by Bryan Levman et al.';

const SC_PRON_LICENSE = 'CC BY-SA 4.0 — SuttaCentral';

/**
 * DPD permalink for a Pāli lemma. URL pattern verified live on dpdict.net.
 * Pass the lemma (dictionary form), not the surface form.
 */
export function dpdCitation(lemma: string): Citation {
  return {
    id: `cite:dpd:${lemma}`,
    short: `DPD s.v. ${lemma}`,
    url: `https://dpdict.net/?q=${encodeURIComponent(lemma)}`,
    provenance: 'dpd',
    query: lemma,
    fetchedAt: TODAY,
    license: DPD_LICENSE,
  };
}

/**
 * SuttaCentral's canonical Pāli pronunciation page. The respellings in
 * the data are *derived* from this guide's rules, not verbatim from it —
 * cite the guide as the authority for the underlying convention.
 */
export function suttaCentralPronunciationCitation(): Citation {
  return {
    id: 'cite:sc-pronunciation',
    short: 'SC Pāli pronunciation guide',
    detail: 'Respelling derived from SuttaCentral\'s pronunciation rules (Bhikkhu Sujato et al.).',
    url: 'https://suttacentral.net/pronunciation',
    provenance: 'sc-suttaplex' as Citation['provenance'],
    query: 'pronunciation',
    fetchedAt: TODAY,
    license: SC_PRON_LICENSE,
  };
}

/**
 * Citation back to the hand-curated contested-terms registry for a term
 * that already lives there. Reuses the same id scheme as Sutta Studio's
 * ContestedTermProvider.
 */
export function contestedTermCitation(term: string): Citation {
  return {
    id: `cite:contested-terms:${term}`,
    short: `Contested-terms registry: ${term}`,
    detail: 'Hand-curated multi-translator renderings + commentarial context.',
    url: `https://github.com/anantham/LexiconForge/blob/main/data/sutta-studio/grounding/contested-terms.json#${encodeURIComponent(term)}`,
    provenance: 'manual' as Citation['provenance'],
    query: term,
    fetchedAt: TODAY,
    license: 'Project-internal hand-curation',
  };
}

/**
 * Honest placeholder when a claim hasn't been verified against DPD/PED yet.
 * Renders as a visible "⚠ needs reference" chip in the UI so the gap is
 * obvious rather than hidden.
 */
export function ungroundedCitation(reason: string): Citation {
  return {
    id: `cite:ungrounded:${reason.replace(/\s+/g, '-').slice(0, 40)}`,
    short: `⚠ ungrounded — ${reason}`,
    provenance: 'manual' as Citation['provenance'],
    query: '',
    fetchedAt: TODAY,
    license: 'unverified',
  };
}
