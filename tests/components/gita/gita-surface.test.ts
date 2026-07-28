// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { GITA_STHITAPRAJNA, BUILD_DIAGNOSTICS, IAST_FALLBACKS } from '../../../data/gita/sthitaprajna';
import { BG2_SOURCE } from '../../../data/gita/bg2-source';
import { romanizationMatches, aksharasOf } from '../../../components/liturgy/concept/devanagari';
import type { AlignSegment, AlignToken } from '../../../types/liturgyAlign';

/**
 * Surface law + self-validation honesty for the Gītā deep reader
 * (data/gita/sthitaprajna.ts). Three guarantees, all mechanical:
 *
 *  1. SURFACE — every curated segment's Sanskrit tokens concatenate back to
 *     the EXACT fetched source line (data/gita/bg2-source.ts, generated
 *     verbatim from sa.wikisource), and every token's pieces concatenate to
 *     the token. No retyped or paraphrased mūla can ship.
 *  2. SOUND — every word either romanizes back to its curated IAST
 *     (devanagari.ts's self-validation) and shows per-akshara sounds, or it
 *     is explicitly flagged for whole-word IAST fallback. Never a guessed
 *     sound on this text.
 *  3. ALIGNMENT — unit bindings are closed (no dangling ids on either side),
 *     English chunks stay word-splittable (the Malayalam validator's
 *     granularity rule), and coverage is total: 23 verses, both halves each.
 */

const segments = GITA_STHITAPRAJNA;
const bySrcKey = (s: AlignSegment) => s.id.replace(/^bg2-/, '');
const saRow = (s: AlignSegment) => s.renderings.find((r) => r.lang === 'sa-Deva')!;
const enRow = (s: AlignSegment) => s.renderings.find((r) => r.lang === 'en')!;
const isMarker = (t: AlignToken) => !t.pronunciation; // daṇḍa / ॥२- NN॥ tokens
const wordTokens = segments.flatMap((s) => saRow(s).tokens.filter((t) => !isMarker(t)));

describe('gītā sthitaprajña — builder integrity', () => {
  it('the builder recorded no curation inconsistencies', () => {
    expect(BUILD_DIAGNOSTICS).toEqual([]);
  });

  it('all 23 verses currently render with validated akshara sounds (no IAST fallbacks in use)', () => {
    // Adding a word to this list must be a conscious act — flag it
    // `iastFallback` in the data AND record it here.
    expect(IAST_FALLBACKS).toEqual([]);
  });
});

describe('gītā sthitaprajña — coverage', () => {
  it('carries every half-verse 2.50–2.72 plus both speaker lines (segment set = source set)', () => {
    const keys = segments.filter((s) => !s.title).map(bySrcKey).sort();
    expect(keys).toEqual(Object.keys(BG2_SOURCE).sort());
    // 23 verses, a + b halves each
    const verses = new Set(
      keys.filter((k) => /[ab]$/.test(k)).map((k) => Number(k.slice(0, -1))),
    );
    expect([...verses].sort((x, y) => x - y)).toEqual(
      Array.from({ length: 23 }, (_, i) => 50 + i),
    );
    for (const v of verses) {
      expect(keys).toContain(`${v}a`);
      expect(keys).toContain(`${v}b`);
    }
  });
});

describe('gītā sthitaprajña — surface law', () => {
  it('every segment’s Sanskrit tokens reconstruct the fetched source line exactly', () => {
    for (const seg of segments) {
      if (seg.title) continue; // editorial title — not part of the mūla
      const joined = saRow(seg).tokens.map((t) => t.text).join(' ');
      expect(joined, `segment ${seg.id}`).toBe(BG2_SOURCE[bySrcKey(seg)]);
    }
  });

  it('every token’s pieces concatenate to its exact written surface', () => {
    for (const seg of segments)
      for (const t of saRow(seg).tokens)
        if (t.segments?.length) {
          expect(t.segments.map((p) => p.text).join(''), `${seg.id}: "${t.text}"`).toBe(t.text);
        }
  });
});

describe('gītā sthitaprajña — no guessed sounds', () => {
  it('every word romanizes back to its curated IAST', () => {
    const fails = wordTokens
      .filter((t) => !romanizationMatches(t.text, t.pronunciation!))
      .map((t) => `${t.pronunciation} ⇏ ${aksharasOf(t.text).map((a) => a.rom).join('')}`);
    expect(fails, `romanization mismatches: ${fails.join(' | ')}`).toEqual([]);
  });

  it('every validated word carries its akshara sound row; every akshara is sounded', () => {
    for (const t of wordTokens) {
      expect(t.segments?.length, `"${t.text}" has no akshara pieces`).toBeGreaterThan(0);
      for (const p of t.segments!) {
        expect(p.akshara, `"${t.text}" piece "${p.text}" not marked akshara`).toBe(true);
        expect(p.pronunciation, `"${t.text}" piece "${p.text}" has no sound`).toBeTruthy();
      }
    }
  });

  it('avagraha honesty: the romanizer gate accepts the apostrophe and still rejects real errors', () => {
    expect(romanizationMatches('रसोऽप्यस्य', "raso'pyasya")).toBe(true);
    expect(romanizationMatches('स्थित्वास्यामन्तकालेऽपि', "sthitvāsyāmantakāle'pi")).toBe(true);
    // negative controls — the fold must not have widened the gate
    expect(romanizationMatches('रसोऽप्यस्य', "raso'pyasyā")).toBe(false);
    expect(romanizationMatches('रसोऽप्यस्य', "rase'pyasya")).toBe(false);
  });
});

describe('gītā sthitaprajña — alignment contract', () => {
  it('every token binds only units present in its segment’s spine; every unit is realized in Sanskrit', () => {
    for (const seg of segments) {
      const ids = new Set(seg.units.map((u) => u.id));
      const realized = new Set<string>();
      for (const r of seg.renderings)
        for (const t of r.tokens) {
          for (const u of t.units) {
            expect(ids.has(u), `${seg.id}: token "${t.text}" → unknown unit ${u}`).toBe(true);
            if (r.lang === 'sa-Deva') realized.add(u);
          }
          for (const p of t.segments ?? [])
            for (const u of p.units ?? [])
              expect(ids.has(u), `${seg.id}: piece "${p.text}" → unknown unit ${u}`).toBe(true);
        }
      for (const u of seg.units)
        expect(realized.has(u.id), `${seg.id}: unit "${u.id}" realized by no Sanskrit token`).toBe(true);
    }
  });

  it('English chunks stay word-splittable: no multi-word chunk carries ≥2 units', () => {
    for (const seg of segments)
      for (const t of enRow(seg).tokens)
        if (t.units.length >= 2 && t.text.trim().split(/\s+/).length >= 2) {
          throw new Error(`${seg.id}: EN chunk "${t.text}" carries ${t.units.length} units — split it`);
        }
  });

  it('every English rendering is labeled as the unreviewed draft witness it is', () => {
    for (const seg of segments) {
      const en = enRow(seg);
      expect(en.by).toBe('fable-draft');
      expect(en.label.toLowerCase()).toContain('draft');
    }
  });

  it('every Sanskrit word offers a hover meaning (units or gloss); markers are glossed too', () => {
    for (const seg of segments)
      for (const t of saRow(seg).tokens) {
        expect(
          t.units.length > 0 || !!t.gloss,
          `${seg.id}: "${t.text}" has neither units nor gloss`,
        ).toBe(true);
      }
  });
});
