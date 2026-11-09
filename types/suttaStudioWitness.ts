/** Additive, packet-local bridge toward TextGraph. No language-specific tokenizer. */
export type WitnessSourceSpan = {
  phaseId: string;
  /** Ordered, contiguous whole written tokens. Use several spans for discontinuity. */
  wordIds: string[];
};

export type WitnessTargetSpan = {
  passageId: string;
  /** Half-open Unicode code-point offsets into the immutable passage text, not UTF-16. */
  start: number;
  end: number;
};

export type WitnessAlignment = {
  id: string;
  sourceSpans: WitnessSourceSpan[];
  targetSpans: WitnessTargetSpan[];
  status: 'aligned' | 'uncertain' | 'unaligned';
  relation: 'corresponds' | 'reordered' | 'expanded' | 'omitted' | 'uncertain';
  /** Placement is an editorial layout choice, never evidence of correspondence. */
  displayAt: { phaseId: string; wordId: string };
  evidence: string;
  review: { status: 'unreviewed' | 'reviewed'; by?: string; date?: string };
};

export type TranslationWitness = {
  id: string;
  label: string;
  /** BCP 47; script is an optional ISO 15924 code. Neither implies a word splitter. */
  language: string;
  languageName: string;
  script?: string;
  direction?: 'ltr' | 'rtl' | 'auto';
  attribution: {
    translator?: string;
    publisher?: string;
    edition: string;
    url?: string;
    revision: string;
    license: string;
    licenseUrl?: string;
    normalization: string;
    source: { language: string; witness: string; url?: string };
  };
  /** Interlinear draft reuses existing senses/ripples; named witnesses never do. */
  content: { kind: 'legacy-interlinear' } | {
    kind: 'translation';
    /** Exact text and original witness numbering, independent of Sanskrit verse numbers. */
    passages: Array<{ id: string; label: string; text: string }>;
    /** Every target code point belongs to exactly one mapping, including unaligned text. */
    alignments: WitnessAlignment[];
  };
};

export type TranslationWitnessSet = {
  defaultWitnessId: string;
  witnesses: TranslationWitness[];
};
