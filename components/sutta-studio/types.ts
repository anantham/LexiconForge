import type { WordSegment } from '../../types/suttaStudio';

export type SegmentFocus = {
  kind: 'segment';
  wordId: string;
  /** Segment ID from the data (e.g., "p1s1") */
  segmentId?: string;
  segmentIndex: number;
  segmentDomId: string;
  data: WordSegment;
};

export type WordFocus = {
  kind: 'word';
  wordId: string;
};

export type Focus = SegmentFocus | WordFocus;
