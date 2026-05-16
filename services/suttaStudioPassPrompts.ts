/**
 * Backward-compat shim — all content moved to canonical locations:
 *   - Prompt builders → services/sutta-studio/prompts/ (Phase 1, commit 8be501f)
 *   - Utility functions → services/sutta-studio/utils.ts (Phase 2a)
 *   - Response schemas → services/sutta-studio/schemas.ts (Phase 2c / PR A)
 *
 * This file is now a pure re-export shim until Phase 4 cleanup deletes it
 * (once all consumers update their imports to the canonical paths).
 *
 * Historical note (PR A): the 7 response schemas used to live here in a
 * version that diverged from services/compiler/schemas.ts — the bench
 * copy had wordRange + refrainId fields that production needed but
 * production schema didn't enforce. PR A moved both copies to a single
 * canonical location, closing that gap.
 */

// Re-export utility functions from canonical location:
export {
  parseJsonResponse,
  buildPhaseStateEnvelope,
  buildBoundaryContext,
  type BoundaryNote,
  type SkeletonPhase,
  type PhaseStageKey,
} from './sutta-studio/utils';

// Re-export prompt builders from canonical location:
export {
  buildSkeletonPrompt,
  buildAnatomistPrompt,
  buildLexicographerPrompt,
  buildWeaverPrompt,
  buildTypesetterPrompt,
  buildMorphologyPrompt,
  buildPhasePrompt,
} from './sutta-studio/prompts';

// Re-export response schemas from canonical location:
export {
  skeletonResponseSchema,
  anatomistResponseSchema,
  lexicographerResponseSchema,
  weaverResponseSchema,
  typesetterResponseSchema,
  phaseResponseSchema,
  morphResponseSchema,
} from './sutta-studio/schemas';
