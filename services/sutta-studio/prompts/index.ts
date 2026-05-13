/**
 * Canonical Sutta Studio prompt builders — single source of truth.
 *
 * Per CONSOLIDATION.md Phase 1: every prompt builder lives in this directory.
 * Both the production compiler (services/compiler/) and the benchmark
 * runners (services/suttaStudioPassRunners.ts) import from here via
 * re-export shims.
 *
 * V2 amendments are wired into Anatomist, Lexicographer, and Phase passes —
 * exactly once, here, not in two divergent files anymore.
 */

export { buildSkeletonPrompt } from './skeleton';
export { buildAnatomistPrompt } from './anatomist';
export { buildLexicographerPrompt } from './lexicographer';
export { buildWeaverPrompt } from './weaver';
export { buildTypesetterPrompt } from './typesetter';
export { buildMorphologyPrompt } from './morphology';
export { buildPhasePrompt } from './phase';
