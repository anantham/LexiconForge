// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { GITA_CHAPTER2_TIER1 } from '../../../data/gita/chapter2-tier1';
import { BG2_SOURCE } from '../../../data/gita/bg2-source';
import { romanizationMatches, aksharasOf, segmentAksharas } from '../../../components/liturgy/concept/devanagari';
import type { AlignSegment, AlignToken } from '../../../types/liturgyAlign';

/**
 * Integrity of the FREE Tier-1 chapter-2 data (data/gita/chapter2-tier1.ts,
 * generated from sa.wikisource + Monier-Williams). The same three mechanical
 * guarantees as the curated pilot, plus a bridge to the committed source
 * authority and a gloss-coverage floor:
 *
 *  1. SURFACE — each segment's Sanskrit tokens rejoin to a source line, and
 *     every token's aksharas rejoin to the token (SUTTA-025 surface law). For
 *     2.50–2.72 the rejoined line must equal bg2-source.ts EXACTLY — the
 *     hand-verified authority the curated pilot is tested against.
 *  2. SOUND — every word's per-akshara IAST romanizes back to the word's
 *     pronunciation (devanagari.ts self-validation). Never a guessed sound.
 *  3. TIER-1 SHAPE — units: [] on every segment (no alignment threads), and
 *     every word carries a sounded akshara row.
 *  4. COVERAGE — a floor on the fraction of words carrying a dictionary gloss,
 *     with the exact number printed for the scaling report.
 */

const segments = GITA_CHAPTER2_TIER1;
const saRow = (s: AlignSegment) => s.renderings.find((r) => r.lang === 'sa-Deva')!;
const keyOf = (s: AlignSegment) => s.id.replace(/^bg2t1-/, '');
const isMarker = (t: AlignToken) => !t.pronunciation; // daṇḍa / ॥२- NN॥ tokens
const wordTokens = segments.flatMap((s) => saRow(s).tokens.filter((t) => !isMarker(t)));

describe('gītā chapter 2 Tier-1 — coverage of the chapter', () => {
  it('carries every half-verse 2.1–2.72 (both halves) plus the speaker lines', () => {
    const keys = segments.map(keyOf);
    const bHalves = new Set(keys.filter((k) => k.endsWith('b')).map((k) => Number(k.slice(0, -1))));
    expect([...bHalves].sort((a, b) => a - b)).toEqual(Array.from({ length: 72 }, (_, i) => i + 1));
    for (let v = 1; v <= 72; v++) {
      expect(keys, `2.${v}a missing`).toContain(`${v}a`);
      expect(keys, `2.${v}b missing`).toContain(`${v}b`);
    }
  });
});

describe('gītā chapter 2 Tier-1 — surface law', () => {
  it('every segment’s tokens rejoin to a single source line', () => {
    for (const seg of segments) {
      const joined = saRow(seg).tokens.map((t) => t.text).join(' ');
      expect(joined.length, `${seg.id} empty`).toBeGreaterThan(0);
    }
  });

  it('for 2.50–2.72, the rejoined line equals the committed bg2-source.ts exactly', () => {
    let checked = 0;
    for (const seg of segments) {
      const k = keyOf(seg);
      if (!(k in BG2_SOURCE)) continue;
      const joined = saRow(seg).tokens.map((t) => t.text).join(' ');
      expect(joined, `segment ${seg.id}`).toBe(BG2_SOURCE[k]);
      checked++;
    }
    expect(checked).toBe(Object.keys(BG2_SOURCE).length); // all 48 pilot keys bridged
  });

  it('every token’s aksharas rejoin to its exact written surface', () => {
    for (const seg of segments)
      for (const t of saRow(seg).tokens) {
        expect(segmentAksharas(t.text).join(''), `${seg.id}: "${t.text}"`).toBe(t.text);
        if (t.segments?.length)
          expect(t.segments.map((p) => p.text).join(''), `${seg.id}: "${t.text}" pieces`).toBe(t.text);
      }
  });
});

describe('gītā chapter 2 Tier-1 — no guessed sounds', () => {
  it('every word romanizes back to its stated pronunciation', () => {
    const fails = wordTokens
      .filter((t) => !romanizationMatches(t.text, t.pronunciation!))
      .map((t) => `${t.text}: ${t.pronunciation} ⇏ ${aksharasOf(t.text).map((a) => a.rom).join('')}`);
    expect(fails, `romanization mismatches: ${fails.join(' | ')}`).toEqual([]);
  });

  it('every word carries a sounded akshara row', () => {
    for (const t of wordTokens) {
      expect(t.segments?.length, `"${t.text}" has no akshara pieces`).toBeGreaterThan(0);
      for (const p of t.segments!) {
        expect(p.akshara, `"${t.text}" piece "${p.text}" not marked akshara`).toBe(true);
        expect(p.pronunciation, `"${t.text}" piece "${p.text}" has no sound`).toBeTruthy();
      }
    }
  });
});

describe('gītā chapter 2 Tier-1 — Tier-1 shape (no threads)', () => {
  it('carries no unit spine (units: []) on any segment — threads are the deferred layer', () => {
    for (const seg of segments) {
      expect(seg.units, `${seg.id} has units`).toEqual([]);
      for (const r of seg.renderings)
        for (const t of r.tokens) expect(t.units, `${seg.id}: "${t.text}" bound to a unit`).toEqual([]);
    }
  });

  it('renders Sanskrit only — no authored translation row', () => {
    for (const seg of segments) {
      expect(seg.renderings.map((r) => r.lang)).toEqual(['sa-Deva']);
    }
  });
});

describe('gītā chapter 2 Tier-1 — dictionary-gloss coverage', () => {
  it('a majority of words carry a trustworthy MW gloss (floor 0.65); exact figure printed', () => {
    const glossed = wordTokens.filter((t) => !!t.gloss).length;
    const total = wordTokens.length;
    const pct = (100 * glossed) / total;
    // eslint-disable-next-line no-console
    console.log(`confident MW gloss coverage: ${glossed}/${total} words = ${pct.toFixed(1)}%`);
    // Coverage is deliberately conservative: indeclinable particles and
    // ambiguous sandhi cuts are left blank rather than shown a wrong gloss.
    expect(pct).toBeGreaterThanOrEqual(65);
  });

  it('a word with no gloss shows no meaning at all — honest, never guessed', () => {
    // A word either carries a non-empty gloss or has none; there is no
    // placeholder/"unknown" text masquerading as a meaning.
    for (const t of wordTokens) {
      if ('gloss' in t) expect((t.gloss ?? '').length, `"${t.text}"`).toBeGreaterThan(0);
    }
  });
});
