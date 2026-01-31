/**
 * Generate Leaderboard for Sutta Studio Benchmarks
 *
 * Scans all benchmark runs, finds the best run per model (by overall quality score),
 * and writes a leaderboard.json file.
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

type QualityScores = {
  generatedAt: string;
  runId: string;
  model: string;
  provider: string;
  promptVersion: string;
  phaseCount: number;
  averages: {
    coverage: number;
    validity: number;
    richness: number;
    grammar: number;
    overall: number;
  };
};

type LeaderboardEntry = {
  rank: number;
  modelId: string;
  modelName: string;

  // Quality scores (0-1)
  overallScore: number;
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
  methodology: {
    docsUrl: string;
    rankingMetric: 'overallScore';
    aggregation: 'bestPerModel';
  };
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

  // Find best run per model (highest overall score)
  const bestPerModel = new Map<string, ModelRun>();
  for (const run of allRuns) {
    const existing = bestPerModel.get(run.modelId);
    if (!existing || run.qualityScores.averages.overall > existing.qualityScores.averages.overall) {
      bestPerModel.set(run.modelId, run);
    }
  }

  console.log(`[Leaderboard] ${bestPerModel.size} unique models with best runs`);

  // Sort by overall score and assign ranks
  const sortedModels = Array.from(bestPerModel.values()).sort(
    (a, b) => b.qualityScores.averages.overall - a.qualityScores.averages.overall
  );

  // Get latest prompt version from most recent run
  const latestPromptVersion = allRuns[0]?.qualityScores.promptVersion || 'unknown';

  const entries: LeaderboardEntry[] = sortedModels.map((run, index) => ({
    rank: index + 1,
    modelId: run.modelId,
    modelName: run.modelName,
    overallScore: run.qualityScores.averages.overall,
    coverageScore: run.qualityScores.averages.coverage,
    validityScore: run.qualityScores.averages.validity,
    richnessScore: run.qualityScores.averages.richness,
    grammarScore: run.qualityScores.averages.grammar,
    tokensTotal: run.metrics.tokensTotal,
    durationMs: run.metrics.durationMs,
    costUsd: run.metrics.costUsd,
    phasesCount: run.qualityScores.phaseCount,
    runTimestamp: run.runTimestamp,
    runId: run.runId,
    packetPath: run.packetPath,
  }));

  const leaderboard: Leaderboard = {
    generatedAt: new Date().toISOString(),
    promptVersion: latestPromptVersion,
    methodology: {
      docsUrl:
        'https://github.com/anthropics/lexiconforge/blob/main/docs/benchmarks/sutta-studio.md#quality-scoring',
      rankingMetric: 'overallScore',
      aggregation: 'bestPerModel',
    },
    entries,
  };

  // Write leaderboard.json
  const leaderboardPath = path.join(reportsRoot, 'leaderboard.json');
  await fs.writeFile(leaderboardPath, JSON.stringify(leaderboard, null, 2), 'utf8');
  console.log(`[Leaderboard] Wrote ${entries.length} entries to ${leaderboardPath}`);

  return leaderboard;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

// CLI entry point
async function main() {
  const leaderboard = await generateLeaderboard();

  console.log('\n=== LEADERBOARD ===\n');
  console.log('Rank | Model            | Overall | Valid. | Rich.  | Tokens  | Cost');
  console.log('-----|------------------|---------|--------|--------|---------|-------');
  for (const entry of leaderboard.entries) {
    const cost = entry.costUsd ? `$${entry.costUsd.toFixed(3)}` : 'free';
    const tokens = entry.tokensTotal > 1000 ? `${(entry.tokensTotal / 1000).toFixed(1)}k` : entry.tokensTotal;
    console.log(
      `  ${entry.rank.toString().padStart(2)} | ${entry.modelId.padEnd(16)} | ${entry.overallScore.toFixed(2).padStart(6)}  | ${entry.validityScore.toFixed(2).padStart(5)}  | ${entry.richnessScore.toFixed(2).padStart(5)}  | ${String(tokens).padStart(7)} | ${cost}`
    );
  }
}

main().catch((error) => {
  console.error('[Leaderboard] Failed:', error);
  process.exitCode = 1;
});
