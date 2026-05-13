/**
 * Weaver pass — maps English tokens to Pali word IDs. The alignment layer
 * that powers cross-language highlighting in the reader.
 */

import type { AppSettings } from '../../../types';
import type {
  AnatomistPass,
  CanonicalSegment,
  LexicographerPass,
  WeaverPass,
} from '../../../types/suttaStudio';
import { buildWeaverPrompt } from '../prompts';
import { buildPhaseStateEnvelope, parseJsonResponse } from '../utils';
import { tokenizeEnglish, type EnglishTokenInput } from '../../suttaStudioTokenizer';
import { weaverResponseSchema } from '../../suttaStudioPassPrompts';
import { defaultLLMCaller } from './_defaultCaller';
import type { LLMCaller, PassCallResult } from './types';

export const runWeaverPass = async (params: {
  phaseId: string;
  workId: string;
  segments: CanonicalSegment[];
  anatomist: AnatomistPass;
  lexicographer: LexicographerPass;
  englishTokens?: EnglishTokenInput[];
  englishText?: string;
  settings: AppSettings;
  structuredOutputs: boolean;
  signal?: AbortSignal;
  llmCaller?: LLMCaller;
  maxTokens?: number;
}): Promise<PassCallResult<WeaverPass>> => {
  const {
    phaseId,
    workId,
    segments,
    anatomist,
    lexicographer,
    englishTokens,
    englishText,
    settings,
    structuredOutputs,
    signal,
    llmCaller = defaultLLMCaller,
    maxTokens = 16000,
  } = params;

  const phaseState = buildPhaseStateEnvelope({
    workId,
    phaseId,
    segments,
    currentStageLabel: 'Weaver (3/4)',
    currentStageKey: 'weaver',
    completed: { anatomist: true, lexicographer: true },
  });

  const tokens = englishTokens
    ? englishTokens
    : tokenizeEnglish(
        englishText ??
          segments
            .map((seg) => seg.baseEnglish || '')
            .filter(Boolean)
            .join(' ')
      );

  const schemaName = `sutta_studio_weaver_${phaseId.replace(/-/g, '_')}`;
  const requestName = 'weaver';

  try {
    const prompt = buildWeaverPrompt(
      phaseId,
      segments,
      phaseState,
      anatomist,
      lexicographer,
      tokens
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
        schema: weaverResponseSchema,
        structuredOutputs,
        meta: { stage: 'weaver', phaseId, requestName },
      },
    });
    const output = parseJsonResponse<WeaverPass>(llm.text);
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
