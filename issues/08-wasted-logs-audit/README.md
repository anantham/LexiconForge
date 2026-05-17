# Issue 8 — Wasted logs — justify each one

> Status: **investigated** · Last updated: 2026-05-15 · Investigator: Claude Opus 4.7 (1M) · Worktree `opus-issues-investigation`

## 1. Claim (verbatim from Issues.md)

> scan for wasted logs that are not useful - justify each log

_Note: an **audit task** — sweep the cold-boot console output, classify each log line by signal-to-noise ratio, identify deletable / consolidatable / gateable categories._

## 2. Reproduction

**Goal:** sample the actual console output a fresh user sees on first boot.

**Environment:** dev server `http://localhost:5183/` (isolated worktree, port-isolated IDB), fresh IndexedDB.

**Steps:**
1. Navigate to `http://localhost:5183/` with empty browser context.
2. Wait 3s for bootstrap pipeline + StrictMode double-mount cycle to settle.
3. Capture full console (info+) via Playwright MCP.

**Trace:** [`traces/cold-boot-console.log`](./traces/cold-boot-console.log) — **158 console messages in ~1.5s of boot activity**.

**Distribution by source file (top sources):**

| Source | Calls | Per-call category |
|---|---:|---|
| `store/bootstrap/initializeStore.ts:30` (step markers) | **82** | progress telemetry |
| `services/db/core/schema.ts:74` (migration step) | **16** | migration progress |
| `services/registryService.ts:106` (per-novel metadata fetch) | **6** | UI data load |
| `scripts/backfillChapterNumbers.ts:39-78` (no-op migration script) | **10** | migration completion |
| `services/db/operations/summaries.ts:141,172` (fetchNovelChapterCounts) | **4** | aggregation result |
| `services/db/migrationService.ts:116,127,167,185` (DataRepair) | **8** | repair telemetry |
| `services/audio/AudioService.ts:36` (PiAPI key warning) | **2** | env warning |
| `services/audio/storage/serviceWorker.ts:20` (AudioSW registered) | **2** | one-time init |
| `services/db/core/connection.ts:46` (DB version check) | **2** | one-time init |
| `store/bootstrap/initializeStore.ts:45,37,32,76` (init summary/table) | **8** | summary |
| `services/telemetryService.ts:33`, `apiMetricsService.ts:9`, `localDictionaryCache.ts:19,42`, `DiffAnalysisService.ts:227` | 5 | one-time service inits |

**Observed result:** **158 lines fire in ~1.5 seconds of cold boot**, of which:

- **~50% (79 lines) are pure duplication** from React.StrictMode double-mount (issue #1's territory). Without StrictMode, the same boot produces ~79 lines — still verbose.
- The largest single offender is `initializeStore.ts:30`: a generic `logStep(name)` callback fires for **every** boot step (`loadSettings invoked`, `loadPromptTemplates start`, `bootRepairs start`, …). Useful for diagnosing boot stalls; noisy under normal operation.
- `scripts/backfillChapterNumbers.ts` logs **5 separate lines** (`Starting`, `Found 0 chapters`, `Backfill complete!`, `Updated: 0`, `Skipped: 0`, `Failed: 0`, `Please reload the page`) even when the work is a no-op (0 chapters to process). The "Please reload the page" line is actively misleading.
- `[Migration] To run backfill, execute: backfillChapterNumbers()` (`backfillChapterNumbers.ts:86`) is a **developer hint logged on every boot** — belongs in a `console.debug` or removed.
- `[fetchNovelChapterCounts] Processing 0 total summaries` + `Aggregated counts: {}` — fires even when the dataset is empty. Empty-result logs add no signal.

**Verdict:** `reproduced` — the user's intuition is correct. Cold-boot console is verbose, with multiple identifiable wasted-log categories.

## 3. Verdict

**Real bug** (audit-quality finding) — Confidence: **0.85**.

The console isn't *wrong*, but it disrespects the diagnostic-vs-signal tradeoff. A fresh user opening DevTools sees a wall of green-path telemetry where they expected exceptions or warnings. The ratio of "this log helped me debug something" to "this log existed because someone wanted feedback in 2024" is low.

Confidence below 1.0 because **what counts as "wasted" depends on debug audience**: a maintainer hunting a boot-time regression wants the `Store:init` step markers, but a user filing a bug report wants only warnings. The actionable fix is **policy + gating**, not deletion.

## 4. Where the failure lives (A / B / C)

**`(A3, B3, C2)`** — confirmed from the index's provisional assignment.

Justification:
- **A3** — No ADR, CONVENTIONS, or design doc specifies a logging policy (log levels, when to use `console.debug` vs `console.log`, when boot telemetry should be gated by `NODE_ENV` or a `DEBUG_BOOT` flag, etc.). The closest is `utils/debug.ts` (`debugLog`, `debugWarn`) which suggests an intent that wasn't followed everywhere.
- **B3** — Code overshoots: many sites log unconditionally where they could `debugLog` (gated), or where they could batch (e.g., one summary line per migration instead of one per step).
- **C2** — No vision doc says it's wrong, but "noise impedes diagnosis" is the obvious dual of CORE-006's "render shell immediately" — both are about respecting the user's attention.

### Themes (cross-cutting failure classes)

- **Propose new theme:** `logging-policy-missing` (per the index's note). Roster N=1 (this issue) but the underlying pattern probably extends to runtime-time logs (translation, image generation, chapter change) — which were not captured in this cold-boot trace. Open question for follow-up.
- Strong overlap with [`completion-only-guards`](../_themes/completion-only-guards.md): the duplicated half of the trace is a downstream symptom of issue #1's double-init. Eliminating that would halve the trace mechanically — but the underlying logs would still be verbose.

## 5. Evidence and code paths

**Categorized inventory** (cold-boot trace, 158 lines):

### A. Genuinely useful (KEEP) — ~8 lines, 5%
- `services/db/core/connection.ts:46` — `[Connection] Version check: Status: fresh-install | DB Version: none | App Version: 16` — diagnostic value at boot. (Currently fires 2× due to StrictMode; fix at #1.)
- `services/db/core/schema.ts:70` — `Applying migrations from version 0 to 16` — single summary line. **OK.**
- `services/db/core/schema.ts:176-227` — `[Migration v13] Running schema repair... Existing stores: [...] Schema repair complete.` — three lines, but version-13-specific and meaningful when it fires. **OK.**
- `services/audio/AudioService.ts:36` — `[AudioService] PiAPI key not found. Audio generation will not be available.` — actionable env warning. **OK** (but currently fires 2×).
- `services/audio/storage/serviceWorker.ts:20` — `[AudioSW] Registered successfully:` — one-time success, but should be `console.debug` per "log warnings/errors, not happy-path".

### B. Useful-but-too-granular (CONSOLIDATE) — ~90 lines, 57%
- `store/bootstrap/initializeStore.ts:30` — the `logStep(name)` callback. 41 unique step names × 2 (StrictMode) = 82 lines. Currently fires unconditionally; should be gated behind `if (DEBUG_BOOT_STEPS)` or `debugLog('boot', name)`. The TABLE summary at line 37 already conveys the same information after init completes.
- `services/db/core/schema.ts:74` — `Applying migration to version N` — 14 lines (versions 1→14 logged individually, then v15+v16). Could be: one summary line `Applying 16 migrations (1 → 16)`. Or `console.debug`.

### C. No-op telemetry (DELETE or gate by IDB-non-empty) — ~14 lines, 9%
- `scripts/backfillChapterNumbers.ts:74-78` (5 lines × 2 = 10) — fires the full success log even when 0 chapters were processed. Should bail before the log block if `chaptersFound === 0`.
- `scripts/backfillChapterNumbers.ts:86` — `[Migration] To run backfill, execute: backfillChapterNumbers()` — developer hint, should be `console.debug` or removed.
- `services/db/operations/summaries.ts:141,172` (2 lines × 2 = 4) — `[fetchNovelChapterCounts] Processing 0 total summaries / Aggregated counts: {}` — fires for empty datasets.

### D. Double-mount duplication (FIX AT #1) — ~79 lines, 50% of trace
- Every line above is logged twice because `initializeStore()` runs twice (StrictMode + missing in-flight guard at `store/bootstrap/initializeStore.ts:423`). Owned by issue #1's `enforce_existing_ADR` action.

### E. One-time service init (KEEP, possibly gate by `NODE_ENV === 'development'`) — ~5 lines, 3%
- `services/telemetryService.ts:33` — `[Telemetry] Initialized (session: 071e11ab)` — useful for correlating sessions across logs but only fires once.
- `services/apiMetricsService.ts:9` — `[ApiMetrics] Service initialized` — happy-path, candidate for `debugLog`.
- `services/diff/DiffAnalysisService.ts:227` — `✅ [DiffAnalysisService] Translator instance injected` — happy-path success log. Candidate for removal.
- `services/localDictionaryCache.ts:19,42` — `[DictionaryCache] Created IndexedDB store / Loaded 0 cached entries` — happy-path + empty-result. Both candidates for removal/gating.

### F. UI data load (CONSOLIDATE) — ~8 lines, 5%
- `services/registryService.ts:89,106` — `[Registry] Fetched 3 novels` followed by `[Registry] Fetched metadata for X` (per novel, ×2 due to StrictMode). Could be one summary line.

**Suspected fault distribution:** the heaviest offender is **`initializeStore.ts:30`'s `logStep(name)` callback** — single source-line responsible for 82/158 = 52% of trace volume.

## 6. Test coverage gap & regression-test obligations

### What's missing

- No tests pin log volume per cold boot — a regression that adds 20 new log lines would land unnoticed.
- No linting rule prohibits `console.log` in `services/` and `store/` (should be `debugLog` from `utils/debug.ts`).
- No CI check exists for "boot console must contain only N lines under WARN+ for a fresh user".

### Regression-test obligations

Since this is `draft_new_ADR` action (see §9), regression tests follow the ADR ratification, not this investigation. Possible test obligations after policy lands:

| Defect | Required regression test |
|---|---|
| Cold-boot verbosity drifts upward | `tests/e2e/console-budget.spec.ts` — Playwright cold-boot, assert `console.warn+` count ≤ 5 and `console.log+` count ≤ 15 on fresh-IDB boot. |
| `backfillChapterNumbers` logs no-op | `tests/scripts/backfillChapterNumbers.test.ts` — given `chaptersFound === 0`, assert no `[Migration] Backfill complete` log fires. |
| `console.log` re-introduced in `services/` | ESLint rule `no-console` with exception for `utils/debug.ts`. |

## 7. Archaeology

Two specific sites worth tracing (deferred to fix-time):

1. `store/bootstrap/initializeStore.ts:30` — the `logStep` callback. When was it added and was it intended as permanent diagnostic or temporary debug?
2. `scripts/backfillChapterNumbers.ts:74-86` — when was the empty-result success block added? It looks like it was written assuming the migration would always have work to do.

Run `python3 scripts/issue-archaeology.py store/bootstrap/initializeStore.ts` when this issue moves to fix-time.

## 8. Generator function

**Class:** "Diagnostic instrumentation added during active development was never reclassified as debug-only or gated after the feature stabilized."

This is a forward-direction reflex (per CLAUDE.md "Lean toward the reverse direction"). Every diagnostic log starts as `console.log(...)` because the dev needs to *see* it in their terminal. After ship, no one goes back and demotes to `debugLog`. The pattern is self-reinforcing because each individual log "feels useful" in isolation.

**Other places this generator might surface (candidates to check, not in this investigation):**
- Runtime translation logs (`services/translate/Translator.ts`, `services/translationService.ts`) — likely large signal at translation time.
- Image generation logs (`services/imageService.ts` if it exists).
- Chapter change logs (relevant to issue #9).
- Audio playback logs.
- IndexedDB operation logs (`services/db/operations/*.ts`).

A single follow-up sweep capturing console during translate-a-chapter would 2-3× the dataset.

## 9. Action — which kind of fix this is

**`draft_new_ADR`** — no logging policy exists; the blast radius is the entire codebase; the generator (§8) extends to runtime not just boot. A targeted local fix would only address ~15% of the visible noise.

Sketch (one-paragraph ADR):

> **Proposed ADR-009 — Logging policy** (working title: `proposed-adrs/ADR-009-logging-policy.md`).
>
> 1. Application code uses `debugLog(channel, level, msg)` from `utils/debug.ts`. Only `services/`/`store/` errors and explicit env warnings (e.g. missing API key) may use `console.warn`/`console.error` directly.
> 2. Boot/migration progress markers fire only when `DEBUG_BOOT=1` (URL param or localStorage). Cold-boot console for a normal user shows ≤ 5 warning lines and ≤ 0 happy-path logs.
> 3. Empty-result paths do not log a multi-line success block. If a migration finds 0 records to process, it returns silently or logs a single `console.debug` line.
> 4. UI data loads (novel registry, summaries) log a single summary line per fetch batch, not per item.
> 5. CI enforces the policy via an ESLint rule (`no-console` with exception for `utils/debug.ts`) and an e2e console-budget test.

| Direction | Impact | Effort | Risk | Reversibility | Confidence |
|---|---|---|---|---|---|
| Draft ADR-009; refactor `initializeStore.ts:30` logStep behind `DEBUG_BOOT` gate | High (52% of trace) | 2-4 hr | Low | High | 0.9 |
| Refactor `backfillChapterNumbers.ts` to bail early on 0 work | Medium (10% of trace) | <1 hr | Low | High | 0.95 |
| Add e2e console-budget regression test | Medium (prevents drift) | 1-2 hr | Low | High | 0.9 |
| Sweep runtime logs (translation, image, chapter change) in a follow-up | High (unknown size) | 2-4 hr | Low | High | 0.7 |

**Recommendation:** draft ADR-009 first (cheap, high leverage), then enforce. Don't attempt piecemeal log deletion before policy lands — the bar for "is this log worth keeping?" needs to be set explicitly. The 50% StrictMode-duplication share resolves automatically once issue #1's single-flight guard ships.

## 9a. Closing gate

This issue closes as `fixed` only when ALL of the following are true:

- [ ] ADR-009 (logging policy) ratified by Aditya in `docs/adr/`.
- [ ] `initializeStore.ts:30`'s `logStep` gated behind `DEBUG_BOOT` env/flag.
- [ ] `backfillChapterNumbers.ts` bails early when 0 chapters to process.
- [ ] `fetchNovelChapterCounts` skips empty-result logging.
- [ ] e2e `console-budget.spec.ts` regression test committed and passing.
- [ ] `no-console` ESLint rule active in `services/` and `store/`.
- [ ] Theme `logging-policy-missing` added under `issues/_themes/`.

## 10. Status

`investigated` — `draft_new_ADR` action pending Aditya's review of the proposed ADR-009 sketch in §9.

## 11. Open questions

- Should `console.debug` survive in production or be tree-shaken? (Vite's behavior with `console.debug` depends on plugin config.)
- Is there appetite for a `DEBUG_BOOT=1` URL-param toggle, or should boot-step logging be permanently off and re-enabled only via build flag?
- The runtime side of the audit (translation, image, chapter change) is not in this trace — should a Phase 2 of this investigation capture those, or is the policy already sufficient to act on?
