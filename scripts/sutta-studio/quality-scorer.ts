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
// facts-scorer imports alignWords/tokenize back from here; the cycle is safe because both sides
// only use the other's exports at CALL time (inside functions), never at module init.
import { scoreFactsDetail, scoreSenseFidelityDetail } from './facts-scorer';

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
export const RUBRIC_VERSION = '2.2';

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
  contentPrecision: number | null;      // of what the model said, how much the golden attests (v2.1)
  contentRecall: number | null;         // of what the golden requires, how much the model said (v2.1)
  fidelityScore: number | null;         // combined fidelity dimension (v2.1; still the "has golden" gate)
  // v2.2 ranked components (ADR SUTTA-013/014) — null when no golden for the phase.
  factsCore: number | null;             // root + word-class macro; morph stays ADVISORY, not ranked
  senseF1: number | null;               // strict sense-english micro-F1 (SUTTA-012 drop-penalised)
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
export const tokenize = (text: string | undefined | null): string[] => {
  if (!text) return [];
  return text
    .normalize('NFC') // fold decomposed diacritics FIRST, else a combining macron (not in
                      // the whitelist below) gets split out and fractures the word (Gemini review)
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
    // Reconstruct under the SAME NFC/case normalization the aligner uses, so a
    // precomposed-vs-decomposed diacritic mismatch isn't scored as data loss (grok review).
    if (normSurface(concat) === normSurface(word.surface)) reconstructed++;
  }
  // Empty output must NOT bank an unearned 1.0 here — that would hand a garbage/empty
  // response a ~0.85 gateFactor (Gemini review). No words → nothing reconstructed → 0.
  const textIntegrity = words.length > 0 ? reconstructed / words.length : 0;

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
export const alignWords = (
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
  if (!golden?.words?.length) return null; // no golden → ungraded (excluded from ranking)
  const pairs = alignWords(golden.words, output.words || []);
  if (pairs.length === 0) return 0; // golden exists but nothing aligned → earned a 0, not a free pass (grok + Gemini review)
  const alignedG = new Set(pairs.map(([gi]) => gi));
  let tp = 0, fp = 0, fn = 0;
  for (const [gi, mi] of pairs) {
    const gCuts = boundaryOffsets(golden.words[gi].segmentIds || [], golden.segments || []);
    const oCuts = boundaryOffsets((output.words || [])[mi].segmentIds || [], output.segments || []);
    for (const c of oCuts) (gCuts.has(c) ? tp++ : fp++);
    for (const c of gCuts) if (!oCuts.has(c)) fn++;
  }
  // v2.1 (ADR SUTTA-012): a golden word the model DROPPED still owes its boundaries.
  // Fidelity used to be conditioned on the words a model chose to keep, so skipping
  // hard words inflated the score (survivorship bias — one model dropped 41% of golden
  // words and still posted competitive per-kept-word fidelity).
  golden.words.forEach((gw, gi) => {
    if (!alignedG.has(gi)) fn += boundaryOffsets(gw.segmentIds || [], golden.segments || []).size;
  });
  const denom = 2 * tp + fp + fn;
  return denom > 0 ? (2 * tp) / denom : 1; // no boundaries on either side across all aligned words → agree
}

/** A word's "knowledge tokens" (by id) — its anatomist tooltips + its lexicographer senses. */
export const wordKnowledgeTokensById = (
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
export function scoreContentFidelityDetail(
  outAnat: AnatomistPass, goldAnat: AnatomistPass | null | undefined,
  outLex: LexicographerPass, goldLex: LexicographerPass | null | undefined
): { f1: number; precision: number; recall: number; tp: number; fp: number; fn: number } | null {
  if (!goldAnat?.words?.length) return null; // no golden → ungraded
  const pairs = alignWords(goldAnat.words, outAnat.words || []);
  const alignedG = new Set(pairs.map(([gi]) => gi));
  let tp = 0, fp = 0, fn = 0, scored = 0;
  for (const [gi, mi] of pairs) {
    const goldTokens = new Set(wordKnowledgeTokensById(goldAnat.words[gi].id, goldAnat, goldLex));
    if (goldTokens.size === 0) continue; // golden silent on this word → no reference
    scored++;
    const modelTokens = new Set(wordKnowledgeTokensById((outAnat.words || [])[mi].id, outAnat, outLex));
    for (const t of modelTokens) (goldTokens.has(t) ? tp++ : fp++);
    for (const t of goldTokens) if (!modelTokens.has(t)) fn++;
  }
  // v2.1 (ADR SUTTA-012): a golden word the model DROPPED still owes its content.
  // Every golden token of an unaligned word is a miss — dropping hard words must not
  // inflate fidelity (survivorship bias). Model-only words stay unpenalized: the golden
  // being silent on a word the model added is a golden gap, not a model error.
  goldAnat.words.forEach((gw, gi) => {
    if (alignedG.has(gi)) return;
    const goldTokens = new Set(wordKnowledgeTokensById(gw.id, goldAnat, goldLex));
    if (goldTokens.size === 0) return;
    scored++;
    fn += goldTokens.size;
  });
  if (scored === 0) return null; // golden carries no reference content for this phase
  const denom = 2 * tp + fp + fn;
  const f1 = denom > 0 ? (2 * tp) / denom : 0;
  return {
    f1,
    precision: tp + fp > 0 ? tp / (tp + fp) : 0,
    recall: tp + fn > 0 ? tp / (tp + fn) : 0,
    tp, fp, fn,
  };
}

export function scoreContentFidelity(
  outAnat: AnatomistPass, goldAnat: AnatomistPass | null | undefined,
  outLex: LexicographerPass, goldLex: LexicographerPass | null | undefined
): number | null {
  return scoreContentFidelityDetail(outAnat, goldAnat, outLex, goldLex)?.f1 ?? null;
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
 * Validity GATE as a multiplier (not an additive bucket). `textIntegrity` (the FRACTION
 * of words whose segments reconstruct the surface) multiplies the gate DIRECTLY: total
 * corruption → 0, a single sandhi slip → a proportional dent — NOT a hard cliff. (An
 * earlier draft imposed a hard 0.1 cap on any textIntegrity miss; that was rejected for
 * crushing a mostly-correct phase to 0.059 over 4 slips — see ADR SUTTA-009.) The softer
 * structural gates — incl. `paliWordCoverage`, structural not UX — swing only [0.7, 1.0].
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

// v2.2 ranked weights (ADR SUTTA-013/014; operator-confirmed as FINAL-score weights). The ranked
// core is three golden-backed dimensions under the canonical-integrity gate:
//   overall = gate × (0.40·segmentationF1 + 0.30·factsCore + 0.30·senseF1)
// Usability and richness are RETIRED from rank (still computed for display); morph, align, the
// LLM judge and probe stay advisory this cycle. factsCore is a root/word-class macro (morph is
// deliberately excluded — advisory until further notice).
const W_SEGMENTATION = 0.40;
const W_FACTS = 0.30;
const W_SENSE = 0.30;

export function computeOverallScore(scores: Omit<QualityScore, 'overallScore'>): number {
  const gateFactor = computeGateFactor(scores);

  // Weight only the components a golden actually provides for this phase, then renormalise — a
  // function-only phase with no golden senses is scored on seg+facts, not penalised for senses
  // it could not have. When all three are present this is exactly the 40/30/30 final formula.
  const ranked: Array<[number, number]> = [];
  if (scores.segmentationFidelity != null) ranked.push([W_SEGMENTATION, scores.segmentationFidelity]);
  if (scores.factsCore != null) ranked.push([W_FACTS, scores.factsCore]);
  if (scores.senseF1 != null) ranked.push([W_SENSE, scores.senseF1]);

  if (ranked.length > 0) {
    const wSum = ranked.reduce((a, [w]) => a + w, 0);
    const quality = ranked.reduce((a, [w, v]) => a + w * v, 0) / wSum;
    return gateFactor * quality;
  }

  // No golden at all → ungraded for rank (EXCLUDED from the leaderboard). Keep a display-only
  // score from the retired usability/richness buckets so the phase still renders somewhere.
  const usability = (scores.alignmentCoverage + scores.englishOrderScore) / 2;
  const richness = (scores.tooltipCoverage + scores.sensePolysemy + scores.morphDataPresent + scores.relationDensity) / 4;
  return gateFactor * (usability + richness) / 2;
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
  const contentDetail = scoreContentFidelityDetail(data.output.anatomist, goldAnat, data.output.lexicographer, goldLex);
  const contentFidelity = contentDetail?.f1 ?? null;
  const fidParts = [segmentationFidelity, contentFidelity].filter((x): x is number => x !== null);
  // fidelityScore stays the v2.1 combined value — the leaderboard still uses `fidelityScore != null`
  // as the "this phase has a golden, so it is rankable" gate.
  const fidelityScore = fidParts.length > 0 ? fidParts.reduce((a, b) => a + b, 0) / fidParts.length : null;

  // v2.2 ranked components. factsCore = root/word-class macro from the facts scorer, morph
  // EXCLUDED (advisory). No DPD/grammar lookup passed → roots are scored against the golden's own
  // DPD-verified √tooltips, and morph is not graded here. senseF1 = strict sense-english micro-F1.
  const factsDetail = scoreFactsDetail(data.output.anatomist, goldAnat);
  const factsCore = (() => {
    if (!factsDetail) return null;
    const cats = [factsDetail.root, factsDetail.pos]
      .filter((c) => c.total > 0)
      .map((c) => c.correct / c.total);
    return cats.length ? cats.reduce((a, b) => a + b, 0) / cats.length : null;
  })();
  const senseF1 = scoreSenseFidelityDetail(data.output.anatomist, goldAnat, data.output.lexicographer, goldLex)?.f1 ?? null;

  // Gate coverage: with a golden present, `paliWordCoverage` is the fraction of GOLDEN
  // words the model actually reproduced (by surface alignment) — NOT the blind word-COUNT
  // ratio scoreAnatomist computes, which a model can satisfy by emitting the right NUMBER
  // of WRONG words (grok review). No golden → keep the count ratio. This value overrides
  // the one from scoreAnatomist below, and it is what feeds the Validity Gate.
  const paliWordCoverage = goldAnat?.words?.length
    ? alignWords(goldAnat.words, data.output.anatomist?.words || []).length / goldAnat.words.length
    : anatomistScores.paliWordCoverage;

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
    paliWordCoverage, // golden-aware coverage overrides scoreAnatomist's count ratio (feeds the Gate)
    segmentationFidelity,
    contentFidelity,
    contentPrecision: contentDetail?.precision ?? null,
    contentRecall: contentDetail?.recall ?? null,
    fidelityScore,
    factsCore,
    senseF1,
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
