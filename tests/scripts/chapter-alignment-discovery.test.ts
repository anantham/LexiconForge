// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { discoverAlignmentMap } from '../../scripts/lib/chapter-alignment-discovery';
import { FakeAlignmentVerifier } from '../../scripts/lib/chapter-alignment-verifier';
import type { TranslationSourceChapter } from '../../scripts/lib/translation-source-types';

const makeRawChapter = (chapterNumber: number): TranslationSourceChapter => ({
  chapterNumber,
  title: `第${chapterNumber}章 token-${chapterNumber}`,
  paragraphs: [{ text: `raw token-${chapterNumber} opening scene` }],
});

const makeEnglishChapter = (
  chapterNumber: number,
  token: number,
  chapterRange?: { from: number; to: number }
): TranslationSourceChapter => ({
  chapterNumber,
  ...(chapterRange ? { chapterRange } : {}),
  title: chapterRange
    ? `Chapter ${chapterRange.from}-${chapterRange.to}: token-${token}`
    : `Chapter ${chapterNumber}: token-${token}`,
  paragraphs: [{ text: `english token-${token} opening scene` }],
});

const verifier = new FakeAlignmentVerifier((raw, english) => {
  const rawToken = raw.excerpt.match(/token-(\d+)/)?.[1];
  const englishToken = english.excerpt.match(/token-(\d+)/)?.[1];
  const same = rawToken && englishToken && rawToken === englishToken;

  return {
    relation: same ? 'same' : 'different',
    confidence: same ? 0.97 : 0.12,
    rationale: same ? 'Token matched.' : 'Different token.',
  };
});

describe('chapter-alignment-discovery', () => {
  it('finds the first offset boundary and records a new one-to-one segment', async () => {
    const rawChapters = [1, 2, 3, 4, 5, 6].map(makeRawChapter);
    const fanChapters = [
      makeEnglishChapter(1, 1),
      makeEnglishChapter(2, 2),
      makeEnglishChapter(4, 3),
      makeEnglishChapter(5, 4),
      makeEnglishChapter(6, 5),
      makeEnglishChapter(7, 6),
    ];

    const map = await discoverAlignmentMap(
      {
        rawSourcePath: '/tmp/raw.txt',
        fanSourcePath: '/tmp/fan.txt',
        rawChapters,
        fanChapters,
      },
      verifier,
      {
        startChapter: 1,
        endChapter: 6,
        checkpointSize: 2,
        searchWindow: 2,
        minConfidence: 0.8,
      }
    );

    expect(map.segments).toEqual([
      expect.objectContaining({
        kind: 'one_to_one',
        raw: { from: 1, to: 2 },
        english: { from: 1, to: 2 },
        offset: 0,
      }),
      expect.objectContaining({
        kind: 'one_to_one',
        raw: { from: 3, to: 6 },
        english: { from: 4, to: 7 },
        offset: 1,
      }),
    ]);
  });

  it('marks merged English chapters explicitly instead of pretending they are one-to-one', async () => {
    const rawChapters = [1, 2, 3, 4, 5].map(makeRawChapter);
    const fanChapters = [
      makeEnglishChapter(1, 1),
      makeEnglishChapter(2, 2),
      makeEnglishChapter(3, 3, { from: 3, to: 4 }),
      makeEnglishChapter(5, 5),
    ];

    const map = await discoverAlignmentMap(
      {
        rawSourcePath: '/tmp/raw.txt',
        fanSourcePath: '/tmp/fan.epub',
        rawChapters,
        fanChapters,
      },
      verifier,
      {
        startChapter: 1,
        endChapter: 5,
        checkpointSize: 2,
        searchWindow: 2,
        minConfidence: 0.8,
      }
    );

    expect(map.segments).toEqual([
      expect.objectContaining({
        kind: 'one_to_one',
        raw: { from: 1, to: 2 },
        english: { from: 1, to: 2 },
        offset: 0,
      }),
      expect.objectContaining({
        kind: 'english_merged',
        raw: { from: 3, to: 4 },
        english: { from: 3, to: 4 },
        offset: 0,
      }),
      expect.objectContaining({
        kind: 'one_to_one',
        raw: { from: 5, to: 5 },
        english: { from: 5, to: 5 },
        offset: 0,
      }),
    ]);
  });
});
