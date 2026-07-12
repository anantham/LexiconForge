// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { scoreAlignmentAgainst } from './align-scorer';
import type { AnatomistPass } from '../../types/suttaStudio';

const anat = (words: Array<{ id: string; surface: string }>): AnatomistPass => ({
  id: 'phase-t',
  words: words.map((w) => ({ id: w.id, surface: w.surface, wordClass: 'content' as const, segmentIds: [`${w.id}s1`] })),
  segments: words.map((w) => ({ id: `${w.id}s1`, wordId: w.id, text: w.surface, type: 'stem' as const })),
});

// Golden: "Evaṁ me sutaṁ" ↔ "So I have heard." — sutaṁ→heard, me→I; ghosts: have, So(?)
const GOLD_ANAT = anat([
  { id: 'g1', surface: 'evaṁ' },
  { id: 'g2', surface: 'me' },
  { id: 'g3', surface: 'sutaṁ' },
]);
const TOKENS = ['So', 'I', 'have', 'heard.'];
const LINKS = [
  { wordId: 'g2', tokenIdxs: [1] },
  { wordId: 'g3', tokenIdxs: [3] },
];

describe('scoreAlignmentAgainst', () => {
  it('scores a perfect alignment as 1 through the linkedPaliId encoding', () => {
    const model = anat([
      { id: 'p1', surface: 'evaṁ' },
      { id: 'p2', surface: 'me' },
      { id: 'p3', surface: 'sutaṁ' },
    ]);
    const weaver = [
      { tokenIndex: 0, text: 'So', isGhost: true },
      { tokenIndex: 1, text: 'I', linkedPaliId: 'p2' },
      { tokenIndex: 2, text: 'have', isGhost: true },
      { tokenIndex: 3, text: 'heard.', linkedPaliId: 'p3' },
    ];
    const s = scoreAlignmentAgainst(LINKS, TOKENS, GOLD_ANAT, model, weaver)!;
    expect(s).toMatchObject({ f1: 1, tp: 2, fp: 0, fn: 0 });
  });

  it('normalizes the linkedSegmentId encoding (p3s1 → word p3)', () => {
    const model = anat([{ id: 'p3', surface: 'sutaṁ' }]);
    const weaver = [{ tokenIndex: 3, text: 'heard.', linkedSegmentId: 'p3s1' }];
    const s = scoreAlignmentAgainst(LINKS, TOKENS, GOLD_ANAT, model, weaver)!;
    expect(s.tp).toBe(1);
    // g2's link is owed but p2/me was dropped by the model → fn (drop penalty)
    expect(s.fn).toBe(1);
    expect(s.recall).toBeCloseTo(0.5);
    expect(s.precision).toBe(1);
  });

  it('is tokenization-independent: matches by folded text + occurrence, not index', () => {
    const model = anat([{ id: 'p9', surface: 'sutaṁ' }]);
    // model indexes tokens differently (offset by 10) — text+occurrence must still match
    const weaver = [{ tokenIndex: 13, text: 'HEARD', linkedPaliId: 'p9' }];
    const s = scoreAlignmentAgainst(LINKS, TOKENS, GOLD_ANAT, model, weaver)!;
    expect(s.tp).toBe(1);
  });

  it('disambiguates repeated tokens by occurrence number', () => {
    const gold = anat([
      { id: 'g1', surface: 'kāye' },
      { id: 'g2', surface: 'kāyānupassī' },
    ]);
    const tokens = ['body', 'observing', 'body'];
    const links = [
      { wordId: 'g1', tokenIdxs: [0] }, // FIRST "body"
      { wordId: 'g2', tokenIdxs: [1, 2] },
    ];
    const model = anat([
      { id: 'p1', surface: 'kāye' },
      { id: 'p2', surface: 'kāyānupassī' },
    ]);
    // model links kāye to the SECOND "body" — wrong occurrence → fp + fn, not tp
    const weaver = [
      { tokenIndex: 2, text: 'body', linkedPaliId: 'p1' },
      { tokenIndex: 1, text: 'observing', linkedPaliId: 'p2' },
    ];
    const s = scoreAlignmentAgainst(links, tokens, gold, model, weaver)!;
    expect(s.tp).toBe(1); // observing
    expect(s.fp).toBe(1); // body#1 claimed for g1, golden wanted body#0
    expect(s.fn).toBe(2); // g1's body#0 + g2's body#1
  });

  it('ignores links on golden-silent words (golden gap, not model error)', () => {
    const model = anat([
      { id: 'p1', surface: 'evaṁ' },
      { id: 'p3', surface: 'sutaṁ' },
    ]);
    // golden has no link for evaṁ — the model linking it to "So" must not count as fp
    const weaver = [
      { tokenIndex: 0, text: 'So', linkedPaliId: 'p1' },
      { tokenIndex: 3, text: 'heard.', linkedPaliId: 'p3' },
    ];
    const s = scoreAlignmentAgainst(LINKS, TOKENS, GOLD_ANAT, model, weaver)!;
    expect(s.fp).toBe(0);
    expect(s.tp).toBe(1);
  });

  it('returns null when there is no reference (empty tokens or no links)', () => {
    const model = anat([{ id: 'p1', surface: 'evaṁ' }]);
    expect(scoreAlignmentAgainst([], TOKENS, GOLD_ANAT, model, [])).toBeNull();
    expect(scoreAlignmentAgainst(LINKS, [], GOLD_ANAT, model, [])).toBeNull();
  });
});
