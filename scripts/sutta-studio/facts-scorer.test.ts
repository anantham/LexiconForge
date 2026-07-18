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

    expect(r.root).toEqual({ correct: 1, total: 3, fabricated: 1, silent: 1, dropped: 0, sprayed: 0 });
    expect(r.pos).toEqual({ correct: 3, total: 3 });
    expect(r.accuracy).toBeCloseTo(4 / 6);
    // macro: mean of root (1/3) and pos (3/3) — morph ungraded here
    expect(r.macro).toBeCloseTo((1 / 3 + 1) / 2);
  });

  it('falls back to golden √tooltips when DPD lacks the word', () => {
    const gold = anat([{ id: 'g1', surface: 'kammāsadhammaṁ', wordClass: 'content', tips: ['√dham: proper name element'] }]);
    const model = anat([{ id: 'p1', surface: 'kammāsadhammaṁ', wordClass: 'content', tips: ['√dham'] }]);

    const r = scoreFactsDetail(model, gold, () => [])!;

    expect(r.root).toEqual({ correct: 1, total: 1, fabricated: 0, silent: 0, dropped: 0, sprayed: 0 });
  });

  it('grades asserted morph for consistency with SOME legitimate DPD reading', () => {
    const gold = anat([
      { id: 'g1', surface: 'kāye', wordClass: 'content' },
      { id: 'g2', surface: 'kurūnaṁ', wordClass: 'content' },
      { id: 'g3', surface: 'satiyā', wordClass: 'content' },
      { id: 'g4', surface: 'ca', wordClass: 'function', morph: { case: 'nom' } },
    ]);
    const model = anat([
      { id: 'p1', surface: 'kāye', wordClass: 'content', morph: { case: 'loc', number: 'sg' } }, // fits 2nd reading
      { id: 'p2', surface: 'kurūnaṁ', wordClass: 'content', morph: { case: 'nom', number: 'sg' } }, // fits nothing → fabricated
      { id: 'p3', surface: 'satiyā', wordClass: 'content' }, // silent → coverage only, not charged
      { id: 'p4', surface: 'ca', wordClass: 'function' },
    ]);
    const grammar = (s: string) =>
      ({
        kāye: [
          { pos: 'noun', gender: 'm', case: 'acc', number: 'pl' },
          { pos: 'noun', gender: 'm', case: 'loc', number: 'sg' },
        ],
        kurūnaṁ: [{ pos: 'noun', gender: 'm', case: 'gen', number: 'pl' }],
        satiyā: [{ pos: 'noun', gender: 'f', case: 'instr', number: 'sg' }],
      })[s];

    const r = scoreFactsDetail(model, gold, () => [], grammar)!;

    // Scored per authority-known key (review #4), not per word:
    //  kāye  → case:loc ✓ + number:sg ✓ = 2/2
    //  kurūnaṁ → case:nom ✗ (gen) + number:sg ✗ (pl) = 0/2
    //  satiyā → silent, eligible but not charged
    expect(r.morph).toEqual({ correct: 2, total: 4 });
    expect(r.morphCoverage).toEqual({ asserted: 2, eligible: 3 });
    // POS now grades EVERY golden word incl. the function word 'ca' (correctly labelled) — audit A1
    expect(r.pos).toEqual({ correct: 4, total: 4 });
  });

  it('scores morph against a SINGLE reading — mixing keys from different ambiguous readings is not free (codex review)', () => {
    const gold = anat([{ id: 'g1', surface: 'kāye', wordClass: 'content' }]);
    // case:acc exists ONLY in reading 1, number:sg ONLY in reading 2 — no single reading has both,
    // so the union-per-key scorer wrongly accepted both (2/2); correlation-preserving gives 1/2.
    const model = anat([{ id: 'p1', surface: 'kāye', wordClass: 'content', morph: { case: 'acc', number: 'sg' } }]);
    const grammar = (s: string) =>
      ({
        kāye: [
          { pos: 'noun', gender: 'm', case: 'acc', number: 'pl' },
          { pos: 'noun', gender: 'm', case: 'loc', number: 'sg' },
        ],
      })[s];

    const r = scoreFactsDetail(model, gold, () => [], grammar)!;

    expect(r.morph).toEqual({ correct: 1, total: 2 });
  });

  it('charges every available check for a dropped golden content word (SUTTA-012)', () => {
    const gold = anat([
      { id: 'g1', surface: 'satipaṭṭhānā', wordClass: 'content', tips: ['√sthā: to stand'], morph: { case: 'nom' } },
    ]);
    const model = anat([{ id: 'p1', surface: 'somethingelse', wordClass: 'content' }]);

    const r = scoreFactsDetail(model, gold, () => [])!;

    expect(r.root).toEqual({ correct: 0, total: 1, fabricated: 0, silent: 0, dropped: 1, sprayed: 0 });
    expect(r.pos).toEqual({ correct: 0, total: 1 });
    // morph is a consistency check on ASSERTED morph — a dropped word cannot
    // assert anything, so it lands in neither morph.total nor coverage
    expect(r.morph).toEqual({ correct: 0, total: 0 });
    expect(r.morphCoverage).toEqual({ asserted: 0, eligible: 0 });
    expect(r.accuracy).toBe(0);
    expect(r.macro).toBe(0);
  });

  it('charges word-class over ALL golden words — labelling everything content is penalised (audit A1)', () => {
    const gold = anat([
      { id: 'g1', surface: 'gacchati', wordClass: 'content' },
      { id: 'g2', surface: 'ca', wordClass: 'function' },
      { id: 'g3', surface: 'pi', wordClass: 'function' },
    ]);
    // A model that hard-codes wordClass:'content' knows zero grammar; the old content-only POS
    // gave it a free 1.0. Now the two mislabelled function words cost it.
    const model = anat([
      { id: 'p1', surface: 'gacchati', wordClass: 'content' },
      { id: 'p2', surface: 'ca', wordClass: 'content' },
      { id: 'p3', surface: 'pi', wordClass: 'content' },
    ]);

    const r = scoreFactsDetail(model, gold, () => [])!;

    expect(r.pos).toEqual({ correct: 1, total: 3 });
  });

  it('denies root credit for a correct root buried in a spray of roots (audit A2)', () => {
    const gold = anat([{ id: 'g1', surface: 'gacchati', wordClass: 'content', tips: ['√gam: to go'] }]);
    // sprays 6 roots to guarantee a hit — recall-only scoring used to credit this as correct
    const sprayer = anat([{ id: 'p1', surface: 'gacchati', wordClass: 'content', tips: ['√gam √kar √pac √chid √bhuj √labh'] }]);
    const sr = scoreFactsDetail(sprayer, gold, () => [])!;
    expect(sr.root).toEqual({ correct: 0, total: 1, fabricated: 0, silent: 0, dropped: 0, sprayed: 1 });

    // a focused answer (the right root + one alternative, within slack) still counts
    const focused = anat([{ id: 'p1', surface: 'gacchati', wordClass: 'content', tips: ['√gam √gā'] }]);
    const fr = scoreFactsDetail(focused, gold, () => [])!;
    expect(fr.root).toEqual({ correct: 1, total: 1, fabricated: 0, silent: 0, dropped: 0, sprayed: 0 });
  });

  it('returns null when nothing is checkable', () => {
    const gold = anat([{ id: 'g1', surface: 'ca', wordClass: 'function' }]);
    const model = anat([{ id: 'p1', surface: 'ca', wordClass: 'function' }]);
    expect(scoreFactsDetail(model, gold, () => [])).toBeNull();
  });

  it('a bogus non-morph assertion cannot inflate the macro (review #4)', () => {
    // Reviewer's repro: adding {note:"nonsense"} raised a weak macro 0.500 → 0.667, because the
    // old code let ANY asserted key add a morph check and fitsReading passed vacuously on a key the
    // reading was silent about. `note` is not a gradeable morph key, so it must now be ignored.
    const gold = anat([{ id: 'g1', surface: 'kāye', wordClass: 'content', tips: ['√kaya: body'] }]);
    const grammar = (s: string) =>
      (s === 'kāye' ? [{ pos: 'noun', gender: 'm', case: 'loc', number: 'sg' }] : undefined);

    // Root wrong, word-class right, no real morph asserted → macro = mean(0/1 root, 1/1 pos) = 0.5.
    const honest = anat([{ id: 'p1', surface: 'kāye', wordClass: 'content', tips: ['√wrong: x'] }]);
    const gamed = anat([{ id: 'p1', surface: 'kāye', wordClass: 'content', tips: ['√wrong: x'], morph: { note: 'nonsense' } }]);

    const base = scoreFactsDetail(honest, gold, () => [], grammar)!;
    const withJunk = scoreFactsDetail(gamed, gold, () => [], grammar)!;

    expect(base.macro).toBeCloseTo(0.5);
    expect(withJunk.morph).toEqual({ correct: 0, total: 0 }); // junk key ignored, morph ungraded
    expect(withJunk.macro).toBe(base.macro); // no free 1.0 category → macro cannot rise
  });

  it('canonicalises morph vocabulary so a correct `ins` matches DPD `instr` (review #4)', () => {
    // Reviewer's repro: a correct instrumental `case:"ins"` scored WRONG because DPD stores `instr`,
    // dragging the macro to 0.333.
    const gold = anat([{ id: 'g1', surface: 'satiyā', wordClass: 'content', tips: ['√sati: mindfulness'] }]);
    const grammar = (s: string) =>
      (s === 'satiyā' ? [{ pos: 'noun', gender: 'f', case: 'instr', number: 'sg' }] : undefined);
    const model = anat([{ id: 'p1', surface: 'satiyā', wordClass: 'content', tips: ['√sati: x'], morph: { case: 'ins' } }]);

    const r = scoreFactsDetail(model, gold, () => [], grammar)!;
    expect(r.morph).toEqual({ correct: 1, total: 1 }); // ins ≡ instr
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
