#!/usr/bin/env npx tsx
/**
 * Run benchmark models in parallel for faster execution.
 * Each model runs as a separate process.
 */

import { spawn } from 'child_process';
import { BENCHMARK_CONFIG } from './benchmark-config';

const MAX_CONCURRENT = 5; // Limit concurrent API calls to avoid rate limits

async function runModelBenchmark(modelId: string): Promise<{ modelId: string; success: boolean; error?: string }> {
  return new Promise((resolve) => {
    console.log(`[${modelId}] Starting...`);

    const proc = spawn('npx', ['tsx', 'scripts/sutta-studio/benchmark.ts', '--model', modelId], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`[${modelId}] ✅ Completed`);
        resolve({ modelId, success: true });
      } else {
        console.log(`[${modelId}] ❌ Failed: ${stderr.slice(-200)}`);
        resolve({ modelId, success: false, error: stderr.slice(-500) });
      }
    });

    proc.on('error', (err) => {
      console.log(`[${modelId}] ❌ Error: ${err.message}`);
      resolve({ modelId, success: false, error: err.message });
    });
  });
}

async function runParallel() {
  const models = BENCHMARK_CONFIG.runs.map(r => r.id);
  console.log(`\n═══════════════════════════════════════════════════════════════════`);
  console.log(`  PARALLEL BENCHMARK: ${models.length} models, ${MAX_CONCURRENT} concurrent`);
  console.log(`═══════════════════════════════════════════════════════════════════\n`);
  console.log(`Models: ${models.join(', ')}\n`);

  const results: Array<{ modelId: string; success: boolean; error?: string }> = [];
  const queue = [...models];
  const running: Promise<any>[] = [];

  while (queue.length > 0 || running.length > 0) {
    // Start new tasks up to MAX_CONCURRENT
    while (queue.length > 0 && running.length < MAX_CONCURRENT) {
      const modelId = queue.shift()!;
      const promise = runModelBenchmark(modelId).then((result) => {
        results.push(result);
        running.splice(running.indexOf(promise), 1);
      });
      running.push(promise);
    }

    // Wait for at least one to complete
    if (running.length > 0) {
      await Promise.race(running);
    }
  }

  // Summary
  console.log(`\n═══════════════════════════════════════════════════════════════════`);
  console.log(`  RESULTS`);
  console.log(`═══════════════════════════════════════════════════════════════════\n`);

  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Succeeded: ${succeeded.length}/${results.length}`);
  succeeded.forEach(r => console.log(`   - ${r.modelId}`));

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}/${results.length}`);
    failed.forEach(r => console.log(`   - ${r.modelId}: ${r.error?.slice(0, 100)}`));
  }
}

runParallel().catch(console.error);
