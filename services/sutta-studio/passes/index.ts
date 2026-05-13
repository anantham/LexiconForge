/**
 * Canonical Sutta Studio pass functions — single source of truth.
 *
 * Per CONSOLIDATION.md Phase 2b. Each pass is a pure function with an
 * explicit dependency surface in its params; production orchestration concerns
 * (telemetry, progress callbacks, retrieval context building, validation,
 * rehydration) wrap these passes from the outside.
 *
 * The lexicographer pass uniquely accepts optional `dpdLookups` — this used
 * to live only in compiler/index.ts. Phase 2b moves it onto the pass where
 * it belongs as a lexicographer-level concern.
 */

export { runSkeletonPass } from './skeleton';
export { runAnatomistPass } from './anatomist';
export { runLexicographerPass } from './lexicographer';
export { runWeaverPass } from './weaver';
export { runTypesetterPass } from './typesetter';
export { runMorphologyPass } from './morphology';

export type {
  PassName,
  LLMCaller,
  PassCallResult,
  SkeletonChunkResult,
  SkeletonRunResult,
} from './types';
