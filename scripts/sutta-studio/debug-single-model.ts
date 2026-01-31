/**
 * Debug Script: Single Model, Single Phase
 *
 * Runs a single pass for a single model on a single phase with full debug output.
 * Use to diagnose why a specific model/phase combination fails.
 *
 * Usage:
 *   npx tsx scripts/sutta-studio/debug-single-model.ts --model kimi-k2.5 --phase phase-b --pass anatomist
 *   npx tsx scripts/sutta-studio/debug-single-model.ts --model kimi-k2.5 --phase phase-b --pass weaver
 *
 * Options:
 *   --model   Model ID from benchmark-config.ts runs array
 *   --phase   Phase ID (e.g., phase-a, phase-b, phase-1)
 *   --pass    Pass name: skeleton, anatomist, lexicographer, weaver, typesetter
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BENCHMARK_CONFIG, type BenchmarkRun } from './benchmark-config';

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
};

const modelId = getArg('model') || 'kimi-k2.5';
const phaseId = getArg('phase') || 'phase-b';
const passName = getArg('pass') || 'anatomist';

console.log('═'.repeat(80));
console.log('DEBUG: Single Model, Single Phase, Single Pass');
console.log('═'.repeat(80));
console.log(`Model:  ${modelId}`);
console.log(`Phase:  ${phaseId}`);
console.log(`Pass:   ${passName}`);
console.log('─'.repeat(80));

async function main() {
  // Find model config
  const runConfig = BENCHMARK_CONFIG.runs.find((r: BenchmarkRun) => r.id === modelId);
  if (!runConfig) {
    console.error(`Model "${modelId}" not found in benchmark-config.ts runs`);
    console.log('Available models:', BENCHMARK_CONFIG.runs.map((r: BenchmarkRun) => r.id).join(', '));
    process.exit(1);
  }

  console.log('\nModel config:');
  console.log(JSON.stringify(runConfig.model, null, 2));

  // Load demo packet for phase data
  const demoPacketPath = path.join(process.cwd(), 'components/sutta-studio/demoPacket.ts');
  console.log('\nLoading demo packet...');

  // Dynamic import of demo packet
  const { DEMO_PACKET_MN10 } = await import('../../components/sutta-studio/demoPacket');

  // Find phase
  const phase = DEMO_PACKET_MN10.phases.find((p: any) => p.id === phaseId);
  if (!phase) {
    console.error(`Phase "${phaseId}" not found in demo packet`);
    console.log('Available phases:', DEMO_PACKET_MN10.phases.map((p: any) => p.id).join(', '));
    process.exit(1);
  }

  console.log('\nPhase data:');
  console.log(`  Pali words: ${phase.paliWords.length}`);
  console.log(`  Pali text: "${phase.paliWords.map((w: any) => w.surface).join(' ')}"`);
  console.log(`  English tokens: ${phase.englishStructure.length}`);

  // Build settings for API call
  const settings = {
    provider: runConfig.model.provider as any,
    model: runConfig.model.model,
    apiKey: process.env[runConfig.model.apiKeyEnv || 'OPENROUTER_API_KEY'] || '',
  };

  if (!settings.apiKey) {
    console.error(`\nAPI key not found in env: ${runConfig.model.apiKeyEnv}`);
    process.exit(1);
  }

  console.log('\nSettings:');
  console.log(`  Provider: ${settings.provider}`);
  console.log(`  Model: ${settings.model}`);
  console.log(`  API key: [REDACTED]`);

  // Prepare input based on pass
  console.log('\n' + '─'.repeat(80));
  console.log(`Preparing ${passName} pass input...`);

  if (passName === 'anatomist') {
    await runAnatomist(phase, settings, runConfig);
  } else if (passName === 'weaver') {
    await runWeaver(phase, settings, runConfig);
  } else if (passName === 'lexicographer') {
    await runLexicographer(phase, settings, runConfig);
  } else {
    console.error(`Pass "${passName}" not yet supported in debug script`);
    process.exit(1);
  }
}

async function runAnatomist(phase: any, settings: any, runConfig: BenchmarkRun) {
  const { runAnatomistPass } = await import('../../services/suttaStudioPassRunners');
  const { getSuttaStudioPromptContext } = await import('../../config/suttaStudioPromptContext');

  const segments = phase.paliWords.map((w: any, i: number) => ({
    pali: w.surface,
    baseEnglish: phase.englishStructure[i]?.text || '',
  }));

  console.log('\nInput segments:');
  segments.forEach((s: any, i: number) => {
    console.log(`  ${i}: "${s.pali}" → "${s.baseEnglish}"`);
  });

  const promptContext = getSuttaStudioPromptContext();
  console.log('\nPrompt context version:', promptContext.version);

  console.log('\n' + '═'.repeat(80));
  console.log('MAKING API CALL...');
  console.log('═'.repeat(80));

  const startTime = performance.now();
  try {
    const result = await runAnatomistPass({
      segments,
      settings,
      llm: runConfig.model as any,
      promptContext,
      providerPreferences: runConfig.model.providerPreferences,
    });

    const duration = performance.now() - startTime;
    console.log(`\n✓ SUCCESS in ${(duration / 1000).toFixed(2)}s`);
    console.log('\nResult summary:');
    console.log(`  Words: ${result.data?.words?.length || 0}`);
    console.log(`  Segments: ${result.data?.segments?.length || 0}`);
    console.log(`  Relations: ${result.data?.relations?.length || 0}`);

    if (result.data?.words) {
      console.log('\nFirst 3 words:');
      result.data.words.slice(0, 3).forEach((w: any) => {
        console.log(`  ${w.id}: "${w.surface}" (${w.wordClass})`);
      });
    }

    // Save full output
    const outPath = `/tmp/debug-${modelId}-${phaseId}-${passName}.json`;
    await fs.writeFile(outPath, JSON.stringify(result, null, 2));
    console.log(`\nFull output saved to: ${outPath}`);

  } catch (error: any) {
    const duration = performance.now() - startTime;
    console.log(`\n✗ FAILED in ${(duration / 1000).toFixed(2)}s`);
    console.log('\nError details:');
    console.log(`  Message: ${error.message}`);
    console.log(`  Name: ${error.name}`);
    if (error.cause) console.log(`  Cause: ${JSON.stringify(error.cause)}`);
    if (error.response) console.log(`  Response: ${JSON.stringify(error.response)}`);
    console.log('\nFull error:');
    console.log(error);
  }
}

async function runWeaver(phase: any, settings: any, runConfig: BenchmarkRun) {
  const { runWeaverPass } = await import('../../services/suttaStudioPassRunners');
  const { getSuttaStudioPromptContext } = await import('../../config/suttaStudioPromptContext');

  // Weaver needs anatomist output - use phase data as proxy
  const anatomistOutput = {
    words: phase.paliWords,
    segments: phase.paliWords.flatMap((w: any) =>
      w.segments.map((s: any) => ({ ...s, wordId: w.id }))
    ),
    relations: phase.relations || [],
  };

  const englishText = phase.englishStructure
    .filter((t: any) => !t.isGhost)
    .map((t: any) => t.text)
    .join(' ');

  console.log('\nEnglish text:', englishText);
  console.log('Anatomist segments:', anatomistOutput.segments.length);

  const promptContext = getSuttaStudioPromptContext();

  console.log('\n' + '═'.repeat(80));
  console.log('MAKING API CALL...');
  console.log('═'.repeat(80));

  const startTime = performance.now();
  try {
    const result = await runWeaverPass({
      anatomistOutput,
      englishText,
      settings,
      llm: runConfig.model as any,
      promptContext,
      providerPreferences: runConfig.model.providerPreferences,
    });

    const duration = performance.now() - startTime;
    console.log(`\n✓ SUCCESS in ${(duration / 1000).toFixed(2)}s`);
    console.log('\nResult summary:');
    console.log(`  Tokens: ${result.data?.tokens?.length || 0}`);

    const linked = result.data?.tokens?.filter((t: any) => t.linkedSegmentId).length || 0;
    console.log(`  Linked tokens: ${linked}`);

    // Save full output
    const outPath = `/tmp/debug-${modelId}-${phaseId}-${passName}.json`;
    await fs.writeFile(outPath, JSON.stringify(result, null, 2));
    console.log(`\nFull output saved to: ${outPath}`);

  } catch (error: any) {
    const duration = performance.now() - startTime;
    console.log(`\n✗ FAILED in ${(duration / 1000).toFixed(2)}s`);
    console.log('\nError details:');
    console.log(`  Message: ${error.message}`);
    console.log(`  Name: ${error.name}`);
    if (error.cause) console.log(`  Cause: ${JSON.stringify(error.cause)}`);
    if (error.response) console.log(`  Response: ${JSON.stringify(error.response)}`);
    console.log('\nFull error:');
    console.log(error);
  }
}

async function runLexicographer(phase: any, settings: any, runConfig: BenchmarkRun) {
  const { runLexicographerPass } = await import('../../services/suttaStudioPassRunners');
  const { getSuttaStudioPromptContext } = await import('../../config/suttaStudioPromptContext');

  const anatomistOutput = {
    words: phase.paliWords,
    segments: phase.paliWords.flatMap((w: any) =>
      w.segments.map((s: any) => ({ ...s, wordId: w.id }))
    ),
    relations: phase.relations || [],
  };

  console.log('\nAnatomist words:', anatomistOutput.words.length);

  const promptContext = getSuttaStudioPromptContext();

  console.log('\n' + '═'.repeat(80));
  console.log('MAKING API CALL...');
  console.log('═'.repeat(80));

  const startTime = performance.now();
  try {
    const result = await runLexicographerPass({
      anatomistOutput,
      settings,
      llm: runConfig.model as any,
      promptContext,
      providerPreferences: runConfig.model.providerPreferences,
    });

    const duration = performance.now() - startTime;
    console.log(`\n✓ SUCCESS in ${(duration / 1000).toFixed(2)}s`);
    console.log('\nResult summary:');
    console.log(`  Senses: ${result.data?.senses?.length || 0}`);

    // Save full output
    const outPath = `/tmp/debug-${modelId}-${phaseId}-${passName}.json`;
    await fs.writeFile(outPath, JSON.stringify(result, null, 2));
    console.log(`\nFull output saved to: ${outPath}`);

  } catch (error: any) {
    const duration = performance.now() - startTime;
    console.log(`\n✗ FAILED in ${(duration / 1000).toFixed(2)}s`);
    console.log('\nError details:');
    console.log(`  Message: ${error.message}`);
    console.log(`  Name: ${error.name}`);
    if (error.cause) console.log(`  Cause: ${JSON.stringify(error.cause)}`);
    if (error.response) console.log(`  Response: ${JSON.stringify(error.response)}`);
    console.log('\nFull error:');
  }
}

main().catch((error) => {
  console.error('\nScript failed:', error);
  process.exit(1);
});
