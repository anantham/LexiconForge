#!/usr/bin/env npx tsx
/**
 * run-phase-experiment.ts — empirical validation runner for the V2-amended prompts.
 *
 * Targets a single named phase from demoPacket.json, runs the V2-active passes
 * (anatomist + lexicographer + phase composition) on its Pali words, and saves
 * the output for diffing against the hand-curated entry.
 *
 * Usage:
 *   tsx scripts/sutta-studio/run-phase-experiment.ts \
 *     --phase phase-2 \
 *     [--model google/gemini-3-flash-preview] \
 *     [--out docs/sutta-studio/experiments/phase-2-v11-output.json]
 *
 * Requires OPENROUTER_API_KEY in env.
 *
 * Skipped passes (intentional, to keep cost focused on V2-amended passes):
 *   - skeleton: we already know the phase grouping from demoPacket.json
 *   - weaver: V2 amendments don't touch token mapping; not informative for V2 validation
 *   - typesetter: V2 amendments don't touch layout blocks
 *   - morphology: refinement pass run after Phase; not core to V2 quality question
 *
 * Run multiple times with different --model to compare V2 prompt behavior across
 * model tiers (Gemini Flash vs Claude Sonnet vs Claude Opus). Output filenames
 * should be differentiated via --out.
 */

import fs from 'fs/promises';
import path from 'path';
import {
  runAnatomistPass,
  runLexicographerPass,
  type LLMCaller,
} from '../../services/sutta-studio/passes';
import { buildPhasePrompt } from '../../services/sutta-studio/prompts';
import { buildPhaseStateEnvelope, parseJsonResponse } from '../../services/sutta-studio/utils';
import { phaseResponseSchema } from '../../services/sutta-studio/schemas';
import { SUTTA_STUDIO_PROMPT_VERSION } from '../../services/suttaStudioPromptVersion';
import { getModelPricing } from '../../services/capabilityService';
import type { CanonicalSegment, PhaseView } from '../../types/suttaStudio';

// --- CLI arg parsing ------------------------------------------------------

const args = process.argv.slice(2);
const getArg = (name: string, defaultVal?: string): string => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return defaultVal ?? '';
  const value = args[i + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`--${name} requires a value`);
  }
  return value;
};

const phaseId = getArg('phase', 'phase-2');
const modelId = getArg('model', 'google/gemini-3-flash-preview');
const defaultOut = `docs/sutta-studio/experiments/${phaseId}-v11-output.json`;
const outPath = getArg('out', defaultOut);

if (!phaseId) {
  console.error('Usage: tsx run-phase-experiment.ts --phase <phase-id> [--model <id>] [--out <path>]');
  process.exit(1);
}

// --- LLM caller (OpenRouter) ---------------------------------------------

const createLLMCaller = (model: string): LLMCaller => {
  return async ({ messages, maxTokens, options }) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY in environment');
    }

    const useStructured = Boolean(options?.schema) && Boolean(options?.structuredOutputs);
    const requestBody: Record<string, any> = {
      model,
      messages,
      max_tokens: maxTokens ?? 4000,
      temperature: 0.2,
    };

    if (useStructured && options?.schema) {
      requestBody.response_format = {
        type: 'json_schema',
        json_schema: {
          name: options.schemaName || 'response',
          schema: options.schema,
          strict: true,
        },
      };
      requestBody.provider = { require_parameters: true };
    } else {
      requestBody.response_format = { type: 'json_object' };
    }

    const start = performance.now();
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost',
        'X-Title': 'LexiconForge Phase Experiment',
      },
      body: JSON.stringify(requestBody),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error?.message || `HTTP ${res.status}`);
    }

    const text = json?.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) {
      throw new Error('Empty response from model');
    }

    const promptTokens = json?.usage?.prompt_tokens ?? null;
    const completionTokens = json?.usage?.completion_tokens ?? null;
    let costUsd: number | null = null;
    if (promptTokens && completionTokens) {
      try {
        const pricing = await getModelPricing(model);
        if (pricing) {
          costUsd = (promptTokens / 1_000_000) * pricing.input + (completionTokens / 1_000_000) * pricing.output;
        }
      } catch {}
    }

    return {
      text,
      tokens: { prompt: promptTokens, completion: completionTokens, total: (promptTokens || 0) + (completionTokens || 0) },
      costUsd: costUsd ?? undefined,
      model: json?.model ?? model,
      raw: json,
      provider: 'OpenRouter',
      durationMs: Math.round(performance.now() - start),
    };
  };
};

// --- Helpers --------------------------------------------------------------

const reconstructPaliFromPhase = (phase: any): string => {
  return phase.paliWords
    .map((w: any) => w.segments.map((s: any) => s.text).join(''))
    .join(' ');
};

const reconstructEnglishFromPhase = (phase: any): string => {
  // englishStructure has ghost tokens (label) and word references (linkedSegmentId).
  // For experiment input, a simple flatten suffices — the phase pass doesn't need
  // a perfect English string, just enough to ground the LLM.
  return (phase.englishStructure || [])
    .map((t: any) => t.label || t.linkedSegmentId || '')
    .filter(Boolean)
    .join(' ');
};

// --- Main -----------------------------------------------------------------

async function main() {
  console.log(`[Experiment] Phase ${phaseId} on model ${modelId}`);
  console.log(`[Experiment] Prompt version: ${SUTTA_STUDIO_PROMPT_VERSION}`);

  const packetPath = path.resolve('components/sutta-studio/demoPacket.json');
  const packetText = await fs.readFile(packetPath, 'utf-8');
  const packet = JSON.parse(packetText);

  const phase = packet.phases.find((p: any) => p.id === phaseId);
  if (!phase) {
    console.error(`Phase ${phaseId} not found in packet`);
    process.exit(1);
  }

  const paliText = reconstructPaliFromPhase(phase);
  const englishText = reconstructEnglishFromPhase(phase);
  const workId = (phase.canonicalSegmentIds?.[0] || '').split(':')[0] || 'mn10';
  const canonicalSegmentId = phase.canonicalSegmentIds?.[0] || `${workId}:1.1`;

  console.log(`[Experiment] Pali: "${paliText}"`);
  console.log(`[Experiment] English (approximate): "${englishText}"`);

  const canonicalSegments: CanonicalSegment[] = [{
    ref: { provider: 'suttacentral' as any, workId, segmentId: canonicalSegmentId },
    order: 0,
    pali: paliText,
    baseEnglish: englishText || undefined,
  }];

  const settings = { model: modelId, provider: 'OpenRouter' } as any;
  const llmCaller = createLLMCaller(modelId);

  // --- 1. Anatomist -------------------------------------------------------
  console.log('\n[1/3] Anatomist...');
  const anatomistResult = await runAnatomistPass({
    phaseId,
    workId,
    segments: canonicalSegments,
    settings,
    structuredOutputs: true,
    llmCaller,
  });
  if (anatomistResult.error || !anatomistResult.output) {
    console.error('Anatomist failed:', anatomistResult.error);
    process.exit(1);
  }
  console.log(`  ✓ ${anatomistResult.output.words.length} words, ${anatomistResult.output.segments.length} segments, ${anatomistResult.output.relations?.length || 0} relations`);
  console.log(`  tokens: prompt=${anatomistResult.llm?.tokens?.prompt} completion=${anatomistResult.llm?.tokens?.completion}`);

  // --- 2. Lexicographer ---------------------------------------------------
  console.log('\n[2/3] Lexicographer...');
  const lexicographerResult = await runLexicographerPass({
    phaseId,
    workId,
    segments: canonicalSegments,
    anatomist: anatomistResult.output,
    dictionaryEntries: {},
    settings,
    structuredOutputs: true,
    llmCaller,
  });
  if (lexicographerResult.error || !lexicographerResult.output) {
    console.error('Lexicographer failed:', lexicographerResult.error);
    process.exit(1);
  }
  console.log(`  ✓ ${lexicographerResult.output.senses.length} word entries with senses`);
  console.log(`  tokens: prompt=${lexicographerResult.llm?.tokens?.prompt} completion=${lexicographerResult.llm?.tokens?.completion}`);

  // --- 3. Phase composition ----------------------------------------------
  console.log('\n[3/3] Phase composition...');
  const phaseState = buildPhaseStateEnvelope({
    workId,
    phaseId,
    segments: canonicalSegments,
    currentStageLabel: 'Phase (compose)',
    completed: { anatomist: true, lexicographer: true, weaver: true, typesetter: true },
  });
  const phasePrompt = buildPhasePrompt(
    phaseId,
    canonicalSegments,
    { ghostOpacity: 0.5, englishVisible: true, studyToggleDefault: false },
    undefined,
    {
      anatomist: anatomistResult.output,
      lexicographer: lexicographerResult.output,
      phaseState,
    }
  );

  const phaseSchemaName = `sutta_studio_phase_${phaseId.replace(/-/g, '_')}`;
  const phaseLLMResult = await llmCaller({
    settings,
    messages: [
      { role: 'system', content: 'Return JSON only.' },
      { role: 'user', content: phasePrompt },
    ],
    maxTokens: 16000,
    options: {
      schemaName: phaseSchemaName,
      schema: phaseResponseSchema,
      structuredOutputs: true,
      meta: { stage: 'phase', phaseId, requestName: 'phase' },
    },
  });
  let phaseView: PhaseView | null = null;
  try {
    phaseView = parseJsonResponse<PhaseView>(phaseLLMResult.text);
    console.log(`  ✓ ${phaseView.paliWords?.length || 0} paliWords, ${(phaseView as any).englishStructure?.length || 0} englishStructure tokens`);
    console.log(`  tokens: prompt=${phaseLLMResult.tokens?.prompt} completion=${phaseLLMResult.tokens?.completion}`);
  } catch (err) {
    console.error('  ✗ Phase composition failed to parse:', err);
    // Don't exit — save what we have
  }

  // --- Aggregate + save ---------------------------------------------------
  const totalPromptTokens =
    (anatomistResult.llm?.tokens?.prompt || 0) +
    (lexicographerResult.llm?.tokens?.prompt || 0) +
    (phaseLLMResult.tokens?.prompt || 0);
  const totalCompletionTokens =
    (anatomistResult.llm?.tokens?.completion || 0) +
    (lexicographerResult.llm?.tokens?.completion || 0) +
    (phaseLLMResult.tokens?.completion || 0);
  const totalCostUsd =
    (anatomistResult.llm?.costUsd || 0) +
    (lexicographerResult.llm?.costUsd || 0) +
    (phaseLLMResult.costUsd || 0);

  const output = {
    _meta: {
      experimentRunAt: new Date().toISOString(),
      phaseId,
      model: modelId,
      promptVersion: SUTTA_STUDIO_PROMPT_VERSION,
      paliText,
      englishText,
      tokens: {
        prompt: totalPromptTokens,
        completion: totalCompletionTokens,
        total: totalPromptTokens + totalCompletionTokens,
      },
      costUsd: totalCostUsd,
      passes: ['anatomist', 'lexicographer', 'phase'],
      note: 'Skipped: skeleton (phase grouping known), weaver + typesetter (orthogonal to V2), morphology (refinement, not core to V2 quality).',
    },
    anatomist: anatomistResult.output,
    lexicographer: lexicographerResult.output,
    phaseView,
  };

  const resolvedOut = path.resolve(outPath);
  await fs.mkdir(path.dirname(resolvedOut), { recursive: true });
  await fs.writeFile(resolvedOut, JSON.stringify(output, null, 2) + '\n');
  console.log(`\n[Experiment] Saved: ${resolvedOut}`);
  console.log(`[Experiment] Total: ${totalPromptTokens} prompt + ${totalCompletionTokens} completion tokens (~$${totalCostUsd.toFixed(4)})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
