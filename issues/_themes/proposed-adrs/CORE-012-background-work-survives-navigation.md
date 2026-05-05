# CORE-012 (DRAFT) — Background Work Survives Navigation; Cancellation Is Explicit-Only

> **Status: PROPOSED — DRAFT v1 (2026-05-05)** · Author: Opus 4.7 (with Aditya as ratifier)
>
> **Not in `docs/adr/` yet.** This draft lives under `issues/_themes/proposed-adrs/` as a working artifact. Move into `docs/adr/` only when Aditya ratifies the principle and signs off the scope. **Until ratified, do not enforce.**
>
> **Originating investigation:** [`issues/19-translation-survives-nav-policy/`](../../19-translation-survives-nav-policy/). Closely related to issue [`12-background-preload-spinner-restart`](../../12-background-preload-spinner-restart/) (preload subset of the same root cause).

## Context

### What's broken

`store/slices/chaptersSlice.ts:170-199` — the `setCurrentChapter` action explicitly cancels any in-flight translation for the previous chapter on every navigation. This kills both user-initiated translations (auto-translate-on-visit) and speculative preload work mid-flight. The LLM call is aborted, no IDB write occurs, and on return the chapter must be re-translated from scratch. LLM tokens are paid for and discarded.

Two user-visible symptoms:

- **Visit case** (issue #19): User visits chapter A → auto-translate fires → user navigates to B mid-flight → translation A is killed. The misleading `beforeunload` "changes will be lost" warning surfaces this — and is *technically truthful* under the current code, because the translation will indeed be lost.
- **Preload case** (issue #12, user's verbatim): "when i move away from the page and get back the background preload ahead chapters are freshly api called rather than showing the calls that were sent in the background... spinner starts from scratch."

Same root cause, two surfaces. Both contradict the user's stated mental model: *"I would not want to lose it I would want it stored in the background so when I navigate back it will be ready waiting for me."*

### Why no existing ADR catches this

[`FEAT-001`](../../../docs/adr/FEAT-001-preloader-strategy.md) commits to "ensure *a* translation is available to prevent waiting" — the spirit clearly implies preload work should be retained, but the ADR is silent on the cancellation rule for the navigation case. The implementation honors the goal at start-time but defeats it at navigation-time.

[`CORE-008`](./CORE-008-derived-views-recomputed-not-stored.md) (proposed) covers JIT derivation but doesn't address in-flight async work. Background translation work is NOT a derived view — it's expensive imperative work that must be initiated, awaited, and persisted. The work itself is raw; the result is what gets persisted.

Neither addresses the principle this ADR commits to: **in-flight work that has no logical dependency on the current view must survive navigation that changes the view**.

### Architecture that already supports the fix

Verified by code inspection in issue #19:

- Translation lives at slice/service layer, not chapter component (`store/slices/translationsSlice.ts:407-411`). Promise reference held by slice; component unmount doesn't kill it.
- Store update is chapter-id-keyed (`store/slices/translationsSlice.ts:487-491`). Writes to chapter Map regardless of current view.
- IDB persist is chapter-id-keyed (`services/translationService.ts:388`). No current-chapter dependency.
- Concurrency is already serialized via `runSequential` (`services/translationService.ts:224-236`). Effective concurrency = 1.

**Conclusion:** removing the auto-cancel is sufficient for correctness. The principle below names the invariant; the implementation is small.

## Decision

### Principle

**In-flight background work survives navigation. Cancellation is explicit-only.**

A user navigation between views (chapters, novels, panels) MUST NOT, as a side effect, cancel work that is logically independent of the navigated-from view. "Logically independent" means: the work's result is keyed by an identifier (e.g. `chapterId`) and persisted to a durable store (IDB) on completion; the user can re-encounter it later by visiting that identifier.

Translation, image generation, and preload work all qualify. UI-local computations (e.g. comparison overlays on the currently-visible chapter, ephemeral hover state) do not — they may be invalidated on view change per [`CORE-008`](./CORE-008-derived-views-recomputed-not-stored.md)'s "invalidate derived state on context change" rule.

### Two distinct termination modes

Terminating in-flight work falls into two categories with very different semantics:

| Mode | Allowed termination triggers | Cleanup expectations |
|---|---|---|
| **Explicit cancel** | User clicks a Cancel button; user invokes a "Stop all" affordance; system reaches a hard cost or rate-limit guardrail | Abort the controller; clear flags; surface clear "cancelled" feedback in UI; do NOT persist partial results |
| **Implicit completion** | Promise resolves successfully; promise rejects with a real error; LLM provider returns a definitive error | Clear flags; persist what completed (full result on success, no partial on error); surface result or error in UI keyed by chapterId |

**Forbidden:** terminating in-flight work as a side effect of unrelated state transitions. Specifically banned: cancel-on-navigation, cancel-on-component-unmount-when-state-lives-at-store-layer, cancel-on-tab-blur (defer to platform).

### Origin taxonomy (commits to vocabulary, not scheduler)

Background work has a discriminating `origin` describing how it was initiated. This ADR commits to the vocabulary so future scheduler work has a hook; it does NOT commit to a scheduler implementation.

| Origin | Initiated by | Priority semantics (descriptive, not enforced by this ADR) |
|---|---|---|
| `manual_translate` | User explicit click (retranslate button, etc.) | Highest — user has expressed direct intent. May preempt lower-priority running work in future scheduler. |
| `auto_visit` | User navigated to a chapter in english view; mediator decided to translate | Medium-high — user is reading this chapter now. |
| `auto_preload` | Preload worker speculating about adjacent chapters | Lowest — speculative; user may never need the result. |

A derived state, **`isBackground`**, is computed at observation time as `currentChapterId !== work.chapterId`. It describes *current state*, not initiation. A translation initiated as `auto_visit` becomes background-state when the user navigates away; its origin does not change.

### Priority taxonomy (reserved, not enforced)

Future scheduler work (out of scope for this ADR's enforcement) is expected to honor:

```
manual_translate > auto_visit > auto_preload
```

Cross-priority cancellation is allowed only when superseding lower-priority work with higher: a `manual_translate` MAY preempt a running `auto_preload`. Same-priority and lower-supersedes-higher are forbidden.

This ADR commits to the *taxonomy* (so origin discrimination is plumbed correctly today). It does NOT commit to a queue implementation, depth bound, preemption mechanic, or cost guardrail. Those are future scheduler work, deferred until empirical signal informs the design.

### Required behaviors

1. **No state-transition handler may cancel in-flight work as a side effect.** `setCurrentChapter` and equivalent navigation actions must NOT call `cancelTranslation`, abort image generation, or otherwise terminate work for the previously-current view. (Issue #19 Phase 1 enforces this for `setCurrentChapter`.)

2. **Component unmount may not cancel work when the work lives at the store layer.** Translation work is initiated by slice actions, held by the slice, and persisted by services — its lifecycle is decoupled from React tree state. Adding `useEffect` cleanups that abort store-layer work would re-introduce the bug.

3. **Persist-keyed-by-id; surface-keyed-by-id.** Completed background work writes to its identifier's record (IDB by `chapterId`). UI surfaces the result by reading from the store/IDB; no special "is this chapter currently visible" gate.

4. **Explicit cancel paths remain.** A Cancel button (toggle behavior on the active translate button at `components/ChapterView.tsx:117-119`) and a "Stop all background work" affordance (Phase 2 banner) MUST exist. Removing implicit cancellation does not mean removing user agency — it means moving cancellation from accident to intent.

5. **Failure surfaces are routed by failure type, not by where the user is now.** Systemic failures (`missing_api_key`, `trial_limit`) surface globally because they affect all subsequent work. Per-chapter failures surface in-place when the user returns to that chapter. (Routing implementation is Phase 2/3; this ADR commits to the principle.)

6. **`beforeunload` warning is scoped to true unrecoverable in-memory work.** After navigation no longer cancels, "unrecoverable" means: an LLM call is in flight that has not yet been persisted to IDB. The `beforeunload` warning fires only in this narrow window. Refresh/close-tab is the one termination path this ADR cannot defend against without durable-queue infrastructure (out of scope).

### Required architectural patterns

- **`TranslationOrigin` type** extended to discriminate `manual_translate | auto_visit | auto_preload`. Plumbed through telemetry for visibility.
- **`isBackground` derived selector** (or equivalent) usable by UI to render banner state, route failures, and key per-chapter behavior.
- **Job lifecycle observability**: telemetry events tagged with origin and `isBackground` so post-ship analysis can answer questions like "what % of `auto_preload` translations are completed but never viewed?" — informing future scheduler decisions.

NOT required by this ADR (deferred to future work): job-entry types, priority queue data structure, preemption mechanic, depth bound, cost guardrail, durable queue, Service Worker integration, amendment-proposal-routing primitive.

## Consequences

### Positive

- The user's mental model holds: navigate away, navigate back, work is ready (or in progress, with a visible signal).
- LLM tokens spent on translations are not wasted on routine navigation. (User cost saving.)
- The misleading `beforeunload` warning becomes accurate (and rare): it only fires when there is truly unrecoverable in-memory work.
- The implicit promise of `FEAT-001` ("ensure *a* translation is available to prevent waiting") is honored end-to-end, not just at preload-start time.
- A clean origin taxonomy gives future scheduler work a foundation without committing to scheduler design now.
- Test patterns become assertable: "translation A completes and persists after nav to B"; "navigation does not produce a cancelling log"; "explicit cancel still works."

### Negative

- Background work that completes while the user is reading another chapter will trigger downstream effects (image autogeneration if enabled per Aditya's pending decision; amendment proposals if `enableAmendments` is on). Cost surface grows. Mitigated by: keeping `runSequential`'s concurrency=1 in Phase 1, and Phase 3 cost guardrails when empirical signal arrives.
- Without depth bounds on the queue (Phase 3), rapid navigation can enqueue uncapped work. Edge case; mitigated by user typically navigating with intent rather than pathologically.
- Removing the auto-cancel makes the queue head-of-line vulnerability visible: a stuck translation blocks later visits from starting. Phase 3 priority/depth work addresses this; Phase 1 leaves the existing `runSequential` behavior intact and accepts the visibility increase.

### Tradeoffs

- **Phase 1 ships the correctness invariant without scheduler infrastructure.** This is intentional — designing the scheduler before observing real usage risks shipping the wrong abstraction (Goodharting on speculative usage patterns). The ADR commits to the principle and the taxonomy slot; Phase 3 fills in policy.
- **Cancellation moves from automatic to explicit.** Some users (and some prior code authors) may have relied on the cancel-on-nav as an implicit "kill what I'm not looking at" affordance. The Phase 2 banner with named work + Stop affordance covers this case explicitly.

## Test patterns this ADR enables

- "In-flight translation survives navigation" — Playwright: trigger translation, navigate, assert work continues, assert IDB record on completion. (Issue #19's primary regression test.)
- "Navigation produces no `cancelling` log" — Playwright assertion against console output during nav.
- "Return-to-chapter does not re-fire completed translation" — Playwright + `autoTranslateMediator` cache assertions.
- "Explicit cancel still aborts" — Vitest unit on `cancelTranslation` slice action.
- "Origin discriminator surfaces in telemetry" — Vitest on telemetry emit calls.
- "Component unmount does not cancel store-layer work" — Vitest: mount/unmount `ChapterView`, assert `cancelTranslation` not called.

## Open questions for ratification

- **Q1 (D1 from issue #19): Auto-image generation on background-completed translation.** Should `autoGenerateImages` (when on) fire for translations that complete while the user is on another chapter? Recommendation: yes (matches user intent). Confirms the cost-surface acceptance above.
- **Q2 (D3 from issue #19): Tab-close survival in scope?** Recommendation: no. Tab-close survival requires durable queue infrastructure (IDB intent replay) or Service Worker — fundamentally different architecture, ~5-10x the work. File a separate ADR if pursued.
- **Q3 (taxonomy):** Is the `manual_translate > auto_visit > auto_preload` ordering correct? Specifically: should `auto_visit` outrank `auto_preload` (yes — user is reading it now), and should `manual_translate` always preempt? Confirm or revise.
- **Q4 (cancellation surface):** Is the toggle-cancel-on-active-translate-button (`ChapterView.tsx:117-119`) the right surface for explicit cancel, or should it move into the Phase 2 banner? Either works; the ADR doesn't bind.
- **Q5 (priority queue scope):** Confirm the ADR commits only to taxonomy, not implementation. Scheduler design is Phase 3 work, deferred until empirical signal. (This is the load-bearing scope question — if you want the scheduler in Phase 1, the ADR should expand.)

## What this ADR does not do

- Does **not** specify a queue data structure, scheduler, or preemption mechanic. Phase 3 work, informed by empirical signal.
- Does **not** specify cost guardrails, depth bounds, or rate limits. Phase 3.
- Does **not** mandate failure routing implementation — only commits to the principle (route by failure type, not by where the user is). Phase 2/3.
- Does **not** specify amendment-proposal-routing implementation. Adjacent concern; may be Phase 2 if real usage shows out-of-context noise.
- Does **not** address tab-close or refresh survival. Different architecture; out of scope.
- Does **not** ban `useEffect` cleanups categorically — only those that cancel store-layer work. Cleanup of component-local state (event listeners, ref disposal) remains correct.
- Does **not** retroactively rewrite history. Existing in-flight cancellation patterns elsewhere in the codebase are flagged as candidates for audit (see issue #19 §8 generator function), but this ADR's enforcement scope is the navigation path specifically.

## Related

- [`Vision.md`](../../../docs/Vision.md) — uninterrupted reading flow (implicit)
- [`FEAT-001-preloader-strategy.md`](../../../docs/adr/FEAT-001-preloader-strategy.md) — "ensure *a* translation is available to prevent waiting"; this ADR enforces the invariant FEAT-001 implies but doesn't commit to.
- [`CORE-008-derived-views-recomputed-not-stored.md`](./CORE-008-derived-views-recomputed-not-stored.md) (proposed) — JIT view derivation; companion principle for *derived state* invalidation. CORE-012 covers *in-flight imperative work* survival. The two together: derived views invalidate freely on context change; in-flight work persists across context change. Distinct invariants for distinct concerns.
- [`CORE-009-single-flight-at-call-sites`](./) (proposed, not yet drafted) — completion-only-guards theme; complementary for dedup of repeat invocations.
- Issue [`19-translation-survives-nav-policy`](../../19-translation-survives-nav-policy/) — originating investigation, Phase 0 spec, full implementation plan.
- Issue [`12-background-preload-spinner-restart`](../../12-background-preload-spinner-restart/) — user's verbatim claim covering the preload subset of this ADR's scope.
- Proposed theme: `nav-cancels-bg-work` (currently N=2 from issues #12 + #19; awaits 3rd instance to ratify per framework).

## Migration path (sketch)

1. **Land this ADR after revisions.** Required answers: Q1, Q2, Q3, Q5. Q4 may be deferred to Phase 2 design.
2. **Issue #19 Phase 1** enforces required behaviors 1-4 in a single PR: remove auto-cancel, extend `TranslationOrigin`, add tests.
3. **Issue #19 Phase 2** delivers required behaviors 5-6: failure routing surface, `beforeunload` scope-down, named banner.
4. **Issue #19 Phase 3** (deferred) adds the priority queue / depth bound / cost guardrails. Reopens this ADR if scheduler design surfaces principle gaps.
5. **Audit candidate list from issue #19 §8 generator function** for other instances of "navigation cancels work that has no logical view dependency." If 3rd instance found, ratify `nav-cancels-bg-work` as a theme.
