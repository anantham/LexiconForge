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
  // Optional LLM-judge semantic content score (ADR SUTTA-010); null when no judge run exists.
  contentSemantic: number | null;
  judgeModel: string | null;
  selfJudge: boolean;
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
  status?: string;
  coverageNote?: string;
  /** The exact run dir(s) this board was built from — makes it auditable/reproducible. */
  sourceRunTimestamps: string[];
  judgeModel: string | null;
  methodology: {
    docsUrl: string;
    rankingMetric: 'overallScore';
    aggregation: 'bestRunPerModel';
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
  // Optional semantic-content score for this run (from judge-content.ts; ADR SUTTA-010).
  contentSemantic: number | null;
  judgeModel: string | null;
  selfJudge: boolean;
  metrics: {
    tokensTotal: number;
    durationMs: number;
    costUsd: number | null;
  };
  packetPath: string;
};

type JudgeScores = { judgeVersion?: string; judgeModel?: string; avgContentSemantic?: number; selfJudge?: boolean };

export async function generateLeaderboard(): Promise<Leaderboard> {
  const reportsRoot = BENCHMARK_CONFIG.outputRoot;
  console.log(`[Leaderboard] Scanning ${reportsRoot} for benchmark runs...`);

  // Get all timestamp directories. For a PUBLISHED board, pin to a canonical run (or set)
  // via LEADERBOARD_DIRS (comma-separated timestamps) so experimental/ablation runs don't
  // pollute it — a published leaderboard must come from a reproducible, named run.
  const dirEntries = await fs.readdir(reportsRoot, { withFileTypes: true });
  const pinned = (process.env.LEADERBOARD_DIRS || '').split(',').map((s) => s.trim()).filter(Boolean);
  let timestampDirs = dirEntries
    .filter((e) => e.isDirectory() && e.name.match(/^\d{4}-\d{2}-\d{2}/))
    .map((e) => e.name)
    .sort()
    .reverse(); // Most recent first
  if (pinned.length) {
    timestampDirs = timestampDirs.filter((d) => pinned.includes(d));
    console.log(`[Leaderboard] PINNED to ${timestampDirs.length}/${pinned.length} run dir(s): ${pinned.join(', ')}`);
  }

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

      // Optional semantic-content score (judge-content.ts writes it to the run-dir root).
      const judge = await readJson<JudgeScores>(path.join(runDir, `judge-scores-${modelId}.json`));

      allRuns.push({
        modelId,
        modelName,
        runTimestamp: timestamp,
        runId: modelId,
        qualityScores,
        contentSemantic: judge?.avgContentSemantic ?? null,
        judgeModel: judge?.judgeModel ?? null,
        selfJudge: judge?.selfJudge ?? false,
        metrics: { tokensTotal, durationMs, costUsd },
        packetPath: `/reports/sutta-studio/${timestamp}/outputs/${modelId}/packet.json`,
      });
    }
  }

  console.log(`[Leaderboard] Found ${allRuns.length} model runs with quality scores`);

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const r4 = (x: number) => Number(x.toFixed(4)); // stamp published numbers at 4 dp (no float noise)
  const excludedModels = new Set<string>();
  const excludedReasons = new Set<string>();

  // Group ranked-eligible runs by model. RUBRIC-VERSION GUARD: only phases scored under the
  // ranked rubric AND with a golden (fidelityScore != null) are eligible — mixing rubric
  // versions is a build failure (ADR SUTTA-009).
  const byModel = new Map<string, Array<{ run: ModelRun; phases: PhaseScore[] }>>();
  for (const run of allRuns) {
    const phases = (run.qualityScores.phases || []).filter((p) => {
      const v = p.rubricVersion ?? run.qualityScores.rubricVersion;
      if (v !== RANKED_RUBRIC_VERSION) {
        excludedReasons.add(`${run.modelId}: rubricVersion ${v ?? 'v1/none'} ≠ ${RANKED_RUBRIC_VERSION} (re-score with backfill)`);
        return false;
      }
      if (p.fidelityScore == null) {
        excludedReasons.add(`${run.modelId}/${p.phase}: no golden → no fidelity, unranked`);
        return false;
      }
      return true;
    });
    if (!phases.length) { excludedModels.add(run.modelId); continue; }
    const arr = byModel.get(run.modelId) || [];
    arr.push({ run, phases });
    byModel.set(run.modelId, arr);
  }
  // A model excluded for some runs but ranked via others is not "excluded".
  for (const id of byModel.keys()) excludedModels.delete(id);

  console.log(`[Leaderboard] ${byModel.size} ranked models`);

  // Per model, pick the SINGLE best run (highest mean overallScore; tie-break: more phases).
  // Use ONLY that run's phases, metrics, and semantic score — never a Frankenstein of
  // best-per-phase across runs, and never summed metrics (grok + Gemini review).
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
    contentSemantic: number | null;
    judgeModel: string | null;
    selfJudge: boolean;
    phasesCount: number;
    metrics: { tokensTotal: number; durationMs: number; costUsd: number | null };
    bestRun: ModelRun;
  }> = [];

  for (const [modelId, runs] of byModel) {
    const ranked = runs
      .map(({ run, phases }) => ({ run, phases, meanOverall: mean(phases.map((p) => p.overallScore)) }))
      // Prefer the MOST COMPLETE run (most phases), THEN the higher mean. Sorting by score
      // first would let a 1-phase lucky/aborted run beat a stable full run — Goodhart (Gemini review).
      .sort((a, b) => b.phases.length - a.phases.length || b.meanOverall - a.meanOverall);
    const best = ranked[0];
    const phases = best.phases;
    modelScores.push({
      modelId,
      modelName: best.run.modelName,
      avgOverall: mean(phases.map((p) => p.overallScore)),
      avgFidelity: mean(phases.map((p) => p.fidelityScore ?? 0)),
      avgSegFidelity: mean(phases.map((p) => p.segmentationFidelity ?? 0)),
      avgContentFidelity: mean(phases.map((p) => p.contentFidelity ?? 0)),
      avgPaliCoverage: mean(phases.map((p) => p.paliWordCoverage ?? 0)),
      avgCoverage: mean(phases.map((p) => p.coverageScore)),
      avgValidity: mean(phases.map((p) => p.validityScore)),
      avgRichness: mean(phases.map((p) => p.richnessScore)),
      avgGrammar: mean(phases.map((p) => p.grammarScore)),
      // Semantic comes ONLY from the chosen run (not averaged across runs / mixed judges).
      contentSemantic: best.run.contentSemantic,
      judgeModel: best.run.judgeModel,
      selfJudge: best.run.selfJudge,
      phasesCount: phases.length,
      metrics: best.run.metrics, // the chosen run's metrics — NOT summed across runs
      bestRun: best.run,
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
    overallScore: r4(m.avgOverall),
    fidelityScore: r4(m.avgFidelity),
    segmentationFidelity: r4(m.avgSegFidelity),
    contentFidelity: r4(m.avgContentFidelity),
    contentSemantic: m.contentSemantic == null ? null : r4(m.contentSemantic),
    judgeModel: m.judgeModel,
    selfJudge: m.selfJudge,
    paliWordCoverage: r4(m.avgPaliCoverage),
    coverageScore: r4(m.avgCoverage),
    validityScore: r4(m.avgValidity),
    richnessScore: r4(m.avgRichness),
    grammarScore: r4(m.avgGrammar),
    tokensTotal: m.metrics.tokensTotal,
    durationMs: Math.round(m.metrics.durationMs),
    costUsd: m.metrics.costUsd == null ? null : Number(m.metrics.costUsd.toFixed(6)),
    phasesCount: m.phasesCount,
    runTimestamp: m.bestRun.runTimestamp,
    runId: m.bestRun.runId,
    packetPath: m.bestRun.packetPath,
  }));

  // Provenance: the exact run dir(s) that actually produced this board (auditable/reproducible).
  const sourceRunTimestamps = Array.from(new Set(entries.map((e) => e.runTimestamp))).sort();
  // MIXED-JUDGE GUARD (ADR SUTTA-010): a board's Semantic column is only comparable if every
  // entry was judged by the SAME model. If judges differ, don't silently label the board with
  // whichever we read first — surface it (and callers should not rank on Semantic).
  const judgeModels = Array.from(new Set(entries.map((e) => e.judgeModel).filter((j): j is string => !!j)));
  const boardJudge = judgeModels.length <= 1 ? (judgeModels[0] ?? null) : 'MIXED';
  if (judgeModels.length > 1) {
    excludedReasons.add(`semantic: ${judgeModels.length} different judges on one board (${judgeModels.join(', ')}) — contentSemantic is NOT comparable across rows`);
  }
  const selfJudged = entries.filter((e) => e.selfJudge).map((e) => e.modelId);
  const phaseCount = Math.max(0, ...entries.map((e) => e.phasesCount));

  const leaderboard: Leaderboard = {
    generatedAt: new Date().toISOString(),
    promptVersion: latestPromptVersion,
    rubricVersion: RANKED_RUBRIC_VERSION,
    status: 'preview',
    sourceRunTimestamps,
    judgeModel: boardJudge,
    coverageNote:
      `PREVIEW — limited coverage. Ranked on ${phaseCount} golden-backed MN10 phase(s), ${entries.length} model(s), ` +
      `from run(s) ${sourceRunTimestamps.join(', ') || '(none)'}. The golden is partial (not every word is graded); ` +
      'Content is deterministic token-F1 (cannot reward paraphrase/enrichment); Semantic is an advisory LLM-judge score ' +
      `(judge=${boardJudge ?? 'n/a'}, not in the ranked total). ` +
      (selfJudged.length ? `⚠️ SELF-JUDGE present for: ${selfJudged.join(', ')} (judge is the same model — biased). ` : '') +
      'Rankings will shift as coverage grows.',
    methodology: {
      docsUrl:
        'https://github.com/anthropics/lexiconforge/blob/main/docs/benchmarks/sutta-studio.md#quality-scoring',
      rankingMetric: 'overallScore',
      aggregation: 'bestRunPerModel',
      description:
        `Ranked on rubric v${RANKED_RUBRIC_VERSION} only (mixing versions is a build failure). ` +
        'overallScore = gateFactor × (0.60·fidelity + 0.25·usability + 0.15·transitional-richness), ' +
        "averaged over the golden-backed phases of each model's SINGLE best run (highest mean overall) — " +
        'NOT cherry-picked best-per-phase across runs; metrics are that run\'s, not summed. ' +
        'fidelity = 0.5·segmentation + 0.5·content, strict micro-F1 vs the golden. ' +
        'CAVEAT: fidelity only scores words the golden covers; where the golden is partial, ' +
        'unscored model words are excluded — see paliWordCoverage and the per-run golden-diff.',
    },
    excluded: { models: Array.from(excludedModels), reasons: Array.from(excludedReasons) },
    entries,
  };

  // Write leaderboard.json to reports/ (local/dev, always). The PUBLISHED copy under public/
  // is written ONLY when pinned to a reproducible run (LEADERBOARD_DIRS) — never let an
  // un-pinned "scan everything" run silently overwrite the public board (grok review).
  const leaderboardPath = path.join(reportsRoot, 'leaderboard.json');
  await fs.writeFile(leaderboardPath, JSON.stringify(leaderboard, null, 2), 'utf8');
  console.log(`[Leaderboard] Wrote ${entries.length} ranked entries to ${leaderboardPath}`);
  if (pinned.length > 0) {
    const publicDir = path.join('public', 'benchmarks');
    await fs.mkdir(publicDir, { recursive: true });
    const publicPath = path.join(publicDir, 'sutta-studio-leaderboard.json');
    await fs.writeFile(publicPath, JSON.stringify(leaderboard, null, 2), 'utf8');
    console.log(`[Leaderboard] Published (pinned) → ${publicPath}`);
    if (selfJudged.length) console.warn(`[Leaderboard] ⚠️  SELF-JUDGE in published board: ${selfJudged.join(', ')} — re-judge with a neutral --judge before shipping.`);
  } else {
    console.warn('[Leaderboard] NOT publishing to public/ — LEADERBOARD_DIRS is unset. A published board must be pinned to a reproducible run (e.g. LEADERBOARD_DIRS=<timestamp>).');
  }
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

  const judgeModel = leaderboard.entries.find((e) => e.judgeModel)?.judgeModel;
  console.log(`\n=== SUTTA-STUDIO LEADERBOARD (rubric v${leaderboard.rubricVersion}) ===\n`);
  console.log('Rank | Model            | Phases | Overall | Fidelity | Seg  | Content | Semantic | PaliCov');
  console.log('-----|------------------|--------|---------|----------|------|---------|----------|--------');
  for (const e of leaderboard.entries) {
    const sem = e.contentSemantic == null ? '  —  ' : e.contentSemantic.toFixed(2).padStart(5);
    console.log(
      `  ${e.rank.toString().padStart(2)} | ${e.modelId.padEnd(16)} | ${e.phasesCount.toString().padStart(6)} | ` +
      `${e.overallScore.toFixed(2).padStart(7)} | ${e.fidelityScore.toFixed(2).padStart(8)} | ${e.segmentationFidelity.toFixed(2).padStart(4)} | ${e.contentFidelity.toFixed(2).padStart(7)} | ${sem.padStart(8)} | ${e.paliWordCoverage.toFixed(2).padStart(7)}`
    );
  }
  if (leaderboard.entries.length === 0) console.log('  (no ranked entries — see exclusions below)');
  console.log(`\nRanked on overallScore, rubric v${leaderboard.rubricVersion} + golden-backed phases only.`);
  console.log('Fidelity = 0.5·Seg + 0.5·Content (deterministic micro-F1 vs golden). PaliCov = golden words the model matched.');
  console.log(`Semantic = LLM-judge content score (ADR SUTTA-010${judgeModel ? `, judge=${judgeModel}` : ''}); rewards enrichment, penalizes hallucination. Not in the ranked total.`);
  if (leaderboard.excluded.reasons.length > 0) {
    console.log(`\nExcluded from ranking (${leaderboard.excluded.models.length}):`);
    for (const r of leaderboard.excluded.reasons) console.log(`  - ${r}`);
  }
}

main().catch((error) => {
  console.error('[Leaderboard] Failed:', error);
  process.exitCode = 1;
});
