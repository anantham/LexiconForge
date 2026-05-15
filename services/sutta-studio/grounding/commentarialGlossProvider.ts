/**
 * Commentarial-Gloss Provider (GROUNDING Phase 4).
 *
 * Reads `data/sutta-studio/grounding/commentarial-glosses.json` (produced
 * by `scripts/sutta-studio/fetch-vism-glosses.ts` from the Eudoxos / edhamma
 * Visuddhimagga TEI glossary) and exposes each entry as a GroundedClaim.
 *
 * Per GROUNDING.md: deterministic lookups, no LLM, missing -> empty array.
 * The pass marks unmatched terms as interpretive rather than fabricating
 * commentarial backing.
 *
 * Each entry produces:
 *   - One citation linking to the Eudoxos glossary's hosted genindex page
 *   - Zero-or-more citations, one per Visuddhimagga section reference
 *     (e.g., "III.68"), each pointing at the corresponding Sphinx HTML
 *     anchor (ch-03.html#iii-68).
 *
 * Licensing: BPS-copyrighted Ñāṇamoli translation, Edhamma awaiting
 * permission. Citation + clickable link to an externally-hosted page is
 * fair use; we do NOT redistribute Vism body text. See the source script
 * and AMORTIZATION.md for the licensing notes.
 */

import type { Citation } from '../../../types/suttaStudio';
import type { GroundedClaim, GroundingProvider } from './types';

type GlossEntry = {
  title: string;
  gloss: string;
  vismRefs: string[];
  pageId?: string;
};

type GlossFile = {
  _meta: {
    source: string;
    sourceUrl: string;
    sphinxBaseUrl: string;
    fetchedAt: string;
    license: string;
    entryCount: number;
    note: string;
  };
  entries: Record<string, GlossEntry>;
};

const ROMAN_NUMERAL_MAP: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9,
  X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16,
  XVII: 17, XVIII: 18, XIX: 19, XX: 20, XXI: 21, XXII: 22, XXIII: 23,
};

/**
 * Map a Vism ref like "III.68" to a Sphinx HTML URL.
 *
 * Chapter file pattern: ch-NN.html (zero-padded arabic).
 * Section anchor pattern: lower-roman + "-" + arabic (e.g., "iii-68").
 *
 * If the Roman numeral isn't recognized (unusual upstream format), fall
 * back to the chapter index page so the link is still functional.
 */
function vismRefToUrl(ref: string, sphinxBase: string): string {
  const m = /^([IVXLCDM]+)\.(\d+)$/.exec(ref.trim());
  if (!m) return sphinxBase;
  const [, romanRaw, sectionNum] = m;
  const roman = romanRaw.toUpperCase();
  const chapterNum = ROMAN_NUMERAL_MAP[roman];
  if (!chapterNum) return sphinxBase;
  const chapterFile = `ch-${String(chapterNum).padStart(2, '0')}.html`;
  const anchor = `${roman.toLowerCase()}-${sectionNum}`;
  return `${sphinxBase}${chapterFile}#${anchor}`;
}

function slugifyForCitationId(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function buildCitationsForEntry(
  entryKey: string,
  entry: GlossEntry,
  sphinxBase: string,
  license: string,
  fetchedAt: string
): Citation[] {
  const citations: Citation[] = [];
  const entrySlug = slugifyForCitationId(entryKey);

  citations.push({
    id: `cite:vism-gloss:${entrySlug}`,
    short: `Nyanamoli, Vism glossary: "${entry.gloss.slice(0, 80)}"`,
    url: `${sphinxBase}genindex.html`,
    excerpt: entry.gloss,
    provenance: 'manual',
    query: entryKey,
    fetchedAt,
    license,
  });

  for (const ref of entry.vismRefs) {
    citations.push({
      id: `cite:vism:${slugifyForCitationId(ref)}:${entrySlug}`,
      short: `Visuddhimagga ${ref}`,
      url: vismRefToUrl(ref, sphinxBase),
      excerpt: entry.gloss,
      provenance: 'manual',
      query: entryKey,
      fetchedAt,
      license,
    });
  }

  return citations;
}

export class CommentarialGlossProvider implements GroundingProvider {
  readonly name = 'commentarial-glosses';
  private readonly glossFile: GlossFile;
  private readonly cache = new Map<string, GroundedClaim[]>();

  constructor(glossFile: GlossFile) {
    this.glossFile = glossFile;
  }

  async lookup(term: string): Promise<GroundedClaim[]> {
    if (this.cache.has(term)) return this.cache.get(term)!;
    if (!term) {
      this.cache.set(term, []);
      return [];
    }

    const normalized = term.toLowerCase();
    const claims: GroundedClaim[] = [];

    for (const [entryKey, entry] of Object.entries(this.glossFile.entries)) {
      const candidateTitles = [entryKey.toLowerCase()];
      if (entryKey.startsWith('*')) candidateTitles.push(entryKey.slice(1).toLowerCase());

      const matches = candidateTitles.some((t) => {
        if (t === normalized) return true;
        if (normalized.includes(t) && t.length >= 4) return true;
        return this.stemPrefixMatch(t, normalized);
      });
      if (!matches) continue;

      const citations = buildCitationsForEntry(
        entryKey,
        entry,
        this.glossFile._meta.sphinxBaseUrl,
        this.glossFile._meta.license,
        this.glossFile._meta.fetchedAt
      );
      if (citations.length === 0) continue;

      claims.push({
        term: entryKey,
        citations,
        narrative: entry.gloss,
      });
    }

    this.cache.set(term, claims);
    return claims;
  }

  private stemPrefixMatch(registryTerm: string, term: string): boolean {
    if (registryTerm.length < 4) return false;
    const vowels = new Set('aāiīuūeoṁ');
    const lastChar = registryTerm[registryTerm.length - 1].toLowerCase();
    if (!vowels.has(lastChar)) return false;
    const stem = registryTerm.slice(0, -1);
    return term.startsWith(stem);
  }
}

export async function loadCommentarialGlosses(
  fetchFn?: () => Promise<GlossFile>
): Promise<GlossFile> {
  if (fetchFn) return fetchFn();
  const mod = await import(
    '../../../data/sutta-studio/grounding/commentarial-glosses.json'
  );
  return (mod.default ?? mod) as GlossFile;
}

export const __testUtils = { vismRefToUrl, slugifyForCitationId, ROMAN_NUMERAL_MAP };
