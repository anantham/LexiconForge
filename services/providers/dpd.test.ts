import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { DpdProvider, mergeDpdData, type DpdData } from './dpd';
import { loadDpdSubsetFromFs, loadAllDpdSubsetsFromFs } from './dpd-loader-fs';
import { citationIdFor } from './citationHelpers';
import type { LexiconEntry } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Synthetic fixtures
// ─────────────────────────────────────────────────────────────────────────────

const makeEntry = (lemma: string, sourceId: string, english: string): LexiconEntry => ({
  lemma,
  sourceId,
  citationId: citationIdFor('dpd', sourceId, lemma),
  partOfSpeech: 'fem',
  senses: [{ english }],
  morphology: { gender: 'f' },
});

const synthetic: DpdData = {
  headwords: {
    sati: [
      makeEntry('sati', 'dpd:1001', 'mindfulness'),
      makeEntry('sati', 'dpd:1002', 'memory'),
    ],
    kāya: [makeEntry('kāya', 'dpd:2001', 'body')],
    assasati: [makeEntry('assasati', 'dpd:3001', 'breathes in')],
  },
  forms: {
    'kāye': ['kāya'],
    'satimā': ['sati', 'satimant'],
    'assasāmi': ['assasati'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DpdProvider — direct lemma + surface-form lookup
// ─────────────────────────────────────────────────────────────────────────────

describe('DpdProvider — synthetic data', () => {
  it('returns all homonym entries for a direct lemma match', async () => {
    const provider = new DpdProvider(synthetic);
    const entries = await provider.lookup('sati');
    expect(entries).toHaveLength(2);
    expect(entries[0].sourceId).toBe('dpd:1001');
    expect(entries[1].sourceId).toBe('dpd:1002');
  });

  it('normalises lemma (trim + lowercase) before lookup', async () => {
    const provider = new DpdProvider(synthetic);
    const entries = await provider.lookup('  Sati  ');
    expect(entries).toHaveLength(2);
  });

  it('resolves a surface form via forms.json to its lemma entries', async () => {
    const provider = new DpdProvider(synthetic);
    const entries = await provider.lookup('kāye');
    expect(entries).toHaveLength(1);
    expect(entries[0].lemma).toBe('kāya');
    expect(entries[0].sourceId).toBe('dpd:2001');
  });

  it('merges entries from multiple candidate lemmas when a surface has more than one', async () => {
    const provider = new DpdProvider(synthetic);
    const entries = await provider.lookup('satimā');
    // 'satimā' resolves to ['sati', 'satimant']; only 'sati' is in headwords,
    // so we get its 2 homonym entries deduped by sourceId.
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.sourceId).sort()).toEqual(['dpd:1001', 'dpd:1002']);
  });

  it('returns an empty array for an unknown lemma', async () => {
    const provider = new DpdProvider(synthetic);
    const entries = await provider.lookup('nothing-here');
    expect(entries).toEqual([]);
  });

  it('returns an empty array for an empty / whitespace lemma', async () => {
    const provider = new DpdProvider(synthetic);
    expect(await provider.lookup('')).toEqual([]);
    expect(await provider.lookup('   ')).toEqual([]);
  });

  it('prefers direct lemma match over surface-form match', async () => {
    // 'sati' is both a headword and might be a surface form (e.g., self-referencing).
    // Direct match should win — no need to consult forms.
    const data: DpdData = {
      headwords: { sati: [makeEntry('sati', 'dpd:1001', 'mindfulness')] },
      forms: { sati: ['sati', 'satimant'] },  // forms also points to sati
    };
    const provider = new DpdProvider(data);
    const entries = await provider.lookup('sati');
    expect(entries).toHaveLength(1);
    expect(entries[0].sourceId).toBe('dpd:1001');
  });

  it('exposes id, label, and license per LexiconProvider contract', () => {
    const provider = new DpdProvider(synthetic);
    expect(provider.id).toBe('dpd');
    expect(provider.label).toBe('DPD');
    expect(provider.license).toContain('CC BY-NC-SA');
    expect(provider.license).toContain('Digital Pāli Dictionary');
  });

  it('size() reports the number of lemma keys', () => {
    const provider = new DpdProvider(synthetic);
    expect(provider.size()).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// mergeDpdData
// ─────────────────────────────────────────────────────────────────────────────

describe('mergeDpdData', () => {
  it('merges headwords across sources; later sources override earlier on conflict', () => {
    const a: DpdData = {
      headwords: { sati: [makeEntry('sati', 'dpd:1001', 'mindfulness')] },
      forms: { 'kāye': ['kāya'] },
    };
    const b: DpdData = {
      headwords: { kāya: [makeEntry('kāya', 'dpd:2001', 'body')] },
      forms: { 'satimā': ['sati'] },
    };
    const merged = mergeDpdData(a, b);
    expect(Object.keys(merged.headwords).sort()).toEqual(['kāya', 'sati']);
    expect(merged.forms?.['kāye']).toEqual(['kāya']);
    expect(merged.forms?.['satimā']).toEqual(['sati']);
  });

  it('returns empty data when given no sources', () => {
    expect(mergeDpdData()).toEqual({ headwords: {}, forms: {} });
  });

  it('handles sources without forms', () => {
    const a: DpdData = { headwords: { sati: [makeEntry('sati', 'dpd:1', 'mindfulness')] } };
    const merged = mergeDpdData(a);
    expect(merged.forms).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Filesystem loader — exercises the real MN10 dataset committed in B.1
// ─────────────────────────────────────────────────────────────────────────────

// Resolve dataRoot to the repo's data/dpd regardless of CWD when tests run.
const DATA_ROOT = path.resolve(__dirname, '..', '..', 'data', 'dpd');

describe('loadDpdSubsetFromFs — real MN10 dataset', () => {
  it('loads data/dpd/mn10 with non-trivial headword + form counts', () => {
    const data = loadDpdSubsetFromFs('mn10', DATA_ROOT);
    expect(Object.keys(data.headwords).length).toBeGreaterThan(100);
    expect(Object.keys(data.forms ?? {}).length).toBeGreaterThan(100);
  });

  it('throws a useful error for an unknown sutta', () => {
    expect(() => loadDpdSubsetFromFs('does-not-exist', DATA_ROOT)).toThrow(/DPD subset not found/);
  });
});

describe('DpdProvider — integration with real MN10 data', () => {
  it('resolves common MN10 lemmas through the real dataset', async () => {
    const data = loadDpdSubsetFromFs('mn10', DATA_ROOT);
    const provider = new DpdProvider(data);

    // Direct lemma matches — these should always resolve.
    const sati = await provider.lookup('sati');
    expect(sati.length).toBeGreaterThan(0);
    expect(sati[0].lemma).toBe('sati');
    expect(sati[0].rawExcerpt).toBeTruthy();
    expect(sati[0].sourceId).toMatch(/^dpd:\d+$/);

    const viharati = await provider.lookup('viharati');
    expect(viharati.length).toBeGreaterThan(0);
    expect(viharati[0].partOfSpeech).toBeDefined();

    const bhikkhu = await provider.lookup('bhikkhu');
    expect(bhikkhu.length).toBeGreaterThan(0);
  });

  it('resolves a locative surface form via forms.json (kāye → kāya)', async () => {
    const data = loadDpdSubsetFromFs('mn10', DATA_ROOT);
    const provider = new DpdProvider(data);
    const entries = await provider.lookup('kāye');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.lemma === 'kāya')).toBe(true);
  });

  // Regression test for the schema-tension #1 root-cause fix (SQLite Lookup
  // table replaces the heuristic stripper). The four surfaces below previously
  // conflated with unrelated lemmas under the heuristic:
  //   - bhikkhū → bhikkhā (alms, fem) — should resolve to bhikkhu (monk, masc)
  //   - kurūsu  → kura (rice, nt)     — should resolve to kuru / kurū (Kurus)
  //   - kurūnaṁ → kura (rice, nt)     — should resolve to kuru / kurū (Kurus)
  //   - evaṁ    → eva (particle)      — should resolve to evaṁ (deictic)
  // Each was patched per-ending; the SQLite Lookup fix closes them all at root.
  it('resolves nom/voc-pl bhikkhū to bhikkhu, NOT bhikkhā (root-cause regression)', async () => {
    const data = loadDpdSubsetFromFs('mn10', DATA_ROOT);
    const provider = new DpdProvider(data);
    const entries = await provider.lookup('bhikkhū');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.lemma === 'bhikkhu')).toBe(true);
    // The conflating feminine 'bhikkhā' (alms) must NOT appear.
    expect(entries.every((e) => e.lemma !== 'bhikkhā')).toBe(true);
  });

  it('resolves loc-pl kurūsu to kuru/kurū, NOT kura (regression)', async () => {
    const data = loadDpdSubsetFromFs('mn10', DATA_ROOT);
    const provider = new DpdProvider(data);
    const entries = await provider.lookup('kurūsu');
    expect(entries.length).toBeGreaterThan(0);
    const lemmas = entries.map((e) => e.lemma);
    expect(lemmas).toContain('kuru');
    expect(lemmas).not.toContain('kura');
  });

  it('resolves gen-pl kurūnaṁ to kuru/kurū, NOT kura (regression)', async () => {
    const data = loadDpdSubsetFromFs('mn10', DATA_ROOT);
    const provider = new DpdProvider(data);
    const entries = await provider.lookup('kurūnaṁ');
    expect(entries.length).toBeGreaterThan(0);
    const lemmas = entries.map((e) => e.lemma);
    expect(lemmas).toContain('kuru');
    expect(lemmas).not.toContain('kura');
  });

  it('resolves evaṁ to the deictic evaṁ, NOT to bare eva (regression)', async () => {
    const data = loadDpdSubsetFromFs('mn10', DATA_ROOT);
    const provider = new DpdProvider(data);
    const entries = await provider.lookup('evaṁ');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.lemma === 'evaṁ')).toBe(true);
    // bare 'eva' is the emphatic particle, a different word
    expect(entries.every((e) => e.lemma !== 'eva')).toBe(true);
  });

  it('returns morphology-bearing entries where DPD POS maps to MorphHint', async () => {
    const data = loadDpdSubsetFromFs('mn10', DATA_ROOT);
    const provider = new DpdProvider(data);
    const entries = await provider.lookup('sati');
    // sati is fem; the ingestion script projects pos=fem → MorphHint.gender='f'.
    const femEntry = entries.find((e) => e.partOfSpeech === 'fem');
    expect(femEntry).toBeDefined();
    expect(femEntry?.morphology?.gender).toBe('f');
  });

  it('returns empty for a lemma absent from the MN10 subset', async () => {
    const data = loadDpdSubsetFromFs('mn10', DATA_ROOT);
    const provider = new DpdProvider(data);
    // A plausibly-Pāli word that wouldn't appear in MN10's vocabulary scope.
    const entries = await provider.lookup('jaccāndha');  // 'born blind'; unlikely in MN10
    expect(entries).toEqual([]);
  });
});

describe('loadAllDpdSubsetsFromFs', () => {
  it('returns merged data covering at least the MN10 subset', () => {
    const data = loadAllDpdSubsetsFromFs(DATA_ROOT);
    expect(Object.keys(data.headwords).length).toBeGreaterThan(100);
    expect(data.headwords['sati']).toBeDefined();
  });

  it('returns empty data for a non-existent root', () => {
    expect(loadAllDpdSubsetsFromFs('/nope/does/not/exist')).toEqual({ headwords: {}, forms: {} });
  });
});
