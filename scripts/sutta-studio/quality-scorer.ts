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
  morphDataPresent: number;
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

  // Morph data presence
  const segmentsWithMorph = segments.filter(s => s.morph).length;
  const morphDataPresent = segments.length > 0
    ? segmentsWithMorph / segments.length
    : 0;

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
} {
  // Content words should have 3 senses, function words 1-2
  let totalExpected = 0;
  let totalActual = 0;

  for (const entry of data.senses) {
    const expected = entry.wordClass === 'content' ? 3 : 1.5;
    const actual = entry.senses?.length || 0;
    totalExpected += expected;
    totalActual += Math.min(actual, expected); // Cap at expected
  }

  const sensePolysemy = totalExpected > 0 ? totalActual / totalExpected : 0;
  return { sensePolysemy };
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
  // Weighted average - redistributed to include layout
  const weights = {
    coverage: 0.25,
    validity: 0.30,
    richness: 0.15,
    grammar: 0.15,
    layout: 0.15,
  };

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
