export type RelationType = 'ownership' | 'direction' | 'location' | 'action';

/**
 * Provider tag for a Citation. Identifies which data source the citation came
 * from so the renderer can attribute correctly and the disagreement inspector
 * (ADR SUTTA-008 §UI Vision #7) can group competing attestations.
 *
 * Extending this enum is additive-safe; renderers should fall through with a
 * generic attribution for unknown values rather than refuse to render.
 */
export type CitationProvenance =
  | 'sc-dictionary-full'
  | 'dpd'
  | 'ms-dpd'
  | 'ped-dsal'
  | 'cpd'
  | 'vri-attha'
  | 'vri-cscd'
  | 'sc-bilara'
  | 'sc-suttaplex'
  | 'buddhanexus'
  | 'bdrc'
  | 'cbeta'
  | 'gretil'
  | '84000'
  | 'wiktionary'
  | 'manual';

export type Citation = {
  id: string;
  short: string;
  detail?: string;
  url?: string;
  /**
   * Provider this citation came from. Per ADR SUTTA-008: every factual
   * linguistic / textual / bibliographic / parallelism claim traces to a
   * provider response, and Citation entries are the audit trail.
   */
  provenance?: CitationProvenance;
  /** The lemma / segment id / work id this citation answers a query for. */
  query?: string;
  /**
   * Direct excerpt from the upstream source. Baked into the packet so the
   * renderer can show the attestation without re-fetching at read time.
   */
  excerpt?: string;
  /** Attribution + license string. Drives the renderer's attribution UI. */
  license?: string;
  /** ISO date the upstream was fetched. "As-of" hint for the reader. */
  fetchedAt?: string;
};

export type SourceProvider = 'suttacentral';


export type ParallelType = 'full' | 'resembling' | 'mention';

export type ParallelInfo = {
  uid: string;
  rootLang: string;
  type: ParallelType;
  acronym?: string;
  isPali: boolean;
};


export type ValidationIssue = {
  level: 'warn' | 'error';
  code:
    | 'segments_empty'
    | 'senses_empty'
    | 'relation_target_missing'
    | 'linked_pali_missing'
    | 'english_token_duplicate'
    | 'english_mapping_duplicate' // Same Pali segment linked by multiple English tokens
    | 'word_id_duplicate'
    | 'phase_id_duplicate'
    | 'canonical_segment_duplicate' // Same segment appears in multiple phases (often intentional sub-segment split)
    | 'canonical_segment_missing' // Source segment not represented in output
    | 'pali_text_mismatch' // Pali text doesn't exactly match source (ERROR - must be 1:1)
    | 'english_content_missing' // Source English words missing from artifact (artifact should be superset)
    | 'phase_degraded' // Phase failed compilation
    | 'surface_repaired' // Anatomist surfaces auto-corrected to the canonical text (model mangled them)
    | 'surface_mismatch'; // Rendered word surface not found in canonical text (repair skipped or missed)
  message: string;
  phaseId?: string;
  wordId?: string;
  segmentIndex?: number;
  tokenId?: string;
  canonicalSegmentId?: string;
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
  type: RelationType;
  label: string;
  status?: 'confirmed' | 'pending';
  /** Per FEATURES.md §2.5 — calibration, not authority signaling. */
  confidence?: 'high' | 'medium' | 'low';
  /** Where this relation analysis comes from. Orthogonal to confidence. */
  epistemicBasis?: EpistemicBasis;
};

/**
 * Where a claim came from. Orthogonal to confidence — a commentarial gloss
 * can be high-confidence (well attested) or low-confidence (one outlier).
 * See FEATURES.md §2.5.
 *
 * Resolution history:
 *   - Original (FEATURES.md §2.5, commit 7d38402): 5 values — etymological,
 *     commentarial, contextual, lexical, comparative.
 *   - 2026-05-12 (commit pending): added 'grammatical' and 'curatorial'.
 *     Surfaced in phase-a/b/c curation: claims grounded in *syntactic /
 *     morphological rules* (agent-in-genitive, accusative-of-time-when,
 *     locative-as-location) were being labeled 'etymological' as the
 *     closest fit — but etymology is word-history, not grammatical
 *     analysis. The placeholder hit 3 of 3 phases (3 relations, 1 sense
 *     in phase-a). The two new values:
 *       * 'grammatical' — syntactic or morphological rule (English perfect
 *         construction, Pāli case-as-preposition, present-tense-finite,
 *         participle-as-substantive, …)
 *       * 'curatorial' — explicit curator inference, grammatically grounded
 *         but not derived from a single attestation
 */
export type EpistemicBasis =
  | 'etymological'   // word-history; sandhi; cognate
  | 'grammatical'    // syntactic / morphological rule
  | 'commentarial'   // attested in commentaries (Aṭṭhakathā, Buddhaghosa, …)
  | 'contextual'     // chosen because of surrounding sutta context
  | 'lexical'        // dictionary attestation (PED, CPD, MW, DPD, …)
  | 'comparative'    // parallel-passage agreement (Pāli ↔ Chinese ↔ Sanskrit)
  | 'curatorial';    // explicit curator inference, grammatically grounded

/**
 * Morphological hints. L1 — pure facts about the source word.
 * The original two fields (case/number) cover noun morphology only;
 * verb morphology (person/tenseAspect/mood/voice/form), gender, ablative,
 * and dual were added per FEATURES.md §2.1.
 */
export type MorphHint = {
  /** 'abl' (ablative) added per §2.1; merges with gen/dat in form but distinct in function. */
  case?: 'gen' | 'dat' | 'loc' | 'ins' | 'acc' | 'nom' | 'voc' | 'abl';
  /** 'du' (dual) added per §2.1 — rare in Pāli but real. */
  number?: 'sg' | 'du' | 'pl';
  gender?: 'm' | 'f' | 'n';
  note?: string;
  // Verb morphology (§2.1). All optional, all L1.
  person?: '1' | '2' | '3';
  tenseAspect?: 'present' | 'aorist' | 'future' | 'perfect' | 'imperfect' | 'participle';
  mood?: 'indicative' | 'imperative' | 'optative' | 'conditional';
  voice?: 'active' | 'middle' | 'passive' | 'causative';
  /** For absolutives leave tenseAspect unset; the form *is* the tense info. */
  form?: 'finite' | 'participle' | 'gerund' | 'infinitive' | 'absolutive';
};

/**
 * Classical Indic compound classification. Used on PaliWord when the
 * surface word is a compound. See FEATURES.md §2.2.
 */
export type CompoundType =
  | 'tappurisa'      // dependent (case-relation): kāy[a]-anupassī = "observer of body"
  | 'kammadhāraya'   // descriptive (apposition): mahā-purisa = "great person"
  | 'dvandva'        // copulative (and): nāma-rūpa = "name and form"
  | 'bahubbīhi'      // possessive (exocentric): bahu-ssuta = "one who has heard much"
  | 'avyayībhāva'    // adverbial: yathā-bala = "according to ability"
  | 'dvigu';         // numerical kammadhāraya: ti-loka = "three worlds"

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

export type WordClass = 'content' | 'function' | 'vocative';

export type AnatomistWord = {
  id: string;
  surface: string;
  wordClass: WordClass;
  segmentIds: string[];
  isAnchor?: boolean;
  /** Refrain ID for visual rhythm - words with same ID share color (e.g., 'bhagava', 'bhikkhu') */
  refrainId?: string;
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

/**
 * Reason an English token has no Pali source. The renderer currently
 * special-cases only 'required' (dotted underline); other values fall
 * through to default ghost styling. New values per FEATURES.md §2.3 are
 * additive-safe — old renderers + LLM prompts see them as "some ghost".
 */
export type GhostKind =
  | 'required'              // catch-all when none below fits
  | 'interpretive'          // translator expansion
  | 'article'               // "the", "a"
  | 'copula'                // "is", "are", "was"
  | 'auxiliary'             // "have", "will", "do" (modal/perfect/future)
  | 'pronoun_from_verb'     // "I" supplied by 1sg ending; "you" by 2pl ending
  | 'preposition_from_case' // "at" / "in" / "by" supplied by loc/ins
  | 'punctuation'           // commas/quotes added for English readability
  | 'quote_marker';         // 'iti' / 'ti' bracket equivalents

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
  /** Reason for the ghost. See GhostKind. */
  ghostKind?: GhostKind;
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
  /** Per FEATURES.md §2.5. Reserve 'high' for genuinely uncontested glosses. */
  confidence?: 'high' | 'medium' | 'low';
  epistemicBasis?: EpistemicBasis;
  /** Per-sense citation pointers into packet.citations (sibling to packet-level Citation list). */
  sourceCitationIds?: string[];
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
  /** Refrain ID for visual rhythm - words with same ID share color (study mode only) */
  refrainId?: string;
  /**
   * Pronunciation hint for the spoken form. Free-form curator-written string —
   * typically syllable breakdown with stressed-syllable CAPS, optionally followed
   * by an English rhyme/sound analog in parens.
   *
   *   "vi · SUD · dhi · yā  (rhymes with 'reading-ya')"
   *   "saht · TAH · num"
   *
   * Pāli is an oral tradition; per-word pronunciation matters because the same
   * Roman letters can carry different sounds depending on syllable position,
   * vowel length, and compound boundaries. Lemma-derived guessing is unreliable.
   * Rendered in the LensPanel audit drawer header, never in hover tooltips.
   */
  pronunciation?: string;
  /** Classical compound type when this word is a compound. Per FEATURES.md §2.2. */
  compoundType?: CompoundType;
  /** Optional segment IDs in resolution order (e.g., ["a3s1","a3s2"]). */
  compoundSegments?: string[];
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
  ghostKind?: GhostKind;
};

/**
 * A span of words within a phase that the renderer should treat as a unit
 * (direct speech, cited phrase, parenthetical aside). Per FEATURES.md §2.4.
 */
export type Span = {
  id: string;
  kind: 'quoted_speech' | 'cited_phrase' | 'parenthetical';
  startWordId: string;
  endWordId: string;
  note?: string;
};

/**
 * Pointer to a parallel passage in another work (or another locus in the same work).
 * Per FEATURES.md §2.7.
 */
export type ParallelRef = {
  /** Free-form work id; resolves against the catalogue when a registry exists. */
  workId: string;
  /** Optional segment-level pointer within the parallel work. */
  segmentId?: string;
  /** "verbatim" / "near-parallel" / "thematic" / etc. — describe the relationship. */
  note?: string;
};

export type PhaseView = {
  id: string;
  /** Canonical segment IDs from bilara-data (e.g., ['mn10:1.1']) */
  canonicalSegmentIds?: string[];
  title?: string;
  sourceSpan?: SourceRef[];
  layoutBlocks?: string[][];
  paliWords: PaliWord[];
  englishStructure: EnglishToken[];
  /** True if this phase failed compilation and shows raw text only */
  degraded?: boolean;
  /** Reason for degradation (e.g., "anatomist failed after 3 retries") */
  degradedReason?: string;
  /** Speech / citation / parenthetical spans, per FEATURES.md §2.4. */
  spans?: Span[];
  /** Parallel passages, per FEATURES.md §2.7. */
  parallels?: ParallelRef[];
};

/**
 * Packet-level provenance — the chain of custody from utterance to JSON.
 * Per FEATURES.md §2.6. Bilingual MVP form; long-term moves to the externalised
 * TextGraph (see docs/sutta-studio/TEXT_GRAPH.md), at which point packets will
 * reference graph nodes instead of embedding this object.
 */
export type Provenance = {
  attribution?: {
    speaker?: string;
    audience?: string;
    legendaryDate?: string;
    legendaryPlace?: string;
    /** 'traditional' marks claims the tradition makes about itself. */
    confidence?: 'traditional' | 'attested' | 'disputed';
  };
  oralLineage?: {
    school: string;
    transmissionLanguage: string;
    estimatedPeriod?: string;
    method?: string;
  };
  firstWritten?: {
    estimatedDate?: string;
    place?: string;
    medium?: string;
    citation?: string;
  };
  manuscripts?: Array<{
    id?: string;
    repository?: string;
    estimatedDate?: string;
    script?: string;
    digitizer?: string;
    digitizedDate?: string;
    url?: string;
  }>;
  edition?: {
    name: string;
    year?: string;
    council?: string;
    digitalSource?: string;
    license?: string;
    /** Canonical URL for the edition itself (e.g., VRI / Council page). */
    url?: string;
    /** Canonical URL for the *digital* source (e.g., bilara-data GitHub). */
    digitalSourceUrl?: string;
    /** URL for the license terms (Creative Commons deed, etc.). */
    licenseUrl?: string;
  };
  translation?: {
    translator: string;
    year?: string;
    license?: string;
    institution?: string;
    methodology?: string;
    /** Canonical URL for the translation (publisher page, SC sutta page, etc.). */
    url?: string;
    /** URL for the license terms. */
    licenseUrl?: string;
  };
  external?: Array<{
    type: 'bdrc' | 'gretil' | 'cbeta' | 'suttacentral' | 'pts' | 'tipitaka.org' | 'other';
    url: string;
    note?: string;
  }>;
  /** Per-canonical-segment variant readings. Key = canonicalSegmentId. */
  segmentVariants?: Record<string, Array<{
    witness: string;
    reading: string;
    note?: string;
  }>>;
  /**
   * Acknowledgments — the works this packet rests on. A flat list so the
   * renderer can present it as "what we owe gratitude to" rather than as a
   * separate audit category. Each entry should resolve to a real public
   * page where the reader can encounter the source on its own terms.
   * Distinct from `external` (per-text registry links) and from per-sense
   * `Citation` rows (which attest specific glosses).
   */
  references?: Array<{
    /** Human-readable label. Compose with people + work, e.g. "Bryan Levman et al. — Digital Pāli Dictionary". */
    label: string;
    url: string;
    /** Optional one-line note (license, scope, why it's named here). */
    note?: string;
    /** Optional categorisation for renderer grouping; free-form. */
    category?: 'dictionary' | 'translation' | 'edition' | 'manuscript-archive' | 'scholarly-reference' | 'commentary' | 'other';
  }>;
};

export type DeepLoomPacket = {
  packetId: string;
  /**
   * Packet schema version. Absent ⇒ 'v1' (pre-versioning). Bump only when
   * making a breaking semantic change; additive fields don't require a bump.
   * See FEATURES.md §4.
   */
  version?: string;
  source: { provider: SourceProvider; workId: string; workIds?: string[] };
  canonicalSegments: CanonicalSegment[];
  phases: PhaseView[];
  citations: Citation[];
  /**
   * Chain-of-custody for the source text. Per FEATURES.md §2.6.
   * Long-term replaced by TextGraph references (`TEXT_GRAPH.md`).
   */
  provenance?: Provenance;
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
    /** Error message when state is 'error' */
    errorMessage?: string;
    /** Detailed stage message (e.g., "Analyzing structure (chunk 2/5)...") */
    stageMessage?: string;
    /** Current pass within a phase (e.g., "Anatomist", "Lexicographer", "Weaver") */
    currentPassName?: string;
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
