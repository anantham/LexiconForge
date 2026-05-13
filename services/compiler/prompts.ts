/**
 * Re-export shim for the production compiler.
 *
 * The canonical prompt builders live at `services/sutta-studio/prompts/`.
 * This file exists only for backward-compat with `services/compiler/index.ts`
 * (and the dead `services/compiler/skeleton.ts`).
 *
 * Per CONSOLIDATION.md Phase 1 — the single prompts module landed here.
 * Phase 4 cleanup will delete this shim once all consumers import from the
 * canonical path.
 */

export {
  buildSkeletonPrompt,
  buildAnatomistPrompt,
  buildLexicographerPrompt,
  buildWeaverPrompt,
  buildTypesetterPrompt,
  buildMorphologyPrompt,
  buildPhasePrompt,
} from '../sutta-studio/prompts';

// Backward-compat alias historically re-exported from this file:
export { buildPhaseStateEnvelope as buildPhaseStateEnvelopeForPhase } from './utils';
