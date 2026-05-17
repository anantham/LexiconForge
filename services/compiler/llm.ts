/**
 * Backward-compat re-export shim — canonical caller moved to
 * services/sutta-studio/llm.ts. Phase 3 of CONSOLIDATION.md.
 *
 * Legacy contract: this file used to export a string-returning
 * `callCompilerLLM`. Existing consumers (services/compiler/index.ts and
 * services/compiler/skeleton.ts, 7 call sites total) destructure the
 * return as a raw text string. To preserve that contract with zero
 * call-site churn, we alias the canonical's string-returning helper
 * (`callCompilerLLMText`) AS `callCompilerLLM` here. When the orchestrator
 * is ported to services/sutta-studio/ (PR D), those consumers move to
 * the rich `CompilerLLMResult`-returning canonical signature.
 *
 * Phase 4 cleanup deletes this file entirely once compiler/index.ts and
 * compiler/skeleton.ts no longer exist.
 */

export { resolveCompilerProvider } from '../sutta-studio/llm';
export { callCompilerLLMText as callCompilerLLM } from '../sutta-studio/llm';
