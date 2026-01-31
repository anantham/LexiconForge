#!/usr/bin/env npx tsx
/**
 * Generate new phases for segments beyond the current demo packet.
 * Uses gemini-3-flash to create anatomist/lexicographer/weaver/typesetter passes.
 */

import fs from 'fs/promises';
import path from 'path';
import { BENCHMARK_CONFIG } from './benchmark-config';
import {
  runAnatomistPass,
  runLexicographerPass,
  runWeaverPass,
  runTypesetterPass,
  type LLMCaller,
} from '../../services/suttaStudioPassRunners';
import type { CanonicalSegment } from '../../types/suttaStudio';
import { getModelPricing } from '../../services/capabilityService';

// Configuration
const MODEL_ID = 'google/gemini-3-flash-preview';
const WORK_ID = 'mn10';
const SEGMENT_RANGE = ['mn10:6', 'mn10:7', 'mn10:8'];

// Simple LLM caller for OpenRouter
const createLLMCaller = (): LLMCaller => {
  return async ({ settings, messages, maxTokens, options }) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY');
    }

    const useStructured = Boolean(options?.schema) && Boolean(options?.structuredOutputs);
    let requestBody: Record<string, any> = {
      model: MODEL_ID,
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
        'X-Title': 'LexiconForge SuttaStudio Generate',
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
        const pricing = await getModelPricing(MODEL_ID);
        if (pricing) {
          costUsd = (promptTokens / 1_000_000) * pricing.input + (completionTokens / 1_000_000) * pricing.output;
        }
      } catch {}
    }

    return {
      text,
      tokens: { prompt: promptTokens, completion: completionTokens, total: (promptTokens || 0) + (completionTokens || 0) },
      costUsd: costUsd ?? undefined,
      model: json?.model ?? MODEL_ID,
      raw: json,
      provider: 'OpenRouter',
      durationMs: Math.round(performance.now() - start),
    };
  };
};

const llmCaller = createLLMCaller();

// Main
async function main() {
  console.log('[Generate] Fetching segments from SuttaCentral...');
  const response = await fetch(`https://suttacentral.net/api/bilarasuttas/${WORK_ID}/sujato`);
  const data = await response.json() as { root_text: Record<string, string>; translation_text: Record<string, string> };

  // Filter segments in our range
  const segments = Object.entries(data.root_text)
    .filter(([key]) => SEGMENT_RANGE.some(prefix => key.startsWith(prefix)))
    .map(([segmentId, pali]) => ({
      ref: { provider: 'suttacentral' as const, workId: WORK_ID, segmentId },
      pali,
      baseEnglish: data.translation_text[segmentId] || '',
    }))
    .sort((a, b) => {
      const [, aSec, aVerse] = a.ref.segmentId.match(/mn10:(\d+)\.(\d+)/) || [];
      const [, bSec, bVerse] = b.ref.segmentId.match(/mn10:(\d+)\.(\d+)/) || [];
      return (parseInt(aSec) * 100 + parseInt(aVerse)) - (parseInt(bSec) * 100 + parseInt(bVerse));
    });

  console.log(`[Generate] Found ${segments.length} segments:`);
  segments.forEach(s => console.log(`  ${s.ref.segmentId}: ${s.pali.slice(0, 50)}...`));

  // Create phases (continue from phase-bg)
  const phaseLetters = 'hijklmnopqrstuvwxyz'.split('');
  const phases = segments.map((seg, i) => ({
    id: `phase-b${phaseLetters[i] || 'x'}`,
    segment: seg,
  }));

  console.log(`\n[Generate] Creating ${phases.length} new phases`);

  // Create output directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.resolve(`reports/sutta-studio/generated-${timestamp}`);
  await fs.mkdir(outputDir, { recursive: true });

  const settings = { ...BENCHMARK_CONFIG.settingsOverrides, model: MODEL_ID } as any;
  const results: any[] = [];

  for (const phase of phases) {
    console.log(`\n[Generate] ${phase.id} (${phase.segment.ref.segmentId})...`);

    try {
      const canonicalSegments: CanonicalSegment[] = [{
        ref: phase.segment.ref,
        order: 0,
        pali: phase.segment.pali,
        baseEnglish: phase.segment.baseEnglish,
      }];

      // 1. ANATOMIST
      console.log(`  [1/4] Anatomist...`);
      const anatomist = await runAnatomistPass({
        phaseId: phase.id, workId: WORK_ID, segments: canonicalSegments,
        settings, structuredOutputs: true, llmCaller,
      });
      if (anatomist.error || !anatomist.output) throw new Error(`Anatomist: ${anatomist.error}`);

      // 2. LEXICOGRAPHER
      console.log(`  [2/4] Lexicographer...`);
      const lexicographer = await runLexicographerPass({
        phaseId: phase.id, workId: WORK_ID, segments: canonicalSegments,
        anatomist: anatomist.output, dictionaryEntries: {},
        settings, structuredOutputs: true, llmCaller,
      });
      if (lexicographer.error || !lexicographer.output) throw new Error(`Lexicographer: ${lexicographer.error}`);

      // 3. WEAVER
      console.log(`  [3/4] Weaver...`);
      const weaver = await runWeaverPass({
        phaseId: phase.id, workId: WORK_ID, segments: canonicalSegments,
        anatomist: anatomist.output, lexicographer: lexicographer.output,
        englishText: phase.segment.baseEnglish,
        settings, structuredOutputs: true, llmCaller,
      });
      if (weaver.error || !weaver.output) throw new Error(`Weaver: ${weaver.error}`);

      // 4. TYPESETTER
      console.log(`  [4/4] Typesetter...`);
      const typesetter = await runTypesetterPass({
        phaseId: phase.id, workId: WORK_ID, segments: canonicalSegments,
        anatomist: anatomist.output, weaver: weaver.output,
        settings, structuredOutputs: true, llmCaller,
      });
      if (typesetter.error || !typesetter.output) throw new Error(`Typesetter: ${typesetter.error}`);

      // Save output
      const result = {
        phaseId: phase.id,
        segment: canonicalSegments[0],
        anatomist: anatomist.output,
        lexicographer: lexicographer.output,
        weaver: weaver.output,
        typesetter: typesetter.output,
      };
      await fs.writeFile(path.join(outputDir, `${phase.id}.json`), JSON.stringify(result, null, 2));
      results.push({ phaseId: phase.id, success: true });
      console.log(`  ✓ SUCCESS`);

    } catch (error) {
      console.error(`  ✗ FAILED:`, error);
      results.push({ phaseId: phase.id, success: false, error: String(error) });
    }
  }

  // Summary
  const success = results.filter(r => r.success).length;
  console.log(`\n[Generate] Complete: ${success}/${results.length} successful`);
  console.log(`Output: ${outputDir}`);

  await fs.writeFile(path.join(outputDir, 'summary.json'), JSON.stringify({ results, outputDir }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
