import { describe, it, expect } from 'vitest';
import { mergeGlossaryLayers } from '../../services/glossaryService';

describe('mergeGlossaryLayers', () => {
  it('returns empty array when all layers are empty', () => {
    expect(mergeGlossaryLayers([], [], [])).toEqual([]);
  });

  it('returns book entries when only book layer has entries', () => {
    const book = [{ source: '灵根', target: 'Spirit Root' }];
    expect(mergeGlossaryLayers([], [], book)).toEqual(book);
  });

  it('book overrides genre for same source term', () => {
    const genre = [{ source: '灵气', target: 'Spiritual Energy' }];
    const book = [{ source: '灵气', target: 'Essence Energy' }];
    const result = mergeGlossaryLayers([], genre, book);
    expect(result).toHaveLength(1);
    expect(result[0].target).toBe('Essence Energy');
  });

  it('genre overrides user for same source term', () => {
    const user = [{ source: '丹田', target: 'energy center' }];
    const genre = [{ source: '丹田', target: 'dantian' }];
    const result = mergeGlossaryLayers(user, genre, []);
    expect(result).toHaveLength(1);
    expect(result[0].target).toBe('dantian');
  });

  it('book overrides both user and genre', () => {
    const user = [{ source: '道', target: 'the Way' }];
    const genre = [{ source: '道', target: 'the Dao' }];
    const book = [{ source: '道', target: 'Dao' }];
    const result = mergeGlossaryLayers(user, genre, book);
    expect(result).toHaveLength(1);
    expect(result[0].target).toBe('Dao');
  });

  it('preserves non-conflicting entries from all layers', () => {
    const user = [{ source: '气', target: 'qi' }];
    const genre = [{ source: '灵根', target: 'Spirit Root' }];
    const book = [{ source: '法宝废墟', target: 'Artifact Graveyard' }];
    const result = mergeGlossaryLayers(user, genre, book);
    expect(result).toHaveLength(3);
    const sources = result.map(e => e.source);
    expect(sources).toContain('气');
    expect(sources).toContain('灵根');
    expect(sources).toContain('法宝废墟');
  });

  it('preserves notes from winning tier', () => {
    const genre = [{ source: '灵气', target: 'Spiritual Energy', note: 'Generic xianxia' }];
    const book = [{ source: '灵气', target: 'Essence Energy', note: 'FMoC-specific' }];
    const result = mergeGlossaryLayers([], genre, book);
    expect(result[0].note).toBe('FMoC-specific');
  });
});
