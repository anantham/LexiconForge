import { describe, expect, it } from 'vitest';
import { mergeChapter } from '../../utils/mergeChapter';

describe('mergeChapter', () => {
  it('takes incoming values when both have a defined value', () => {
    const existing = { id: 'a', title: 'Old', content: 'Old content' };
    const incoming = { id: 'a', title: 'New', content: 'New content' };
    expect(mergeChapter(existing, incoming)).toEqual({
      id: 'a',
      title: 'New',
      content: 'New content',
    });
  });

  it('preserves existing values when incoming has null', () => {
    const existing = {
      id: 'a',
      content: 'Chinese sutra',
      fanTranslation: 'English from 84000' as string | null,
    };
    const incoming = {
      id: 'a',
      content: 'Chinese sutra (refreshed)',
      fanTranslation: null as string | null,
    };
    expect(mergeChapter(existing, incoming)).toEqual({
      id: 'a',
      content: 'Chinese sutra (refreshed)',
      fanTranslation: 'English from 84000',
    });
  });

  it('preserves existing values when incoming has undefined', () => {
    const existing = {
      id: 'a',
      content: 'C',
      translationResult: { translation: 'EN' } as any,
    };
    const incoming = {
      id: 'a',
      content: 'C',
      translationResult: undefined as any,
    };
    expect(mergeChapter(existing, incoming).translationResult).toEqual({ translation: 'EN' });
  });

  it('treats empty string as an explicit clear (does NOT preserve)', () => {
    const existing = { id: 'a', fanTranslation: 'old' };
    const incoming = { id: 'a', fanTranslation: '' };
    expect(mergeChapter(existing, incoming).fanTranslation).toBe('');
  });

  it('treats empty array as an explicit clear', () => {
    const existing = { id: 'a', tags: ['x', 'y'] };
    const incoming = { id: 'a', tags: [] };
    expect(mergeChapter(existing, incoming).tags).toEqual([]);
  });

  it('takes incoming for keys absent from existing', () => {
    const existing = { id: 'a' } as any;
    const incoming = { id: 'a', title: 'New' };
    expect(mergeChapter(existing, incoming).title).toBe('New');
  });

  it('preserves all in-memory fields the incoming refresh nulls out', () => {
    const existing: any = {
      id: 'a',
      content: 'C',
      fanTranslation: 'fan',
      translationResult: { translation: 'EN' },
      suttaStudio: { packetId: 'p1' },
      blurb: 'blurb',
    };
    const incoming: any = {
      id: 'a',
      content: 'C',
      fanTranslation: null,
      translationResult: null,
      suttaStudio: null,
      blurb: null,
    };
    const merged = mergeChapter(existing, incoming);
    expect(merged.fanTranslation).toBe('fan');
    expect(merged.translationResult).toEqual({ translation: 'EN' });
    expect(merged.suttaStudio).toEqual({ packetId: 'p1' });
    expect(merged.blurb).toBe('blurb');
  });

  it('does not preserve when both are null/undefined', () => {
    const existing = { id: 'a', fanTranslation: null };
    const incoming = { id: 'a', fanTranslation: null };
    expect(mergeChapter(existing, incoming).fanTranslation).toBeNull();
  });
});
