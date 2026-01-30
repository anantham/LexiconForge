/**
 * Sutta Studio Pipeline Scoring
 *
 * Compares model outputs against golden data from demoPacket.
 * Calculates metrics across all pipeline passes.
 */

import type { PhaseView, WordSegment } from '../../types/suttaStudio';
import type { AnatomistPass, LexicographerPass, WeaverPass, TypesetterPass } from '../../types/suttaStudio';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AnatomistScore {
  wordCountMatch: boolean;
  wordCountDelta: number;
  segmentCountTotal: number;
  segmentCountGolden: number;
  segmentsPerWord: number;
  segmentsPerWordGolden: number;
  surfaceAccuracy: number; // % of word surfaces matching
  segmentTypeDistribution: Record<string, number>;
  tooltipCoverage: number; // % of words with tooltips
  avgTooltipsPerSegment: number;
  relationCount: number;
}

export interface LexicographerScore {
  senseEntriesMatch: boolean;
  senseEntriesDelta: number;
  totalSenses: number;
  totalSensesGolden: number;
  avgSensesPerWord: number;
  avgSensesPerWordGolden: number;
  contentWordSenseCount: number; // Should be ~3 per content word
  functionWordSenseCount: number; // Should be 1-2 per function word
}

export interface WeaverScore {
  tokenCountMatch: boolean;
  tokenCountDelta: number;
  ghostCount: number;
  linkedCount: number;
  ghostRatio: number; // ghosts / total tokens
  unmappedTokens: number;
}

export interface TypesetterScore {
  blockCount: number;
  blockCountGolden: number;
  avgBlockSize: number;
  avgBlockSizeGolden: number;
  layoutPattern: string; // e.g., "1,1,1,1" or "2,2"
}

export interface PhaseScore {
  phaseId: string;
  modelId: string;
  anatomist: AnatomistScore;
  lexicographer: LexicographerScore;
  weaver: WeaverScore;
  typesetter: TypesetterScore;
  overall: {
    structuralAccuracy: number; // 0-1, weighted average
    qualityScore: number; // 0-1, based on tooltips/senses
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring Functions
// ─────────────────────────────────────────────────────────────────────────────

export function scoreAnatomist(
  output: AnatomistPass,
  golden: PhaseView
): AnatomistScore {
  const goldenWords = golden.paliWords || [];
  const outputWords = output.words || [];
  const outputSegments = output.segments || [];

  // Word count
  const wordCountMatch = outputWords.length === goldenWords.length;
  const wordCountDelta = outputWords.length - goldenWords.length;

  // Segment counts
  const goldenSegmentCount = goldenWords.reduce((sum, w) => sum + (w.segments?.length || 0), 0);
  const segmentCountTotal = outputSegments.length;

  // Segments per word
  const segmentsPerWord = outputWords.length > 0 ? segmentCountTotal / outputWords.length : 0;
  const segmentsPerWordGolden = goldenWords.length > 0 ? goldenSegmentCount / goldenWords.length : 0;

  // Surface accuracy - check if output surfaces match golden
  const goldenSurfaces = new Set(goldenWords.map(w =>
    w.segments?.map(s => s.text).join('') || ''
  ));
  const matchingSurfaces = outputWords.filter(w => goldenSurfaces.has(w.surface)).length;
  const surfaceAccuracy = outputWords.length > 0 ? matchingSurfaces / outputWords.length : 0;

  // Segment type distribution
  const segmentTypeDistribution: Record<string, number> = {};
  for (const seg of outputSegments) {
    segmentTypeDistribution[seg.type] = (segmentTypeDistribution[seg.type] || 0) + 1;
  }

  // Tooltip coverage
  const segmentsWithTooltips = outputSegments.filter(s => s.tooltips && s.tooltips.length > 0).length;
  const tooltipCoverage = outputSegments.length > 0 ? segmentsWithTooltips / outputSegments.length : 0;

  // Avg tooltips per segment
  const totalTooltips = outputSegments.reduce((sum, s) => sum + (s.tooltips?.length || 0), 0);
  const avgTooltipsPerSegment = outputSegments.length > 0 ? totalTooltips / outputSegments.length : 0;

  // Relations
  const relationCount = output.relations?.length || 0;

  return {
    wordCountMatch,
    wordCountDelta,
    segmentCountTotal,
    segmentCountGolden: goldenSegmentCount,
    segmentsPerWord: Math.round(segmentsPerWord * 100) / 100,
    segmentsPerWordGolden: Math.round(segmentsPerWordGolden * 100) / 100,
    surfaceAccuracy: Math.round(surfaceAccuracy * 100) / 100,
    segmentTypeDistribution,
    tooltipCoverage: Math.round(tooltipCoverage * 100) / 100,
    avgTooltipsPerSegment: Math.round(avgTooltipsPerSegment * 100) / 100,
    relationCount,
  };
}

export function scoreLexicographer(
  output: LexicographerPass,
  golden: PhaseView
): LexicographerScore {
  const goldenWords = golden.paliWords || [];
  const outputSenses = output.senses || [];

  // Count golden senses
  const goldenTotalSenses = goldenWords.reduce((sum, w) => sum + (w.senses?.length || 0), 0);
  const goldenContentWords = goldenWords.filter(w => w.wordClass === 'content' || !w.wordClass);
  const goldenFunctionWords = goldenWords.filter(w => w.wordClass === 'function');

  // Count output senses
  const totalSenses = outputSenses.reduce((sum, e) => sum + (e.senses?.length || 0), 0);
  const contentWordEntries = outputSenses.filter(e => e.wordClass === 'content');
  const functionWordEntries = outputSenses.filter(e => e.wordClass === 'function');

  const contentWordSenseCount = contentWordEntries.reduce((sum, e) => sum + (e.senses?.length || 0), 0);
  const functionWordSenseCount = functionWordEntries.reduce((sum, e) => sum + (e.senses?.length || 0), 0);

  return {
    senseEntriesMatch: outputSenses.length === goldenWords.length,
    senseEntriesDelta: outputSenses.length - goldenWords.length,
    totalSenses,
    totalSensesGolden: goldenTotalSenses,
    avgSensesPerWord: outputSenses.length > 0 ? Math.round((totalSenses / outputSenses.length) * 100) / 100 : 0,
    avgSensesPerWordGolden: goldenWords.length > 0 ? Math.round((goldenTotalSenses / goldenWords.length) * 100) / 100 : 0,
    contentWordSenseCount,
    functionWordSenseCount,
  };
}

export function scoreWeaver(
  output: WeaverPass,
  golden: PhaseView
): WeaverScore {
  const tokens = output.tokens || [];
  const goldenTokens = golden.englishStructure || [];

  const ghostCount = tokens.filter(t => t.isGhost).length;
  const linkedCount = tokens.filter(t => t.linkedPaliId || t.linkedSegmentId).length;
  const unmappedTokens = tokens.filter(t => !t.isGhost && !t.linkedPaliId && !t.linkedSegmentId).length;

  return {
    tokenCountMatch: tokens.length === goldenTokens.length,
    tokenCountDelta: tokens.length - goldenTokens.length,
    ghostCount,
    linkedCount,
    ghostRatio: tokens.length > 0 ? Math.round((ghostCount / tokens.length) * 100) / 100 : 0,
    unmappedTokens,
  };
}

export function scoreTypesetter(
  output: TypesetterPass,
  golden: PhaseView
): TypesetterScore {
  const blocks = output.layoutBlocks || [];
  const goldenBlocks = golden.layoutBlocks || [];

  const blockSizes = blocks.map(b => b.length);
  const goldenBlockSizes = goldenBlocks.map(b => b.length);

  const avgBlockSize = blockSizes.length > 0
    ? blockSizes.reduce((a, b) => a + b, 0) / blockSizes.length
    : 0;
  const avgBlockSizeGolden = goldenBlockSizes.length > 0
    ? goldenBlockSizes.reduce((a, b) => a + b, 0) / goldenBlockSizes.length
    : 0;

  return {
    blockCount: blocks.length,
    blockCountGolden: goldenBlocks.length,
    avgBlockSize: Math.round(avgBlockSize * 100) / 100,
    avgBlockSizeGolden: Math.round(avgBlockSizeGolden * 100) / 100,
    layoutPattern: blockSizes.join(','),
  };
}

export function scorePhase(
  phaseId: string,
  modelId: string,
  outputs: {
    anatomist: AnatomistPass;
    lexicographer: LexicographerPass;
    weaver: WeaverPass;
    typesetter: TypesetterPass;
  },
  golden: PhaseView
): PhaseScore {
  const anatomist = scoreAnatomist(outputs.anatomist, golden);
  const lexicographer = scoreLexicographer(outputs.lexicographer, golden);
  const weaver = scoreWeaver(outputs.weaver, golden);
  const typesetter = scoreTypesetter(outputs.typesetter, golden);

  // Calculate overall scores
  const structuralAccuracy = calculateStructuralAccuracy(anatomist, lexicographer, weaver);
  const qualityScore = calculateQualityScore(anatomist, lexicographer);

  return {
    phaseId,
    modelId,
    anatomist,
    lexicographer,
    weaver,
    typesetter,
    overall: {
      structuralAccuracy: Math.round(structuralAccuracy * 100) / 100,
      qualityScore: Math.round(qualityScore * 100) / 100,
    },
  };
}

function calculateStructuralAccuracy(
  anatomist: AnatomistScore,
  lexicographer: LexicographerScore,
  weaver: WeaverScore
): number {
  // Weight: word count match is most important
  let score = 0;
  let weights = 0;

  // Word count (weight: 3)
  if (anatomist.wordCountMatch) {
    score += 3;
  } else if (Math.abs(anatomist.wordCountDelta) <= 1) {
    score += 2; // Close enough
  }
  weights += 3;

  // Surface accuracy (weight: 2)
  score += anatomist.surfaceAccuracy * 2;
  weights += 2;

  // Sense entries match (weight: 2)
  if (lexicographer.senseEntriesMatch) {
    score += 2;
  }
  weights += 2;

  // Weaver token match (weight: 1)
  if (weaver.tokenCountMatch) {
    score += 1;
  }
  weights += 1;

  return score / weights;
}

function calculateQualityScore(
  anatomist: AnatomistScore,
  lexicographer: LexicographerScore
): number {
  let score = 0;
  let weights = 0;

  // Tooltip coverage (weight: 2)
  score += anatomist.tooltipCoverage * 2;
  weights += 2;

  // Avg tooltips per segment - target ~2 (weight: 1)
  const tooltipScore = Math.min(anatomist.avgTooltipsPerSegment / 2, 1);
  score += tooltipScore;
  weights += 1;

  // Avg senses per word - target ~2.5 for content words (weight: 2)
  const senseScore = Math.min(lexicographer.avgSensesPerWord / 2.5, 1);
  score += senseScore * 2;
  weights += 2;

  // Relations present (weight: 1)
  if (anatomist.relationCount > 0) {
    score += 1;
  }
  weights += 1;

  return score / weights;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

export function formatScoreTable(scores: PhaseScore[]): string {
  const lines: string[] = [];

  lines.push('┌─────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│                        PIPELINE SCORING RESULTS                            │');
  lines.push('├─────────────────────────────────────────────────────────────────────────────┤');

  for (const score of scores) {
    lines.push(`│ ${score.modelId.padEnd(20)} │ ${score.phaseId.padEnd(10)} │ Struct: ${(score.overall.structuralAccuracy * 100).toFixed(0).padStart(3)}% │ Quality: ${(score.overall.qualityScore * 100).toFixed(0).padStart(3)}% │`);
  }

  lines.push('├─────────────────────────────────────────────────────────────────────────────┤');
  lines.push('│ ANATOMIST DETAILS                                                          │');
  lines.push('├─────────────────────────────────────────────────────────────────────────────┤');

  for (const score of scores) {
    const a = score.anatomist;
    lines.push(`│ ${score.modelId.padEnd(15)} ${score.phaseId.padEnd(8)} │ words: ${a.wordCountDelta >= 0 ? '+' : ''}${a.wordCountDelta} │ segs/word: ${a.segmentsPerWord.toFixed(1)}/${a.segmentsPerWordGolden.toFixed(1)} │ tooltips: ${a.avgTooltipsPerSegment.toFixed(1)} │`);
  }

  lines.push('└─────────────────────────────────────────────────────────────────────────────┘');

  return lines.join('\n');
}

export function formatScoreCSV(scores: PhaseScore[]): string {
  const headers = [
    'modelId', 'phaseId',
    'structuralAccuracy', 'qualityScore',
    'wordCountDelta', 'segmentsPerWord', 'segmentsPerWordGolden',
    'surfaceAccuracy', 'tooltipCoverage', 'avgTooltipsPerSegment', 'relationCount',
    'senseEntriesDelta', 'avgSensesPerWord', 'avgSensesPerWordGolden',
    'tokenCountDelta', 'ghostRatio', 'unmappedTokens',
    'blockCount', 'blockCountGolden', 'layoutPattern'
  ];

  const rows = scores.map(s => [
    s.modelId, s.phaseId,
    s.overall.structuralAccuracy, s.overall.qualityScore,
    s.anatomist.wordCountDelta, s.anatomist.segmentsPerWord, s.anatomist.segmentsPerWordGolden,
    s.anatomist.surfaceAccuracy, s.anatomist.tooltipCoverage, s.anatomist.avgTooltipsPerSegment, s.anatomist.relationCount,
    s.lexicographer.senseEntriesDelta, s.lexicographer.avgSensesPerWord, s.lexicographer.avgSensesPerWordGolden,
    s.weaver.tokenCountDelta, s.weaver.ghostRatio, s.weaver.unmappedTokens,
    s.typesetter.blockCount, s.typesetter.blockCountGolden, s.typesetter.layoutPattern
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
