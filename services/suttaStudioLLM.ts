/**
 * Backward-compat re-export shim — canonical caller moved to
 * services/sutta-studio/llm.ts. Phase 3 of CONSOLIDATION.md.
 *
 * Phase 4 cleanup deletes this file entirely once all consumers import
 * directly from services/sutta-studio/llm.
 */

export {
  callCompilerLLM,
  callCompilerLLMText,
  resolveCompilerProvider,
  type CompilerLLMOptions,
  type CompilerLLMResult,
} from './sutta-studio/llm';
