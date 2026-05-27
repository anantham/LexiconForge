# Sutta Studio Compiler Consolidation — Design Doc

> **Status:** Phase 4 cleanup in progress.
>
> | Phase | Scope | Status |
> |---|---|---|
> | 0 | Design doc | DONE |
> | 1 | Single prompts module | DONE (commit 8be501f) |
> | 2a | utils.ts moved | DONE |
> | 2b | passes/ moved | DONE (commit c43d656) |
> | 2c | schemas.ts moved | DONE (PR #62, commit 0d81bec, 2026-05-16) |
> | 2d | orchestrator port (compiler/index.ts → sutta-studio/orchestrator.ts) | PENDING (PR D) |
> | 3 | Single LLM caller | DONE (this PR, 2026-05-16) |
> | 4 | Shim cleanup + delete services/compiler/ | PENDING |
>
> Earlier task tracking marked Phase 3 complete after Phase 2 landed; the 2026-05-16 doc audit caught
> that two divergent callers (compiler/llm.ts and suttaStudioLLM.ts) still existed and reopened the
> work. The canonical caller now lives at services/sutta-studio/llm.ts; both legacy files are shims.
>
> **Companion PR:** #50 (V2 wire) is PAUSED — its commits will be reworked once consolidation lands.

## Why this exists

The Sutta Studio codebase has two parallel compiler implementations:

```
Production stack (used by SuttaStudioApp.tsx)
  services/compiler/
    index.ts        ← compileSuttaStudioPacket (god-orchestrator, 675 lines)
    prompts.ts      ← buildAnatomistPrompt, buildLexicographerPrompt, ...
    llm.ts          ← callCompilerLLM
    skeleton.ts, schemas.ts, dictionary.ts, segments.ts, utils.ts

Benchmark stack (used by scripts/sutta-studio/benchmark.ts + generate-new-phases)
  services/
    suttaStudioPassRunners.ts   ← runAnatomistPass, runLexicographerPass, ...
    suttaStudioPassPrompts.ts   ← same prompts, divergent versions
    suttaStudioLLM.ts           ← different LLM caller, different signature
```

They were built at different times for different audiences:

| | Production stack | Benchmark stack |
|---|---|---|
| Born | 2026-03-05 (refactor from monolith) | 2026-01-30 (benchmark infrastructure) |
| Last touched | 2026-05-11 (DPD wiring) | 2026-03-08 (Cluster D) |
| API shape | Single orchestrator | Per-pass functions with injectable `LLMCaller` |
| Has been added since | DPD wiring, model override, retrieval context fixes | Pluggable LLM caller for tests, golden-fixture scripts |
| Has not received | The richer prompt examples and ripple support from the other stack | DPD wiring, telemetry, structured output schemas |

The two stacks have **drifted in opposite directions**. Neither is a strict subset of the other. As of PR #50 (paused) both received the V2 amendments — this is the rare moment when they are aligned on the most important content.

## What "principled" means in this refactor

1. **Single source of truth** for every prompt builder, every pass function, every JSON schema, every LLM call shape.
2. **Pure pass functions at the leaves** — `(input, prompt, llmCaller, schema) → output`. No orchestration coupling.
3. **Production orchestration is a separate layer** — telemetry, progress callbacks, caching, validation, rehydration, state envelopes — these wrap the pure passes, they do not live inside them.
4. **Backward-compatible public surface** — `compileSuttaStudioPacket` keeps its current signature; benchmark scripts keep their `runXPass` imports; consumers don't change in this refactor.
5. **Future protocol amendments land in one place.** This is the recurring-cost reason consolidation matters.

## Target file structure

```
services/sutta-studio/                          # NEW canonical location
  prompts/
    skeleton.ts                                 # buildSkeletonPrompt
    anatomist.ts                                # buildAnatomistPrompt (1 + 2 + REFRAIN examples)
    lexicographer.ts                            # buildLexicographerPrompt (DPD context + ripple example + senses)
    weaver.ts                                   # buildWeaverPrompt (with ANTI_PATTERN)
    typesetter.ts                               # buildTypesetterPrompt
    morphology.ts                               # buildMorphologyPrompt
    phase.ts                                    # buildPhasePrompt
    index.ts                                    # public re-exports
  passes/
    skeleton.ts                                 # runSkeletonPass (pure)
    anatomist.ts                                # runAnatomistPass (pure)
    lexicographer.ts                            # runLexicographerPass (pure, with DPD context as a pass concern)
    weaver.ts                                   # runWeaverPass (pure)
    typesetter.ts                               # runTypesetterPass (pure)
    morphology.ts                               # runMorphologyPass (pure)
    types.ts                                    # PassName, LLMCaller, PassCallResult, etc.
    index.ts                                    # public re-exports
  schemas.ts                                    # consolidated structured-output schemas
  llm.ts                                        # single callCompilerLLM with optional LLMCaller injection
  orchestrator.ts                               # compileSuttaStudioPacket — composition + state + telemetry
  utils.ts                                      # buildBoundaryContext, chunkPhases, parseJsonResponse, etc.
  index.ts                                      # public-facing barrel for the whole module

# Existing public-facing files become thin re-exports (transitional):
services/suttaStudioCompiler.ts        → re-export from services/sutta-studio/index
services/suttaStudioPassRunners.ts     → re-export from services/sutta-studio/passes
services/suttaStudioLLM.ts             → re-export from services/sutta-studio/llm

# These get deleted in Phase 4 cleanup, after a transition period:
services/compiler/                     ← old production stack
services/suttaStudioPassPrompts.ts     ← old benchmark prompts
```

## Feature inventory — what migrates where

### Prompt builders (Phase 1)

| Pass | Current — compiler/prompts.ts | Current — suttaStudioPassPrompts.ts | Target — services/sutta-studio/prompts/* |
|---|---|---|---|
| **skeleton** | 1 builder | 1 builder (identical) | Merge: single builder |
| **anatomist** | 1 builder, 1 example (PHASE_A) | 1 builder, 3 examples (PHASE_A + PHASE_B + REFRAIN) | Take the 3-example version; keep the no-DPD signature (anatomist doesn't need DPD) |
| **lexicographer** | 1 builder, has `dpdLookups` param, has DPD block | 1 builder, has ripple example + RIPPLE_EXAMPLE_JSON | **Merge:** DPD context + ripple example + senses block |
| **weaver** | 1 builder | 1 builder, has ANTI_PATTERN | Take the version with ANTI_PATTERN |
| **typesetter** | 1 builder (with `log` calls) | 1 builder (with optional `logger` injection) | Take the injectable-logger version |
| **morphology** | 1 builder | 1 builder | Merge: identical |
| **phase** | 1 builder | 1 builder | Merge: identical |

V2 amendments wire in here, one place, exactly once.

### Pass runners (Phase 2)

`services/suttaStudioPassRunners.ts` (586 lines) already has clean per-pass functions. The migration is:

1. Move each `runXPass` into `services/sutta-studio/passes/<pass>.ts`
2. Each pass becomes a **pure function** — receives inputs + prompt + LLMCaller + schema → returns output. No telemetry calls from inside.
3. DPD context for the lexicographer pass moves OUT of `compiler/index.ts` and INTO `passes/lexicographer.ts` (where it conceptually belongs — it's a lexicographer concern, not an orchestrator concern).
4. `compileSuttaStudioPacket` in `services/sutta-studio/orchestrator.ts` becomes a thin composer:
   ```ts
   const skeleton = await runSkeletonPass(...)
   for (const phase of skeleton.phases) {
     const anatomist = await runAnatomistPass(...)
     onProgress({ stage: 'phase', ... })
     const lexico = await runLexicographerPass({...dpdContext})
     recordPhaseDuration(...)
     // ... etc
   }
   ```
   Orchestration concerns (telemetry, progress, retrieval, validation, rehydration, throttling) wrap the pure passes; they don't live inside them.

### LLM caller (Phase 3)

| Concern | compiler/llm.ts (123 lines) | suttaStudioLLM.ts (154 lines) |
|---|---|---|
| Provider resolution | Yes | Yes |
| Model override | No | No (it's in compiler/index.ts) |
| Pipeline event logging | Yes (start + finish + error) | Yes (start + finish + error) |
| Performance timing | Yes | Yes |
| `LLMCaller` injection seam | No | No (benchmark wraps it externally) |
| Abort signal support | Yes | Yes |

These are 80% identical. The merged version lives at `services/sutta-studio/llm.ts` with one signature, plus an optional `LLMCaller` injection for tests. Benchmark scripts that currently bring their own caller can pass it as the `llmCaller` parameter on `runXPass`.

### Schemas, utils, etc. (Phase 2/3)

- `compiler/schemas.ts` (401 lines) — JSON schemas. Move as-is to `services/sutta-studio/schemas.ts`.
- `compiler/utils.ts` (218 lines) — buildBoundaryContext, chunkPhases, parseJsonResponse, computeSourceDigest, createCompilerThrottle, applyWordRangeToSegments, buildPhaseStateEnvelope, buildSourceRefs, BoundaryNote, SkeletonPhase. Move as-is to `services/sutta-studio/utils.ts`.
- `compiler/dictionary.ts` (137 lines) — fetchDictionaryEntry. Move to `services/sutta-studio/dictionary.ts`.
- `compiler/segments.ts` (51 lines) — fetchCanonicalSegmentsForUid. Move to `services/sutta-studio/segments.ts`.
- `compiler/skeleton.ts` (124 lines) — runSkeletonPass (already pure). Move to `services/sutta-studio/passes/skeleton.ts`. Note: there are TWO runSkeletonPass implementations today — compiler/skeleton.ts + suttaStudioPassRunners.ts. They both must be reconciled in Phase 2.

### Production orchestration concerns (Phase 2, wrapping)

These currently live in `compiler/index.ts` and must move to `services/sutta-studio/orchestrator.ts`:

- `applySuttaStudioModelOverride` (model-cost cap)
- `onProgress` callback management
- `recordPhaseDuration` / `getAveragePhaseDuration` telemetry
- `buildRetrievalContext` invocation (cross-chapter context for boundary phases)
- `validatePhase` / `validatePacket` calls
- `logPipelineEvent` calls
- `DictionaryCache` initialization
- `segmentCache` / `initializePipelineCaches`
- `rehydratePhase` / `dedupeEnglishStructure` / `buildDegradedPhaseView` (error-path recovery)
- `tokenizeEnglish` / `getWordTokens` (for Weaver input prep)
- DPD provider initialization (`new DpdProvider`, `getBundledDpdData()`)
- `computeSourceDigest`
- `createCompilerThrottle` (rate limiting)

These are PRODUCTION concerns. Benchmark doesn't need most of them. Keeping them OUTSIDE the pure pass functions is the architectural unlock.

## Migration order (by phase)

### Phase 0 — Design (this doc) — **DONE when you read this**

No code changes. Inventory + plan. Reviewed by user before Phase 1.

### Phase 1 — Single prompts module (`services/sutta-studio/prompts/`)

**Scope:**
1. Create `services/sutta-studio/prompts/` directory with one file per pass.
2. Each file MERGES the best-of-both for its pass per the table above.
3. Wire `SUTTA_STUDIO_V2_AMENDMENTS` in ONE place — the canonical builder for each pass that needs it (Anatomist, Lexicographer, Phase).
4. Update `services/compiler/prompts.ts` to be a thin re-export shim from the new location.
5. Update `services/suttaStudioPassPrompts.ts` to be a thin re-export shim from the new location.
6. Run `npm test` — all 300+ tests should pass without modification (signatures unchanged).
7. Smoke-test the live UI compile in the worktree (manual) — confirm output unchanged at the structural level.

**Files touched (estimate):**
- NEW: 8 files in `services/sutta-studio/prompts/` (7 builders + index.ts)
- MODIFIED: `services/compiler/prompts.ts` (becomes ~10 lines of re-exports)
- MODIFIED: `services/suttaStudioPassPrompts.ts` (becomes ~10 lines of re-exports)

**Risk:** Low. Signatures preserved; consumers unchanged.

**Effort:** ~3-4 hours.

### Phase 2 — Canonical pass functions (`services/sutta-studio/passes/`)

**Scope:**
1. Create `services/sutta-studio/passes/` with one file per pass.
2. Move `runXPass` from `suttaStudioPassRunners.ts`. Make each pass a pure function: explicit deps in signature, no calls to telemetry/retrieval/validation from inside.
3. Port the DPD-context-building logic from `compiler/index.ts` into `passes/lexicographer.ts` so the pass declares its dependency on DPD explicitly.
4. Create `services/sutta-studio/orchestrator.ts` — `compileSuttaStudioPacket` as a composition. All the production orchestration concerns (listed above) live here.
5. Update `services/compiler/index.ts` to be a re-export shim from the new orchestrator.
6. Update `services/suttaStudioPassRunners.ts` to be a re-export shim from new `passes/`.
7. Move `schemas.ts`, `utils.ts`, `dictionary.ts`, `segments.ts` from `compiler/` to `services/sutta-studio/`.
8. Run full test suite + smoke-test the live UI compile.

**Files touched (estimate):**
- NEW: 8 files in `services/sutta-studio/passes/` (7 passes + types/index)
- NEW: `services/sutta-studio/orchestrator.ts`
- NEW: `services/sutta-studio/schemas.ts`, `utils.ts`, `dictionary.ts`, `segments.ts`
- MODIFIED: `services/compiler/index.ts` (becomes thin shim)
- MODIFIED: `services/suttaStudioPassRunners.ts` (becomes thin shim)

**Risk:** Medium. Two `runSkeletonPass` implementations exist today (compiler/skeleton.ts + suttaStudioPassRunners.ts:96) — these must be reconciled. The DPD context port needs careful behavioral testing. Lots of code moves; one missed import could break the live UI.

**Effort:** ~4-6 hours.

### Phase 3 — Single LLM caller — **DONE 2026-05-16**

**What landed:**
1. Created `services/sutta-studio/llm.ts` as the canonical caller — based on the richer suttaStudioLLM
   shape (typed `CompilerLLMOptions` / `CompilerLLMResult` exports, `providerPreferences` pass-through,
   plus a `callCompilerLLMText` string-return convenience wrapper).
2. `services/suttaStudioLLM.ts` → re-export shim from the canonical.
3. `services/compiler/llm.ts` → re-export shim that aliases `callCompilerLLMText AS callCompilerLLM`
   to preserve the legacy string-return contract for the 7 existing call sites in compiler/index.ts +
   compiler/skeleton.ts with zero call-site churn. Those consumers will move to the rich signature
   when the orchestrator is ported (Phase 2d / PR D).
4. `services/sutta-studio/passes/_defaultCaller.ts` and `passes/types.ts` updated to import canonical
   directly rather than the (now-shim) suttaStudioLLM path.

**Earlier confusion (why this phase was reopened):** task tracking marked Phase 3 complete after
Phase 2 landed, but no `services/sutta-studio/llm.ts` ever existed and both legacy files remained
concrete. The 2026-05-16 doc audit (Phase 0 → Phase 5 of the doc-audit skill, scoped to Sutta Studio)
caught the divergence and surfaced it as a P0 DRIFT finding. This PR closes it.

**Risk paid:** Low. Both call patterns (string-returning legacy via compiler/llm.ts, rich-returning
canonical via sutta-studio/llm.ts) preserved exactly; full test suite green.

### Phase 4 — Cleanup + rework PR #50

**Scope:**
1. Check whether the re-export shims (suttaStudioCompiler.ts, suttaStudioPassRunners.ts, suttaStudioLLM.ts, compiler/prompts.ts, suttaStudioPassPrompts.ts, compiler/index.ts) can be DELETED — i.e., are all consumers updated to import from the new canonical path?
   - SuttaStudioApp.tsx imports `compileSuttaStudioPacket` from `services/suttaStudioCompiler` — update to `services/sutta-studio`.
   - Benchmark scripts import from `services/suttaStudioPassRunners` — update to `services/sutta-studio/passes`.
   - If all consumers updated, delete the shims.
2. Delete the `services/compiler/` directory if fully migrated.
3. Rework PR #50 — the double-wire commits become a single one-line wire in the consolidated builder. Reset PR #50's branch to the post-consolidation state.
4. Update `CLAUDE.md` / `AGENTS.md` / docs to reflect the new file structure.
5. Full test suite + manual UI smoke + benchmark CLI smoke.

**Risk:** Low. Just cleanup.

**Effort:** ~1-2 hours.

## Test strategy

| Layer | What we verify | How |
|---|---|---|
| **Prompt builder output** | Byte-for-byte identical for v1 inputs (no V2 yet for benchmark); structurally identical with V2 added for production | Unit-test asserting `buildAnatomistPrompt(...).includes('PHASE_B example')` etc. Add ~5 minimal tests per pass. |
| **Pass function I/O** | runXPass output unchanged for fixed inputs (use existing benchmark golden fixtures) | Run `npm run sutta:lookup` and benchmark fixtures pre- and post-refactor; diff results. |
| **Orchestrator end-to-end** | compileSuttaStudioPacket produces packet with same shape, segments, phases | Smoke-test in UI: open /sutta/demo, hit compile, compare DOM tree (paliWords count, phase count, senses count per phase). |
| **Benchmark CLI** | `tsx scripts/sutta-studio/benchmark.ts` runs to completion, produces expected leaderboard | Run before refactor (capture metrics CSV); run after; diff for behavior preservation. |
| **Existing test suite** | All ~300 tests pass | `npm test` |

**Behavior contract:** the refactor MUST NOT change observable behavior of either compile path. This is a pure structural refactor. Any observed behavior delta means we've introduced a regression.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Two `runSkeletonPass` implementations diverge silently | High (they exist already) | Production output changes | In Phase 2, diff the two implementations line-by-line; pick the production one (more recently maintained) as canonical; explicitly note any differences in the commit message |
| DPD context port changes lexicographer output | Medium | Subtle output drift | Smoke-test phase-1 (DPD-heavy) compile pre/post; compare DPD entries in resulting senses |
| A missed import breaks the live UI | High (lots of moves) | Production broken | Phase 1 + 2 each end with a manual UI smoke test before merge; use re-export shims aggressively until Phase 4 |
| The benchmark scripts depend on internal types we move | Medium | Benchmark broken | Run `tsx scripts/sutta-studio/benchmark.ts --dry-run` after each phase |
| The refactor takes >2 sessions, partial state lands | Medium | Confused codebase | Each phase ends with a fully-working state; partial refactors are NOT pushed |
| `compiler/index.ts` has hidden cross-pass coupling | Medium | Orchestrator port is hard | Read all 675 lines BEFORE starting Phase 2; map every cross-pass call |

## Backward compatibility plan

Throughout Phases 1-3, the old public-facing paths continue to work via re-export shims:

```ts
// services/compiler/prompts.ts — after Phase 1:
export * from '../sutta-studio/prompts';

// services/suttaStudioPassRunners.ts — after Phase 2:
export * from './sutta-studio/passes';
```

This means:
- `SuttaStudioApp.tsx` keeps importing from `services/suttaStudioCompiler`
- Benchmark scripts keep importing from `services/suttaStudioPassRunners`
- No "big bang" import-update PR

Phase 4 is when (and only when) we update consumers to import from the new canonical path AND delete the shims.

## What does NOT change in this refactor

- **The prompt content itself** (other than gaining V2 amendments in one place instead of two).
- **The pipeline pass order** (Skeleton → Anatomist → Lexicographer → **Grounding** → Weaver → Typesetter → Phase → Morphology). Grounding was inserted between Lexicographer and Weaver in 2026-05-14 (task #47, GROUNDING.md Phase 2.5); the consolidation refactor preserves this order.
- **The compiler's public API signatures.** `compileSuttaStudioPacket(options)` keeps the exact same options.
- **Benchmark output format / leaderboard schema.**
- **The CLAUDE.md / AGENTS.md multi-agent coordination rules.**
- **Test coverage shape** (we may add small unit tests; we won't remove any).

## Open questions for review

1. **Naming of the new module:** `services/sutta-studio/` (kebab-case dir) vs `services/suttaStudio/` (camelCase, matching existing file naming). Lean kebab-case for directories per common JS/TS convention; the existing files use camelCase only because they're at the services root. **Proposal: kebab-case.**

2. **Should orchestrator concerns (telemetry, retrieval) be testable in isolation?** Current proposal puts them all in `orchestrator.ts`. Alternative: factor into `services/sutta-studio/orchestration/{telemetry,retrieval,validation,rehydration}.ts`. **Lean: defer that factoring; the orchestrator at ~200-300 lines is reviewable as one file.**

3. **The "benchmark wraps its own LLMCaller" pattern:** does the refactored `runXPass` accept `llmCaller` as a required positional arg, or as an optional named option that defaults to the production caller? **Lean: optional named option, defaults to production caller (so production code doesn't need to pass it explicitly).**

4. **Pull SUTTA_STUDIO_PROMPT_VERSION semantics:** the version key currently bumps when prompts change. After consolidation, do we bump it again to mark the refactor? **Proposal: yes — bump to `v12-consolidation` so benchmark leaderboards can distinguish pre/post-refactor runs.**

5. **Should `config/suttaStudioPromptContext.ts` and `config/suttaStudioPromptContextV2.ts` move into `services/sutta-studio/prompts/contexts.ts`?** They're imported only by the prompt builders. Moving them would centralize. **Lean: defer (Phase 5, if ever). Config in `config/` is the existing convention; not worth touching now.**

6. **Should `config/suttaStudioExamples.ts` move similarly?** Same reasoning as #5. **Lean: defer.**

## How to resume in a future session

1. Read this doc first.
2. Check the most recent commit on `feat/opus-compiler-consolidation` to see which phase is done.
3. Run `npm test` and the benchmark CLI smoke to confirm the working state.
4. Pick up from the next phase. Each phase ends in a fully-working state; partial phases are not committed.

## Sign-off

This is Phase 0. Phase 1 begins after review. If the design changes substantively during Phase 1 implementation, update this doc before proceeding to Phase 2.
