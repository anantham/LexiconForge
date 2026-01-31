/**
 * suttaStudioRehydrator.ts
 *
 * Joins flattened pass outputs (Anatomist, Lexicographer, Weaver, Typesetter)
 * into a UI-ready PhaseView structure.
 *
 * This is Phase 2.5 from the Assembly-Line Roadmap.
 */

import type {
  AnatomistPass,
  AnatomistRelation,
  LexicographerPass,
  WeaverPass,
  TypesetterPass,
  PhaseView,
  PaliWord,
  EnglishToken,
  SourceRef,
  WordSegment,
  Sense,
} from '../types/suttaStudio';
import type { EnglishTokenInput } from './suttaStudioTokenizer';

const warn = (message: string, ...args: any[]) =>
  console.warn(`[SuttaStudioRehydrator] ${message}`, ...args);

const log = (message: string, ...args: any[]) =>
  console.log(`[SuttaStudioRehydrator] ${message}`, ...args);

/**
 * Build a map of wordId -> WordSegment[] from Anatomist output.
 * Also attaches relations to the appropriate segments.
 * Each segment includes its ID for segment-level linking.
 */
export const buildSegmentsMapFromAnatomist = (
  anatomist: AnatomistPass
): Map<string, WordSegment[]> => {
  const segmentsById = new Map(anatomist.segments.map((seg) => [seg.id, seg]));

  // Build relation lookup: segmentId -> first relation
  const relationsBySegment = new Map<string, AnatomistRelation>();
  if (anatomist.relations?.length) {
    for (const relation of anatomist.relations) {
      if (!relationsBySegment.has(relation.fromSegmentId)) {
        relationsBySegment.set(relation.fromSegmentId, relation);
      } else {
        warn(`Multiple relations for segment ${relation.fromSegmentId}; keeping first.`);
      }
    }
  }

  const byWord = new Map<string, WordSegment[]>();

  for (const word of anatomist.words) {
    const segments: WordSegment[] = [];

    for (const segmentId of word.segmentIds) {
      const segment = segmentsById.get(segmentId);
      if (!segment) {
        warn(`Missing segment ${segmentId} for word ${word.id}.`);
        continue;
      }

      const relation = relationsBySegment.get(segmentId);
      segments.push({
        id: segmentId, // Include segment ID for segment-level linking
        text: segment.text,
        type: segment.type,
        tooltips: segment.tooltips,
        morph: segment.morph,
        relation: relation
          ? {
              // Support both new segment-to-segment and segment-to-word relations
              targetSegmentId: relation.targetSegmentId,
              targetWordId: relation.targetWordId,
              type: relation.type,
              label: relation.label,
              status: relation.status,
            }
          : undefined,
      });
    }

    // Fallback: if no segments resolved, create a stub with generated ID
    if (!segments.length) {
      segments.push({ id: `${word.id}s1`, text: word.surface || '…', type: 'stem' });
    }

    byWord.set(word.id, segments);
  }

  return byWord;
};

/**
 * Build a map of wordId -> Sense[] from Lexicographer output.
 */
export const buildSensesMapFromLexicographer = (
  lexicographer: LexicographerPass
): Map<string, Sense[]> => {
  return new Map(
    lexicographer.senses.map((entry) => [entry.wordId, entry.senses])
  );
};

/**
 * Build a map of segmentId -> Sense[] from Lexicographer segment senses.
 * Used for compound words where each segment has distinct meanings.
 */
export const buildSegmentSensesMapFromLexicographer = (
  lexicographer: LexicographerPass
): Map<string, Sense[]> => {
  if (!lexicographer.segmentSenses?.length) {
    return new Map();
  }
  return new Map(
    lexicographer.segmentSenses.map((entry) => [entry.segmentId, entry.senses])
  );
};

/**
 * Filter English tokens for display.
 *
 * Previous versions attempted to deduplicate tokens that resolved to the same
 * sense text. This caused bugs where distinct English words (e.g., "Mindfulness"
 * and "Meditation") were incorrectly dropped when they both linked to the same
 * Pali compound word.
 *
 * Each token from the Weaver has a unique tokenIndex, so no deduplication is
 * needed. This function now only filters out invalid/empty tokens.
 */
export const dedupeEnglishStructure = (
  english: EnglishToken[],
  _paliWords: PaliWord[]
): EnglishToken[] => {
  if (!english || english.length === 0) return [];

  // Filter out tokens with no link and no label (invalid tokens)
  return english.filter(
    (token) => token.linkedSegmentId || token.linkedPaliId || token.label || token.isGhost
  );
};

/**
 * Convert WeaverPass tokens to EnglishToken[] for the PhaseView.
 * Only includes word tokens (not whitespace/punctuation).
 * Supports both segment-level linking (preferred) and word-level linking (fallback).
 *
 * DEDUPLICATION: If the LLM produces multiple tokens linking to the same segment ID,
 * only the first one is kept. This prevents rendering bugs like "in Jeta's Grove" x3.
 * Note: This is different from the old sense-text deduplication which was problematic -
 * here we dedupe on exact segment/word ID matches, not resolved text.
 */
export const buildEnglishStructureFromWeaver = (
  weaver: WeaverPass,
  englishTokens: EnglishTokenInput[]
): EnglishToken[] => {
  const tokenMap = new Map(englishTokens.map((t) => [t.index, t]));
  const result: EnglishToken[] = [];

  // Track used segment IDs to prevent duplicates
  // Key: linkedSegmentId or linkedPaliId, Value: tokenIndex of first use
  const usedSegmentIds = new Set<string>();
  const usedPaliIds = new Set<string>();

  for (const weaverToken of weaver.tokens) {
    const originalToken = tokenMap.get(weaverToken.tokenIndex);
    if (!originalToken) {
      warn(`Weaver token index ${weaverToken.tokenIndex} not found in original tokens`);
      continue;
    }

    // Skip whitespace and punctuation tokens
    if (originalToken.isWhitespace || originalToken.isPunctuation) {
      continue;
    }

    // Deduplicate: skip tokens that link to already-used segment IDs
    // This prevents "in Jeta's Grove" appearing 3 times when LLM outputs duplicates
    if (weaverToken.linkedSegmentId) {
      if (usedSegmentIds.has(weaverToken.linkedSegmentId)) {
        warn(`Duplicate linkedSegmentId "${weaverToken.linkedSegmentId}" at token ${weaverToken.tokenIndex} ("${weaverToken.text}") - skipping`);
        continue;
      }
      usedSegmentIds.add(weaverToken.linkedSegmentId);
    } else if (weaverToken.linkedPaliId && !weaverToken.isGhost) {
      // For word-level linking (without segment-level), also dedupe
      // But only for non-ghosts - ghosts can repeat (e.g., multiple "the")
      if (usedPaliIds.has(weaverToken.linkedPaliId)) {
        warn(`Duplicate linkedPaliId "${weaverToken.linkedPaliId}" at token ${weaverToken.tokenIndex} ("${weaverToken.text}") - skipping`);
        continue;
      }
      usedPaliIds.add(weaverToken.linkedPaliId);
    }

    const englishToken: EnglishToken = {
      id: `e${weaverToken.tokenIndex}`,
      // Segment-level linking (preferred for compounds)
      linkedSegmentId: weaverToken.linkedSegmentId,
      // Word-level linking (fallback)
      linkedPaliId: weaverToken.linkedPaliId,
      isGhost: weaverToken.isGhost,
      ghostKind: weaverToken.ghostKind,
    };

    // For ghosts, store the original text as label
    if (weaverToken.isGhost) {
      englishToken.label = weaverToken.text;
    }

    result.push(englishToken);
  }

  return result;
};

export type RehydrateParams = {
  phaseId: string;
  title?: string;
  sourceSpan: SourceRef[];
  anatomist: AnatomistPass;
  lexicographer: LexicographerPass;
  /** Weaver pass output - maps English tokens to Pali words */
  weaver?: WeaverPass;
  /** Original tokenized English (needed to reconstruct englishStructure) */
  englishTokens?: EnglishTokenInput[];
  /** Typesetter pass output */
  typesetter?: TypesetterPass;
  /** Fallback PhaseView from LLM (used during transition period) */
  fallbackPhaseView?: PhaseView;
};

/**
 * Rehydrate a PhaseView from flattened pass outputs.
 *
 * Assembly order:
 * 1. Start with Anatomist words as base paliWords
 * 2. Attach segments from Anatomist (with relations and IDs)
 * 3. Attach word-level senses from Lexicographer
 * 4. Attach segment-level senses from Lexicographer (for compounds)
 * 5. Attach wordClass from Anatomist (for color coding)
 * 6. Attach englishStructure from Weaver (or fallback)
 * 7. Attach layoutBlocks from Typesetter (or fallback)
 */
export const rehydratePhase = (params: RehydrateParams): PhaseView => {
  const {
    phaseId,
    title,
    sourceSpan,
    anatomist,
    lexicographer,
    weaver,
    englishTokens,
    typesetter,
    fallbackPhaseView,
  } = params;

  // Build lookup maps
  const segmentsMap = buildSegmentsMapFromAnatomist(anatomist);
  const sensesMap = buildSensesMapFromLexicographer(lexicographer);
  const segmentSensesMap = buildSegmentSensesMapFromLexicographer(lexicographer);

  // Build paliWords from Anatomist words
  const paliWords: PaliWord[] = anatomist.words.map((word) => {
    let segments = segmentsMap.get(word.id) || [
      { id: `${word.id}s1`, text: word.surface || '…', type: 'stem' as const },
    ];

    // Attach segment-level senses if available
    if (segmentSensesMap.size > 0) {
      segments = segments.map((seg) => {
        const segmentSenses = segmentSensesMap.get(seg.id);
        if (segmentSenses?.length) {
          return { ...seg, senses: segmentSenses };
        }
        return seg;
      });
    }

    // Word-level senses (used when segments don't have individual senses)
    const senses = sensesMap.get(word.id) || [];

    // Check if we have either word-level or segment-level senses
    const hasSegmentSenses = segments.some((seg) => seg.senses?.length);
    if (!senses.length && !hasSegmentSenses) {
      warn(`No senses found for word ${word.id} (${word.surface})`);
    }

    return {
      id: word.id,
      segments,
      senses,
      isAnchor: word.isAnchor,
      wordClass: word.wordClass, // For color coding (content=green, function=white)
    };
  });

  // Get englishStructure: prefer Weaver output, fall back to LLM output
  let englishStructure: EnglishToken[] = [];
  let englishSource: string = 'none';
  if (weaver && englishTokens) {
    // Build from Weaver pass output
    englishStructure = buildEnglishStructureFromWeaver(weaver, englishTokens);
    englishSource = 'weaver';
  } else if (fallbackPhaseView?.englishStructure) {
    // Fall back to LLM-generated englishStructure
    englishStructure = fallbackPhaseView.englishStructure;
    englishSource = 'fallbackPhaseView';
  }
  const beforeDedupeCount = englishStructure.length;
  const linkedBefore = englishStructure.filter((t) => t.linkedPaliId || t.linkedSegmentId).length;
  englishStructure = dedupeEnglishStructure(englishStructure, paliWords);
  const afterDedupeCount = englishStructure.length;
  const linkedAfter = englishStructure.filter((t) => t.linkedPaliId || t.linkedSegmentId).length;
  log(`rehydratePhase(${phaseId}): englishSource=${englishSource}, tokens=${beforeDedupeCount}->${afterDedupeCount}, linked=${linkedBefore}->${linkedAfter}`);

  // Get layoutBlocks: prefer Typesetter, fall back to LLM output
  let layoutBlocks: string[][] | undefined;
  if (typesetter?.layoutBlocks) {
    layoutBlocks = typesetter.layoutBlocks;
  } else if (fallbackPhaseView?.layoutBlocks) {
    layoutBlocks = fallbackPhaseView.layoutBlocks;
  }

  return {
    id: phaseId,
    title,
    sourceSpan,
    paliWords,
    englishStructure,
    layoutBlocks,
  };
};

/**
 * Build a degraded PhaseView when compilation fails.
 * Shows Pali text and English text side-by-side, no relations or weaving.
 * Marked as degraded so UI can display appropriately.
 */
export const buildDegradedPhaseView = (params: {
  phaseId: string;
  title?: string;
  sourceSpan: SourceRef[];
  paliTexts: Array<{ surface: string }>;
  englishTexts?: string[];
  reason: string;
}): PhaseView => {
  const { phaseId, title, sourceSpan, paliTexts, englishTexts, reason } = params;

  // Create minimal paliWords with single stem segments (including segment IDs)
  const paliWords: PaliWord[] = paliTexts.map((item, index) => {
    const wordId = `p${index + 1}`;
    return {
      id: wordId,
      segments: [{ id: `${wordId}s1`, text: item.surface, type: 'stem' as const }],
      senses: [],
    };
  });

  // Create minimal englishStructure as ghost tokens (one per word)
  const englishStructure: EnglishToken[] = (englishTexts || []).map(
    (text, index) => ({
      id: `e${index + 1}`,
      label: text,
      isGhost: true,
      ghostKind: 'interpretive' as const,
    })
  );

  log(`buildDegradedPhaseView(${phaseId}): paliWords=${paliWords.length}, englishTokens=${englishStructure.length}, linkedTokens=0, reason="${reason}"`);

  return {
    id: phaseId,
    title,
    sourceSpan,
    paliWords,
    englishStructure,
    degraded: true,
    degradedReason: reason,
  };
};

/**
 * Validate that segment IDs are unique within a phase.
 * Returns list of duplicate IDs found.
 */
export const validateSegmentIdUniqueness = (
  paliWords: PaliWord[]
): string[] => {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const word of paliWords) {
    for (const segment of word.segments) {
      if (segment.id) {
        if (seen.has(segment.id)) {
          duplicates.push(segment.id);
        } else {
          seen.add(segment.id);
        }
      }
    }
  }

  return duplicates;
};

/**
 * Validate all English token links resolve to valid segments or words.
 * Returns list of invalid link references.
 */
export const validateEnglishLinks = (
  englishStructure: EnglishToken[],
  paliWords: PaliWord[]
): string[] => {
  const validWordIds = new Set(paliWords.map((w) => w.id));
  const validSegmentIds = new Set<string>();
  for (const word of paliWords) {
    for (const seg of word.segments) {
      if (seg.id) validSegmentIds.add(seg.id);
    }
  }

  const invalid: string[] = [];

  for (const token of englishStructure) {
    if (token.linkedSegmentId && !validSegmentIds.has(token.linkedSegmentId)) {
      invalid.push(`segment:${token.linkedSegmentId}`);
    }
    if (token.linkedPaliId && !validWordIds.has(token.linkedPaliId)) {
      invalid.push(`word:${token.linkedPaliId}`);
    }
  }

  return invalid;
};
