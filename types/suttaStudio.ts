export type RelationType = 'ownership' | 'direction' | 'location' | 'action';

export type Citation = {
  id: string;
  short: string;
  detail?: string;
  url?: string;
};

export type SourceProvider = 'suttacentral';

export type ValidationIssue = {
  level: 'warn' | 'error';
  code:
    | 'segments_empty'
    | 'senses_empty'
    | 'relation_target_missing'
    | 'linked_pali_missing'
    | 'english_token_duplicate'
    | 'word_id_duplicate'
    | 'phase_id_duplicate';
  message: string;
  phaseId?: string;
  wordId?: string;
  segmentIndex?: number;
  tokenId?: string;
};

export type SourceRef = {
  provider: SourceProvider;
  workId: string;
  segmentId: string;
};

export type CanonicalSegment = {
  ref: SourceRef;
  order: number;
  pali: string;
  baseEnglish?: string;
};

export type Relation = {
  targetId: string;
  type: RelationType;
  label: string;
  status?: 'confirmed' | 'pending';
};

export type MorphHint = {
  case?: 'gen' | 'dat' | 'loc' | 'ins' | 'acc' | 'nom' | 'voc';
  number?: 'sg' | 'pl';
  note?: string;
};

export type WordSegment = {
  text: string;
  type: 'root' | 'suffix' | 'prefix' | 'stem';
  tooltips?: string[];
  tooltip?: string;
  tooltipsBySense?: Record<string, string>;
  relation?: Relation;
  morph?: MorphHint;
};

export type Sense = {
  id?: string;
  english: string;
  nuance: string;
  notes?: string;
  citationIds?: string[];
  ripples?: Record<string, string>;
};

export type PaliWord = {
  id: string;
  color?: string;
  segments: WordSegment[];
  senses: Sense[];
  isAnchor?: boolean;
  sourceRefs?: SourceRef[];
};

export type EnglishToken = {
  id: string;
  label?: string;
  linkedPaliId?: string;
  isGhost?: boolean;
  ghostKind?: 'required' | 'interpretive';
};

export type PhaseView = {
  id: string;
  title?: string;
  sourceSpan?: SourceRef[];
  layoutBlocks?: string[][];
  paliWords: PaliWord[];
  englishStructure: EnglishToken[];
};

export type DeepLoomPacket = {
  packetId: string;
  source: { provider: SourceProvider; workId: string; workIds?: string[] };
  canonicalSegments: CanonicalSegment[];
  phases: PhaseView[];
  citations: Citation[];
  progress?: {
    totalPhases?: number;
    readyPhases?: number;
    totalSegments?: number;
    readySegments?: number;
    state?: 'idle' | 'building' | 'complete' | 'error';
    currentPhaseId?: string;
    lastProgressAt?: number;
    lastPhaseMs?: number;
    avgPhaseMs?: number;
    etaMs?: number;
  };
  renderDefaults: {
    ghostOpacity: number;
    englishVisible: boolean;
    studyToggleDefault: boolean;
  };
  compiler?: {
    provider: 'openrouter' | 'openai' | 'local';
    model: string;
    promptVersion: string;
    createdAtISO: string;
    sourceDigest: string;
    validatorVersion?: string;
    validationIssues?: ValidationIssue[];
  };
};
