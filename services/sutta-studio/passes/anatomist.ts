/**
 * Anatomist pass — first semantic pass.
 * Decomposes Pali surface forms into morpheme segments, assigns word
 * classes, generates tooltips, and proposes relations between words.
 */

import type { AppSettings } from '../../../types';
import type { AnatomistPass, CanonicalSegment } from '../../../types/suttaStudio';
import { buildAnatomistPrompt } from '../prompts';
import { buildPhaseStateEnvelope, parseJsonResponse } from '../utils';
import { anatomistResponseSchema } from '../../suttaStudioPassPrompts';
import { defaultLLMCaller } from './_defaultCaller';
import type { LLMCaller, PassCallResult } from './types';

export const runAnatomistPass = async (params: {
  phaseId: string;
  workId: string;
  segments: CanonicalSegment[];
  settings: AppSettings;
  structuredOutputs: boolean;
  retrievalContext?: string;
  signal?: AbortSignal;
  llmCaller?: LLMCaller;
  maxTokens?: number;
}): Promise<PassCallResult<AnatomistPass>> => {
  const {
    phaseId,
    workId,
    segments,
    settings,
    structuredOutputs,
    retrievalContext,
    signal,
    llmCaller = defaultLLMCaller,
    maxTokens = 16000,
  } = params;

  const phaseState = buildPhaseStateEnvelope({
    workId,
    phaseId,
    segments,
    currentStageLabel: 'Anatomist (1/4)',
    currentStageKey: 'anatomist',
    completed: {},
  });

  const schemaName = `sutta_studio_anatomist_${phaseId.replace(/-/g, '_')}`;
  const requestName = 'anatomist';

  try {
    const prompt = buildAnatomistPrompt(phaseId, segments, phaseState, retrievalContext);
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
        schema: anatomistResponseSchema,
        structuredOutputs,
        meta: { stage: 'anatomist', phaseId, requestName },
      },
    });
    const output = parseJsonResponse<AnatomistPass>(llm.text);
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
