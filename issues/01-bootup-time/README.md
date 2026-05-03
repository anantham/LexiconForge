# Issue 1 — Boot time is 31.6s

> Status: **investigated** · Last updated: 2026-05-02 · Investigator: Opus 4.7

## TL;DR

**Reproduced live (2026-05-02).** With `?novel=forty-millenniums-of-cultivation&version=v1-composite&chapter=lexiconforge%3A%2F%2F…%2F339`, total init = **21,696 ms** on the user's running dev server — the same order of magnitude as the user's 31.6s trace. The 9s difference is plausibly network speed.

But the slow boot is a *symptom*. The real story is:

1. **StrictMode runs the entire init pipeline twice in parallel**, including 6+ duplicated network calls (registry + per-novel metadata) per page load.
2. **`RegistryService.resolveCompatibleVersion` silently remaps the requested version** (`v1-composite → v1-st-enhanced`) and only logs a warning.
3. **`ImportService` is told to import under the remapped scope**, but the session JSON's chapters are tagged with the *original* scope.
4. **Import runs for ~20 seconds processing chapters** before scope-validation throws on `Chapter 1000: Five` — far from the user's actual chapter 339.
5. The whole thing fails with `[Import] Scoped stableId scope mismatch`, the user sees no chapter rendered, nothing in the UI explains why.

So this isn't a "boot is slow" bug. It's a **silent data-integrity failure that happens to take 20s to surface**. Six independent defects, all in the boot path:

| # | Defect | File |
|---|---|---|
| 1 | StrictMode in-flight guard missing — pipeline runs twice | `store/bootstrap/initializeStore.ts:454` |
| 2 | Module-global telemetry array shared across concurrent runs | `store/bootstrap/initializeStore.ts:28-30` |
| 3 | `handleBootstrapIntents` and below emit zero `bootstrapLog` marks | `store/bootstrap/initializeStore.ts:319-352` |
| 4 | Slow `ImportService.importFromUrl` blocks `initializeStore` instead of streaming | `store/bootstrap/initializeStore.ts:262` |
| 5 | `RegistryService.resolveCompatibleVersion` silently remaps versions to ones the import path can't honor | `services/registryService.ts` |
| 6 | `ImportService` scope-validation fails per-chapter deep into import instead of fail-fast at request time | `services/importService.ts` |

## 1. Claim (verbatim from Issues.md)

> **fix boot up time** ----ok let me be clear ----
> initializeStore.ts:62
> [...full table of 45 boot marks omitted; key entries:]
> · 38 `bootRepairs complete` 0 23
> · 39 `loadUrlMappings start` **31583** 31606
> · 44 `initializeStore complete – isInitialized true` 0 31650
> Total init time: 31650ms
>
> Codex's analysis (the deep-link phase is opaque, the guard is only `isInitialized`, telemetry is module-global) is in `Issues.md` and is the starting point for this investigation.

The full quoted claim is preserved in the seed stub of this file before this rewrite — see `git log -- issues/01-bootup-time/README.md` for the original.

## 2. Reproduction

**Harness:** [`traces/repro.mjs`](./traces/repro.mjs) — standalone Playwright script. Auto-starts a Vite dev server on `127.0.0.1:5191`, opens fresh browser contexts, captures every `[Store:init …]` console line and the `Total init time` summary.

```bash
node issues/01-bootup-time/traces/repro.mjs
```

**Result file:** [`traces/repro-result.json`](./traces/repro-result.json).

| Scenario | totalInitMs | beginCount | skippedCount | navTime |
|---|---:|---:|---:|---:|
| A: cold cache, no deep link (`/`) | 5008 | **2** | 0 | 5024 |
| B: cold cache, `/?novel=forty-millenniums-of-cultivation` | 842 | **2** | 0 | 981 |
| C: warm cache, same deep link | 366 | **2** | 0 | 609 |

**Headline 31.6s did not reproduce.** Likely because:
- The fresh test profile's `forty-millenniums-of-cultivation` registry record either has no `sessionJsonUrl` reachable from the test env, or the file is small/cached on the dev machine. The user's slow trace was almost certainly a real `ImportService.importFromUrl` against a multi-MB session JSON — which my fresh harness skipped through.
- Once we have a known-slow `sessionJsonUrl` (e.g. one of the registry's larger novels), this same harness will reproduce the 30s-ish gap.

**The duplicate-pipeline symptom *did* reproduce, in every scenario.** Every step prints twice in [`traces/repro-result.json`](./traces/repro-result.json):

```
[Store:init +4782ms Δ0ms] initializeStore – begin
[Store:init +4783ms Δ1ms] loadSettings invoked
[Store:init +4783ms Δ0ms] loadPromptTemplates start
[Store:init +4787ms Δ0ms] initializeStore – begin       ← 2nd StrictMode mount
[Store:init +4787ms Δ0ms] loadSettings invoked          ← runs in parallel
[Store:init +4787ms Δ0ms] loadPromptTemplates start
…
[Store:init +5008ms Δ20ms] audio initialization complete
[Store:init +5008ms Δ0ms] initializeStore complete – isInitialized true   ← 2nd
```

Neither pipeline ever prints `initializeStore – skipped (already initialized)` — meaning the guard at `store/bootstrap/initializeStore.ts:454` never fires.

**Verdict (initial run):** `reproduced` (for the duplicate-init defect and the absence of deep-link instrumentation) · `cannot-reproduce-locally` (for the 31.6s headline number, but the code path that explains it is identified). Confidence **0.92**.

### Live server reproduction (2026-05-02)

After the user started the dev server and provided the deep-link, I ran [`traces/repro-live.mjs`](./traces/repro-live.mjs) (chapter-only URL — fails fast at navigate, ~1s) and [`traces/repro-novel-deeplink.mjs`](./traces/repro-novel-deeplink.mjs) (full novel+version+chapter URL — the slow path).

**Full deep-link result:**
```
URL: /?novel=forty-millenniums-of-cultivation&version=v1-composite
     &chapter=lexiconforge%3A%2F%2Fforty-millenniums-of-cultivation%2Fchapter%2F339
totalInitMs = 21,696
begin = 2  (StrictMode duplicate)
navTime = 24,870 ms
```

**Console excerpt (relative timestamps; identical lines doubled = StrictMode pipeline):**
```
+0ms      [Registry] Fetched 3 novels
+0ms      [Registry] Fetched 3 novels                              ← double
+27ms     [Registry] Fetched metadata for Forty Millenniums of Cultivation
+28ms     [DeepLink] Requested version v1-composite resolved to v1-st-enhanced
+28ms     [DeepLink] Loading novel: Forty Millenniums of Cultivation
+31ms     [Registry] Fetched metadata for Forty Millenniums of Cultivation  ← double
+31ms     [DeepLink] Requested version v1-composite resolved to v1-st-enhanced ← double
+32ms     [DeepLink] Loading novel: Forty Millenniums of Cultivation         ← double

… 20+ seconds of silence (the uninstrumented import phase) …

+20442ms  [Store] Failed to import session data: Error: [Import] Scoped
          stableId scope mismatch while importing "Chapter 1000: Five".
          expectedScope="forty-millenniums-of-cultivation::v1-st-enhanced",
          actualScope="forty-millenniums-of-cu..."
+20443ms  [DeepLink] Failed to load novel: …same error…
+20800ms  [Registry] Fetched 3 novels                              ← refetch 3
+20800ms  [Registry] Fetched 3 novels                              ← × 2 = 4
+20812ms  [Registry] Fetched metadata for Forty Millenniums of Cultivation
+20812ms  [Registry] Fetched metadata for Forty Millenniums of Cultivation  ← double
+21287ms  [Registry] Fetched metadata for Eternal Life (×2)
+21296ms  [Registry] Fetched metadata for Dungeon Defense WN (×2)
```

**Network waste per page load:**
- 4 calls to `[Registry] Fetched 3 novels` (should be 1)
- 6 per-novel metadata calls (should be at most 3, ideally 1 if you only need FMC)
- ~20s spent processing chapters in an import that ultimately rolls back

**Verdict, post-live:** **real bug, reproduced**, with the 31s symptom now traced to a *failing* import (not a slow-but-successful one). Confidence **0.96**.

### Chapter-only URL is also broken (separate, fast-failing)

Your second URL — `?chapter=lexiconforge%3A%2F%2F…%2F339` with no `?novel=` — bails out in <1s with:
```
[Navigate] forty-millenniums-of-cultivation is not currently supported.
Currently supported sites: kakuyomu.jp, ncode.syosetu.com, dxmwx.org
```
because `handleNavigate` treats the host portion of `lexiconforge://…` as a site-adapter key. So the chapter-only deep-link form for internal `lexiconforge://` URLs simply doesn't work; users have to include `?novel=` to land on a chapter. Worth its own issue, but related — same family of "URL params that look complete but aren't honored end-to-end".

## 3. Verdict

**Real bug — six of them, layered.** Three originally identified in `store/bootstrap/initializeStore.ts`; live reproduction added three more (silent version remap, deep-fail scope validation, doubled HTTP fetches).

## 4. Where the failure lives  (A / B / C)

**`(A1*, B2, C2)`** — confirmed, **upgraded from initial `(A2, B2, C2)` after ADR audit (2026-05-02).**

- **A1\*** (was A2): **CORE-006** *does* commit to the right behavior. From `docs/adr/CORE-006-tree-shakeable-service-architecture.md:281-302`:
  ```ts
  export async function initializeApp(): Promise<AppServices> {
    const criticalServices = await loadCriticalServices();  // db + nav + translation only
    renderAppShell(criticalServices);                       // render IMMEDIATELY
    loadOptionalFeatures();                                 // background, non-blocking
    return criticalServices;
  }
  ```
  And SLO: `featureLoading: '< 500ms from trigger'`. The ADR's `Status: Implemented (2026-03-05)` claim is what the asterisk flags — **the code does not in fact match the ADR**. This is ADR-vs-code drift, not under-specification.
- **B2**: Code falls short on multiple sub-axes — concurrent guard, telemetry isolation, deep-link instrumentation, single-flight network calls, request-boundary validation, audio-init in critical path. Each sub-axis is a B2 by itself.
- **C2**: Drifted from JIT vision. Init blocks rendering on a full session-JSON materialization where the vision calls for "render the requested chapter, lazily fill the rest."

**Implication.** The fix is not "write a new ADR." It's **"enforce CORE-006 with tests."** A failing test that asserts "init returns a render-able shell within Nms regardless of deep-link state" would have caught this and would prevent regression.

**Themes this issue instances:**

- [`_themes/jit-vs-precompute.md`](../_themes/jit-vs-precompute.md) — the deep-link import path materializes a full session before any view can render. Issues 11, 12, 15, 16 are likely siblings.
- [`_themes/completion-only-guards.md`](../_themes/completion-only-guards.md) — the `isInitialized`-only guard at line 454 is the canonical example of this generator. Same shape recurs in issues 2, 7, 9, 12.
- [`_themes/silent-failure-deep.md`](../_themes/silent-failure-deep.md) — the import runs ~20s before scope-validation throws on Chapter 1000; mismatch was determinable from the request.
- [`_themes/co-mingled-commits.md`](../_themes/co-mingled-commits.md) — the broken guard arrived inside a commit titled "remove 15 unnecessary `as any` casts". Process-level generator.

## 4a. Original verdict table (preserved for context)

| # | Defect | Confidence |
|---|---|---:|
| 1 | StrictMode allows two pipelines to run concurrently because the guard tests completion (`isInitialized`) but not in-flight state | 0.98 |
| 2 | Module-global `bootMarks/bootStart/lastMark` are shared across concurrent runs; `resetBootTelemetry()` is called by both, races, and produces interleaved doubled traces | 0.95 |
| 3 | The deep-link / import phase (`handleBootstrapIntents` and below) emits **no** `bootstrapLog` calls, so any latency there shows up as a single mystery delta in the table | 0.99 |
| 4 | `ImportService.importFromUrl` blocks `initializeStore` instead of streaming the requested chapter first — confirmed live, ~21s on user's machine for an import that ultimately *failed* | 0.97 |
| 5 | `RegistryService.resolveCompatibleVersion` silently remaps `v1-composite → v1-st-enhanced` ([live trace shows it](#live-server-reproduction-2026-05-02)). Downstream import expects the remapped scope, but the session JSON's chapters use the original scope, guaranteeing a mismatch | 0.95 |
| 6 | `ImportService` scope-validation fires per-chapter deep into a streaming pass (`Chapter 1000: Five`) instead of at request boundary; the user pays 20s before learning it can't work | 0.95 |
| 7 | StrictMode-doubled registry HTTP fetches: 4× `Fetched 3 novels` and 6× per-novel metadata calls per cold load. Wasted bandwidth, but more importantly a *correctness* signal that the same data is being fetched twice from racing pipelines | 0.99 |

## 4. Evidence and code paths

**Validation of Codex's line refs from `Issues.md` (line drift, not substance drift):**

| Codex claim | Current reality |
|---|---|
| `initializeStore.ts:445` (deep-link phase) | Now at line 478 — `handleBootstrapIntents(ctx, new URLSearchParams(window.location.search))` |
| `initializeStore.ts:237` (full import) | Now at line 247 — `loadNovelIntoStore` |
| `services/importService.ts:101` (full import) | Still in importService — `ImportService.importFromUrl` is invoked at `initializeStore.ts:262` |
| `initializeStore.ts:423` (guard) | Now at line 454 |
| `initializeStore.ts:28` (telemetry global) | Still lines 28-30 (`bootMarks`, `bootStart`, `lastMark`) |
| `MainApp.tsx:153` (init effect) | Confirmed line 153 |
| `index.tsx:14` (StrictMode) | Confirmed line 14 |

**Defect 1 — concurrent re-entry.** [`store/bootstrap/initializeStore.ts:451`](../../store/bootstrap/initializeStore.ts#L451):

```ts
return async () => {
  // Idempotency guard — prevents StrictMode double-init in dev
  if (ctx.get().isInitialized) {            // ← only checks completion
    bootstrapLog('initializeStore – skipped (already initialized)');
    return;
  }
  resetBootTelemetry();
  bootstrapLog('initializeStore – begin');
  …
  ctx.get().setInitialized(true);           // ← only flips at the very end
```

Both StrictMode mounts call `initializeStore()` ~5ms apart. Both observe `isInitialized === false` (the first call hasn't reached `setInitialized(true)` yet), both fall through, both run the pipeline.

**Defect 2 — module-global telemetry contamination.** [`store/bootstrap/initializeStore.ts:28`](../../store/bootstrap/initializeStore.ts#L28):

```ts
let bootMarks: BootMark[] = [];
let bootStart = 0;
let lastMark = 0;

const resetBootTelemetry = () => {
  bootMarks = []; bootStart = 0; lastMark = 0;
};
```

Concurrent run 2 calls `resetBootTelemetry()` at the moment run 1 has already pushed several marks → the array is wiped and re-filled with interleaved marks from both pipelines. The `flushBootTelemetry()` at the end then prints whatever happens to be in the array when one pipeline finishes; the second flush prints again. The user's trace in `Issues.md` showing back-to-back `urlMappingsBackfill done / normalizeStableIds start / urlMappingsBackfill done / normalizeStableIds start` (rows 17/18/22/23 in the original) is exactly this pattern.

**Defect 3 — uninstrumented deep-link phase.** [`store/bootstrap/initializeStore.ts:319-352`](../../store/bootstrap/initializeStore.ts#L319) (`handleBootstrapIntents`), [`L187-284`](../../store/bootstrap/initializeStore.ts#L187) (`handleNovelIntent`), [`L286-298`](../../store/bootstrap/initializeStore.ts#L286) (`handleChapterIntent`), [`L300-317`](../../store/bootstrap/initializeStore.ts#L300) (`handleImportIntent`). Total `bootstrapLog` calls in this region: **0.** Compare to `runBootRepairs` which emits 18+ marks in ~5ms. From the outside, a 31s `ImportService.importFromUrl` looks identical to a 50ms one.

The user's table (row 38 → 39):
```
38  'bootRepairs complete'        0      23
39  'loadUrlMappings start'  31583   31606
```
…is exactly the gap left by the un-instrumented `handleBootstrapIntents` phase running between Phase 1 and Phase 3 (line 478 in `initializeStore`).

## 5. Test coverage gap

Tests that touch `initializeStore`:

- [`tests/store/bootstrap/bootstrapHelpers.test.ts`](../../tests/store/bootstrap/bootstrapHelpers.test.ts) — 719 lines, mocks every dependency, calls `createInitializeStore(...)()` once per test. **Never invokes it twice concurrently. Never simulates StrictMode.**
- [`tests/store/appScreen.integration.test.tsx`](../../tests/store/appScreen.integration.test.tsx) — mocks `initializeStore` as `vi.fn().mockResolvedValue(undefined)`; does not exercise the real implementation.

**Gaps that should exist:**

1. **StrictMode double-invocation test** — call `createInitializeStore(ctx)()` twice without awaiting in between, assert that `loadSettings`, `runBootRepairs`, etc. were each called exactly once. This is the test that would have caught defects 1 and 2 the moment they shipped.
2. **Telemetry isolation test** — assert that two parallel `initializeStore()` calls produce a single coherent `boot-telemetry-history` entry, or two separate entries, but never an interleaved one.
3. **Deep-link instrumentation test** — assert that when `handleBootstrapIntents` is called with a `?novel=` param, at least N `bootstrapLog` marks fire between `bootRepairs complete` and `loadUrlMappings start`. Would catch any future regression where someone removes the (still-to-be-added) instrumentation.
4. **End-to-end boot-time SLO** — Playwright test that boots cold and asserts `totalInitMs < 5000` for the no-deep-link case and `< Xms` for the deep-link case. Would catch regressions even with no understanding of the cause.

None of these exist. The investigation harness in `traces/repro.mjs` is the closest thing the repo has to (4) and could be promoted to a real test.

## 6. Archaeology

Run: `python3 scripts/issue-archaeology.py store/bootstrap/initializeStore.ts --git`. Four sessions edited the file; combined with `git blame` on the suspect lines:

### Session timeline

| Session | Date | Model | First user prompt (excerpt) | What landed |
|---|---|---|---|---|
| `92ad916d-9a32-401b-a0c2-4b30b84e20c1` | 2025-12-27 | claude-opus-4-5-20251101 | "can we look at all the branches and see if it is safe to merge into main?" | Pre-existing edits; not implicated in the boot bug |
| `ff1cc5a6-86e3-4149-b296-1f4f7a327cb3` | 2026-01-29 | claude-opus-4-5-20251101 | "Refining debug file naming with fresh timestamps…" | Edits unrelated to boot path |
| `fb24700c-3f35-4857-b41e-55860ca61260` | 2026-04-04…06 | **claude-opus-4-6** | (continuation of FMC glossary import work) | **Added the broken idempotency guard** (commit `ff3106cd`, lines 453-457). Edit at 2026-04-05T17:45:54Z |
| `e9b48c0c-ec7d-4c25-8050-b3c377af161b` | 2026-04-05…06 | **claude-opus-4-6** | "[Image #1] when I click on a book in the library shelf I don't want this weird side bar to appear, just start reading…" | **Added boot telemetry as module-globals** (commit `ae260fe5`, lines 29-30) and later `resetBootTelemetry` (commit `c973b304`, lines 28, 32-37) |

### Commit timeline (most-recent first)

| Commit | Date | Title | Touches lines | Notes |
|---|---|---|---|---|
| `e1de26ad` | 2026-04-10 | `chore: telemetry improvements and bug fix in MaintenanceOps` | 460 | Cosmetic |
| `c973b304` | 2026-04-06 | `fix: fetch transport hardening — SSRF, SuttaCentral bypass, TOC consistency` | 28, 32-37, 458 | Added `resetBootTelemetry()` — patched the symptom of telemetry globals, not the disease |
| `ff3106cd` | 2026-04-05 13:47 EDT | `fix: remove 15 unnecessary 'as any' casts on TranslationResult properties` | 453-457 | **Title and content disagree.** The "as any" cleanup commit also slipped in the broken idempotency guard. The guard's design (`if (isInitialized) return;`) is a single-mount fix that doesn't survive StrictMode; no test was added |
| `ae260fe5` | 2026-04-05 08:02 EDT | `feat: boot telemetry + DRY repair loop` (Co-Authored-By: Claude Opus 4.6) | 29-30, +93 lines | Introduced module-global telemetry state under the implicit assumption that init is sequential |
| `326b4e88` | 2026-03-29 | `feat(shelf): app shell routing + bootstrap refactor` | 452, 459 | Created `createInitializeStore` skeleton; no guard at this point |
| `056bb75a` | 2025-11-18 | `refactor(db): remove legacy indexedDB facade` | (file existed earlier with different shape) | Pre-history |

### What the agents had to go on

- The author of `ff3106cd` (the guard) was working in a session whose nominal goal was glossary import (`fb24700c`'s first prompt was about generating `lexiconforge-glossary-v1` JSON for FMC). The guard appears to be a "while I'm here, this looks wrong" tweak — the problem is it was tweaked without a test that would have demonstrated whether the guard works.
- The author of `ae260fe5` (telemetry) was writing a feature, not a defensive structure. Module-globals are a reasonable choice for a single-pipeline scenario; the fault is upstream — there is no architectural commitment in this codebase that init *must* be single-pipeline.

## 7. Generator function

**The class of mistake (multi-instance):**

> **"Idempotency by checking completion-state, not in-flight-state."**
>
> When an async function should run at most once, it must guard with a flag that flips *immediately on entry*, not at completion. Otherwise, any concurrent caller (StrictMode double-mount, double-click, two route effects, two slice subscribers) will pass the guard. The fix is one of:
> - cache the in-flight `Promise` (`if (this.initPromise) return this.initPromise; this.initPromise = (async () => {...})(); …`)
> - flip an `isInitializing` flag at the top, clear it in a `finally`
> - or, at the call site, dedupe via a `useRef` and a single-fire effect

A second, related generator:

> **"Module-globals as per-call scratch space."**
>
> Anything written into a module-level `let` becomes shared state across *every* caller of the module's functions. If two callers can ever overlap in time, they will corrupt each other. The fix is to scope state to the call (closure variable, function parameter, or `WeakMap` keyed by the caller).

A third, meta-level:

> **"Co-mingled commits."**
>
> Commit `ff3106cd` is titled `fix: remove 15 unnecessary 'as any' casts` but also adds a control-flow guard. A reviewer (human or AI) reading the title will skim the diff for cast removals and miss the live-fire control change. This is a process generator, not a code one — but it produced a real bug here.

### Other places in this codebase to check (NOT investigating in this issue):

| Pattern | Suspect file | Why suspect |
|---|---|---|
| Completion-only guard | `services/audio/storage/serviceWorker.ts` (`audioServiceWorker.register()`) | Called from `initializeAudioServices` line 443; if `register()` is itself non-idempotent, double-init compounds |
| Completion-only guard | `services/registryService.ts` (`fetchNovelById`) | Could be hit twice in deep-link flow |
| Module-global mutable state | any `services/db/operations/*.ts` that holds caches in module-let | grep `^let\s.*=` under `services/db/operations/` |
| Module-global mutable state | `services/db/core/connection.ts` (likely a singleton DB handle) | Singleton is fine if construction is idempotent; check |
| Module-global mutable state | `store/bootstrap/initializeStore.ts` itself — there are no other `let` decls in this file but `bootMarks/bootStart/lastMark` is the precedent |

The audit-task issues (#7 "provider registration inefficiency", #8 "wasted logs") are likely surface manifestations of the same generator class — registering twice because the registration check sees state mid-flight. Cross-link those investigations when they happen.

## 8. Fix directions (sketches only — no code)

### Direction A — Single-fire init guard (fixes defects 1+2 directly)

> Convert `createInitializeStore` to memoize the in-flight Promise. First caller starts the work and stores `initPromise`; every subsequent caller (until the next page reload) returns the same Promise.

- Impact: high — eliminates duplicate pipeline, halves boot CPU, fixes telemetry doubling for free.
- Effort: low — ~5 lines.
- Risk: low — the existing `isInitialized` check still functions for the post-completion case.
- Reversibility: high.
- Confidence: 0.95.
- Open questions: should the cached promise be cleared on error so the next mount can retry? (Probably yes.)

### Direction B — Move telemetry into per-call closure (fixes defect 2 robustly)

> Make `bootMarks/bootStart/lastMark` local variables of `createInitializeStore`'s returned function. Pass a `bootstrapLog` closure into helpers that need it (already passed via `BootstrapContext` is one option — extend the context).

- Impact: medium — telemetry stays correct even if defect 1 isn't fixed.
- Effort: low-medium — touches every helper that calls `bootstrapLog`.
- Risk: low.
- Reversibility: high.
- Confidence: 0.93.

### Direction C — Instrument the deep-link phase (fixes defect 3)

> Add `bootstrapLog` calls at: entry/exit of `handleBootstrapIntents`, around the `RegistryService.fetchNovelById` call, around `loadNovelIntoStore`, around `ImportService.importFromUrl`, around `handleNavigate`. Time the network fetch separately from the IDB-write phase.

- Impact: high diagnostic; zero direct UX speedup.
- Effort: low — ~10 marks.
- Risk: nil.
- Reversibility: trivial.
- Confidence: 0.97.

### Direction D — Stop blocking init on full deep-link import (the big UX win)

> The slow path is `ImportService.importFromUrl` running inside the `initializeStore` await chain. Codex's option 3 in `Issues.md` is the right one: kick off the import in the background, mark the store ready as soon as enough is available to render the requested chapter, and let the rest stream in. The streaming path already exists (`services/importService.ts` has a streaming variant per the existing analysis).

- Impact: high — this is the actual user-visible fix for the 31s number.
- Effort: medium — 0.5–1.5 days; needs careful state-machine handling for "reader ready vs import-in-progress".
- Risk: medium — touches the deep-link UX.
- Reversibility: medium.
- Confidence: 0.85.

### Recommended order (no implementation, just sequencing)

1. **C first** (instrument) — gives us truth before we change anything. Will let us measure the impact of every subsequent change.
2. **A second** (in-flight guard) — small, safe, halves the dev-mode work.
3. **D third** (streaming deep-link) — the actual product fix.
4. **B if telemetry is still wrong after A** — usually A subsumes the need for B, since the original defect 2 only matters when concurrent runs exist.

Confidence in this ordering: **0.88**.

## 9. Open questions

- Which novel + version did the user have in their browser when the 31s trace was captured? Knowing the `sessionJsonUrl` size would let me reproduce the exact symptom.
- Is the user's browser making the network request to the same CDN/host that prod users would hit, or to GitHub Raw? GitHub Raw can be slow under cold-cache conditions.
- Has the StrictMode double-mount produced any *user-visible* incidents (e.g. the `[DeepLink] Loading novel:` log appearing twice and confusing flow)? The reproduction shows it's silent in dev because the second pipeline catches up to the first; in prod (no StrictMode), it doesn't double — but a double-`importFromUrl` in dev means double network bandwidth and double IDB writes during dev iterations.
- Why was the idempotency guard tucked into a commit titled "remove `as any` casts"? Process question for Aditya, not a code question. The pattern of co-mingled commits is itself the third generator function above.
