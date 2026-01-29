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
  /** Target word ID (e.g., "p2") - use for word-to-word relations */
  targetWordId?: string;
  /** Target segment ID (e.g., "p1s2") - use for segment-to-segment relations */
  targetSegmentId?: string;
  /** @deprecated Use targetWordId or targetSegmentId instead */
  targetId?: string;
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
  /** Unique ID for this segment (e.g., "p1s1") - required for segment-level linking */
  id: string;
  text: string;
  type: 'root' | 'suffix' | 'prefix' | 'stem';
  /** Etymological/grammatical tooltips shown on hover in study mode */
  tooltips?: string[];
  tooltip?: string;
  tooltipsBySense?: Record<string, string>;
  /** Grammatical relation to another segment or word */
  relation?: Relation;
  morph?: MorphHint;
  /** Segment-level senses for cycling (e.g., Sati → Mindfulness/Memory/Awareness) */
  senses?: Sense[];
};

export type WordClass = 'content' | 'function';

export type AnatomistWord = {
  id: string;
  surface: string;
  wordClass: WordClass;
  segmentIds: string[];
  isAnchor?: boolean;
};

export type AnatomistSegment = {
  id: string;
  wordId: string;
  text: string;
  type: 'root' | 'suffix' | 'prefix' | 'stem';
  morph?: MorphHint;
  /** Etymological tooltips for this segment (e.g., "√bhikkh: To share / beg") */
  tooltips?: string[];
};

export type AnatomistRelation = {
  id: string;
  fromSegmentId: string;
  /** Target word ID for segment-to-word relations */
  targetWordId?: string;
  /** Target segment ID for segment-to-segment relations (e.g., within compounds) */
  targetSegmentId?: string;
  type: RelationType;
  label: string;
  status?: 'confirmed' | 'pending';
};

export type AnatomistHandoff = {
  confidence?: 'high' | 'medium' | 'low';
  segmentationIssues?: string[];
  notes?: string;
};

export type AnatomistPass = {
  id: string;
  words: AnatomistWord[];
  segments: AnatomistSegment[];
  relations?: AnatomistRelation[];
  handoff?: AnatomistHandoff;
};

export type LexicographerEntry = {
  wordId: string;
  wordClass: WordClass;
  /** Word-level senses (used when segments don't have individual meanings) */
  senses: Sense[];
};

/** Segment-level senses for compound words where each part has distinct meaning */
export type LexicographerSegmentEntry = {
  segmentId: string;
  senses: Sense[];
};

export type LexicographerHandoff = {
  confidence?: 'high' | 'medium' | 'low';
  missingDefinitions?: string[];
  notes?: string;
};

export type LexicographerPass = {
  id: string;
  /** Word-level senses */
  senses: LexicographerEntry[];
  /** Segment-level senses for compounds */
  segmentSenses?: LexicographerSegmentEntry[];
  handoff?: LexicographerHandoff;
};

// ─────────────────────────────────────────────────────────────────────────────
// Weaver Pass (Phase 4): English token mapping
// ─────────────────────────────────────────────────────────────────────────────

export type WeaverToken = {
  /** Index of the token in the tokenized English array */
  tokenIndex: number;
  /** The original token text (for verification) */
  text: string;
  /** Link to specific Pali segment (preferred for compounds) */
  linkedSegmentId?: string;
  /** Link to Pali word (fallback when segment-level not applicable) */
  linkedPaliId?: string;
  /** True if this token has no Pali equivalent */
  isGhost: boolean;
  /** Type of ghost: 'required' for grammatical, 'interpretive' for clarifying */
  ghostKind?: 'required' | 'interpretive';
};

export type WeaverHandoff = {
  confidence?: 'high' | 'medium' | 'low';
  unmappedTokens?: number[];
  notes?: string;
};

export type WeaverPass = {
  id: string;
  tokens: WeaverToken[];
  handoff?: WeaverHandoff;
};

// ─────────────────────────────────────────────────────────────────────────────
// Typesetter Pass (Phase 5): Layout blocks
// ─────────────────────────────────────────────────────────────────────────────

export type TypesetterHandoff = {
  confidence?: 'high' | 'medium' | 'low';
  notes?: string;
};

export type TypesetterPass = {
  id: string;
  layoutBlocks: string[][];
  handoff?: TypesetterHandoff;
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
  /** Grammatical role color (derived from wordClass in UI) */
  color?: string;
  /** Word segments - each segment can have its own senses for compounds */
  segments: WordSegment[];
  /** Word-level senses (fallback when segments don't have individual senses) */
  senses: Sense[];
  /** True if this word is the semantic anchor of the phase */
  isAnchor?: boolean;
  sourceRefs?: SourceRef[];
  /** Word class for color coding: content (green), function (white), vocative (yellow) */
  wordClass?: WordClass;
};

export type EnglishToken = {
  id: string;
  /** Static label for ghost words or punctuation */
  label?: string;
  /** Link to a specific segment (preferred for compounds) */
  linkedSegmentId?: string;
  /** Link to a word (fallback when segment-level not applicable) */
  linkedPaliId?: string;
  /** True if this token has no Pali equivalent (articles, copula, etc.) */
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
  /** True if this phase failed compilation and shows raw text only */
  degraded?: boolean;
  /** Reason for degradation (e.g., "anatomist failed after 3 retries") */
  degradedReason?: string;
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
    currentStage?: 'fetching' | 'skeleton' | 'phases';
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
