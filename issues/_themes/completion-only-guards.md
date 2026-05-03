# Theme — Completion-Only Guards

## Statement

> "Run once" guards check **completion** state (`isInitialized`, `wasRegistered`, `hasFetched`) and not **in-flight** state. Under any concurrent caller — React StrictMode double-mount, double-click, two effect dependencies, two slice subscribers — both calls observe `not yet completed`, both fall through, both run the work in parallel.

## The shape

```ts
async function ensureX() {
  if (state.xIsDone) return;     // ← only catches sequential re-entry
  // ... long async work ...
  state.xIsDone = true;          // ← only flips at the end
}
```

In a single-caller world, this is fine. In any world with concurrent callers, two parallel pipelines run end-to-end. The bug is silent in production (different concurrency profile than dev), then surfaces in dev as doubled console output, doubled HTTP calls, or interleaved telemetry.

## The fix shape (this is a theme doc, not the ADR — sketch only)

Three vision-compatible options:

1. **Promise memoization** — first caller starts the work and caches the promise; concurrent callers await the same promise. Clear the cache on error so retry is possible.
2. **`isInitializing` flag flipped on entry, cleared in `finally`** — concurrent callers observe in-flight and either wait or no-op.
3. **At the call site, dedupe via `useRef` + a single-fire effect** — pushes the dedupe to the consumer; rarely the right level for shared infrastructure.

## Instances (current)

| # | What runs twice | Class | Status |
|---|---|---|---|
| 1 | `initializeStore` runs end-to-end concurrently under StrictMode | `(A1*, B2, C2)` | **confirmed** |
| 7 | Provider registration runs repeatedly | `(A2, B2, C1)` | suspected |
| 9 | Suspected — chapter change may re-fire load when navigation effect runs twice | `(A1*, B2, C2)` | suspected |
| 12 | Background preload spinner restarts from scratch on tab return | `(A1*, B2, C1)` | suspected |
| ~~2~~ | ~~Fan toggle re-triggers translation~~ | — | **REFUTED** (2026-05-02) — codebase has dual-layer in-flight guards: mediator + `handleTranslate` entry-check. See [issue #2](../02-fan-toggle-restarts-translation/) |

The N=4 (was 5) is meaningful: even after removing one false positive, the theme still has multiple confirmed/suspected instances. It also produced a useful **falsifiable prediction** that was tested — the matrix is doing real work, not just decorating issues.

## Existing spec coverage (ADR audit — 2026-05-02)

| ADR | What it commits to | Distance to this theme |
|---|---|---|
| **DB-002** (Atomic Transaction Boundaries, *Implemented 2026-03-05*) | Full "Idempotency & Retry Strategy" section. Idempotency keys for `generateTranslationIdempotent`, `generateImageIdempotent`. "Final dedup check inside transaction." `Promise.race` for timeouts. Tested under "4 simultaneous tabs" | **Strong precedent at the data-op layer** — the *philosophy* of single-flight already exists in this codebase, just not at the call-site layer where #1, #2, #7, #9, #12 live |

**The gap**: DB-002 protects writes against concurrent callers. Nothing protects `initializeStore`, provider registration, registry fetches, or hydration from being entered twice. The pattern is half-implemented — defended at the database, undefended at the call site.

This is actually a **good** state for proposing CORE-009: the codebase already accepts that idempotency-keys are the right shape. The new ADR extends an existing pattern instead of introducing a foreign one.

## Leverage point

**Write the missing ADR.** Working title: `CORE-009-single-flight-at-call-sites` (note: scope is call-sites, since DB-002 owns the data-layer).

Content sketch:

- **Invariant**: any function whose intent is "run at most once for a given key" must use a single-flight wrapper. Completion-only guards are forbidden.
- **Provide the wrapper**: a small utility (`utils/singleFlight.ts` or similar) that takes `(key, fn)` and returns a promise; concurrent calls with the same key share the promise; errors clear the cache. ~30 lines.
- **Apply it to the canonical sites**: `initializeStore`, provider registration, registry fetches, navigation hydration, chapter loaders.
- **Test pattern**: every site gets a "two concurrent calls do the work once" test. Becomes a boilerplate test that's easy to write per-site.

Once that ADR + utility exist, issues 1, 2, 7, 9, 12 collapse to "wrap the entry point" tasks.

## Why this gets re-introduced

From the archaeology on issue #1: the broken guard at `initializeStore.ts:454` was added in a commit titled `fix: remove 15 unnecessary 'as any' casts`. The agent looked at concurrent-init under StrictMode, wrote a guard that *looked* correct, and bundled it into a cleanup commit. No test forced the guard to actually work.

This is what the theme *predicts* keeps happening: sees the symptom (double-mount), writes the obvious-looking fix, doesn't test the concurrency. The leverage point of "have a single-flight wrapper that the codebase prefers" makes the obvious-looking fix become the correct fix automatically.

## Connection to other themes

- **silent-failure-deep**: when a single-flight call fails, the cache must clear so retry can happen. Otherwise the cache becomes a stuck-failure.
- **jit-vs-precompute**: the single-flight wrapper is itself an "anticipative pre-compute" — the second caller doesn't redo work, but the value is JIT (computed at first request, not at boot).
