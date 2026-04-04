import type { SourceChapterRange, TranslationSourceChapter } from './translation-source-types';

export type AlignmentSegmentKind = 'one_to_one' | 'english_merged' | 'unresolved';

export interface ChapterProbe {
  chapterNumber: number;
  title: string;
  excerpt: string;
}

export interface AlignmentJudgment {
  relation: 'same' | 'different';
  confidence: number;
  rationale: string;
}

export interface AlignmentVerifier {
  kind: string;
  model?: string;
  verify(raw: ChapterProbe, english: ChapterProbe): Promise<AlignmentJudgment>;
}

export interface AlignmentEvidence {
  rawChapterNumber: number;
  englishChapterNumber: number;
  confidence: number;
  rationale: string;
}

export interface AlignmentSegment {
  kind: AlignmentSegmentKind;
  raw: SourceChapterRange;
  english?: SourceChapterRange;
  offset?: number;
  confidence: number;
  evidence: AlignmentEvidence[];
  notes?: string[];
}

export interface AlignmentMap {
  version: 1;
  generatedAt: string;
  rawSourcePath: string;
  fanSourcePath: string;
  verifier: {
    kind: string;
    model?: string;
  };
  segments: AlignmentSegment[];
}

export interface DiscoveryOptions {
  startChapter: number;
  endChapter: number;
  initialOffset?: number;
  checkpointSize?: number;
  searchWindow?: number;
  minConfidence?: number;
}

export interface DiscoveryContext {
  rawSourcePath: string;
  fanSourcePath: string;
  rawChapters: TranslationSourceChapter[];
  fanChapters: TranslationSourceChapter[];
}
