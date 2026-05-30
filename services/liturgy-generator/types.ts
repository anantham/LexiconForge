import type {
  LiturgyDoc,
  LiturgySection,
  TripleScriptWitnessSection,
  TripleScriptWitnessSegment,
  Witness,
} from '../../types/liturgy';

export type LiturgyGeneratorStage =
  | 'ingest'
  | 'section'
  | 'alignment'
  | 'morpheme-alignment'
  | 'validation'
  | 'emit';

export type LiturgyGeneratorDiagnosticLevel = 'info' | 'warn' | 'error';

export type LiturgyGeneratorDiagnostic = {
  level: LiturgyGeneratorDiagnosticLevel;
  code: string;
  message: string;
  stage: LiturgyGeneratorStage;
  sectionId?: string;
  segmentId?: string;
  witnessBy?: string;
  path?: string;
};

export type AlignmentHint = {
  wordIndex: number;
  terms: string[];
  morphemes?: Array<{
    morphemeIndex: number;
    terms: string[];
  }>;
};

export type LiturgyGeneratorWitnessInput = Witness & {
  /**
   * `infer` fills missing alignments. `preserve` leaves authored arrays alone.
   * `none` deliberately emits no alignment for this witness.
   */
  alignmentMode?: 'infer' | 'preserve' | 'none';
};

export type LiturgyGeneratorTripleScriptSegmentInput =
  Omit<TripleScriptWitnessSegment, 'witnesses'> & {
    witnesses: LiturgyGeneratorWitnessInput[];
    alignmentHints?: AlignmentHint[];
  };

export type LiturgyGeneratorTripleScriptSectionInput =
  Omit<TripleScriptWitnessSection, 'segments'> & {
    segments: LiturgyGeneratorTripleScriptSegmentInput[];
  };

export type LiturgyGeneratorSectionInput =
  | LiturgyGeneratorTripleScriptSectionInput
  | Exclude<LiturgySection, TripleScriptWitnessSection>;

export type LiturgyGeneratorInput = {
  exportName?: string;
  doc: Omit<LiturgyDoc, 'sections'>;
  sections: LiturgyGeneratorSectionInput[];
};

export type LiturgyGeneratorStats = {
  inferredAlignments: number;
  preservedAlignments: number;
  skippedAlignments: number;
  inferredMorphemeAlignments: number;
  unmappedTokens: number;
  warningCount: number;
  errorCount: number;
};

export type LiturgyGeneratorResult = {
  doc: LiturgyDoc;
  exportName: string;
  diagnostics: LiturgyGeneratorDiagnostic[];
  stats: LiturgyGeneratorStats;
};

export type AlignmentResult = {
  alignTo: number[];
  morphemeAlignTo?: (number | null)[];
  diagnostics: LiturgyGeneratorDiagnostic[];
  unmappedTokenCount: number;
  morphemeMatchCount: number;
};
