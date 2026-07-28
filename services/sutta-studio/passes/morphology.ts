/**
 * Morphology pass — adds case/number/gender/tense hints to segments. Runs
 * AFTER the Phase pass and refines segment morphology data.
 *
 * NOT yet the production compile path (CONSOLIDATION Phase 4 pending) —
 * services/compiler/index.ts still orchestrates its own inline pass calls;
 * this module serves benchmark/experiment callers until the orchestrator port.
 */

import type { AppSettings } from '../../../types';
import type { CanonicalSegment, PhaseView } from '../../../types/suttaStudio';
import { buildMorphologyPrompt } from '../prompts';
import { parseJsonResponse } from '../utils';
import { morphResponseSchema } from '../schemas';
import { defaultLLMCaller } from './_defaultCaller';
import type { LLMCaller, PassCallResult } from './types';
import { SUTTA_STUDIO_TOKEN_BUDGETS } from '../passBudgets';

export const runMorphologyPass = async (params: {
  phaseId: string;
  segments: CanonicalSegment[];
  phaseView: PhaseView;
  settings: AppSettings;
  structuredOutputs: boolean;
  retrievalContext?: string;
  signal?: AbortSignal;
  llmCaller?: LLMCaller;
  maxTokens?: number;
}): Promise<PassCallResult<{ paliWords: Array<{ id: string; segments: PhaseView['paliWords'][number]['segments'] }> }>> => {
  const {
    phaseId,
    segments,
    phaseView,
    settings,
    structuredOutputs,
    retrievalContext,
    signal,
    llmCaller = defaultLLMCaller,
    maxTokens = SUTTA_STUDIO_TOKEN_BUDGETS.morphology,
  } = params;

  const schemaName = `sutta_studio_morph_${phaseId.replace(/-/g, '_')}`;
  const requestName = 'morphology';

  try {
    const prompt = buildMorphologyPrompt(phaseId, phaseView, segments, retrievalContext);
    const llm = await llmCaller({
      settings,
      messages: [
        { role: 'system', content: 'Return JSON only.' },
        { role: 'user', content: prompt },
      ],
      signal,
      maxTokens,
      options: {
        schemaName,
        schema: morphResponseSchema,
        structuredOutputs,
        meta: { stage: 'morph', phaseId, requestName },
      },
    });
    const output = parseJsonResponse<{ paliWords: Array<{ id: string; segments: PhaseView['paliWords'][number]['segments'] }> }>(llm.text);
    return { output, llm, requestName, schemaName, phaseId };
  } catch (e: any) {
    return {
      output: null,
      error: e?.message || String(e),
      requestName,
      schemaName,
      phaseId,
    };
  }
};
