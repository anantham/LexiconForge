// Version history:
// v9-tooltips: Added tooltip requirements to anatomist
// v10-diverse-examples: Expanded train/test split (21/30), added 3 diverse anatomist examples,
//                       added weaver anti-pattern for duplicate mappings
// v11-mn10-amendments: V2 amendments active in production. 6 protocol blocks from MN10 batches 1-4
//                      hand-curation wire into Anatomist + Lexicographer + Phase passes via the
//                      canonical services/sutta-studio/prompts/ module: pay-rent tooltip register,
//                      arrow-earning relation rule, sense metadata (epistemicBasis/sourceCitationIds/
//                      confidence/notes), anchor selection, translator-debate cycles, cross-phase
//                      awareness. See docs/sutta-studio/CONSOLIDATION.md (Phase 1).
// v12-prior-phase-context: Sliding-window prior-phase context (default 3 phases) now populated in
//                      the PhaseStateEnvelope. The V11 CROSS_PHASE amendment was already conditional
//                      ("if you're given prior-phase context..."); v12 actually provides it.
//                      Closes the cross-phase narrative gap that v11 couldn't bridge with a one-
//                      phase prompt window. See services/sutta-studio/utils.ts:formatPriorPhasesContext.
//                      Bump invalidates v11 cache entries — they were correct under their window
//                      but lacked the cross-phase observations v12 enables.
export const SUTTA_STUDIO_PROMPT_VERSION = 'sutta-studio-v12-prior-phase-context';
