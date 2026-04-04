import * as fs from 'fs';

import type {
  AlignmentMap,
  AlignmentSegment,
} from './chapter-alignment-types';

export interface AlignmentTarget {
  status: 'exact' | 'merged' | 'unresolved' | 'missing';
  segment?: AlignmentSegment;
  englishChapterNumber?: number;
}

export const loadAlignmentMap = (alignmentMapPath: string): AlignmentMap => (
  JSON.parse(fs.readFileSync(alignmentMapPath, 'utf-8')) as AlignmentMap
);

export const findAlignmentSegment = (
  alignmentMap: AlignmentMap,
  rawChapterNumber: number
): AlignmentSegment | null => (
  alignmentMap.segments.find((segment) => (
    rawChapterNumber >= segment.raw.from && rawChapterNumber <= segment.raw.to
  )) || null
);

export const resolveAlignmentTarget = (
  alignmentMap: AlignmentMap,
  rawChapterNumber: number
): AlignmentTarget => {
  const segment = findAlignmentSegment(alignmentMap, rawChapterNumber);
  if (!segment) {
    return { status: 'missing' };
  }

  if (segment.kind === 'unresolved') {
    return { status: 'unresolved', segment };
  }

  if (!segment.english) {
    return { status: 'missing', segment };
  }

  if (segment.kind === 'english_merged') {
    return { status: 'merged', segment };
  }

  const offset = typeof segment.offset === 'number'
    ? segment.offset
    : segment.english.from - segment.raw.from;

  return {
    status: 'exact',
    segment,
    englishChapterNumber: rawChapterNumber + offset,
  };
};
