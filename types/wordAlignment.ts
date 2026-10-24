export interface WordPair {
  /** Source-language word or phrase. */
  source: string;
  /** Target-language rendering; empty when the source is omitted in translation. */
  target: string;
  /** Character offsets into the source text; end is exclusive. */
  sourceStart: number;
  sourceEnd: number;
  /** Character offsets into the target text; end is exclusive. */
  targetStart: number;
  targetEnd: number;
}

export interface WordAlignment {
  pairs: WordPair[];
  /** Changing translation versions invalidates the cached alignment. */
  translationVersionId: string | null;
  /** ISO timestamp. */
  alignedAt: string;
  modelUsed: string;
  pairCount: number;
}
