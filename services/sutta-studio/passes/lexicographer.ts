/**
 * Lexicographer pass — generates English senses for each Pali word.
 *
 * Accepts optional DPD attestations via `dpdLookups`. When provided, the
 * prompt builder renders them as a structured block alongside the raw
 * SuttaCentral dictionary entries — and the LLM is prompted to wire
 * sourceCitationIds back to specific DPD entries.
 *
 * NOTE: DPD wiring used to live ONLY in compiler/index.ts (the production
 * orchestrator). Phase 2 of CONSOLIDATION.md moves it INTO the lexicographer
 * pass where it belongs as a pass-level concern. Benchmark callers can now
 * also provide DPD context (previously only production could).
 */

import type { AppSettings } from '../../../types';
import type { AnatomistPass, CanonicalSegment, LexicographerPass } from '../../../types/suttaStudio';
import type { LexiconEntry } from '../../providers/types';
import { buildLexicographerPrompt } from '../prompts';
import { buildPhaseStateEnvelope, parseJsonResponse } from '../utils';
import { lexicographerResponseSchema } from '../schemas';
import { defaultLLMCaller } from './_defaultCaller';
import type { LLMCaller, PassCallResult } from './types';

export const runLexicographerPass = async (params: {
  phaseId: string;
  workId: string;
  segments: CanonicalSegment[];
  anatomist: AnatomistPass;
  dictionaryEntries?: Record<string, unknown | null>;
  /**
   * Optional DPD attestations per wordId. When present, sent to the LLM as a
   * structured block; the LLM is prompted to cite back via Sense.sourceCitationIds.
   */
  dpdLookups?: Record<string, LexiconEntry[]>;
  settings: AppSettings;
  structuredOutputs: boolean;
  retrievalContext?: string;
  signal?: AbortSignal;
  llmCaller?: LLMCaller;
  maxTokens?: number;
}): Promise<PassCallResult<LexicographerPass>> => {
  const {
    phaseId,
    workId,
    segments,
    anatomist,
    dictionaryEntries = {},
    dpdLookups,
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
    currentStageLabel: 'Lexicographer (2/4)',
    currentStageKey: 'lexicographer',
    completed: { anatomist: true },
  });

  const schemaName = `sutta_studio_lexico_${phaseId.replace(/-/g, '_')}`;
  const requestName = 'lexicographer';

  try {
    const prompt = buildLexicographerPrompt(
      phaseId,
      segments,
      phaseState,
      anatomist,
      dictionaryEntries,
      retrievalContext,
      dpdLookups
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
        schema: lexicographerResponseSchema,
        structuredOutputs,
        meta: { stage: 'lexicographer', phaseId, requestName },
      },
    });
    const output = parseJsonResponse<LexicographerPass>(llm.text);
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
