import { describe, it, expect } from 'vitest';
import { CommentarialGlossProvider, __testUtils } from '../../services/sutta-studio/grounding/commentarialGlossProvider';

const { vismRefToUrl, slugifyForCitationId } = __testUtils;

const SPHINX = 'https://edhamma.github.io/vism/sphinx/build/html/';

const fixture = {
  _meta: {
    source: 'edhamma/vism (test)',
    sourceUrl: 'https://example.test/gloss.tei',
    sphinxBaseUrl: SPHINX,
    fetchedAt: '2026-05-14',
    license: 'BPS test',
    entryCount: 4,
    note: 'test fixture',
  },
  entries: {
    sati: {
      title: 'sati',
      gloss: 'mindfulness',
      vismRefs: [],
      pageId: '843',
    },
    'satipaṭṭhāna': {
      title: 'satipaṭṭhāna',
      gloss: 'foundation of mindfulness',
      vismRefs: ['III.68', 'VIII.145'],
    },
    nibbāna: {
      title: 'nibbāna',
      gloss: 'extinction; the unconditioned',
      vismRefs: ['XVI.62'],
    },
    // Asterisk-prefixed entry (PED supplement marker)
    '*aṇimā': {
      title: '*aṇimā',
      gloss: 'minuteness',
      vismRefs: ['VII.61'],
    },
  },
};

describe('vismRefToUrl', () => {
  it('maps a simple Roman.arabic ref to the Sphinx chapter anchor', () => {
    expect(vismRefToUrl('III.68', SPHINX)).toBe(`${SPHINX}ch-03.html#iii-68`);
  });

  it('handles two-letter Roman numerals', () => {
    expect(vismRefToUrl('XVII.45', SPHINX)).toBe(`${SPHINX}ch-17.html#xvii-45`);
    expect(vismRefToUrl('XXIII.1', SPHINX)).toBe(`${SPHINX}ch-23.html#xxiii-1`);
  });

  it('zero-pads the chapter number', () => {
    expect(vismRefToUrl('I.1', SPHINX)).toBe(`${SPHINX}ch-01.html#i-1`);
    expect(vismRefToUrl('IX.10', SPHINX)).toBe(`${SPHINX}ch-09.html#ix-10`);
  });

  it('falls back to the base URL for malformed refs', () => {
    expect(vismRefToUrl('not-a-ref', SPHINX)).toBe(SPHINX);
    expect(vismRefToUrl('III', SPHINX)).toBe(SPHINX);
    expect(vismRefToUrl('XXIV.1', SPHINX)).toBe(SPHINX); // unknown Roman
  });
});

describe('slugifyForCitationId', () => {
  it('lowercases + replaces non-alphanumeric with hyphens', () => {
    expect(slugifyForCitationId('III.68')).toBe('iii-68');
    expect(slugifyForCitationId('satipaṭṭhāna')).toBe('satipa-h-na');
    expect(slugifyForCitationId('*aṇimā')).toBe('a-im');
  });
});

describe('CommentarialGlossProvider', () => {
  it('returns claims for an exact-match term', async () => {
    const provider = new CommentarialGlossProvider(fixture as any);
    const claims = await provider.lookup('sati');
    expect(claims.length).toBeGreaterThan(0);

    const satiClaim = claims.find((c) => c.term === 'sati');
    expect(satiClaim).toBeTruthy();
    expect(satiClaim!.narrative).toBe('mindfulness');
    expect(satiClaim!.citations.length).toBeGreaterThan(0);
    expect(satiClaim!.citations[0].url).toContain('genindex.html');
  });

  it('returns one citation per Vism section ref + one glossary anchor', async () => {
    const provider = new CommentarialGlossProvider(fixture as any);
    const claims = await provider.lookup('satipaṭṭhāna');

    const claim = claims.find((c) => c.term === 'satipaṭṭhāna');
    expect(claim).toBeTruthy();
    // 1 glossary anchor + 2 Vism refs = 3 citations
    expect(claim!.citations).toHaveLength(3);

    const vismCitations = claim!.citations.filter((c) => c.id.startsWith('cite:vism:'));
    expect(vismCitations).toHaveLength(2);
    expect(vismCitations.map((c) => c.url).sort()).toEqual([
      `${SPHINX}ch-03.html#iii-68`,
      `${SPHINX}ch-08.html#viii-145`,
    ]);
  });

  it('matches substring (e.g., satipaṭṭhāna inside the surface "satipaṭṭhānā")', async () => {
    const provider = new CommentarialGlossProvider(fixture as any);
    const claims = await provider.lookup('satipaṭṭhānā');
    const claim = claims.find((c) => c.term === 'satipaṭṭhāna');
    expect(claim).toBeTruthy();
  });

  it('matches stem-prefix (drop final Pali vowel)', async () => {
    // 'nibbānaṁ' starts with 'nibbān' = stem of 'nibbāna' (drop final 'a')
    const provider = new CommentarialGlossProvider(fixture as any);
    const claims = await provider.lookup('nibbānaṁ');
    const claim = claims.find((c) => c.term === 'nibbāna');
    expect(claim).toBeTruthy();
  });

  it('matches asterisk-prefixed entries via their unstarred form', async () => {
    const provider = new CommentarialGlossProvider(fixture as any);
    const claims = await provider.lookup('aṇimā');
    const claim = claims.find((c) => c.term === '*aṇimā');
    expect(claim).toBeTruthy();
  });

  it('returns empty array for unknown terms (no LLM fallback)', async () => {
    const provider = new CommentarialGlossProvider(fixture as any);
    const claims = await provider.lookup('xyz-not-in-glossary');
    expect(claims).toEqual([]);
  });

  it('caches lookup results across repeated queries', async () => {
    const provider = new CommentarialGlossProvider(fixture as any);
    const a = await provider.lookup('sati');
    const b = await provider.lookup('sati');
    expect(a).toBe(b); // same reference -> cache hit
  });

  it('returns empty array for empty string term', async () => {
    const provider = new CommentarialGlossProvider(fixture as any);
    const claims = await provider.lookup('');
    expect(claims).toEqual([]);
  });

  it('every citation has the required Citation fields', async () => {
    const provider = new CommentarialGlossProvider(fixture as any);
    const claims = await provider.lookup('satipaṭṭhāna');
    for (const claim of claims) {
      for (const c of claim.citations) {
        expect(c.id).toBeTruthy();
        expect(c.short).toBeTruthy();
        expect(c.url).toMatch(/^https?:\/\//);
        expect(c.excerpt).toBeTruthy();
        expect(c.provenance).toBe('manual');
        expect(c.query).toBeTruthy();
        expect(c.fetchedAt).toBeTruthy();
        expect(c.license).toBeTruthy();
      }
    }
  });
});
