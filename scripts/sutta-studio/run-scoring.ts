#!/usr/bin/env npx tsx
/**
 * Run scoring against benchmark outputs using demoPacket as golden data.
 *
 * Usage: npx tsx scripts/sutta-studio/run-scoring.ts [benchmark-run-dir]
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { DEMO_PACKET_MN10 } from '../../components/sutta-studio/demoPacket';
import {
  scorePhase,
  formatScoreTable,
  formatScoreCSV,
  type PhaseScore,
} from './scoring';
import type { AnatomistPass, LexicographerPass, WeaverPass, TypesetterPass, PhaseView } from '../../types/suttaStudio';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_BENCHMARK_DIR = 'reports/sutta-studio';

// ─────────────────────────────────────────────────────────────────────────────
// Load Golden Data from demoPacket
// ─────────────────────────────────────────────────────────────────────────────

function getGoldenPhases(): Map<string, PhaseView> {
  const phases = new Map<string, PhaseView>();
  for (const phase of DEMO_PACKET_MN10.phases) {
    phases.set(phase.id, phase);
  }
  console.log(`[Golden] Loaded ${phases.size} phases from demoPacket`);
  console.log(`[Golden] Phase IDs: ${Array.from(phases.keys()).join(', ')}`);
  return phases;
}

// ─────────────────────────────────────────────────────────────────────────────
// Load Benchmark Outputs
// ─────────────────────────────────────────────────────────────────────────────

interface BenchmarkOutput {
  modelId: string;
  phaseId: string;
  output: {
    anatomist: AnatomistPass;
    lexicographer: LexicographerPass;
    weaver: WeaverPass;
    typesetter: TypesetterPass;
  };
}

async function findLatestBenchmarkRun(baseDir: string): Promise<string> {
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  const runDirs = entries
    .filter(e => e.isDirectory() && e.name.startsWith('2026-'))
    .map(e => e.name)
    .sort()
    .reverse();

  if (runDirs.length === 0) {
    throw new Error(`No benchmark runs found in ${baseDir}`);
  }

  return path.join(baseDir, runDirs[0]);
}

async function loadBenchmarkOutputs(runDir: string): Promise<BenchmarkOutput[]> {
  const outputsDir = path.join(runDir, 'outputs');
  const outputs: BenchmarkOutput[] = [];

  let modelDirs: string[];
  try {
    modelDirs = await fs.readdir(outputsDir);
  } catch (e) {
    console.error(`[Benchmark] No outputs directory in ${runDir}`);
    return [];
  }

  for (const modelId of modelDirs) {
    const modelDir = path.join(outputsDir, modelId);
    const stat = await fs.stat(modelDir);
    if (!stat.isDirectory()) continue;

    // Skip non-model files
    if (modelId.endsWith('.json')) continue;

    const files = await fs.readdir(modelDir);
    const pipelineFiles = files.filter(f => f.startsWith('pipeline-phase-'));

    for (const file of pipelineFiles) {
      try {
        const content = await fs.readFile(path.join(modelDir, file), 'utf8');
        const data = JSON.parse(content);

        if (data.output?.anatomist && data.output?.lexicographer && data.output?.weaver && data.output?.typesetter) {
          outputs.push({
            modelId,
            phaseId: data.phaseId,
            output: data.output,
          });
        }
      } catch (e) {
        console.warn(`[Benchmark] Failed to load ${file}: ${e}`);
      }
    }
  }

  console.log(`[Benchmark] Loaded ${outputs.length} outputs from ${runDir}`);
  return outputs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const benchmarkDir = args[0] || DEFAULT_BENCHMARK_DIR;

  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('                     SUTTA STUDIO PIPELINE SCORING');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');

  // Load golden data
  const goldenPhases = getGoldenPhases();

  // Find and load benchmark outputs
  let runDir: string;
  try {
    if (benchmarkDir.includes('2026-')) {
      // Specific run directory provided
      runDir = benchmarkDir;
    } else {
      // Find latest run
      runDir = await findLatestBenchmarkRun(benchmarkDir);
    }
    console.log(`[Benchmark] Using run: ${runDir}`);
  } catch (e) {
    console.error(`Error finding benchmark run: ${e}`);
    process.exit(1);
  }

  const benchmarkOutputs = await loadBenchmarkOutputs(runDir);

  if (benchmarkOutputs.length === 0) {
    console.error('No benchmark outputs found to score.');
    process.exit(1);
  }

  // Score each output against golden
  const scores: PhaseScore[] = [];
  const skipped: string[] = [];

  for (const output of benchmarkOutputs) {
    // Map benchmark phase IDs to golden phase IDs
    // Benchmark uses "phase-1", "phase-2", etc.
    // Demo uses same IDs, so direct match should work
    const golden = goldenPhases.get(output.phaseId);

    if (!golden) {
      skipped.push(`${output.modelId}/${output.phaseId} (no golden)`);
      continue;
    }

    const score = scorePhase(
      output.phaseId,
      output.modelId,
      output.output,
      golden
    );
    scores.push(score);
  }

  if (skipped.length > 0) {
    console.log(`\n[Scoring] Skipped ${skipped.length} outputs (no matching golden):`);
    for (const s of skipped.slice(0, 10)) {
      console.log(`  - ${s}`);
    }
    if (skipped.length > 10) {
      console.log(`  ... and ${skipped.length - 10} more`);
    }
  }

  // Output results
  console.log('\n');
  console.log(formatScoreTable(scores));

  // Group by model for summary
  const byModel = new Map<string, PhaseScore[]>();
  for (const score of scores) {
    if (!byModel.has(score.modelId)) {
      byModel.set(score.modelId, []);
    }
    byModel.get(score.modelId)!.push(score);
  }

  console.log('\n');
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│                           MODEL SUMMARY                                     │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');

  for (const [modelId, modelScores] of byModel) {
    const avgStructural = modelScores.reduce((sum, s) => sum + s.overall.structuralAccuracy, 0) / modelScores.length;
    const avgQuality = modelScores.reduce((sum, s) => sum + s.overall.qualityScore, 0) / modelScores.length;
    const avgSegsPerWord = modelScores.reduce((sum, s) => sum + s.anatomist.segmentsPerWord, 0) / modelScores.length;
    const avgTooltips = modelScores.reduce((sum, s) => sum + s.anatomist.avgTooltipsPerSegment, 0) / modelScores.length;

    console.log(`│ ${modelId.padEnd(20)} │ phases: ${modelScores.length.toString().padStart(2)} │ struct: ${(avgStructural * 100).toFixed(0).padStart(3)}% │ quality: ${(avgQuality * 100).toFixed(0).padStart(3)}% │ segs/w: ${avgSegsPerWord.toFixed(1)} │ tips: ${avgTooltips.toFixed(1)} │`);
  }

  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  // Save CSV
  const csvPath = path.join(runDir, 'scoring-results.csv');
  await fs.writeFile(csvPath, formatScoreCSV(scores));
  console.log(`\n[Output] Saved CSV to ${csvPath}`);

  // Save JSON
  const jsonPath = path.join(runDir, 'scoring-results.json');
  await fs.writeFile(jsonPath, JSON.stringify(scores, null, 2));
  console.log(`[Output] Saved JSON to ${jsonPath}`);
}

main().catch(console.error);
