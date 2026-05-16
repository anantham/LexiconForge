/**
 * Backward-compat re-export shim — canonical schemas moved to
 * services/sutta-studio/schemas.ts. Phase 2c (PR A) of CONSOLIDATION.md.
 *
 * Historical note: this file and services/suttaStudioPassPrompts.ts both
 * defined the same 7 schemas, but had drifted: the bench-side file gained
 * wordRange + refrainId fields that production code needed (and prompted
 * the LLM for) but production schema didn't enforce. Unifying here closes
 * that gap — all callers now use one canonical schema with the richer
 * fields.
 *
 * Phase 4 cleanup deletes this file entirely once all consumers import
 * directly from services/sutta-studio/schemas.
 */

export {
  skeletonResponseSchema,
  anatomistResponseSchema,
  lexicographerResponseSchema,
  weaverResponseSchema,
  typesetterResponseSchema,
  phaseResponseSchema,
  morphResponseSchema,
} from '../sutta-studio/schemas';
