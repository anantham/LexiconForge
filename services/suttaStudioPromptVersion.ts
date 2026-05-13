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
export const SUTTA_STUDIO_PROMPT_VERSION = 'sutta-studio-v11-mn10-amendments';
