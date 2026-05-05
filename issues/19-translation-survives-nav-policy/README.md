# Issue 19 — Translation cancelled by SPA navigation (background-work policy)

> Status: **investigated** · Last updated: 2026-05-05 · Investigator: Claude Opus 4.7 (1M)
> Phase 0 spec — captures full investigation, decisions, and phased plan. Implementation deferred per phased shipping.

## 1. Claim

**Origin:** This issue did not begin in `Issues.md`. It was discovered while reviewing handover thread #3 (`docs/HANDOVER.md`) about a misleading `beforeunload` "Reload site? Changes you may have made may not be saved" warning. Investigation revealed a deeper bug under the dialog symptom.

**Closest pre-existing user claim** is `Issues.md` item 12, which captures the preload subset of the same root cause:

> when i move away from the page and get back the background preload ahead chapters are freshly api called rather than showing the calls that were sent in the background... spinner starts from scratch

That's filed as [issue 12](../12-background-preload-spinner-restart/). This issue (#19) covers the broader root cause, including the user-initiated translation case the handover surfaced. Recommend Aditya add a corresponding item to `Issues.md` if the broader framing should be formalized as a user-filed claim.

**The full claim, after investigation:**

> When the user navigates between chapters mid-translation, the in-flight translation is cancelled. The LLM call is aborted, no IDB write occurs, and on return to the chapter the translation has to start over. This applies to both user-initiated translations (auto-translate-on-visit) and speculative preload work. The user's mental model is that background work should continue and be ready on return; the code actively prevents this. The misleading `beforeunload` warning is a downstream symptom — its message ("changes will be lost") is technically truthful given the current behavior; the bug is the behavior, not the dialog.

**Calibration:** the verbatim handover quote was about the dialog. The investigation widened the claim. Per the calibration rule, both framings should be re-checked before any fix lands — the dialog symptom and the cancellation root-cause must both be addressed for the user's mental model to hold.

## 2. Reproduction

**Status:** repro is prescribed but not yet executed live. Per the §2 hard rule, this issue is `investigated` (Phase 0 spec), not `ready-for-fix`. A live Playwright reproduction must exist before Phase 1 implementation begins. The repro doubles as the Phase 1 regression test.

**Prescribed repro (planned):** `traces/repro-shape-b.spec.ts` (Playwright)

- Environment: dev server on `:5180`, fresh IndexedDB.
- Setup: stub the LLM provider fetch with a 30s delay response (no real cost).
- Steps:
  1. Load chapter A in english view (auto-translate fires).
  2. Within ~500ms, navigate to chapter B.
  3. Read console for `🚫 [Chapters] Navigation detected, cancelling previous chapter translation: A`.
  4. Wait 35s (past mock LLM completion).
  5. Inspect IDB: assert no translation record exists for chapter A.
  6. Navigate back to chapter A.
  7. Assert chapter A has no `translationResult` and a fresh translation fires.
- **Expected (current, buggy) result:** all assertions pass — confirming Shape B.
- **Expected (post-fix) result:** the cancelling-log assertion FAILS (no log fires), the IDB assertion finds a record, the no-result-on-return assertion fails (result is present, no re-fire).
- Verdict: pending live execution. Code-read verdict is `real bug` at confidence 0.95.

## 3. Verdict

**Real bug** — Shape B confirmed by code inspection. Confidence: **0.95**.

`store/slices/chaptersSlice.ts:170-199` — the `setCurrentChapter` action explicitly cancels any in-flight translation for the previous chapter on every navigation. The comment makes the intent explicit:

```ts
// Cancel any active translation from the previous chapter when navigating away
const prevChapterId = get().currentChapterId;
if (prevChapterId && prevChapterId !== chapterId) {
  debugLog('translation', 'summary', '🚫 [Chapters] Navigation detected, cancelling previous chapter translation:', prevChapterId);
  translationsActions.cancelTranslation(prevChapterId);
}
```

This cascades:

1. `cancelTranslation(prevChapterId)` in `store/slices/translationsSlice.ts:655-679`
2. → `TranslationService.cancelTranslation(prevChapterId)` in `services/translationService.ts:564-582`
3. → `controller.abort()` on the in-flight `AbortController`
4. → in-flight `fetch` to the LLM provider throws `AbortError`
5. → `handleTranslate`'s `try/catch` (translationsSlice.ts:411-413) returns `{aborted: true}`
6. → IDB persist at `services/translationService.ts:386-406` is **not reached** (downstream of the abort point at line 323)

Result: the LLM tokens are paid for and discarded; chapter A has no record; the user returns to a chapter that needs to be re-translated.

**Why 0.95 and not 1.0:** code-read can be wrong. Live verification (the Playwright repro in §2) raises confidence to 1.0 by observing the call chain end-to-end against real behavior.

## 4. Where the failure lives — (A2*, B2, C2)

- **A2*** — No ADR commits to "in-flight background work survives navigation." `FEAT-001` (preload) commits to "ensure *a* translation is available, prevent waiting" — the spirit clearly implies preload work should be retained, but the ADR is silent on the cancellation rule for the navigation case. Asterisk because FEAT-001's "Implemented" claim looks aspirational given this code path.
- **B2** — Code falls short of the implicit invariant. The cancellation is an active behavior, not a passive gap.
- **C2** — Drifted from vision. The user's mental model (and the implicit promise of preload) is that background work continues; the code actively prevents this. Vision (`docs/Vision.md`) doesn't directly contradict, but the spirit of "uninterrupted reading flow" is undercut by re-translating chapters the user already had work in flight on.

### Themes

- [completion-only-guards](../_themes/completion-only-guards.md) — partial fit. The cancellation path itself does clean up flags correctly (verified via code reading); the deeper "in-flight work cancelled by side effect of unrelated state transition" pattern is not exactly the completion-guard generator. But it's adjacent.
- **Proposed new theme:** `nav-cancels-bg-work` — "Navigation handler imperatively cancels in-flight work that has no logical dependency on the current view." Currently N=2 instances within this issue alone (preload-case from #12, visit-case from this issue). One more instance from elsewhere would justify ratifying the theme. Defer ratification per the framework.

## 5. Evidence and code paths

### The cancellation chain

- **Trigger:** `store/slices/chaptersSlice.ts:170-199` (`setCurrentChapter`)
- **Slice action:** `store/slices/translationsSlice.ts:655-679` (`cancelTranslation`)
- **Service action:** `services/translationService.ts:564-582` (`TranslationService.cancelTranslation`)
- **Abort propagation point:** `services/translationService.ts:319` (`abortController.signal` passed to `translateChapter`)
- **Abort observation point:** `services/translationService.ts:323-326` (returns `{aborted: true}`)
- **IDB persist (NOT REACHED on abort):** `services/translationService.ts:386-406` (`TranslationOps.storeByStableId`)

### Architecture that already supports background continuation

- **Translation lives at slice/service layer, not chapter component:** `store/slices/translationsSlice.ts:407-411` invokes `TranslationService.translateChapterSequential` as a slice promise. The promise reference is held by the slice, not the React tree, so component unmount doesn't kill it.
- **Store update is chapter-id-keyed:** `store/slices/translationsSlice.ts:487-491` calls `chaptersActions.updateChapter(chapterId, {translationResult})` — writes to the chapter Map regardless of current view.
- **IDB persist is chapter-id-keyed:** `services/translationService.ts:388` (`TranslationOps.storeByStableId(chapterId, ...)`) — no current-chapter dependency.
- **Conclusion:** removing the auto-cancel is sufficient to make background continuation work; no other architectural changes required for Phase 1 correctness.

### Concurrency model

- **`runSequential` at `services/translationService.ts:224-236`** — single global promise chain. Effective concurrency = 1. Already serializes; no concurrency cap needed for Phase 1.
- **Implication for Phase 3:** queue depth (head-of-line blocking, stale-chapter-priority, unbounded queue) is the concern, not concurrency. A priority queue / depth bound is the right shape, not a concurrency cap.

### Origin discrimination gap (Phase 1 prerequisite)

- **Current code conflates two intents under `'auto_translate'`:**
  - `store/autoTranslateMediator.ts:91` — `handleTranslate(chapterId, 'auto_translate')` for visit-triggered auto-translate.
  - `store/slices/chaptersSlice.ts:1028` (preload worker) — also `'auto_translate'` for preload-triggered.
- **Phase 1 must split these** so Phase 3 priority work has a hook. Lightweight extension to `TranslationOrigin` type, no scheduler infrastructure.

### Background-completion side effects (verified via code)

- **`translation:complete` window event** (`store/slices/translationsSlice.ts:568-581`): subscriber is `DiffTriggerService`; keys work by `chapterId`; does not require chapter to be visible. Safe to fire from background.
- **Auto-image generation** (`store/slices/translationsSlice.ts:599-601`): fires when `autoGenerateImages` is on and translation has illustrations. **Decision required for Phase 1:** does this fire for background-completed translations? See §9b.

## 6. Test coverage gap & regression-test obligations

### What's missing

- No test asserts that an in-flight translation survives chapter navigation.
- No test asserts that a translation result is persisted to IDB even if the chapter is no longer current at completion time.
- No test asserts that returning to a chapter with a previously-completed background translation does not re-fire translation.
- The existing `tests/store/appScreen.integration.test.tsx` "auto-retry-suppression" test (currently skipped per handover §6 deferred item 6) covers a related but different invariant.

### Regression-test obligations (HARD GATE for Phase 1)

| Defect | Required regression test |
|---|---|
| Translation cancelled by SPA nav (visit case) | `traces/repro-shape-b.spec.ts` (Playwright): start translation A, nav to B mid-flight, assert A's translation completes, assert IDB record for A exists, assert no `🚫 cancelling` log fires. |
| Translation cancelled by SPA nav (preload case — #12) | Same Playwright test, parameterized for `auto_preload` origin: trigger preload of A, nav to B mid-flight, same assertions. |
| Return-to-chapter doesn't re-fire on completed translation | Playwright: complete a background translation for A, nav back to A, assert no second `[Translation] 🚀 Starting` log fires (use `autoTranslateMediator`'s already-cached path). |
| Explicit cancel still works | Vitest unit test on `cancelTranslation` slice action: assert that calling it directly aborts the controller and clears state. (May already exist; verify and reference.) |
| Origin discriminator is plumbed through | Vitest unit test on `autoTranslateMediator` and preload worker call sites: assert the new `auto_visit` and `auto_preload` origins reach `handleTranslate` correctly and surface in telemetry. |

**Phase 2 obligations (file separately when Phase 2 starts):** banner rendering, `beforeunload` scope-down, image leak audit findings, amendment proposal routing if shipped.

**Phase 3 obligations (deferred):** priority queue ordering, manual-preempts-preload behavior, failure routing per `failureType`.

## 7. Archaeology

_Deferred — run `python3 scripts/issue-archaeology.py store/slices/chaptersSlice.ts` before Phase 1 implementation to identify when the auto-cancel was introduced and what driving prompt or scenario produced it. The cancellation likely predates the slices refactor (legacy `useAppStore` in `archive/`); confirm._

## 8. Generator function

**The class of mistake:** "A navigation/state-transition handler imperatively cancels in-flight work that has no logical dependency on the transitioned-from state."

**Why it occurs:** the original author probably reasoned "user left chapter A, so work for A is no longer needed" — local reasoning that ignores the user's mental model of background work and the cost of discarding speculative or in-flight LLM calls.

**Other places this generator might surface (candidates to check, not investigated here):**

- Image generation cancellation on chapter switch (the handover's image-leak concern is adjacent — image gen may have a parallel auto-cancel that's also wrong)
- Fan-translation fetch cancellation on chapter switch (if any)
- Glossary or amendment-proposal background work (if any cancels-on-nav)
- Any `useEffect` cleanup that aborts a fetch tied to component lifecycle when the data persists at store level

## 9. Action — `enforce_implicit_intent + draft_new_ADR`

This issue requires **two actions in concert**:

1. **`enforce_implicit_intent`** (Phase 1) — FEAT-001 implies background work should survive; remove the auto-cancel and add tests that demand the implied invariant.
2. **`draft_new_ADR`** (Phase 0 → ratification) — [`CORE-012-background-work-survives-navigation`](../_themes/proposed-adrs/CORE-012-background-work-survives-navigation.md) drafted 2026-05-05. Commits to the principle ("background work survives navigation; cancellation is explicit-only") and the origin/priority taxonomy slot, without committing to scheduler implementation. Awaits Aditya ratification on Q1-Q5 in the ADR.

## 9a. Phased shipping plan

**Phase 0 — Spec (this document) + ADR draft.** No code change. Captures the full intent, scope, decisions, and phased roadmap.

**Phase 1 — Correctness + origin discrimination** (single PR):

- Remove auto-cancel in `store/slices/chaptersSlice.ts:setCurrentChapter`
- Delete the `🚫 [Chapters] Navigation detected, cancelling` debug log
- Extend `TranslationOrigin` type: split `'auto_translate'` into `'auto_visit'` and `'auto_preload'`
- Update `store/autoTranslateMediator.ts:91` (use `auto_visit`) and `store/slices/chaptersSlice.ts:1028` (use `auto_preload`)
- Thread new origins through telemetry/progress where applicable
- Add comments at call sites flagging "priority policy is a future Phase 3 extension point"
- Tests per §6 obligations table (Phase 1 rows)
- Decision-bound: see §9b "Phase 1 decisions"

**Phase 2 — Visibility** (one or two PRs, additive):

- Background-work banner: named, count, current chapter title, no Cancel-by-default. "Stop" affordance behind overflow/menu.
- `beforeunload` scope-down to `pendingTranslations.size > 0` (now meaningful since SPA-nav no longer triggers spurious in-flight state).
- Image-loading-leak audit: trace every `isLoading: true` set in `store/slices/imageSlice.ts`, ensure paired clear on every termination path. Fix or document if clean.
- Per-chapter amendment proposal routing — if real usage shows out-of-context proposals appearing. May be deferable depending on `enableAmendments` default (currently `false` per recent fix).

**Phase 3 — Policy** (after observing Phase 1+2 in real usage for at least 2-4 weeks):

- Priority queue with taxonomy: manual_translate > auto_visit > background_continuation (derived) > auto_preload
- Manual preemption rule: manual cancels running preload (the only sanctioned cross-priority cancellation)
- Queue-depth bound or LRU eviction policy
- Failure routing per `failureType`: systemic (`missing_api_key`, `trial_limit`) → global toast + halt queue; per-chapter → in-place error on return; aggregated tally in banner
- Cost guardrails (queued spend warning, etc.)
- Amendment proposal persistence/expiry policy

## 9b. Phase 1 decisions (must answer before implementation)

These are committed-to-by-Phase-1 choices that shouldn't be discovered in code:

| Decision | Options | Recommendation |
|---|---|---|
| **D1. Auto-image generation on background-completed translation?** | (a) fire on background completion, (b) defer until user returns to chapter | **(a) fire on background completion.** Matches user intent ("ready when I return"). Cost surface ~doubles for any background translation. Acknowledge in spec; revisit in Phase 3 if cost-control is needed. |
| **D2. Origin taxonomy: 3 or 4 origins?** | (a) 3 origins (`manual_translate`, `auto_visit`, `auto_preload`) + derived `isBackground` boolean, (b) 4 origins including `background_continuation` | **(a) 3 origins.** "Origin" describes initiation; "background" is a state derivable from `currentChapterId !== translation.chapterId`. Avoids mutating origin mid-flight. Cleaner taxonomy. |
| **D3. Tab-close survival in scope?** | (a) yes — durable queue with IDB intent replay, (b) no — SPA-nav only | **(b) SPA-nav only.** Tab-close survival is a fundamentally different architecture (durable queue or Service Worker). Out of scope for this issue. File a separate issue if pursued. |
| **D4. First-ship aggressiveness?** | (a) Phase 1 only (minimal correctness), (b) Phase 1+2 together, (c) full Phase 1+2+3 in one project | **(b) Phase 1 then Phase 2 (separate PRs).** Phase 1 makes behavior correct; Phase 2 makes it legible. Phase 3 deferred until empirical signal. |

**Ratified by Aditya:** 2026-05-05. D1-D4 accepted as written.

## 9c. Soft blockers (defer to Phase 2/3 boundary)

- Failure routing policy for background failures — Phase 3
- Amendment proposal persistence (session-scope vs cross-tab-close) — Phase 2 if shipped, otherwise Phase 3
- What to do with deferred state from chapters never re-visited — Phase 3
- Cost guardrail thresholds — Phase 3
- Queue depth bounds — Phase 3
- Settings exposure (new toggles) — hardcode reasonable defaults in Phase 1+2; expose only if Phase 3 demands

## 10. Status

`triaged → investigated` (Phase 0 complete)

Transition to `ready-for-fix` requires:

- [ ] §2 live repro executed (Playwright script committed to `traces/`, run and observed)
- [x] D1-D4 ratified by Aditya (or alternative chosen) — accepted as written on 2026-05-05
- [x] Proposed ADR [`CORE-012`](../_themes/proposed-adrs/CORE-012-background-work-survives-navigation.md) drafted in `issues/_themes/proposed-adrs/` (awaits ratification on Q1-Q5)
- [ ] Issue 12 cross-referenced from this README and vice versa
- [ ] (Optional) Issues.md updated with item 19 if formalization wanted

Then Phase 1 implementation may begin.

## 11. Open questions

- **Q1 (architecture):** Is there any case where in-flight translation cancellation on nav was *desired* behavior? (e.g., explicit "stop and switch focus" UX intent.) If so, the explicit cancel button + "Stop all" affordance in Phase 2's banner covers it. Confirm with Aditya there's no implicit intent we're missing.
- **Q2 (cost):** Per D1, background image generation will fire post-translation. Worst case scenario: user rapid-navs through 10 chapters, each triggers translate + image gen, cost spikes. Is the existing `preloadCount` cap (which bounds preload-triggered translations) sufficient, or does the visit-case need its own bound?
- **Q3 (telemetry):** The new `auto_visit` vs `auto_preload` origin split lets us measure abandonment rates ("% of background translations completed but never viewed"). Worth wiring to `clientTelemetry` in Phase 1 to inform Phase 3 decisions, or wait until Phase 2?
- **Q4 (theme):** Is `nav-cancels-bg-work` a ratifiable theme at N=2 (this issue's two cases), or wait for a third instance from elsewhere in the codebase? Per the framework, themes need N≥2 confirmed instances.
- **Q5 (cross-link):** Should issue #12's verdict be updated to point at this issue as the broader investigation, with #12's status set to "subsumed by #19"? Or should #12 remain independent and #19 cite it as a co-equal instance?
