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
// v13-segment-senses: Per-segment senses (backfilled entry — the bump shipped in f48560a without
//                      one). Lexicographer schema gained segmentSenses; prompt v13 asks for 1-2
//                      senses per meaningful compound part / prefix (never pure inflectional
//                      endings). The whole downstream (types, rehydrator, view, repair) already
//                      carried the path; only the schema field and the prompt were missing.
//                      Powers morpheme-level hover in the reader.
// v14-ripples-map:     Ripples schema contradiction fixed: both schema copies said
//                      array-of-{tradition,rendering} while prompt + type + renderer + worked
//                      example all use Record<english-token-id, string> — under strict structured
//                      outputs the documented feature was impossible to emit. Schemas now declare
//                      the map shape ({ type:'object', additionalProperties:{type:'string'} }).
//                      OpenAI strict dialect cannot express open maps, so toOpenAIStrictSchema
//                      DROPS ripples for openai/* (disclosed degradation). Worked example's
//                      impossible 'ghost_article' key reglossed to a real e-prefixed token id.
//                      Also strips retired per-sense epistemicBasis/confidence instructions from
//                      TRANSLATOR_DEBATE (schema forbids them under additionalProperties:false).
//                      Bump invalidates v13 cache entries; benchmark runs across v13/v14 are NOT
//                      comparable on the ripples/debate axes.
export const SUTTA_STUDIO_PROMPT_VERSION = 'sutta-studio-v14-ripples-map';
