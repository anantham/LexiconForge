/**
 * Backfill Quality Scores for Existing Benchmark Runs
 *
 * Scans existing pipeline-*.json files and generates quality-scores.json
 * for each model output directory.
 *
 * Run with: npx tsx scripts/sutta-studio/backfill-quality-scores.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BENCHMARK_CONFIG } from './benchmark-config';
import { scorePhase, type QualityScore, type PipelineOutput } from './quality-scorer';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const reportsRoot = BENCHMARK_CONFIG.outputRoot;
  console.log(`[Backfill] Scanning ${reportsRoot} for benchmark runs...`);

  // Get all timestamp directories
  const dirEntries = await fs.readdir(reportsRoot, { withFileTypes: true });
  const timestampDirs = dirEntries
    .filter((e) => e.isDirectory() && e.name.match(/^\d{4}-\d{2}-\d{2}/))
    .map((e) => e.name)
    .sort();

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const timestamp of timestampDirs) {
    const runDir = path.join(reportsRoot, timestamp);
    const outputsDir = path.join(runDir, 'outputs');
    const metricsPath = path.join(runDir, 'metrics.json');

    if (!(await fileExists(outputsDir))) continue;
    if (!(await fileExists(metricsPath))) continue;

    // Read metrics for prompt version
    const metricsContent = await fs.readFile(metricsPath, 'utf8');
    const metrics = JSON.parse(metricsContent);
    const promptVersion = metrics.promptVersion || 'unknown';

    // Get model directories
    const outputEntries = await fs.readdir(outputsDir, { withFileTypes: true });
    const modelDirs = outputEntries.filter((e) => e.isDirectory()).map((e) => e.name);

    for (const modelId of modelDirs) {
      const modelDir = path.join(outputsDir, modelId);
      const qualityPath = path.join(modelDir, 'quality-scores.json');

      // Always rewrite: the scorer evolves (v2.0 rubric, then hardening fixes), so a
      // pre-existing quality-scores.json is often STALE. Re-score from the pipeline
      // outputs (which embed the golden) every time — this is the canonical refresh.
      const existed = await fileExists(qualityPath);

      // Find all pipeline-*.json files
      const modelFiles = await fs.readdir(modelDir);
      const pipelineFiles = modelFiles.filter((f) => f.startsWith('pipeline-') && f.endsWith('.json'));

      if (pipelineFiles.length === 0) {
        continue;
      }

      console.log(`[Backfill] Processing ${timestamp}/${modelId} (${pipelineFiles.length} phases)...`);

      const qualityScores: QualityScore[] = [];

      for (const pipelineFile of pipelineFiles) {
        const phaseId = pipelineFile.replace('pipeline-', '').replace('.json', '');
        const pipelinePath = path.join(modelDir, pipelineFile);

        try {
          const content = await fs.readFile(pipelinePath, 'utf8');
          const data = JSON.parse(content);

          // Check if we have complete outputs
          if (!data.output?.anatomist || !data.output?.lexicographer || !data.output?.weaver) {
            continue;
          }

          // Build PipelineOutput structure. CRITICAL: pass through `golden` — the
          // pipeline files embed it, and without it scorePhase can't compute fidelity
          // (fidelityScore stays null and the run silently drops off the ranked board).
          const pipelineOutput: PipelineOutput = {
            output: {
              anatomist: data.output.anatomist,
              lexicographer: data.output.lexicographer,
              weaver: data.output.weaver,
              typesetter: data.output.typesetter || null,
            },
            segments: (data.segments || []).map((s: any) => ({ pali: s.pali || '' })),
            golden: data.golden || null,
          } as PipelineOutput;

          const score = scorePhase(pipelineOutput, phaseId, modelId);
          qualityScores.push(score);
        } catch (error) {
          console.warn(`  Warning: Failed to score ${phaseId}:`, error);
        }
      }

      if (qualityScores.length === 0) {
        failed++;
        continue;
      }

      // Calculate averages
      const avgCoverage = qualityScores.reduce((s, q) => s + q.coverageScore, 0) / qualityScores.length;
      const avgValidity = qualityScores.reduce((s, q) => s + q.validityScore, 0) / qualityScores.length;
      const avgRichness = qualityScores.reduce((s, q) => s + q.richnessScore, 0) / qualityScores.length;
      const avgGrammar = qualityScores.reduce((s, q) => s + q.grammarScore, 0) / qualityScores.length;
      const avgOverall = qualityScores.reduce((s, q) => s + q.overallScore, 0) / qualityScores.length;
      // Fidelity is the v2.0 headline metric; average only over phases that HAVE a golden.
      const fidPhases = qualityScores.filter((q) => q.fidelityScore != null);
      const avgFidelity = fidPhases.length > 0
        ? fidPhases.reduce((s, q) => s + (q.fidelityScore as number), 0) / fidPhases.length
        : null;
      const rubricVersion = qualityScores[0]?.rubricVersion ?? null;

      const qualitySummary = {
        generatedAt: new Date().toISOString(),
        runId: modelId,
        model: modelId,
        provider: 'OpenRouter',
        promptVersion,
        rubricVersion,
        phaseCount: qualityScores.length,
        goldenPhaseCount: fidPhases.length,
        averages: {
          fidelity: avgFidelity,
          coverage: avgCoverage,
          validity: avgValidity,
          richness: avgRichness,
          grammar: avgGrammar,
          overall: avgOverall,
        },
        phases: qualityScores,
      };

      await fs.writeFile(qualityPath, JSON.stringify(qualitySummary, null, 2), 'utf8');
      console.log(`  ${existed ? 'Refreshed' : 'Created'} quality-scores.json (${qualityScores.length} phases, ${fidPhases.length} w/ golden, rubric=${rubricVersion}, fid=${avgFidelity == null ? 'n/a' : avgFidelity.toFixed(2)}, overall=${avgOverall.toFixed(2)})`);
      created++;
    }
  }

  console.log(`\n[Backfill] Done. Written: ${created}, Failed: ${failed}`);
  void skipped;
}

main().catch((error) => {
  console.error('[Backfill] Failed:', error);
  process.exitCode = 1;
});
