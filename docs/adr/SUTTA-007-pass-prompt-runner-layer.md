# SUTTA-007: Sutta Studio Pass Prompt & Runner Layer

**Status:** Implemented
**Date:** 2026-03-05
**Domain:** Sutta Studio Pipeline

---

## Context

The Sutta Studio pipeline runs Pali text through five sequential LLM passes (Skeleton →
Anatomist → Lexicographer → Weaver → Typesetter) before producing a `DeepLoomPacket`.

There are two parallel implementations of this pipeline logic:

| Layer | Files | Used by |
|-------|-------|---------|
| **App pipeline** | `services/compiler/` (8 modules) | `SuttaStudioApp.tsx` (production UI) |
| **Script/benchmark layer** | `suttaStudioPassPrompts.ts` + `suttaStudioPassRunners.ts` | `scripts/sutta-studio/` tooling only |

This ADR documents the script/benchmark layer, which predates and inspired the cleaner
compiler module decomposition.

---

## suttaStudioPassPrompts.ts (~723 LOC)

**Role:** Prompt layer — schemas, builders, types, and parsing utilities.

**What it contains:**

| Export | Purpose |
|--------|---------|
| `skeletonResponseSchema` … `morphResponseSchema` | 7 JSON schemas for structured LLM outputs |
| `PhaseStageKey`, `BoundaryNote`, `SkeletonPhase` | Core pipeline types |
| `buildSkeletonPrompt` … `buildMorphologyPrompt` | 7 prompt builder functions (one per pass) |
| `buildPhaseStateEnvelope` | State context injected into every pass prompt |
| `buildBoundaryContext` | Sutta chapter boundary annotations |
| `parseJsonResponse<T>` | LLM response parser with balanced-JSON fallback |

**Why a single file (not yet split):** The prompt builders are tightly coupled to the schemas
and types they reference. They are tuned together during benchmarking — splitting them would
require cross-file imports for every prompt tweak. Unlike the production compiler (where
isolation aids maintainability), the benchmark layer prioritises iteration speed over
structural purity.

---

## suttaStudioPassRunners.ts (~586 LOC)

**Role:** Execution layer — per-pass async runner functions that call the LLM, handle errors,
and return typed result objects.

**What it contains:**

| Export | Purpose |
|--------|---------|
| `PassName` | Union type: `'skeleton' | 'anatomist' | …` |
| `LLMCaller` | Injectable LLM caller interface (for testability) |
| `PassCallResult<T>` | Typed wrapper for each pass result (output + LLM metadata + error) |
| `SkeletonRunResult`, `SkeletonChunkResult` | Skeleton-specific result shapes |
| `runSkeletonPass` | Runs skeleton chunking loop |
| `runAnatomistPass` | Runs anatomist pass for a single phase |
| `runLexicographerPass` | Runs lexicographer pass for a single phase |
| `runWeaverPass` | Runs weaver pass for a single phase |
| `runTypesetterPass` | Runs typesetter pass for a single phase |
| `runMorphologyPass` | Runs morphology (token analysis) pass |

Each runner accepts an injectable `LLMCaller` parameter, making it usable from both the
benchmark harness and future unit tests without a live provider.

---

## Relationship to services/compiler/

The `services/compiler/` module (decomposed March 2026) is the production path. It:
- Is used by `SuttaStudioApp.tsx`
- Has tighter error handling and progress callbacks
- Has the same pass logic but is not designed for external scripting

The pass-runner layer is the **benchmark harness interface** — it exposes each pass
individually so scripts can test model quality on isolated passes without running the
full pipeline.

**They should not be merged.** The compiler serves the UI; the runners serve the scripts.
Merging would couple production error-handling concerns to benchmark flexibility requirements.

---

## Amendment — Reversed by CONSOLIDATION (2026-05-16)

The "should not be merged" claim above was **reversed** by `docs/sutta-studio/CONSOLIDATION.md`
(landed across 2026-03-08 → 2026-05-16, PRs #62 and #63). Operational experience showed the
two stacks drifting in opposite directions — the bench-side prompts/schemas gained `wordRange`
and `refrainId` fields that production needed but the production schema didn't enforce;
production gained DPD wiring and structured-output telemetry the bench stack lacked.

The cost of *not* merging turned out to be silent feature divergence at exactly the boundary
where alignment matters most (schema contracts and prompt content). The current arrangement:

- All prompt builders, schemas, pass functions, and the LLM caller live under
  `services/sutta-studio/` (canonical single location).
- The two files described here (`suttaStudioPassPrompts.ts`, `suttaStudioPassRunners.ts`) are
  now thin re-export shims to be deleted in CONSOLIDATION Phase 4.
- Benchmark flexibility is preserved via an injectable `LLMCaller` parameter on the canonical
  pass functions, not by maintaining a parallel implementation.

The architectural principle "production error-handling concerns differ from benchmark
flexibility requirements" is still correct; it just doesn't require two separate codebases.
It requires injection seams.

---

## Implementation Notes (original — now superseded by Amendment above)

**Files (pre-CONSOLIDATION state, kept for historical context):**
- `services/suttaStudioPassPrompts.ts` (~723 LOC at the time of writing; now a 47-line shim)
- `services/suttaStudioPassRunners.ts` (~586 LOC at the time of writing; now a 35-line shim)
- Primary consumer: `scripts/sutta-studio/benchmark.ts` (still true; now consumes via the shims)

**Deviations from proposal:** See Amendment above. The original ADR was written to document
existing code at a moment when the two stacks aligned; subsequent drift forced the merger.

---

## Known Debt

| Item | Severity | Notes |
|------|----------|-------|
| No unit tests | Medium | Pass runners accept injectable `LLMCaller` — ideal seam for mocking |
| `suttaStudioPassPrompts.ts` contains types now duplicated in `services/compiler/utils.ts` | Low | `SkeletonPhase`, `BoundaryNote`, `PhaseStageKey` exist in both. Could unify if scripts are ever migrated to use compiler/ types |
| No decomposition plan | Low | 723 LOC is at the upper edge of "review" threshold. Suggested split: schemas → `passSchemas.ts`, builders → `passPromptBuilders.ts`, utils → `passUtils.ts` |

---

## Related

- [SUTTA-003](./SUTTA-003-sutta-studio-mvp.md) — Sutta Studio MVP design
- [SUTTA-006](./SUTTA-006-pipeline-caching-architecture.md) — Pipeline caching
- `services/compiler/` — Production pipeline (decomposed from `suttaStudioCompiler.ts`)
- `scripts/sutta-studio/benchmark.ts` — Primary consumer of the runner layer
