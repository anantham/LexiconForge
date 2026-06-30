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

export type QualityScore = {
  phase: string;
  model: string;
  // Coverage
  paliWordCoverage: number;
  englishMappingRatio: number;
  alignmentCoverage: number;
  // Validity
  noEmptySegments: number;
  noDuplicateMappings: number;
  textIntegrity: number;
  // Richness
  tooltipDensity: number;
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

/** Token-set F1 (precision+recall harmonic mean) — rewards overlap, penalizes extras. */
const tokenF1 = (gold: string[], model: string[]): number => {
  const g = new Set(gold), m = new Set(model);
  if (g.size === 0 && m.size === 0) return 1;
  if (g.size === 0 || m.size === 0) return 0;
  let inter = 0;
  for (const x of m) if (g.has(x)) inter++;
  const p = inter / m.size, r = inter / g.size;
  return p + r > 0 ? (2 * p * r) / (p + r) : 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// SCORING FUNCTIONS (exported for use in benchmark.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function scoreAnatomist(data: AnatomistPass, inputPali: string): {
  paliWordCoverage: number;
  noEmptySegments: number;
  textIntegrity: number;
  tooltipDensity: number;
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

  // Text integrity: do segments concatenate to surface form?
  let textIntegrity = 1;
  for (const word of words) {
    const wordSegments = segments.filter(s => s.wordId === word.id);
    const concat = wordSegments.map(s => s.text).join('');
    // Normalize for case comparison
    if (concat.toLowerCase() !== word.surface.toLowerCase()) {
      textIntegrity = 0;
      break;
    }
  }

  // Tooltip density: average tooltips per segment
  const totalTooltips = segments.reduce((sum, s) => sum + (s.tooltips?.length || 0), 0);
  const avgTooltips = segments.length > 0 ? totalTooltips / segments.length : 0;
  const tooltipDensity = Math.min(1, avgTooltips / 2); // 2 tooltips per segment = 100%

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
    tooltipDensity,
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

/** Index a pass's words by lowercased surface form (the cross-pass join key). */
const indexWordsBySurface = (
  pass: AnatomistPass | null | undefined
): Map<string, { id: string; segmentIds: string[] }> => {
  const map = new Map<string, { id: string; segmentIds: string[] }>();
  for (const w of (pass?.words || [])) {
    const key = (w.surface || '').toLowerCase();
    if (key && !map.has(key)) map.set(key, { id: w.id, segmentIds: w.segmentIds || [] });
  }
  return map;
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

const cutF1 = (gold: Set<number>, model: Set<number>): number => {
  if (gold.size === 0 && model.size === 0) return 1; // both single-segment → agree
  if (gold.size === 0 || model.size === 0) return 0;
  let inter = 0;
  for (const c of model) if (gold.has(c)) inter++;
  const p = inter / model.size, r = inter / gold.size;
  return p + r > 0 ? (2 * p * r) / (p + r) : 0;
};

/** Morpheme-boundary fidelity: do the model's cuts match the golden's, per shared word? */
export function scoreSegmentationFidelity(
  output: AnatomistPass,
  golden: AnatomistPass | null | undefined
): number | null {
  if (!golden?.words?.length) return null;
  const goldIdx = indexWordsBySurface(golden);
  const outIdx = indexWordsBySurface(output);
  let n = 0, sum = 0;
  for (const [surface, gWord] of goldIdx) {
    const oWord = outIdx.get(surface);
    if (!oWord) continue; // model didn't analyse this golden word
    const gCuts = boundaryOffsets(gWord.segmentIds, golden.segments || []);
    const oCuts = boundaryOffsets(oWord.segmentIds, output.segments || []);
    sum += cutF1(gCuts, oCuts);
    n++;
  }
  return n > 0 ? sum / n : null;
}

/** A word's "knowledge tokens" — its anatomist tooltips + its lexicographer senses. */
const wordKnowledgeTokens = (
  surface: string,
  anat: AnatomistPass | null | undefined,
  lex: LexicographerPass | null | undefined
): string[] => {
  const word = (anat?.words || []).find(w => (w.surface || '').toLowerCase() === surface);
  if (!word) return [];
  const tokens: string[] = [];
  for (const s of (anat?.segments || []).filter(s => s.wordId === word.id)) {
    for (const t of (s.tooltips || [])) tokens.push(...tokenize(t));
  }
  const lexEntry = (lex?.senses || []).find(e => e.wordId === word.id);
  if (lexEntry) {
    for (const sense of (lexEntry.senses || [])) {
      tokens.push(...tokenize(sense.english));
      tokens.push(...tokenize(sense.nuance));
    }
  }
  return tokens;
};

/** Etymology + gloss fidelity: token-F1 of the model's per-word knowledge vs golden's. */
export function scoreContentFidelity(
  outAnat: AnatomistPass, goldAnat: AnatomistPass | null | undefined,
  outLex: LexicographerPass, goldLex: LexicographerPass | null | undefined
): number | null {
  if (!goldAnat?.words?.length) return null;
  const goldIdx = indexWordsBySurface(goldAnat);
  const outIdx = indexWordsBySurface(outAnat);
  let n = 0, sum = 0;
  for (const surface of goldIdx.keys()) {
    if (!outIdx.has(surface)) continue;
    const goldTokens = wordKnowledgeTokens(surface, goldAnat, goldLex);
    if (goldTokens.length === 0) continue; // golden silent on this word → no reference
    const modelTokens = wordKnowledgeTokens(surface, outAnat, outLex);
    sum += tokenF1(goldTokens, modelTokens);
    n++;
  }
  return n > 0 ? sum / n : null;
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

export function computeOverallScore(scores: Omit<QualityScore, 'overallScore'>): number {
  // When a golden packet is available, FIDELITY (does the model reproduce the
  // golden's morpheme boundaries + etymology/gloss?) is the HEADLINE dimension,
  // and grammar/arrows are de-emphasized — per owner: segmentation + etymology
  // matter far more than relations. Without a golden, fall back to the legacy
  // density-only weighting so ad-hoc scoring still works.
  if (scores.fidelityScore !== null && scores.fidelityScore !== undefined) {
    const w = { coverage: 0.20, validity: 0.20, richness: 0.15, fidelity: 0.30, grammar: 0.05, layout: 0.10 };
    return (
      scores.coverageScore * w.coverage +
      scores.validityScore * w.validity +
      scores.richnessScore * w.richness +
      scores.fidelityScore * w.fidelity +
      scores.grammarScore * w.grammar +
      scores.layoutDimension * w.layout
    );
  }

  const weights = { coverage: 0.25, validity: 0.30, richness: 0.15, grammar: 0.15, layout: 0.15 };
  return (
    scores.coverageScore * weights.coverage +
    scores.validityScore * weights.validity +
    scores.richnessScore * weights.richness +
    scores.grammarScore * weights.grammar +
    scores.layoutDimension * weights.layout
  );
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
    anatomistScores.tooltipDensity +
    lexiScores.sensePolysemy +
    anatomistScores.morphDataPresent
  ) / 3;
  const grammarScore = (grammarScores.relationDensity + grammarScores.relationsValid) / 2;
  const layoutDimension = typesetterScores.layoutScore;

  const baseScores = {
    phase,
    model,
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
    console.log(`    Tooltip Density:        ${(r.tooltipDensity * 100).toFixed(0)}%`);
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
