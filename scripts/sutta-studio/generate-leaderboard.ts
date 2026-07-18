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
import { readBenchmarkRunStatus } from './benchmark-run-status';

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
const RANKED_RUBRIC_VERSION = '2.2';

/**
 * A golden-backed phase the model never completed, scored 0 everywhere it is ranked on.
 * Precision is left null (no predictions → precision is undefined), but recall is 0 — the model
 * recalled none of the golden — so the F1/recall columns are penalised honestly.
 */
function zeroPhase(phaseId: string, model: string): PhaseScore {
  return {
    phase: phaseId,
    model,
    rubricVersion: RANKED_RUBRIC_VERSION,
    fidelityScore: 0,
    segmentationFidelity: 0,
    contentFidelity: 0,
    paliWordCoverage: 0,
    coverageScore: 0,
    validityScore: 0,
    richnessScore: 0,
    grammarScore: 0,
    overallScore: 0,
    alignmentCoverage: 0,
    ...({ contentPrecision: null, contentRecall: 0 } as Record<string, unknown>),
  };
}

/**
 * Charge every golden-backed phase the model did NOT complete as a 0, so every model's mean is
 * over the SAME denominator: the configured held-out phase universe.
 *
 * The bug this fixes: a phase a model failed or never ran is simply ABSENT from its
 * `quality-scores.json.phases[]`, so `mean(overallScore)` divided by the count of SURVIVING
 * phases only. A model that failed the hard phases was averaged over the easy ones it survived,
 * so failing looked like an advantage — phase-level survivorship bias, the same class the v2.1
 * word-level drop penalty fought (dropped golden words charged as misses, ADR SUTTA-012).
 *
 * Pure and deterministic — the unit test drives this directly.
 */
export function chargeMissingGoldenPhases(
  scored: PhaseScore[],
  goldenUniverse: readonly string[],
): { phases: PhaseScore[]; missing: string[]; completed: number } {
  const byId = new Map(scored.map((p) => [p.phase, p]));
  const model = scored[0]?.model ?? '';
  const phases: PhaseScore[] = [];
  const missing: string[] = [];
  for (const phaseId of goldenUniverse) {
    const hit = byId.get(phaseId);
    if (hit) {
      phases.push(hit);
    } else {
      phases.push(zeroPhase(phaseId, model));
      missing.push(phaseId);
    }
  }
  return { phases, missing, completed: phases.length - missing.length };
}

type LeaderboardEntry = {
  rank: number;
  modelId: string;
  modelName: string;

  // v2.0 quality scores (0-1) — fidelity is the headline, overall is the ranking metric
  overallScore: number;
  // 95% bootstrap CI over per-phase overall scores; models whose CIs overlap are TIES.
  overallScoreCI: [number, number] | null;
  tiedWithAbove: boolean;
  fidelityScore: number;
  segmentationFidelity: number;
  contentFidelity: number;
  // Content F1 decomposed (v2.1 / ADR SUTTA-012): precision = attested share of what the
  // model said; recall = said share of what the golden requires (dropped words included).
  contentPrecision: number | null;
  contentRecall: number | null;
  // Optional LLM-judge semantic content score (ADR SUTTA-010); null when no judge run exists.
  contentSemantic: number | null;
  judgeModel: string | null;
  selfJudge: boolean;
  paliWordCoverage: number;
  // Judge-derived integrity telemetry (share of judged words with a confident false claim;
  // count of words where the judge flagged the GOLDEN itself as suspect).
  hallucinationRate: number | null;
  goldenSuspectCount: number | null;
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
  phasesCount: number;       // phases the model actually completed
  phasesExpected: number;    // size of the held-out ranking universe (the mean's denominator)
  phasesCharged: number;     // golden-backed phases not completed, charged as 0
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
  /** Grounding sources + disclosed circularity — who authored what, and on whose authority. */
  grounding: {
    closedBook: boolean;
    closedBookNote: string;
    sources: Array<{ name: string; authority: string; role: string }>;
    knownCircularity: string[];
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
  // Optional semantic-content score for this run (from judge-content.ts; ADR SUTTA-010).
  contentSemantic: number | null;
  judgeModel: string | null;
  selfJudge: boolean;
  // Judge-derived integrity telemetry: share of judged words flagged as a confident false
  // claim (hallucination), and count of words where the judge flagged the GOLDEN as suspect.
  hallucinationRate: number | null;
  goldenSuspectCount: number | null;
  metrics: {
    tokensTotal: number;
    durationMs: number;
    costUsd: number | null;
  };
  packetPath: string;
};

type JudgeScores = {
  judgeVersion?: string; judgeModel?: string; avgContentSemantic?: number; selfJudge?: boolean;
  words?: Array<{ hallucination?: boolean; goldenSuspect?: boolean }>;
};

/** Deterministic PRNG (mulberry32) so bootstrap CIs are reproducible board-to-board. */
const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** 95% bootstrap CI of the mean over per-phase scores (resample phases, N=2000, seeded). */
const bootstrapCI = (values: number[], nBoot = 2000): [number, number] | null => {
  if (values.length < 2) return null;
  const rand = mulberry32(42);
  const means: number[] = [];
  for (let b = 0; b < nBoot; b++) {
    let s = 0;
    for (let i = 0; i < values.length; i++) s += values[Math.floor(rand() * values.length)];
    means.push(s / values.length);
  }
  means.sort((a, b) => a - b);
  return [means[Math.floor(0.025 * nBoot)], means[Math.ceil(0.975 * nBoot) - 1]];
};

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
    const runStatus = await readBenchmarkRunStatus(runDir);
    if (runStatus !== 'complete') {
      const reason = `${timestamp}: status ${runStatus ?? 'missing'} (only complete runs are rankable)`;
      if (pinned.includes(timestamp)) {
        throw new Error(`[Leaderboard] Refusing pinned run ${reason}`);
      }
      console.warn(`[Leaderboard] Skipping ${reason}`);
      continue;
    }
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
        hallucinationRate: judge?.words?.length
          ? judge.words.filter((w) => w.hallucination).length / judge.words.length
          : null,
        goldenSuspectCount: judge?.words?.length
          ? judge.words.filter((w) => w.goldenSuspect).length
          : null,
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

  // The held-out ranking universe. Every ranked model is scored over exactly THIS set — missing
  // golden-backed phases are charged 0 (below), not dropped — so the denominator is fixed and the
  // same for all, instead of being whatever each model happened to survive.
  const goldenUniverse = BENCHMARK_CONFIG.phasesToTest;

  // Coverage floor: even with missing phases charged as 0, a model that completed only a handful
  // of phases has too little real signal to rank — its few completions may be unrepresentative.
  // Exclude best-runs that COMPLETED fewer than 50% of the universe (e.g. a circuit-broken 4/30).
  const coverageFloor = Math.max(1, Math.floor(goldenUniverse.length * 0.5));

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
    avgContentPrecision: number | null;
    avgContentRecall: number | null;
    avgPaliCoverage: number;
    avgCoverage: number;
    avgValidity: number;
    avgRichness: number;
    avgGrammar: number;
    contentSemantic: number | null;
    judgeModel: string | null;
    selfJudge: boolean;
    hallucinationRate: number | null;
    goldenSuspectCount: number | null;
    overallCI: [number, number] | null;
    phasesCount: number;
    phasesExpected: number;
    phasesCharged: number;
    metrics: { tokensTotal: number; durationMs: number; costUsd: number | null };
    bestRun: ModelRun;
  }> = [];

  for (const [modelId, runs] of byModel) {
    const ranked = runs
      .map(({ run, phases }) => {
        // Charge missing golden-backed phases as 0 BEFORE ranking, so every run of every model
        // is compared over the same universe-sized denominator.
        const charged = chargeMissingGoldenPhases(phases, goldenUniverse);
        return { run, ...charged, meanOverall: mean(charged.phases.map((p) => p.overallScore)) };
      })
      // Best = highest survivorship-corrected mean. All runs now share the universe denominator,
      // so this can no longer be gamed by a 1-phase lucky/aborted run (its 29 zeros sink it);
      // tie-break on phases actually completed.
      .sort((a, b) => b.meanOverall - a.meanOverall || b.completed - a.completed);
    const best = ranked[0];
    if (best.completed < coverageFloor) {
      excludedModels.add(modelId);
      excludedReasons.add(`${modelId}: ${best.completed}/${goldenUniverse.length} phases completed (< ${coverageFloor} floor) — insufficient coverage to rank`);
      continue;
    }
    if (best.missing.length) {
      excludedReasons.add(`${modelId}: charged 0 on ${best.missing.length}/${goldenUniverse.length} golden-backed phase(s) not completed (${best.missing.slice(0, 5).join(', ')}${best.missing.length > 5 ? ', …' : ''})`);
    }
    // Universe-length: completed phases plus a 0 for each one not completed.
    const phases = best.phases;
    modelScores.push({
      modelId,
      modelName: best.run.modelName,
      avgOverall: mean(phases.map((p) => p.overallScore)),
      avgFidelity: mean(phases.map((p) => p.fidelityScore ?? 0)),
      avgSegFidelity: mean(phases.map((p) => p.segmentationFidelity ?? 0)),
      avgContentFidelity: mean(phases.map((p) => p.contentFidelity ?? 0)),
      // P/R (v2.1): mean over phases that carry them (older scores may predate the fields).
      avgContentPrecision: (() => { const xs = phases.map((p: any) => p.contentPrecision).filter((x: any): x is number => x != null); return xs.length ? mean(xs) : null; })(),
      avgContentRecall: (() => { const xs = phases.map((p: any) => p.contentRecall).filter((x: any): x is number => x != null); return xs.length ? mean(xs) : null; })(),
      avgPaliCoverage: mean(phases.map((p) => p.paliWordCoverage ?? 0)),
      avgCoverage: mean(phases.map((p) => p.coverageScore)),
      avgValidity: mean(phases.map((p) => p.validityScore)),
      avgRichness: mean(phases.map((p) => p.richnessScore)),
      avgGrammar: mean(phases.map((p) => p.grammarScore)),
      // Semantic comes ONLY from the chosen run (not averaged across runs / mixed judges).
      contentSemantic: best.run.contentSemantic,
      judgeModel: best.run.judgeModel,
      selfJudge: best.run.selfJudge,
      hallucinationRate: best.run.hallucinationRate,
      goldenSuspectCount: best.run.goldenSuspectCount,
      // Statistical honesty (operator request): 95% bootstrap CI over this run's per-phase
      // overall scores — sub-CI gaps between models are ties, not rankings.
      overallCI: bootstrapCI(phases.map((p) => p.overallScore)),
      // phasesCount = how many the model actually COMPLETED; the mean above is over the full
      // universe (completed + zero-charged), so phasesCharged makes the shortfall explicit.
      phasesCount: best.completed,
      phasesExpected: goldenUniverse.length,
      phasesCharged: best.missing.length,
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
    overallScoreCI: m.overallCI ? [r4(m.overallCI[0]), r4(m.overallCI[1])] as [number, number] : null,
    // CIs overlapping with the model ranked directly above ⇒ statistically a tie at n=30 phases.
    tiedWithAbove: index > 0 && !!m.overallCI && !!modelScores[index - 1].overallCI
      && m.overallCI[1] >= (modelScores[index - 1].overallCI as [number, number])[0],
    fidelityScore: r4(m.avgFidelity),
    segmentationFidelity: r4(m.avgSegFidelity),
    contentFidelity: r4(m.avgContentFidelity),
    contentPrecision: m.avgContentPrecision == null ? null : r4(m.avgContentPrecision),
    contentRecall: m.avgContentRecall == null ? null : r4(m.avgContentRecall),
    contentSemantic: m.contentSemantic == null ? null : r4(m.contentSemantic),
    judgeModel: m.judgeModel,
    selfJudge: m.selfJudge,
    paliWordCoverage: r4(m.avgPaliCoverage),
    hallucinationRate: m.hallucinationRate == null ? null : r4(m.hallucinationRate),
    goldenSuspectCount: m.goldenSuspectCount,
    coverageScore: r4(m.avgCoverage),
    validityScore: r4(m.avgValidity),
    richnessScore: r4(m.avgRichness),
    grammarScore: r4(m.avgGrammar),
    tokensTotal: m.metrics.tokensTotal,
    durationMs: Math.round(m.metrics.durationMs),
    costUsd: m.metrics.costUsd == null ? null : Number(m.metrics.costUsd.toFixed(6)),
    phasesCount: m.phasesCount,
    phasesExpected: m.phasesExpected,
    phasesCharged: m.phasesCharged,
    runTimestamp: m.bestRun.runTimestamp,
    runId: m.bestRun.runId,
    packetPath: m.bestRun.packetPath,
  }));

  // HARD FAIL (codex review #12): an all-excluded board (e.g. every run on a stale rubric
  // version) must never silently publish an empty ranking — that reads as "no models" not
  // "re-score needed".
  if (entries.length === 0) {
    throw new Error(`0 ranked entries — every run was excluded. Reasons: ${Array.from(excludedReasons).join(' | ') || '(none recorded)'}`);
  }

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
      `Limited coverage. Ranked on ${phaseCount} golden-backed MN10 phase(s), ${entries.length} model(s), ` +
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
        'overallScore = gateFactor × (0.40·segmentationF1 + 0.30·factsCore + 0.30·senseF1) — the ' +
        'canonical-integrity gate times the three golden-backed dimensions (ADR SUTTA-013/014). ' +
        "Averaged over the golden-backed phases of each model's SINGLE best run (selected by most completed phases FIRST, then highest mean overall — completeness beats score, so a lucky partial run cannot represent a model) — " +
        'NOT cherry-picked best-per-phase across runs; metrics are that run\'s, not summed. ' +
        'segmentationF1 = morpheme-boundary micro-F1 vs the golden; factsCore = root + word-class ' +
        'macro (morph EXCLUDED — advisory this cycle); senseF1 = strict sense-english micro-F1. ' +
        'Usability and richness proxies are RETIRED from rank; morph, alignment, the LLM judge and ' +
        'the reader probe stay advisory. v2.1 (SUTTA-012): golden words a model DROPS are charged as ' +
        'misses (no survivorship bias); content F1 stays as a reference column. ' +
        'All ranked runs use the IDENTICAL harness pipeline (same fixed phases, same passes, no retrieval context) — ' +
        'scores are comparable to each other but NOT to the richer production pipeline. ' +
        'Ranking is driven by overallScore only; contentF1 is reference-width-sensitive (partial remediation: ' +
        'golden v2 widened senses; dictionary-attested ALTERNATE SEGMENTATIONS are still penalized — known limitation). ' +
        'CAVEAT: fidelity only scores words the golden covers; where the golden is partial, ' +
        'unscored model words are excluded — see paliWordCoverage and the per-run golden-diff.',
    },
    excluded: { models: Array.from(excludedModels), reasons: Array.from(excludedReasons) },
    // GROUNDING & PROVENANCE (operator request): every layer's authority, disclosed, so the
    // reader can judge circularity risk themselves. Facts trace to human scholarship; wording,
    // selection and judging pass through LLMs with the guards named here.
    grounding: {
      // NOT closed-book. The benchmark feeds DPD attestations (roots/POS/attested senses) to the
      // Anatomist and Lexicographer passes — see the DPD source below and
      // services/sutta-studio/dpdGrounding. The earlier `closedBook: true` / "raw Pāli only" label
      // contradicted that (and its own DPD source row). It withholds the SuttaCentral dictionary
      // payload, retrieval context, and prior-phase window that production ALSO supplies
      // (SUTTA-014 parity gap), so benchmark output is LESS grounded than production — not
      // un-grounded.
      closedBook: false,
      closedBookNote:
        'Models receive the raw Pāli phrase PLUS DPD attestations (roots, part-of-speech, attested ' +
        'senses) at the Anatomist and Lexicographer passes — the board is NOT closed-book. It still ' +
        'withholds the SuttaCentral dictionary payload, retrieval context, and prior-phase window ' +
        'that production feeds, so production output is more grounded again (SUTTA-014).',
      sources: [
        { name: 'SuttaCentral canonical MN 10 (Mahāsaṅgīti; Sujato segmentation)', authority: 'human/scholarly', role: 'source text, phase cuts, and the text-integrity gate (morphemes must reconstruct these exact surfaces)' },
        { name: 'Digital Pāli Dictionary (DPD; compiled from PTS PED, CPD, traditional grammars)', authority: 'human/lexicographic', role: 'factual authority: roots, POS, attested senses. The golden is machine-verified against it; golden-v2 sense additions were restricted to VERBATIM DPD strings' },
        { name: 'Golden reference (51 phrases)', authority: 'LLM-drafted (Claude) under operator direction, DPD-verified', role: 'token-overlap reference for Content-F1 and context for the judge. Wording is NOT neutral — a known limitation; see the facts-vs-prose roadmap (SUTTA-013)' },
        { name: 'Golden v2 curation (2026-07-02)', authority: 'LLM-selected (Claude curator + adversarial skeptic) from DPD data, mechanical verbatim-membership guards, codex (OpenAI) plan review', role: '13 context-vetted sense additions, 1 wrong-homonym removal, 3 tooltip corrections; full audit log in docs/benchmarks/golden-v2-apply-log.json' },
        { name: 'Semantic judge (openai/gpt-4o-mini)', authority: 'LLM, different family from the golden curator; self-judge guard on the board', role: 'advisory meaning-level score; asymmetric rubric (hallucination ≤0.4); emits per-word hallucination flags and goldenSuspect golden-QA flags' },
      ],
      knownCircularity: [
        'Golden PROSE is Claude-worded (dictionary-checked facts, non-neutral phrasing) — token overlap favors similar phrasing until the facts-vs-prose split lands',
        'Golden-v2 curation and its adversarial verification were both Claude-family (selection bounded to verbatim DPD content); a cross-family check (grok, 2026-07-02) independently reviewed all 17 applied changes: 17/17 upheld, 0 reverts (docs/benchmarks/golden-v2-grok-verify.md)',
        'The judge anchors on the golden, so golden errors propagate into Semantic until flagged via goldenSuspect',
      ],
    },
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
  console.log('Rank | Model            | Phases | Overall (95% CI)   | Fidelity | Seg  | Content | P    | R    | Semantic | Halluc | PaliCov');
  console.log('-----|------------------|--------|---------|----------|------|---------|----------|--------');
  for (const e of leaderboard.entries) {
    const sem = e.contentSemantic == null ? '  —  ' : e.contentSemantic.toFixed(2).padStart(5);
    console.log(
      `  ${e.rank.toString().padStart(2)} | ${e.modelId.padEnd(16)} | ${e.phasesCount.toString().padStart(6)} | ` +
      `${(e.overallScore.toFixed(2) + (e.overallScoreCI ? ` [${e.overallScoreCI[0].toFixed(2)}–${e.overallScoreCI[1].toFixed(2)}]` : '') + (e.tiedWithAbove ? ' =' : '')).padStart(18)} | ${e.fidelityScore.toFixed(2).padStart(8)} | ${e.segmentationFidelity.toFixed(2).padStart(4)} | ${e.contentFidelity.toFixed(2).padStart(7)} | ${(e.contentPrecision == null ? ' —  ' : e.contentPrecision.toFixed(2)).padStart(4)} | ${(e.contentRecall == null ? ' —  ' : e.contentRecall.toFixed(2)).padStart(4)} | ${sem.padStart(8)} | ${(e.hallucinationRate == null ? '  —  ' : (e.hallucinationRate * 100).toFixed(0).padStart(3) + '% ').padStart(6)} | ${e.paliWordCoverage.toFixed(2).padStart(7)}`
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

// Only run the CLI when invoked as a script — importing this module (e.g. from a test that
// exercises chargeMissingGoldenPhases) must not read/write the filesystem. Same guard shape as
// align-scorer.ts.
if (process.argv[1]?.endsWith('generate-leaderboard.ts')) {
  main().catch((error) => {
    console.error('[Leaderboard] Failed:', error);
    process.exitCode = 1;
  });
}
