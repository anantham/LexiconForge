/**
 * Default LLM caller — used when a pass is invoked without an explicit
 * `llmCaller` argument. Dynamic-imports the existing LLM module to avoid a
 * circular dep risk (Phase 3 will consolidate the LLM module proper).
 */

import type { LLMCaller } from './types';

export const defaultLLMCaller: LLMCaller = async ({ settings, messages, signal, maxTokens, options }) => {
  const { callCompilerLLM } = await import('../../suttaStudioLLM');
  return callCompilerLLM(settings, messages, signal, maxTokens ?? 4000, options);
};
