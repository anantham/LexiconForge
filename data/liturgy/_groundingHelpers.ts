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

/**
 * Wikipedia citation — starting-point reference for general etymology /
 * cross-tradition transliteration. Useful for non-Pāli chants (Sanskrit
 * mantras, East Asian renderings) where DPD doesn't apply. Treat as a
 * launching point, not authority.
 */
export function wikipediaCitation(article: string): Citation {
  return {
    id: `cite:wikipedia:${article.replace(/\s+/g, '_')}`,
    short: `Wikipedia: ${article}`,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(article.replace(/\s+/g, '_'))}`,
    provenance: 'manual' as Citation['provenance'],
    query: article,
    fetchedAt: TODAY,
    license: 'CC BY-SA 4.0 — Wikipedia',
  };
}

/**
 * 84000 Reading-Room glossary entry. Permalinks live at
 * `84000.co/glossary/<slug>`. If you don't have the slug yet, pass `null`
 * to get an honest placeholder citation that the UI will surface as
 * "needs 84000 lookup" — gap stays visible until research lands.
 *
 * `excerpt` is the relevant fragment from the entry; embed it so the
 * reader can show authoritative grounding without re-fetching.
 */
export function eightyFourThousandCitation(
  slug: string | null,
  term: string,
  excerpt?: string,
): Citation {
  if (!slug) {
    return {
      id: `cite:84000:unresolved:${term}`,
      short: `84000 glossary: ${term} (slug not yet resolved)`,
      detail: 'Permalink not yet looked up. Search 84000.co/glossary to resolve.',
      provenance: '84000',
      query: term,
      excerpt,
      fetchedAt: TODAY,
      license: 'CC BY-NC-ND 4.0 — 84000 Reading Room',
    };
  }
  return {
    id: `cite:84000:${slug}`,
    short: `84000 glossary: ${term}`,
    url: `https://84000.co/glossary/${slug}`,
    provenance: '84000',
    query: term,
    excerpt,
    fetchedAt: TODAY,
    license: 'CC BY-NC-ND 4.0 — 84000 Reading Room',
  };
}

/**
 * Digital Dictionary of Buddhism (Charles Muller, ed.). Entries at
 * buddhism-dict.net; login-walled but URLs are public. Pass the headword
 * exactly as DDB uses it. Embed the relevant excerpt for in-reader
 * grounding without round-tripping to the server.
 */
export function ddbCitation(headword: string, excerpt?: string): Citation {
  return {
    id: `cite:ddb:${headword.replace(/\s+/g, '_').slice(0, 80)}`,
    short: `DDB s.v. ${headword}`,
    detail: 'Digital Dictionary of Buddhism (ed. Charles Muller). Login required for full entry.',
    url: `http://www.buddhism-dict.net/cgi-bin/xpr-ddb.pl?q=${encodeURIComponent(headword)}`,
    provenance: 'manual' as Citation['provenance'],
    query: headword,
    excerpt,
    fetchedAt: TODAY,
    license: 'DDB content licensed for academic use; see buddhism-dict.net',
  };
}

/**
 * Princeton Dictionary of Buddhism (Buswell & Lopez 2014). Print-only —
 * cite by entry headword + page number. UI renders as "Princeton
 * Dictionary p. 655" with no clickable URL.
 *
 * Pass `null` for page if not yet verified; renders as page-needed and
 * the gap stays visible.
 */
export function princetonDictionaryCitation(
  entry: string,
  page?: number | null,
  excerpt?: string,
): Citation {
  const pageStr = page ? `p. ${page}` : 'page needed';
  return {
    id: `cite:princeton:${entry.replace(/\s+/g, '_').slice(0, 80)}`,
    short: `Princeton Dictionary of Buddhism, s.v. ${entry} (${pageStr})`,
    detail: 'Buswell & Lopez (eds.), *The Princeton Dictionary of Buddhism* (2014). Print.',
    provenance: 'manual' as Citation['provenance'],
    query: entry,
    excerpt,
    fetchedAt: TODAY,
    license: 'Quoted by entry-name for scholarly reference; © Princeton University Press',
  };
}

/**
 * Soothill & Hodous, *A Dictionary of Chinese Buddhist Terms* (1937).
 * Older but still standard for Buddhist Chinese vocabulary. Public
 * domain. DDB embeds it for cross-reference. Pass the Chinese headword.
 */
export function soothillHodousCitation(headword: string, excerpt?: string): Citation {
  return {
    id: `cite:soothill:${headword}`,
    short: `Soothill–Hodous s.v. ${headword}`,
    detail: 'Soothill & Hodous, *A Dictionary of Chinese Buddhist Terms* (1937). Public domain.',
    url: `http://mahajana.net/texts/soothill-hodous.html`,
    provenance: 'manual' as Citation['provenance'],
    query: headword,
    excerpt,
    fetchedAt: TODAY,
    license: 'Public domain (1937)',
  };
}

/**
 * H.H. the Dalai Lama's official commentary on a topic. Uses dalailama.com
 * permalinks where they exist.
 */
export function dalaiLamaCitation(slug: string, title: string): Citation {
  return {
    id: `cite:dalailama:${slug}`,
    short: `H.H. the Dalai Lama — ${title}`,
    url: `https://www.dalailama.com/${slug}`,
    provenance: 'manual' as Citation['provenance'],
    query: title,
    fetchedAt: TODAY,
    license: 'Public address — quoted with attribution',
  };
}
