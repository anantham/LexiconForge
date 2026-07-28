import { describe, it, expect } from 'vitest';
import {
  parseGroupedChapterNumber,
  isGroupableChapters,
  isChapterVerseGrouping,
  buildSectionTree,
  type ChapterIndexItem,
} from '../../../services/library/sectionGrouping';

describe('parseGroupedChapterNumber', () => {
  it('splits group*1000 + item (2047 -> group 2, item 47)', () => {
    expect(parseGroupedChapterNumber(2047)).toEqual({ group: 2, item: 47 });
  });

  it('handles the first and last Gītā verses', () => {
    expect(parseGroupedChapterNumber(1001)).toEqual({ group: 1, item: 1 }); // 1.1
    expect(parseGroupedChapterNumber(18078)).toEqual({ group: 18, item: 78 }); // 18.78
  });

  it('handles a group boundary (item 0)', () => {
    expect(parseGroupedChapterNumber(3000)).toEqual({ group: 3, item: 0 });
  });

  it('is defensive against non-finite input', () => {
    expect(parseGroupedChapterNumber(Number.NaN)).toEqual({ group: 0, item: 0 });
  });
});

describe('isGroupableChapters', () => {
  it('detects a grouped novel (Gītā verses span multiple groups)', () => {
    const gita: ChapterIndexItem[] = [
      { chapterNumber: 1001 },
      { chapterNumber: 1047 },
      { chapterNumber: 2001 },
      { chapterNumber: 2072 },
      { chapterNumber: 18078 },
    ];
    expect(isGroupableChapters(gita)).toBe(true);
  });

  // Red-proof: an ordinary flat novel (Aithihyamala 1..126) must NOT be grouped.
  it('rejects a flat novel numbered 1, 2, 3, …', () => {
    const flat: ChapterIndexItem[] = [
      { chapterNumber: 1 },
      { chapterNumber: 2 },
      { chapterNumber: 126 },
    ];
    expect(isGroupableChapters(flat)).toBe(false);
  });

  // Red-proof: a single-section slice (only chapter 2, 2050..2072) is >= 1000
  // but spans ONE group — still flat, not a tree.
  it('rejects a single-group slice even when >= 1000', () => {
    const oneChapter: ChapterIndexItem[] = [
      { chapterNumber: 2050 },
      { chapterNumber: 2060 },
      { chapterNumber: 2072 },
    ];
    expect(isGroupableChapters(oneChapter)).toBe(false);
  });

  it('rejects an empty set', () => {
    expect(isGroupableChapters([])).toBe(false);
  });

  it('rejects a set with any chapter below 1000', () => {
    const mixed: ChapterIndexItem[] = [{ chapterNumber: 900 }, { chapterNumber: 2001 }];
    expect(isGroupableChapters(mixed)).toBe(false);
  });
});

describe('isChapterVerseGrouping (primary gate — explicit marker only)', () => {
  it('accepts the explicit chapter-verse marker', () => {
    expect(isChapterVerseGrouping({ scheme: 'chapter-verse' })).toBe(true);
  });

  // Red-proof: grouping is by the MARKER, never inferred from chapter numbers —
  // a long web novel numbered 1001+ carries no marker, so it must NOT be grouped.
  it('rejects a marker-less novel regardless of chapter numbering', () => {
    expect(isChapterVerseGrouping(undefined)).toBe(false);
    expect(isChapterVerseGrouping(null)).toBe(false);
    expect(isChapterVerseGrouping({})).toBe(false);
  });

  it('rejects an unknown scheme', () => {
    expect(isChapterVerseGrouping({ scheme: 'volume-chapter' })).toBe(false);
  });
});

describe('buildSectionTree', () => {
  const chapters: ChapterIndexItem[] = [
    { chapterNumber: 2072, title: '2.72', id: 'c-2072' },
    { chapterNumber: 1001, title: 'The despair of Arjuna', id: 'c-1001' },
    { chapterNumber: 2047, title: '2.47', id: 'c-2047' },
    { chapterNumber: 2001, title: '2.1', id: 'c-2001' },
  ];

  it('groups verses by group and sorts both groups and verses ascending', () => {
    const tree = buildSectionTree(chapters);
    expect(tree.map((g) => g.group)).toEqual([1, 2]);
    expect(tree[1].verses.map((v) => v.item)).toEqual([1, 47, 72]);
    expect(tree[1].verses.map((v) => v.ref)).toEqual(['2.1', '2.47', '2.72']);
  });

  it('threads the encoded chapterNumber + id onto each verse', () => {
    const tree = buildSectionTree(chapters);
    const verse247 = tree[1].verses.find((v) => v.item === 47);
    expect(verse247?.chapterNumber).toBe(2047);
    expect(verse247?.id).toBe('c-2047');
  });

  it('drops a title that only echoes the "group.item" ref, keeps a real title', () => {
    const tree = buildSectionTree(chapters);
    // "2.47" == ref -> dropped
    expect(tree[1].verses.find((v) => v.item === 47)?.title).toBeUndefined();
    // "The despair of Arjuna" != ref -> kept
    expect(tree[0].verses.find((v) => v.item === 1)?.title).toBe('The despair of Arjuna');
  });

  it('defaults to a plain "Chapter N" label, and honors a custom labeler', () => {
    expect(buildSectionTree(chapters)[1].label).toBe('Chapter 2');
    const labeled = buildSectionTree(chapters, (group, count) => ({
      shortLabel: `Ch ${group}`,
      label: `Ch ${group} (${count})`,
    }));
    expect(labeled[1].label).toBe('Ch 2 (3)');
  });
});
