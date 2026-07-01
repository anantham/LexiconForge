/**
 * Generate Leaderboard for Sutta Studio Benchmarks
 *
 * Scans all benchmark runs and aggregates ALL phase scores across ALL runs
 * per model. This gives a true representation of model capability across
 * the full test set (15 phases).
 *
 * Run standalone: npx tsx scripts/sutta-studio/generate-leaderboard.ts
 * Or called from benchmark.ts after each run completes.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BENCHMARK_CONFIG } from './benchmark-config';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type PhaseScore = {
  phase: string;
  model: string;
  rubricVersion?: string;
  // v2.0 headline fidelity (null when the phase has no golden → unranked)
  fidelityScore?: number | null;
  segmentationFidelity?: number | null;
  contentFidelity?: number | null;
  paliWordCoverage?: number;
  // legacy v1 aggregates (kept for reference, not ranked on)
  coverageScore: number;
  validityScore: number;
  richnessScore: number;
  grammarScore: number;
  overallScore: number;
  alignmentCoverage: number;
};

type QualityScores = {
  generatedAt: string;
  runId: string;
  model: string;
  provider: string;
  promptVersion: string;
  rubricVersion?: string;
  phaseCount: number;
  goldenPhaseCount?: number;
  averages: {
    fidelity?: number | null;
    coverage: number;
    validity: number;
    richness: number;
    grammar: number;
    overall: number;
  };
  phases: PhaseScore[];
};

/** The rubric version the leaderboard ranks on. Mixing versions is a build failure. */
const RANKED_RUBRIC_VERSION = '2.0';

type LeaderboardEntry = {
  rank: number;
  modelId: string;
  modelName: string;

  // v2.0 quality scores (0-1) — fidelity is the headline, overall is the ranking metric
  overallScore: number;
  fidelityScore: number;
  segmentationFidelity: number;
  contentFidelity: number;
  paliWordCoverage: number;
  // legacy v1 aggregates, retained for reference only
  coverageScore: number;
  validityScore: number;
  richnessScore: number;
  grammarScore: number;

  // Cost/performance
  tokensTotal: number;
  durationMs: number;
  costUsd: number | null;

  // Metadata
  phasesCount: number;
  runTimestamp: string;
  runId: string;
  packetPath: string;
};

type Leaderboard = {
  generatedAt: string;
  promptVersion: string;
  rubricVersion: string;
  methodology: {
    docsUrl: string;
    rankingMetric: 'overallScore';
    aggregation: 'allPhasesPerModel';
    description: string;
  };
  /** Runs/phases that were NOT ranked, and why — transparency, not silent dropping. */
  excluded: { models: string[]; reasons: string[] };
  entries: LeaderboardEntry[];
};

type MetricsJson = {
  generatedAt: string;
  promptVersion: string;
  runs: Array<{
    id: string;
    model: { id: string; model: string; provider: string };
  }>;
  rows: Array<{
    runId: string;
    durationMs: number | null;
    costUsd: number | null;
    tokensTotal: number | null;
  }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LOGIC
// ─────────────────────────────────────────────────────────────────────────────

type ModelRun = {
  modelId: string;
  modelName: string;
  runTimestamp: string;
  runId: string;
  qualityScores: QualityScores;
  metrics: {
    tokensTotal: number;
    durationMs: number;
    costUsd: number | null;
  };
  packetPath: string;
};

export async function generateLeaderboard(): Promise<Leaderboard> {
  const reportsRoot = BENCHMARK_CONFIG.outputRoot;
  console.log(`[Leaderboard] Scanning ${reportsRoot} for benchmark runs...`);

  // Get all timestamp directories
  const dirEntries = await fs.readdir(reportsRoot, { withFileTypes: true });
  const timestampDirs = dirEntries
    .filter((e) => e.isDirectory() && e.name.match(/^\d{4}-\d{2}-\d{2}/))
    .map((e) => e.name)
    .sort()
    .reverse(); // Most recent first

  console.log(`[Leaderboard] Found ${timestampDirs.length} benchmark runs`);

  // Collect all model runs with quality scores
  const allRuns: ModelRun[] = [];

  for (const timestamp of timestampDirs) {
    const runDir = path.join(reportsRoot, timestamp);
    const outputsDir = path.join(runDir, 'outputs');
    const metricsPath = path.join(runDir, 'metrics.json');

    // Read metrics.json for run metadata
    const metrics = await readJson<MetricsJson>(metricsPath);
    if (!metrics) continue;

    // Check if outputs directory exists
    if (!(await fileExists(outputsDir))) continue;

    // Get model directories
    const outputEntries = await fs.readdir(outputsDir, { withFileTypes: true });
    const modelDirs = outputEntries.filter((e) => e.isDirectory()).map((e) => e.name);

    for (const modelId of modelDirs) {
      const modelDir = path.join(outputsDir, modelId);
      const qualityPath = path.join(modelDir, 'quality-scores.json');
      const packetPath = path.join(modelDir, 'packet.json');

      // Must have quality scores
      const qualityScores = await readJson<QualityScores>(qualityPath);
      if (!qualityScores || !qualityScores.averages) continue;

      // Must have packet for viewing
      if (!(await fileExists(packetPath))) continue;

      // Find model config from metrics
      const runConfig = metrics.runs.find((r) => r.id === modelId);
      const modelName = runConfig?.model?.model || modelId;

      // Aggregate metrics for this model run
      const modelRows = metrics.rows.filter((r) => r.runId === modelId);
      const tokensTotal = modelRows.reduce((sum, r) => sum + (r.tokensTotal || 0), 0);
      const durationMs = modelRows.reduce((sum, r) => sum + (r.durationMs || 0), 0);
      const costUsd = modelRows.reduce((sum, r) => sum + (r.costUsd || 0), 0) || null;

      allRuns.push({
        modelId,
        modelName,
        runTimestamp: timestamp,
        runId: modelId,
        qualityScores,
        metrics: { tokensTotal, durationMs, costUsd },
        packetPath: `/reports/sutta-studio/${timestamp}/outputs/${modelId}/packet.json`,
      });
    }
  }

  console.log(`[Leaderboard] Found ${allRuns.length} model runs with quality scores`);

  // Aggregate ALL phases across ALL runs per model
  // This gives a true representation across the full test set
  type ModelAggregate = {
    modelId: string;
    modelName: string;
    allPhases: PhaseScore[];
    // Track unique phases by phase ID to avoid double-counting same phase from multiple runs
    uniquePhases: Map<string, PhaseScore>;
    // Keep the run with most phases for the packet link
    bestRun: ModelRun;
    totalTokens: number;
    totalDuration: number;
    totalCost: number | null;
  };

  const modelAggregates = new Map<string, ModelAggregate>();
  const excludedModels = new Set<string>();
  const excludedReasons = new Set<string>();

  for (const run of allRuns) {
    const allPhasesRaw = run.qualityScores.phases || [];
    // RUBRIC-VERSION GUARD: only phases scored under the ranked rubric AND with a golden
    // (fidelityScore != null) are eligible. Mixing rubric versions on one board is a build
    // failure (ADR SUTTA-009); no-golden phases have no fidelity so they can't be ranked.
    const phases = allPhasesRaw.filter((p) => {
      const v = p.rubricVersion ?? run.qualityScores.rubricVersion;
      if (v !== RANKED_RUBRIC_VERSION) {
        excludedModels.add(run.modelId);
        excludedReasons.add(`${run.modelId}: rubricVersion ${v ?? 'v1/none'} ≠ ${RANKED_RUBRIC_VERSION} (re-score with backfill)`);
        return false;
      }
      if (p.fidelityScore == null) {
        excludedModels.add(run.modelId);
        excludedReasons.add(`${run.modelId}/${p.phase}: no golden → no fidelity, unranked`);
        return false;
      }
      return true;
    });
    let agg = modelAggregates.get(run.modelId);

    if (!agg) {
      agg = {
        modelId: run.modelId,
        modelName: run.modelName,
        allPhases: [],
        uniquePhases: new Map(),
        bestRun: run,
        totalTokens: 0,
        totalDuration: 0,
        totalCost: null,
      };
      modelAggregates.set(run.modelId, agg);
    }

    // Add each phase score, using the best score per phase ID
    for (const phase of phases) {
      const existing = agg.uniquePhases.get(phase.phase);
      if (!existing || phase.overallScore > existing.overallScore) {
        agg.uniquePhases.set(phase.phase, phase);
      }
    }

    // Track best run (most phases) for packet link
    if (phases.length > (agg.bestRun.qualityScores.phases?.length || 0)) {
      agg.bestRun = run;
    }

    // Aggregate metrics
    agg.totalTokens += run.metrics.tokensTotal;
    agg.totalDuration += run.metrics.durationMs;
    if (run.metrics.costUsd !== null) {
      agg.totalCost = (agg.totalCost || 0) + run.metrics.costUsd;
    }
  }

  console.log(`[Leaderboard] ${modelAggregates.size} unique models with aggregated phases`);

  // Compute averages across all unique phases per model
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const modelScores: Array<{
    modelId: string;
    modelName: string;
    avgOverall: number;
    avgFidelity: number;
    avgSegFidelity: number;
    avgContentFidelity: number;
    avgPaliCoverage: number;
    avgCoverage: number;
    avgValidity: number;
    avgRichness: number;
    avgGrammar: number;
    phasesCount: number;
    metrics: { tokensTotal: number; durationMs: number; costUsd: number | null };
    bestRun: ModelRun;
  }> = [];

  for (const agg of modelAggregates.values()) {
    const phases = Array.from(agg.uniquePhases.values());
    if (phases.length === 0) continue;

    modelScores.push({
      modelId: agg.modelId,
      modelName: agg.modelName,
      avgOverall: mean(phases.map((p) => p.overallScore)),
      avgFidelity: mean(phases.map((p) => p.fidelityScore ?? 0)),
      avgSegFidelity: mean(phases.map((p) => p.segmentationFidelity ?? 0)),
      avgContentFidelity: mean(phases.map((p) => p.contentFidelity ?? 0)),
      avgPaliCoverage: mean(phases.map((p) => p.paliWordCoverage ?? 0)),
      avgCoverage: mean(phases.map((p) => p.coverageScore)),
      avgValidity: mean(phases.map((p) => p.validityScore)),
      avgRichness: mean(phases.map((p) => p.richnessScore)),
      avgGrammar: mean(phases.map((p) => p.grammarScore)),
      phasesCount: phases.length,
      metrics: {
        tokensTotal: agg.totalTokens,
        durationMs: agg.totalDuration,
        costUsd: agg.totalCost,
      },
      bestRun: agg.bestRun,
    });
  }

  // Sort by overall score and assign ranks
  modelScores.sort((a, b) => b.avgOverall - a.avgOverall);

  // Get latest prompt version from most recent run
  const latestPromptVersion = allRuns[0]?.qualityScores.promptVersion || 'unknown';

  const entries: LeaderboardEntry[] = modelScores.map((m, index) => ({
    rank: index + 1,
    modelId: m.modelId,
    modelName: m.modelName,
    overallScore: m.avgOverall,
    fidelityScore: m.avgFidelity,
    segmentationFidelity: m.avgSegFidelity,
    contentFidelity: m.avgContentFidelity,
    paliWordCoverage: m.avgPaliCoverage,
    coverageScore: m.avgCoverage,
    validityScore: m.avgValidity,
    richnessScore: m.avgRichness,
    grammarScore: m.avgGrammar,
    tokensTotal: m.metrics.tokensTotal,
    durationMs: m.metrics.durationMs,
    costUsd: m.metrics.costUsd,
    phasesCount: m.phasesCount,
    runTimestamp: m.bestRun.runTimestamp,
    runId: m.bestRun.runId,
    packetPath: m.bestRun.packetPath,
  }));

  const leaderboard: Leaderboard = {
    generatedAt: new Date().toISOString(),
    promptVersion: latestPromptVersion,
    rubricVersion: RANKED_RUBRIC_VERSION,
    methodology: {
      docsUrl:
        'https://github.com/anthropics/lexiconforge/blob/main/docs/benchmarks/sutta-studio.md#quality-scoring',
      rankingMetric: 'overallScore',
      aggregation: 'allPhasesPerModel',
      description:
        `Ranked on rubric v${RANKED_RUBRIC_VERSION} only (mixing versions is a build failure). ` +
        'overallScore = gateFactor × (0.60·fidelity + 0.25·usability + 0.15·transitional-richness), ' +
        'averaged over each model\'s unique golden-backed phases (best score per phase across runs). ' +
        'fidelity = 0.5·segmentation + 0.5·content, strict micro-F1 vs the golden. ' +
        'CAVEAT: fidelity only scores words the golden covers; where the golden is partial, ' +
        'unscored model words are excluded — see paliWordCoverage and the per-run golden-diff.',
    },
    excluded: { models: Array.from(excludedModels), reasons: Array.from(excludedReasons) },
    entries,
  };

  // Write leaderboard.json
  const leaderboardPath = path.join(reportsRoot, 'leaderboard.json');
  await fs.writeFile(leaderboardPath, JSON.stringify(leaderboard, null, 2), 'utf8');
  console.log(`[Leaderboard] Wrote ${entries.length} ranked entries to ${leaderboardPath}`);
  if (excludedReasons.size > 0) {
    console.warn(`[Leaderboard] EXCLUDED ${excludedModels.size} model(s) / phase(s) from ranking:`);
    for (const r of excludedReasons) console.warn(`  - ${r}`);
  }

  return leaderboard;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

// CLI entry point
async function main() {
  const leaderboard = await generateLeaderboard();

  console.log(`\n=== SUTTA-STUDIO LEADERBOARD (rubric v${leaderboard.rubricVersion}) ===\n`);
  console.log('Rank | Model            | Phases | Overall | Fidelity | Seg  | Content | PaliCov');
  console.log('-----|------------------|--------|---------|----------|------|---------|--------');
  for (const e of leaderboard.entries) {
    console.log(
      `  ${e.rank.toString().padStart(2)} | ${e.modelId.padEnd(16)} | ${e.phasesCount.toString().padStart(6)} | ` +
      `${e.overallScore.toFixed(2).padStart(7)} | ${e.fidelityScore.toFixed(2).padStart(8)} | ${e.segmentationFidelity.toFixed(2).padStart(4)} | ${e.contentFidelity.toFixed(2).padStart(7)} | ${e.paliWordCoverage.toFixed(2).padStart(7)}`
    );
  }
  if (leaderboard.entries.length === 0) console.log('  (no ranked entries — see exclusions below)');
  console.log(`\nRanked on overallScore, rubric v${leaderboard.rubricVersion} + golden-backed phases only.`);
  console.log('Fidelity = 0.5·Seg + 0.5·Content (strict micro-F1 vs golden). PaliCov = golden words the model matched.');
  if (leaderboard.excluded.reasons.length > 0) {
    console.log(`\nExcluded from ranking (${leaderboard.excluded.models.length}):`);
    for (const r of leaderboard.excluded.reasons) console.log(`  - ${r}`);
  }
}

main().catch((error) => {
  console.error('[Leaderboard] Failed:', error);
  process.exitCode = 1;
});
