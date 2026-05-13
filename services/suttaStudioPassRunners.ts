/**
 * Backward-compat shim — canonical pass functions moved to
 * services/sutta-studio/passes/ per CONSOLIDATION.md Phase 2b.
 *
 * Existing consumers continue to import from this path without changes:
 *   - scripts/sutta-studio/benchmark.ts (LLMCaller, PassName, SkeletonPhase, run*Pass)
 *   - scripts/sutta-studio/benchmark-config.ts (PassName)
 *   - scripts/sutta-studio/generate-new-phases.ts (LLMCaller, run*Pass)
 *
 * Phase 4 cleanup will delete this shim once those scripts are updated to
 * import from services/sutta-studio/passes directly.
 */

export {
  runSkeletonPass,
  runAnatomistPass,
  runLexicographerPass,
  runWeaverPass,
  runTypesetterPass,
  runMorphologyPass,
} from './sutta-studio/passes';

export type {
  PassName,
  LLMCaller,
  PassCallResult,
  SkeletonChunkResult,
  SkeletonRunResult,
} from './sutta-studio/passes';

// SkeletonPhase used to be re-exported from this file via the
// suttaStudioPassPrompts import chain. Preserve that export so benchmark
// scripts that import `type SkeletonPhase from './suttaStudioPassRunners'`
// keep working.
export type { SkeletonPhase } from './sutta-studio/utils';
