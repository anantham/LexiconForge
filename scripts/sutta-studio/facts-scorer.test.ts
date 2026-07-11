// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { scoreFactsDetail, scoreSenseFidelityDetail, extractRoots, rootStem } from './facts-scorer';
import type { AnatomistPass, LexicographerPass } from '../../types/suttaStudio';
import type { LexiconEntry } from '../../services/providers/types';

const anat = (
  words: Array<{ id: string; surface: string; wordClass: 'content' | 'function'; tips?: string[]; morph?: Record<string, string> }>
): AnatomistPass => ({
  id: 'phase-t',
  words: words.map((w) => ({ id: w.id, surface: w.surface, wordClass: w.wordClass, segmentIds: [`${w.id}s1`] })),
  segments: words.map((w) => ({
    id: `${w.id}s1`,
    wordId: w.id,
    text: w.surface,
    type: 'stem' as const,
    tooltips: w.tips || [],
    ...(w.morph ? { morph: w.morph as never } : {}),
  })),
});

const lex = (entries: Array<{ wordId: string; senses: Array<{ english: string; nuance?: string }> }>): LexicographerPass => ({
  id: 'phase-t',
  senses: entries.map((e) => ({
    wordId: e.wordId,
    wordClass: 'content' as const,
    senses: e.senses.map((s) => ({ english: s.english, nuance: s.nuance ?? '' })),
  })),
});

const dpdWith = (roots: Record<string, string>) => (surface: string): LexiconEntry[] => {
  const r = roots[surface.toLowerCase()];
  return r ? [{ lemma: surface, senses: [{ english: 'x', citation: `Sanskrit: y [${r}]` }] } as unknown as LexiconEntry] : [];
};

describe('scoreFactsDetail', () => {
  it('grades root claims against DPD: match, fabrication, and silence', () => {
    const gold = anat([
      { id: 'g1', surface: 'gacchati', wordClass: 'content', tips: ['√gam: to go'] },
      { id: 'g2', surface: 'suttaṁ', wordClass: 'content', tips: ['√su: to hear'] },
      { id: 'g3', surface: 'dhammo', wordClass: 'content', tips: ['√dhar: to hold'] },
    ]);
    const model = anat([
      { id: 'p1', surface: 'gacchati', wordClass: 'content', tips: ['√gam: movement'] }, // match
      { id: 'p2', surface: 'suttaṁ', wordClass: 'content', tips: ['√sup: to sleep'] }, // fabricated root
      { id: 'p3', surface: 'dhammo', wordClass: 'content', tips: ['a teaching'] }, // silent
    ]);
    const dpd = dpdWith({ gacchati: 'gam', suttaṁ: 'su', dhammo: 'dhar' });

    const r = scoreFactsDetail(model, gold, dpd)!;

    expect(r.root).toEqual({ correct: 1, total: 3, fabricated: 1, silent: 1, dropped: 0 });
    expect(r.pos).toEqual({ correct: 3, total: 3 });
    expect(r.accuracy).toBeCloseTo(4 / 6);
    // macro: mean of root (1/3) and pos (3/3) — morph ungraded here
    expect(r.macro).toBeCloseTo((1 / 3 + 1) / 2);
  });

  it('falls back to golden √tooltips when DPD lacks the word', () => {
    const gold = anat([{ id: 'g1', surface: 'kammāsadhammaṁ', wordClass: 'content', tips: ['√dham: proper name element'] }]);
    const model = anat([{ id: 'p1', surface: 'kammāsadhammaṁ', wordClass: 'content', tips: ['√dham'] }]);

    const r = scoreFactsDetail(model, gold, () => [])!;

    expect(r.root).toEqual({ correct: 1, total: 1, fabricated: 0, silent: 0, dropped: 0 });
  });

  it('checks morph pairs individually and skips function words entirely', () => {
    const gold = anat([
      { id: 'g1', surface: 'kurūnaṁ', wordClass: 'content', morph: { case: 'gen', number: 'pl' } },
      { id: 'g2', surface: 'ca', wordClass: 'function', tips: ['√xx: bogus'], morph: { case: 'nom' } },
    ]);
    const model = anat([
      { id: 'p1', surface: 'kurūnaṁ', wordClass: 'content', morph: { case: 'gen', number: 'sg' } }, // 1 of 2 pairs
      { id: 'p2', surface: 'ca', wordClass: 'function' },
    ]);

    const r = scoreFactsDetail(model, gold, () => [])!;

    expect(r.morph).toEqual({ correct: 1, total: 2 });
    expect(r.pos.total).toBe(1); // function word contributes nothing
  });

  it('charges every available check for a dropped golden content word (SUTTA-012)', () => {
    const gold = anat([
      { id: 'g1', surface: 'satipaṭṭhānā', wordClass: 'content', tips: ['√sthā: to stand'], morph: { case: 'nom' } },
    ]);
    const model = anat([{ id: 'p1', surface: 'somethingelse', wordClass: 'content' }]);

    const r = scoreFactsDetail(model, gold, () => [])!;

    expect(r.root).toEqual({ correct: 0, total: 1, fabricated: 0, silent: 0, dropped: 1 });
    expect(r.pos).toEqual({ correct: 0, total: 1 });
    expect(r.morph).toEqual({ correct: 0, total: 1 });
    expect(r.accuracy).toBe(0);
    expect(r.macro).toBe(0);
  });

  it('returns null when nothing is checkable', () => {
    const gold = anat([{ id: 'g1', surface: 'ca', wordClass: 'function' }]);
    const model = anat([{ id: 'p1', surface: 'ca', wordClass: 'function' }]);
    expect(scoreFactsDetail(model, gold, () => [])).toBeNull();
  });
});

describe('scoreSenseFidelityDetail', () => {
  it('scores sense english only — nuance and tooltips are out', () => {
    const gold = anat([{ id: 'g1', surface: 'sutaṁ', wordClass: 'content', tips: ['tooltip prose everywhere'] }]);
    const goldL = lex([{ wordId: 'g1', senses: [{ english: 'heard', nuance: 'auditory reception teachings' }] }]);
    const model = anat([{ id: 'p1', surface: 'sutaṁ', wordClass: 'content', tips: ['totally different prose'] }]);
    const modelL = lex([{ wordId: 'p1', senses: [{ english: 'heard', nuance: 'unrelated nuance wording' }] }]);

    const r = scoreSenseFidelityDetail(model, gold, modelL, goldL)!;

    // english matches exactly; nuance/tooltip divergence must not matter
    expect(r.f1).toBe(1);
  });

  it('applies the drop penalty for golden words with senses', () => {
    const gold = anat([
      { id: 'g1', surface: 'sutaṁ', wordClass: 'content' },
      { id: 'g2', surface: 'dhammo', wordClass: 'content' },
    ]);
    const goldL = lex([
      { wordId: 'g1', senses: [{ english: 'heard' }] },
      { wordId: 'g2', senses: [{ english: 'teaching' }, { english: 'nature' }] },
    ]);
    const model = anat([{ id: 'p1', surface: 'sutaṁ', wordClass: 'content' }]); // dhammo dropped
    const modelL = lex([{ wordId: 'p1', senses: [{ english: 'heard' }] }]);

    const r = scoreSenseFidelityDetail(model, gold, modelL, goldL)!;

    expect(r.tp).toBe(1);
    expect(r.fn).toBe(2); // dropped word owes its two sense tokens
    expect(r.recall).toBeCloseTo(1 / 3);
    expect(r.precision).toBe(1);
  });
});

describe('root helpers', () => {
  it('stems √ tokens and extracts from prose', () => {
    expect(rootStem('√bhikkh 1 a (beg)')).toBe('bhikkh');
    expect([...extractRoots('from √gam + √sthā, forming...')]).toEqual(['gam', 'sthā']);
  });
});
