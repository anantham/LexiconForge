// @vitest-environment node
/**
 * Regression vector for the v2.0 benchmark scorer (ADR SUTTA-009).
 *
 * These lock in the edge-case fixes from the #24 cross-family review (grok + Gemini):
 * garbage/empty output must score 0 — never a `null` free pass or an unearned gate
 * credit — and reconstruction must normalise (NFC) the way the aligner does. Plus the
 * two spec-alignment fixes: relationDensity folded into transitional-richness, and
 * golden-aware paliWordCoverage in the Gate.
 *
 * Run: npx vitest run scripts/sutta-studio/quality-scorer.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  alignWords,
  scoreAnatomist,
  scoreSegmentationFidelity,
  scoreContentFidelity,
  scorePhase,
  type PipelineOutput,
} from './quality-scorer';
import type { AnatomistPass, LexicographerPass, WeaverPass } from '../../types/suttaStudio';

// ── fixture builders ─────────────────────────────────────────────────────────
const seg = (id: string, wordId: string, text: string, tooltips: string[] = []) =>
  ({ id, wordId, text, type: 'stem' as const, tooltips });
const word = (id: string, surface: string, segmentIds: string[]) =>
  ({ id, surface, wordClass: 'content' as const, segmentIds });

/** golden: "nigamo" → ni·gam·o, "loke" → lok·e, each segment carrying tooltips. */
function goldenAnat(): AnatomistPass {
  return {
    id: 'phase-x',
    words: [word('p1', 'nigamo', ['p1s1', 'p1s2', 'p1s3']), word('p2', 'loke', ['p2s1', 'p2s2'])],
    segments: [
      seg('p1s1', 'p1', 'ni', ['ni-: down']),
      seg('p1s2', 'p1', 'gam', ['√gam: go']),
      seg('p1s3', 'p1', 'o', ['Function: nom sg']),
      seg('p2s1', 'p2', 'lok', ['√lok: world']),
      seg('p2s2', 'p2', 'e', ['Function: loc sg']),
    ],
  };
}
function goldenLex(): LexicographerPass {
  return {
    id: 'phase-x',
    senses: [
      { wordId: 'p1', wordClass: 'content', senses: [{ english: 'market town', nuance: 'small town' }] },
      { wordId: 'p2', wordClass: 'content', senses: [{ english: 'world', nuance: 'the world' }] },
    ],
  };
}
const emptyAnat = (): AnatomistPass => ({ id: 'phase-x', words: [], segments: [] });
const emptyLex = (): LexicographerPass => ({ id: 'phase-x', senses: [] });
const emptyWeaver = (): WeaverPass => ({ id: 'phase-x', tokens: [] } as WeaverPass);

const mkPipeline = (anat: AnatomistPass, lex: LexicographerPass): PipelineOutput =>
  ({
    output: { anatomist: anat, lexicographer: lex, weaver: emptyWeaver(), typesetter: null },
    segments: [{ pali: 'nigamo loke' }],
    golden: { anatomist: goldenAnat(), lexicographer: goldenLex(), weaver: null, typesetter: null },
  } as unknown as PipelineOutput);

// ── alignWords (LCS sequence alignment) ──────────────────────────────────────
describe('alignWords', () => {
  it('aligns identical sequences positionally', () => {
    expect(alignWords(goldenAnat().words, goldenAnat().words)).toEqual([[0, 0], [1, 1]]);
  });
  it('does not cascade when a middle word is dropped', () => {
    const g = [word('a', 'aaa', []), word('b', 'bbb', []), word('c', 'ccc', [])];
    const m = [word('a', 'aaa', []), word('c', 'ccc', [])];
    expect(alignWords(g, m)).toEqual([[0, 0], [2, 1]]);
  });
  it('returns [] when either side is empty', () => {
    expect(alignWords(goldenAnat().words, [])).toEqual([]);
    expect(alignWords([], goldenAnat().words)).toEqual([]);
  });
});

// ── #24 fix: garbage/empty scores 0, never a null free pass ───────────────────
describe('fidelity: garbage/empty → 0 (not null)', () => {
  it('segmentationFidelity: empty model vs golden → 0', () => {
    expect(scoreSegmentationFidelity(emptyAnat(), goldenAnat())).toBe(0);
  });
  it('segmentationFidelity: no golden → null (ungraded, excluded from ranking)', () => {
    expect(scoreSegmentationFidelity(goldenAnat(), null)).toBeNull();
  });
  it('segmentationFidelity: identical segmentation → 1', () => {
    expect(scoreSegmentationFidelity(goldenAnat(), goldenAnat())).toBe(1);
  });
  it('contentFidelity: empty model vs golden → 0', () => {
    expect(scoreContentFidelity(emptyAnat(), goldenAnat(), emptyLex(), goldenLex())).toBe(0);
  });
  it('contentFidelity: no golden → null', () => {
    expect(scoreContentFidelity(goldenAnat(), null, goldenLex(), null)).toBeNull();
  });
});

// ── #24 fix: textIntegrity (empty → 0, reconstruct under NFC) ─────────────────
describe('textIntegrity', () => {
  it('empty output → 0 (was 1, which banked ~0.85 gate credit)', () => {
    expect(scoreAnatomist(emptyAnat(), 'nigamo loke').textIntegrity).toBe(0);
  });
  it('reconstructing segments → 1', () => {
    expect(scoreAnatomist(goldenAnat(), 'nigamo loke').textIntegrity).toBe(1);
  });
  it('NFC: decomposed segment text reconstructs a precomposed surface → 1', () => {
    // surface uses precomposed ā (U+0101); segments spell it decomposed (a + U+0304).
    const decomposed: AnatomistPass = {
      id: 'phase-x',
      words: [word('p1', 'lokā', ['p1s1', 'p1s2'])],
      segments: [seg('p1s1', 'p1', 'lok'), seg('p1s2', 'p1', 'ā')],
    };
    expect(scoreAnatomist(decomposed, 'lokā').textIntegrity).toBe(1);
  });
});

// ── scorePhase end-to-end: gate must collapse on garbage ──────────────────────
describe('scorePhase: garbage must not bank credit', () => {
  it('empty model → fidelity 0, textIntegrity 0, overall ≈ 0', () => {
    const s = scorePhase(mkPipeline(emptyAnat(), emptyLex()), 'phase-x', 'garbage');
    expect(s.textIntegrity).toBe(0);
    expect(s.fidelityScore).toBe(0);
    expect(s.overallScore).toBeLessThan(0.02);
  });
  it('golden-perfect model outranks garbage by a wide margin', () => {
    const good = scorePhase(mkPipeline(goldenAnat(), goldenLex()), 'phase-x', 'good');
    const bad = scorePhase(mkPipeline(emptyAnat(), emptyLex()), 'phase-x', 'garbage');
    expect(good.fidelityScore).toBeGreaterThan(0.9);
    expect(good.overallScore - bad.overallScore).toBeGreaterThan(0.3);
  });
});

// ── #2 fix: golden-aware paliWordCoverage (Gate) ──────────────────────────────
describe('paliWordCoverage is golden-aware', () => {
  it('right NUMBER of WRONG surfaces → coverage 0 (not ~1 from a blind count ratio)', () => {
    const wrong: AnatomistPass = {
      id: 'phase-x',
      words: [word('p1', 'xxxxx', ['p1s1']), word('p2', 'yyyyy', ['p2s1'])],
      segments: [seg('p1s1', 'p1', 'xxxxx'), seg('p2s1', 'p2', 'yyyyy')],
    };
    const s = scorePhase(mkPipeline(wrong, emptyLex()), 'phase-x', 'wrong-surfaces');
    expect(s.paliWordCoverage).toBe(0);
  });
  it('full golden match → coverage 1', () => {
    const s = scorePhase(mkPipeline(goldenAnat(), goldenLex()), 'phase-x', 'good');
    expect(s.paliWordCoverage).toBe(1);
  });
});
