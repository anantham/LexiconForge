/**
 * Quality Scorer for Sutta Studio Pipeline Outputs
 *
 * Empirically-derived scoring rubric based on manual inspection of
 * gemini-2-flash and trinity-large outputs for MN10 phases.
 *
 * Run with: npx tsx scripts/sutta-studio/quality-scorer.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  AnatomistPass,
  LexicographerPass,
  WeaverPass,
  TypesetterPass,
} from '../../types/suttaStudio';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type PipelineOutput = {
  output: {
    anatomist: AnatomistPass;
    lexicographer: LexicographerPass;
    weaver: WeaverPass;
    typesetter: TypesetterPass | null;
  };
  /**
   * The curated golden packet for this phase, when available. Used by the
   * FIDELITY dimensions to measure how faithfully the model reproduces the
   * golden's morpheme boundaries + etymological/gloss content — rather than
   * just measuring output density. Absent for ad-hoc (non-benchmark) scoring,
   * in which case the fidelity dimensions are skipped and weights fall back.
   */
  golden?: {
    anatomist: AnatomistPass | null;
    lexicographer: LexicographerPass | null;
    weaver: WeaverPass | null;
    typesetter: TypesetterPass | null;
  } | null;
  segments: Array<{ pali: string }>;
};

/**
 * Scoring-rubric version. v2.0 = the Gate/Fidelity/Usability redesign (ADR SUTTA-009):
 * gateFactor multiplier, sequence-aligned micro-F1 fidelity, paliWordCoverage as a Gate.
 * v1 (density) scores are NOT comparable to v2 and must not share a leaderboard.
 */
export const RUBRIC_VERSION = '2.0';

export type QualityScore = {
  phase: string;
  model: string;
  rubricVersion: string;
  // Coverage
  paliWordCoverage: number;
  englishMappingRatio: number;
  alignmentCoverage: number;
  // Validity
  noEmptySegments: number;
  noDuplicateMappings: number;
  textIntegrity: number;
  // Richness
  tooltipCoverage: number;
  sensePolysemy: number;
  senseDistinctness: number;  // fraction of sense-pairs that are NOT near-duplicates (anti-vacuous-polysemy)
  morphDataPresent: number;
  // Fidelity (vs golden) — null when no golden packet is available for the phase
  segmentationFidelity: number | null;  // morpheme-boundary F1 vs golden, matched by surface
  contentFidelity: number | null;       // etymology + gloss token F1 vs golden, matched by surface
  fidelityScore: number | null;         // combined fidelity dimension
  // Grammar (arrows)
  relationCount: number;
  relationDensity: number;  // relations per content word
  relationsValid: number;   // all refs point to existing IDs
  // Layout (typesetter)
  blockSizeScore: number;       // % of words in ideal blocks (2-5 words)
  singleWordBlockRatio: number; // % of blocks that are single-word (lower is better)
  oversizedBlockRatio: number;  // % of blocks > 5 words (lower is better)
  englishOrderScore: number;    // 1.0 = English in original order, 0 = scrambled
  layoutScore: number;          // combined layout quality
  // Aggregates
  coverageScore: number;
  validityScore: number;
  richnessScore: number;
  grammarScore: number;
  layoutDimension: number;      // layout dimension score
  overallScore: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN HELPERS (sense distinctness + golden fidelity)
// ─────────────────────────────────────────────────────────────────────────────

const SENSE_STOP = new Set([
  'the', 'and', 'for', 'with', 'are', 'here', 'part', 'name', 'meaning', 'sense',
  'word', 'term', 'its', 'this', 'that', 'not', 'but', 'than', 'from', 'one',
  'what', 'about', 'marks', 'mark', 'used', 'refers', 'form', 'where', 'which',
  'into', 'place', 'thing', 'something', 'usual', 'like', 'etc',
]);

/** Lowercase, strip punctuation (keep Pāli diacritics + √ root marker), drop stopwords/short. */
const tokenize = (text: string | undefined | null): string[] => {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-zĀ-ſḀ-ỿ√]+/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => (t.length > 2 || t.startsWith('√')) && !SENSE_STOP.has(t));
};

const jaccard = (a: string[], b: string[]): number => {
  const sa = new Set(a), sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const uni = new Set([...a, ...b]).size;
  return uni > 0 ? inter / uni : 0;
};

/** Two glosses are near-duplicates if their content tokens overlap heavily. */
const nearDuplicate = (a: string[], b: string[]): boolean => jaccard(a, b) >= 0.5;

/** Greedy distinct-cluster count: collapse near-duplicate token sets. */
const countDistinctClusters = (items: string[][]): number => {
  const reps: string[][] = [];
  for (const it of items) {
    if (!reps.some(r => nearDuplicate(r, it))) reps.push(it);
  }
  return reps.length;
};

// ─────────────────────────────────────────────────────────────────────────────
// SCORING FUNCTIONS (exported for use in benchmark.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function scoreAnatomist(data: AnatomistPass, inputPali: string): {
  paliWordCoverage: number;
  noEmptySegments: number;
  textIntegrity: number;
  tooltipCoverage: number;
  morphDataPresent: number;
} {
  const words = data?.words || [];
  const segments = data?.segments || [];

  // Count input words (rough: split on whitespace)
  const inputWords = inputPali.split(/\s+/).filter(w => w.length > 0);
  const outputWords = words.length;
  const paliWordCoverage = inputWords.length > 0 ? Math.min(1, outputWords / inputWords.length) : 0;

  // Empty segments check
  const emptySegments = segments.filter(s => !s.text || s.text.trim() === '').length;
  const noEmptySegments = segments.length > 0
    ? 1 - (emptySegments / segments.length)
    : 0;

  // Text integrity: FRACTION of words whose segments concatenate back to the surface.
  // (Was binary — one bad word zeroed the phase, which the gate multiplier then made
  // catastrophic. Fractional distinguishes a single sandhi slip from total corruption
  // and feeds the gate proportionally: total corruption → 0, one slip → a small dent.)
  let reconstructed = 0;
  for (const word of words) {
    const concat = segments.filter(s => s.wordId === word.id).map(s => s.text).join('');
    if (concat.toLowerCase() === (word.surface || '').toLowerCase()) reconstructed++;
  }
  const textIntegrity = words.length > 0 ? reconstructed / words.length : 1;

  // Tooltip COVERAGE: fraction of segments that carry at least one tooltip.
  // (Was avg-tooltips-per-segment — a DENSITY metric that punished correct
  // morpheme splitting: splitting a lumped stem into N segments diluted the
  // average even with the same total explanation. Coverage is split-invariant —
  // every segment explained = 1.0 whether the word is 1 segment or 4. The
  // QUALITY/correctness of the explanation is measured by contentFidelity.)
  const explainedSegments = segments.filter(s => (s.tooltips?.length || 0) > 0).length;
  const tooltipCoverage = segments.length > 0 ? explainedSegments / segments.length : 0;

  // Morph data presence — RESTRAINT-AWARE.
  // Inflectional morphology (case/number/gender/tense) belongs on the SUFFIX
  // segments (the grammatical endings), NOT on roots / prefixes / stems. The old
  // metric (morph on EVERY segment) penalized the linguistically correct behavior
  // of tagging only the endings. Score the fraction of suffix segments that carry
  // morph; if there are no suffixes to tag, nothing was missed → full marks.
  const morphBearing = segments.filter(s => s.type === 'suffix');
  const morphTagged = morphBearing.filter(s => s.morph).length;
  const morphDataPresent = morphBearing.length > 0
    ? morphTagged / morphBearing.length
    : 1;

  return {
    paliWordCoverage,
    noEmptySegments,
    textIntegrity,
    tooltipCoverage,
    morphDataPresent,
  };
}

export function scoreLexicographer(data: LexicographerPass): {
  sensePolysemy: number;
  senseDistinctness: number;
} {
  // Content words should have 3 senses, function words 1-2.
  let totalExpected = 0;
  let totalDistinct = 0;
  let pairTotal = 0;
  let pairDistinct = 0;

  for (const entry of data.senses) {
    const expected = entry.wordClass === 'content' ? 3 : 1.5;
    const senseTokens = (entry.senses || []).map(s => tokenize(s.english));
    // Distinctness-aware: collapse near-duplicate senses BEFORE crediting, so
    // "town / market town / settlement"-style padding can't farm a free 1.0.
    const distinctCount = countDistinctClusters(senseTokens);
    totalExpected += expected;
    totalDistinct += Math.min(distinctCount, expected);
    // Standalone metric: fraction of sense-pairs that are genuinely distinct.
    for (let i = 0; i < senseTokens.length; i++) {
      for (let j = i + 1; j < senseTokens.length; j++) {
        pairTotal++;
        if (!nearDuplicate(senseTokens[i], senseTokens[j])) pairDistinct++;
      }
    }
  }

  const sensePolysemy = totalExpected > 0 ? totalDistinct / totalExpected : 0;
  const senseDistinctness = pairTotal > 0 ? pairDistinct / pairTotal : 1;
  return { sensePolysemy, senseDistinctness };
}

export function scoreWeaver(data: WeaverPass): {
  englishMappingRatio: number;
  alignmentCoverage: number;
  noDuplicateMappings: number;
} {
  const tokens = data?.tokens || [];
  const totalTokens = tokens.length;

  // Non-ghost tokens (visible in UI)
  const nonGhostTokens = tokens.filter(t => !t.isGhost).length;
  const englishMappingRatio = totalTokens > 0 ? nonGhostTokens / totalTokens : 0;

  // Alignment coverage: tokens with actual Pali links (segment OR word level)
  // - linkedSegmentId: links to morphological segment (a1s1, a2s1) - finer granularity
  // - linkedPaliId: links to Pali word (p1, p2) - coarser granularity
  // Both are valid alignment strategies, so we accept either
  const linkedTokens = tokens.filter(t => !t.isGhost && (t.linkedSegmentId || t.linkedPaliId)).length;
  const alignmentCoverage = nonGhostTokens > 0 ? linkedTokens / nonGhostTokens : 0;

  // Check for duplicate mappings (segment or word level)
  const allLinks = tokens
    .filter(t => t.linkedSegmentId || t.linkedPaliId)
    .map(t => t.linkedSegmentId || t.linkedPaliId!);
  const uniqueLinks = new Set(allLinks);
  const duplicateCount = allLinks.length - uniqueLinks.size;
  const noDuplicateMappings = allLinks.length > 0
    ? 1 - (duplicateCount / allLinks.length)
    : 1;

  return { englishMappingRatio, alignmentCoverage, noDuplicateMappings };
}

export function scoreGrammar(data: AnatomistPass): {
  relationCount: number;
  relationDensity: number;
  relationsValid: number;
} {
  const relations = data?.relations || [];
  const words = data?.words || [];
  const segments = data?.segments || [];

  const relationCount = relations.length;

  // Relation density: relations per content word (expect ~0.5-1 relation per content word)
  const contentWords = words.filter(w => w.wordClass === 'content').length;
  const expectedRelations = Math.max(1, contentWords * 0.5); // At least 1 expected
  const relationDensity = Math.min(1, relationCount / expectedRelations);

  // Validate that all refs point to existing IDs
  const segmentIds = new Set(segments.map(s => s.id));
  const wordIds = new Set(words.map(w => w.id));

  let validCount = 0;
  for (const rel of relations) {
    const fromValid = segmentIds.has(rel.fromSegmentId);
    // Relations can target words OR segments, check both
    const toWordValid = rel.targetWordId ? wordIds.has(rel.targetWordId) : false;
    const toSegmentValid = rel.targetSegmentId ? segmentIds.has(rel.targetSegmentId) : false;
    if (fromValid && (toWordValid || toSegmentValid)) validCount++;
  }
  const relationsValid = relationCount > 0 ? validCount / relationCount : 1;

  return { relationCount, relationDensity, relationsValid };
}

// ─────────────────────────────────────────────────────────────────────────────
// FIDELITY (vs golden) — the dimensions that actually READ the curated packet.
// Match words across golden/model by surface form (their IDs differ), then
// compare morpheme boundaries (segmentation) and etymology/gloss tokens (content).
// ─────────────────────────────────────────────────────────────────────────────

/** Normalized surface key for cross-pass word alignment (lowercase + Unicode NFC). */
const normSurface = (s: string | undefined): string => (s || '').toLowerCase().normalize('NFC');

/**
 * Align two word arrays by normalized surface via LCS sequence alignment, returning
 * matched [goldenIndex, modelIndex] pairs in order. Robust to drops / merges / repeats:
 * a dropped instance of a repeated word leaves ONE golden word unmatched with no cascade
 * — unlike positional Nth-to-Nth matching (Gemini review finding #1).
 */
const alignWords = (
  gold: AnatomistPass['words'],
  model: AnatomistPass['words']
): Array<[number, number]> => {
  const G = (gold || []).map(w => normSurface(w.surface));
  const M = (model || []).map(w => normSurface(w.surface));
  const n = G.length, m = M.length;
  if (n === 0 || m === 0) return [];
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = G[i - 1] === M[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (G[i - 1] === M[j - 1]) { pairs.push([i - 1, j - 1]); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return pairs.reverse();
};

/** Internal cut offsets for a word's ordered morpheme segments (e.g. ni|gam|o → {2,5}). */
const boundaryOffsets = (
  segmentIds: string[],
  segs: AnatomistPass['segments']
): Set<number> => {
  const byId = new Map((segs || []).map(s => [s.id, s]));
  const ordered = segmentIds.map(id => byId.get(id)).filter(Boolean) as AnatomistPass['segments'];
  const cuts = new Set<number>();
  let acc = 0;
  for (let i = 0; i < ordered.length - 1; i++) {
    acc += (ordered[i].text || '').length;
    cuts.add(acc);
  }
  return cuts;
};

/** Morpheme-boundary fidelity: MICRO-F1 of cut positions, pooled over sequence-aligned words. */
export function scoreSegmentationFidelity(
  output: AnatomistPass,
  golden: AnatomistPass | null | undefined
): number | null {
  if (!golden?.words?.length) return null;
  const pairs = alignWords(golden.words, output.words || []);
  if (pairs.length === 0) return null;
  let tp = 0, fp = 0, fn = 0;
  for (const [gi, mi] of pairs) {
    const gCuts = boundaryOffsets(golden.words[gi].segmentIds || [], golden.segments || []);
    const oCuts = boundaryOffsets((output.words || [])[mi].segmentIds || [], output.segments || []);
    for (const c of oCuts) (gCuts.has(c) ? tp++ : fp++);
    for (const c of gCuts) if (!oCuts.has(c)) fn++;
  }
  const denom = 2 * tp + fp + fn;
  return denom > 0 ? (2 * tp) / denom : 1; // no boundaries on either side across all aligned words → agree
}

/** A word's "knowledge tokens" (by id) — its anatomist tooltips + its lexicographer senses. */
const wordKnowledgeTokensById = (
  wordId: string,
  anat: AnatomistPass | null | undefined,
  lex: LexicographerPass | null | undefined
): string[] => {
  const tokens: string[] = [];
  for (const s of (anat?.segments || []).filter(s => s.wordId === wordId)) {
    for (const t of (s.tooltips || [])) tokens.push(...tokenize(t));
  }
  const lexEntry = (lex?.senses || []).find(e => e.wordId === wordId);
  if (lexEntry) {
    for (const sense of (lexEntry.senses || [])) {
      tokens.push(...tokenize(sense.english));
      tokens.push(...tokenize(sense.nuance));
    }
  }
  return tokens;
};

/**
 * Etymology + gloss fidelity: STRICT MICRO-F1 (β=1) over sequence-aligned words.
 * Pool TP/FP/FN across the whole phase, then one F1 — so a 20-token compound carries
 * more weight than a 1-token particle (Gemini #3). Balanced F1, NOT recall-weighted:
 * recall-weighting rewards synonym-spraying (Gemini #2); "model exceeds golden" is
 * handled by the golden-update protocol, not by loosening the metric. Words the golden
 * is silent on contribute nothing (no penalty for a model's correct additions).
 */
export function scoreContentFidelity(
  outAnat: AnatomistPass, goldAnat: AnatomistPass | null | undefined,
  outLex: LexicographerPass, goldLex: LexicographerPass | null | undefined
): number | null {
  if (!goldAnat?.words?.length) return null;
  const pairs = alignWords(goldAnat.words, outAnat.words || []);
  if (pairs.length === 0) return null;
  let tp = 0, fp = 0, fn = 0, scored = 0;
  for (const [gi, mi] of pairs) {
    const goldTokens = new Set(wordKnowledgeTokensById(goldAnat.words[gi].id, goldAnat, goldLex));
    if (goldTokens.size === 0) continue; // golden silent on this word → no reference
    scored++;
    const modelTokens = new Set(wordKnowledgeTokensById((outAnat.words || [])[mi].id, outAnat, outLex));
    for (const t of modelTokens) (goldTokens.has(t) ? tp++ : fp++);
    for (const t of goldTokens) if (!modelTokens.has(t)) fn++;
  }
  if (scored === 0) return null;
  const denom = 2 * tp + fp + fn;
  return denom > 0 ? (2 * tp) / denom : 0;
}

export function scoreTypesetter(
  data: TypesetterPass | null,
  weaver?: WeaverPass | null,
  anatomist?: AnatomistPass | null
): {
  blockSizeScore: number;       // 1.0 = all blocks ideal size (2-5), penalized for too small or large
  singleWordBlockRatio: number; // 0 = no single-word blocks (lower is better)
  oversizedBlockRatio: number;  // 0 = no blocks > 5 words (lower is better)
  englishOrderScore: number;    // 1.0 = English reads in original order, 0 = completely scrambled
  layoutScore: number;          // Combined metric (higher is better)
} {
  const blocks = data?.layoutBlocks || [];

  if (blocks.length === 0) {
    return { blockSizeScore: 0, singleWordBlockRatio: 0, oversizedBlockRatio: 0, englishOrderScore: 0, layoutScore: 0 };
  }

  const totalWords = blocks.reduce((sum, b) => sum + b.length, 0);
  if (totalWords === 0) {
    return { blockSizeScore: 0, singleWordBlockRatio: 0, oversizedBlockRatio: 0, englishOrderScore: 0, layoutScore: 0 };
  }

  // Count blocks by size category
  let singleWordBlocks = 0;
  let idealBlocks = 0;      // 2-5 words
  let oversizedBlocks = 0;  // > 5 words

  let wordsInSingle = 0;
  let wordsInIdeal = 0;
  let wordsInOversized = 0;

  for (const block of blocks) {
    const size = block.length;
    if (size === 1) {
      singleWordBlocks++;
      wordsInSingle += size;
    } else if (size >= 2 && size <= 5) {
      idealBlocks++;
      wordsInIdeal += size;
    } else if (size > 5) {
      oversizedBlocks++;
      wordsInOversized += size;
    }
  }

  // Ratios (0 = none, 1 = all)
  const singleWordBlockRatio = singleWordBlocks / blocks.length;
  const oversizedBlockRatio = oversizedBlocks / blocks.length;

  // Block size score: what % of words are in ideal-sized blocks
  const blockSizeScore = wordsInIdeal / totalWords;

  // English order score: measure how much displayed order matches original
  // Uses Kendall tau-like metric: count inversions (pairs out of order)
  let englishOrderScore = 1; // Default to perfect if we can't compute

  if (weaver?.tokens && anatomist?.words && anatomist.segments) {
    // Build map: Pali word/segment -> position in layout
    const paliPositionMap = new Map<string, number>();
    let pos = 0;
    for (const block of blocks) {
      for (const wordId of block) {
        paliPositionMap.set(wordId, pos);
        // Also map segments of this word
        const word = anatomist.words.find(w => w.id === wordId);
        if (word) {
          for (const segId of word.segmentIds) {
            paliPositionMap.set(segId, pos);
          }
        }
        pos++;
      }
    }

    // Get linked tokens with their original and display positions
    const linkedTokens = weaver.tokens
      .filter(t => t.linkedPaliId || t.linkedSegmentId)
      .map(t => {
        const linkTarget = t.linkedSegmentId || t.linkedPaliId!;
        const displayPos = paliPositionMap.get(linkTarget) ?? -1;
        return { originalIndex: t.tokenIndex, displayPos };
      })
      .filter(t => t.displayPos >= 0);

    // Count inversions: pairs where original order differs from display order
    let inversions = 0;
    let pairs = 0;
    for (let i = 0; i < linkedTokens.length; i++) {
      for (let j = i + 1; j < linkedTokens.length; j++) {
        pairs++;
        const origOrder = linkedTokens[i].originalIndex < linkedTokens[j].originalIndex;
        const dispOrder = linkedTokens[i].displayPos < linkedTokens[j].displayPos;
        if (origOrder !== dispOrder) inversions++;
      }
    }

    // Score: 1 - (inversions / total_pairs)
    englishOrderScore = pairs > 0 ? 1 - (inversions / pairs) : 1;
  }

  // Combined layout score:
  // - Reward words in ideal blocks (35%)
  // - Penalize single-word blocks (20%)
  // - Penalize oversized blocks (15%)
  // - Reward English reading in correct order (30%)
  const layoutScore = (
    blockSizeScore * 0.35 +
    (1 - singleWordBlockRatio) * 0.20 +
    (1 - oversizedBlockRatio) * 0.15 +
    englishOrderScore * 0.30
  );

  return { blockSizeScore, singleWordBlockRatio, oversizedBlockRatio, englishOrderScore, layoutScore };
}

/**
 * Validity GATE as a multiplier (not an additive bucket). A `textIntegrity` failure
 * (segments don't reconstruct the surface) is catastrophic data loss → hard 0.1 cap
 * (Gemini review #4). The softer structural gates — including `paliWordCoverage`, which
 * is structural not UX (Gemini) — degrade the score mildly via softFactor in [0.7, 1.0].
 */
export function computeGateFactor(scores: {
  textIntegrity: number;
  noEmptySegments: number;
  noDuplicateMappings: number;
  relationsValid: number;
  paliWordCoverage: number;
}): number {
  // textIntegrity is the FRACTION of words that reconstruct (0..1); it multiplies the
  // gate directly — total corruption → 0 (Gemini's "garbage scores 0"), a single sandhi
  // slip → a proportional dent, not a catastrophic cliff. The softer structural gates
  // (incl. paliWordCoverage, which is structural not UX — Gemini) swing only [0.7, 1.0].
  const soft = (scores.noEmptySegments + scores.noDuplicateMappings + scores.relationsValid + scores.paliWordCoverage) / 4;
  const softFactor = 0.7 + 0.3 * soft;
  return scores.textIntegrity * softFactor;
}

// v2.0 quality weights — Fidelity dominates; the old density metrics survive only as a
// small "transitional richness" bucket (kept, not deleted) until relation/morph fidelity
// replaces them in v2.1. See ADR SUTTA-009.
const W_FIDELITY = 0.60;
const W_USABILITY = 0.25;
const W_RICHNESS = 0.15;

export function computeOverallScore(scores: Omit<QualityScore, 'overallScore'>): number {
  const gateFactor = computeGateFactor(scores);
  const usability = (scores.alignmentCoverage + scores.englishOrderScore) / 2;
  const transitionalRichness = (scores.tooltipCoverage + scores.sensePolysemy + scores.morphDataPresent) / 3;

  if (scores.fidelityScore !== null && scores.fidelityScore !== undefined) {
    const quality = W_FIDELITY * scores.fidelityScore + W_USABILITY * usability + W_RICHNESS * transitionalRichness;
    return gateFactor * quality;
  }

  // No golden → "ungraded for fidelity": score on gate × (usability + richness) only,
  // renormalized over their weights. Such phases are EXCLUDED from the ranked leaderboard.
  const quality = (W_USABILITY * usability + W_RICHNESS * transitionalRichness) / (W_USABILITY + W_RICHNESS);
  return gateFactor * quality;
}

export function scorePhase(data: PipelineOutput, phase: string, model: string): QualityScore {
  const inputPali = data.segments.map(s => s.pali).join(' ');

  const anatomistScores = scoreAnatomist(data.output.anatomist, inputPali);
  const lexiScores = scoreLexicographer(data.output.lexicographer);
  const weaverScores = scoreWeaver(data.output.weaver);
  const grammarScores = scoreGrammar(data.output.anatomist);
  const typesetterScores = scoreTypesetter(data.output.typesetter, data.output.weaver, data.output.anatomist);

  // FIDELITY (vs golden) — null when no golden packet is present for this phase.
  const goldAnat = data.golden?.anatomist ?? null;
  const goldLex = data.golden?.lexicographer ?? null;
  const segmentationFidelity = scoreSegmentationFidelity(data.output.anatomist, goldAnat);
  const contentFidelity = scoreContentFidelity(data.output.anatomist, goldAnat, data.output.lexicographer, goldLex);
  const fidParts = [segmentationFidelity, contentFidelity].filter((x): x is number => x !== null);
  const fidelityScore = fidParts.length > 0 ? fidParts.reduce((a, b) => a + b, 0) / fidParts.length : null;

  // Coverage now includes alignment coverage as the most important factor for visible alignment edges
  // Weight: paliWordCoverage (33%) + englishMappingRatio (17%) + alignmentCoverage (50%)
  const coverageScore = (
    anatomistScores.paliWordCoverage * 0.33 +
    weaverScores.englishMappingRatio * 0.17 +
    weaverScores.alignmentCoverage * 0.50
  );
  const validityScore = (
    anatomistScores.noEmptySegments +
    weaverScores.noDuplicateMappings +
    anatomistScores.textIntegrity
  ) / 3;
  const richnessScore = (
    anatomistScores.tooltipCoverage +
    lexiScores.sensePolysemy +
    anatomistScores.morphDataPresent
  ) / 3;
  const grammarScore = (grammarScores.relationDensity + grammarScores.relationsValid) / 2;
  const layoutDimension = typesetterScores.layoutScore;

  const baseScores = {
    phase,
    model,
    rubricVersion: RUBRIC_VERSION,
    ...anatomistScores,
    ...lexiScores,
    ...weaverScores,
    ...grammarScores,
    ...typesetterScores,
    segmentationFidelity,
    contentFidelity,
    fidelityScore,
    coverageScore,
    validityScore,
    richnessScore,
    grammarScore,
    layoutDimension,
  };

  return {
    ...baseScores,
    overallScore: computeOverallScore(baseScores),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const reportsDir = path.join(process.cwd(), 'reports/sutta-studio/2026-01-30T22-19-46-222Z/outputs');
  const models = [
    'gemini-2-flash',
    'gemma-2-27b',
    'glm-4.7-flash',
    'kimi-k2.5',
    'lfm-thinking',
    'llama-3.3-70b',
    'minimax-m2',
    'mistral-large',
    'molmo-2-8b',
    'nemotron-3-nano',
    'qwen-2.5-72b',
    'solar-pro-3',
    'trinity-large',
  ];
  const phases = ['phase-a', 'phase-b', 'phase-c', 'phase-d', 'phase-e', 'phase-f', 'phase-g', 'phase-h',
                   'phase-1', 'phase-2', 'phase-3', 'phase-4', 'phase-5', 'phase-6', 'phase-7'];

  const results: QualityScore[] = [];

  for (const model of models) {
    for (const phase of phases) {
      const filePath = path.join(reportsDir, model, `pipeline-${phase}.json`);
      if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${model}/${phase} - file not found`);
        continue;
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PipelineOutput;

      // Skip if output is null (model failed)
      if (!data.output?.anatomist || !data.output?.lexicographer || !data.output?.weaver) {
        console.log(`Skipping ${model}/${phase} - incomplete output`);
        continue;
      }

      const score = scorePhase(data, phase, model);
      results.push(score);
    }
  }

  // Print results as table
  console.log('\n' + '═'.repeat(100));
  console.log('QUALITY SCORES - Empirical Rubric');
  console.log('═'.repeat(100));

  console.log('\n┌─────────┬─────────────────┬─────────┬──────────┬──────────┬─────────┬─────────┐');
  console.log('│ Phase   │ Model           │Coverage │ Validity │ Richness │ Grammar │ Overall │');
  console.log('├─────────┼─────────────────┼─────────┼──────────┼──────────┼─────────┼─────────┤');

  for (const r of results) {
    console.log(
      `│ ${r.phase.padEnd(7)} │ ${r.model.padEnd(15)} │ ${r.coverageScore.toFixed(2).padStart(6)}  │ ${r.validityScore.toFixed(2).padStart(7)}  │ ${r.richnessScore.toFixed(2).padStart(7)}  │ ${r.grammarScore.toFixed(2).padStart(6)}  │ ${r.overallScore.toFixed(2).padStart(6)}  │`
    );
  }

  console.log('└─────────┴─────────────────┴─────────┴──────────┴──────────┴─────────┴─────────┘');

  // Print detailed breakdown for one phase
  console.log('\n' + '─'.repeat(60));
  console.log('DETAILED BREAKDOWN: phase-b');
  console.log('─'.repeat(60));

  const phaseB = results.filter(r => r.phase === 'phase-b');
  for (const r of phaseB) {
    console.log(`\n${r.model}:`);
    console.log(`  Coverage:`);
    console.log(`    Pali Word Coverage:     ${(r.paliWordCoverage * 100).toFixed(0)}%`);
    console.log(`    English Mapping Ratio:  ${(r.englishMappingRatio * 100).toFixed(0)}%`);
    console.log(`    Alignment Coverage:     ${(r.alignmentCoverage * 100).toFixed(0)}% ← links between Pali/English`);
    console.log(`  Validity:`);
    console.log(`    No Empty Segments:      ${(r.noEmptySegments * 100).toFixed(0)}%`);
    console.log(`    No Duplicate Mappings:  ${(r.noDuplicateMappings * 100).toFixed(0)}%`);
    console.log(`    Text Integrity:         ${r.textIntegrity ? '✓' : '✗'}`);
    console.log(`  Richness:`);
    console.log(`    Tooltip Coverage:       ${(r.tooltipCoverage * 100).toFixed(0)}%`);
    console.log(`    Sense Polysemy:         ${(r.sensePolysemy * 100).toFixed(0)}%`);
    console.log(`    Morph Data Present:     ${(r.morphDataPresent * 100).toFixed(0)}%`);
    console.log(`  Grammar (Arrows):`);
    console.log(`    Relation Count:         ${r.relationCount}`);
    console.log(`    Relation Density:       ${(r.relationDensity * 100).toFixed(0)}%`);
    console.log(`    Relations Valid:        ${(r.relationsValid * 100).toFixed(0)}%`);
  }

  // Model rankings
  console.log('\n' + '═'.repeat(60));
  console.log('MODEL RANKINGS (Average across phases)');
  console.log('═'.repeat(60));

  const modelAverages = new Map<string, { scores: number[]; validity: number[]; richness: number[]; grammar: number[] }>();
  for (const r of results) {
    if (!modelAverages.has(r.model)) {
      modelAverages.set(r.model, { scores: [], validity: [], richness: [], grammar: [] });
    }
    const m = modelAverages.get(r.model)!;
    m.scores.push(r.overallScore);
    m.validity.push(r.validityScore);
    m.richness.push(r.richnessScore);
    m.grammar.push(r.grammarScore);
  }

  const rankings = Array.from(modelAverages.entries())
    .map(([model, data]) => ({
      model,
      avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
      avgValidity: data.validity.reduce((a, b) => a + b, 0) / data.validity.length,
      avgRichness: data.richness.reduce((a, b) => a + b, 0) / data.richness.length,
      avgGrammar: data.grammar.reduce((a, b) => a + b, 0) / data.grammar.length,
      phaseCount: data.scores.length,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  console.log('\n Rank │ Model             │ Phases │ Valid │ Rich  │ Gram  │ Score');
  console.log('──────┼───────────────────┼────────┼───────┼───────┼───────┼───────');

  rankings.forEach((r, i) => {
    console.log(
      ` ${(i + 1).toString().padStart(2)}   │ ${r.model.padEnd(17)} │ ${r.phaseCount.toString().padStart(5)}  │ ${r.avgValidity.toFixed(2).padStart(5)} │ ${r.avgRichness.toFixed(2).padStart(5)} │ ${r.avgGrammar.toFixed(2).padStart(5)} │ ${r.avgScore.toFixed(2).padStart(5)}`
    );
  });

  console.log('\nLegend: Valid=Validity, Rich=Richness, Gram=Grammar, Score=Overall');
}

// Only run when executed directly, not when imported
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch(console.error);
}
