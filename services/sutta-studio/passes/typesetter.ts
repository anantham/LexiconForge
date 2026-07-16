/**
 * Typesetter pass — arranges Pali words into layout blocks for visual rendering.
 * Words from the same canonical segment stay in the same block.
 */

import type { AppSettings } from '../../../types';
import type {
  AnatomistPass,
  CanonicalSegment,
  TypesetterPass,
  WeaverPass,
} from '../../../types/suttaStudio';
import { buildTypesetterPrompt } from '../prompts';
import { buildPhaseStateEnvelope, parseJsonResponse } from '../utils';
import { typesetterResponseSchema } from '../schemas';
import { defaultLLMCaller } from './_defaultCaller';
import type { LLMCaller, PassCallResult } from './types';
import { SUTTA_STUDIO_TOKEN_BUDGETS } from '../passBudgets';

export const runTypesetterPass = async (params: {
  phaseId: string;
  workId: string;
  segments: CanonicalSegment[];
  anatomist: AnatomistPass;
  weaver: WeaverPass;
  settings: AppSettings;
  structuredOutputs: boolean;
  signal?: AbortSignal;
  llmCaller?: LLMCaller;
  maxTokens?: number;
  logger?: (message: string) => void;
}): Promise<PassCallResult<TypesetterPass>> => {
  const {
    phaseId,
    workId,
    segments,
    anatomist,
    weaver,
    settings,
    structuredOutputs,
    signal,
    llmCaller = defaultLLMCaller,
    maxTokens = SUTTA_STUDIO_TOKEN_BUDGETS.typesetter,
    logger,
  } = params;

  const phaseState = buildPhaseStateEnvelope({
    workId,
    phaseId,
    segments,
    currentStageLabel: 'Typesetter (4/4)',
    currentStageKey: 'typesetter',
    completed: { anatomist: true, lexicographer: true, weaver: true },
  });

  const schemaName = `sutta_studio_typesetter_${phaseId.replace(/-/g, '_')}`;
  const requestName = 'typesetter';

  try {
    const prompt = buildTypesetterPrompt(
      phaseId,
      phaseState,
      anatomist,
      weaver,
      segments,
      logger
    );
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
        schema: typesetterResponseSchema,
        structuredOutputs,
        meta: { stage: 'typesetter', phaseId, requestName },
      },
    });
    const output = parseJsonResponse<TypesetterPass>(llm.text);
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
