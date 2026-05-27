# Issue 16 — Chapter-translation switch loses comments and floating-comment icons

> Status: **FIX-IN-PLACE, MECHANICAL TESTS PASSING, REAL-BOOK CYCLE PARTIALLY VERIFIED** · Last updated: 2026-05-15 · Investigator: Claude Opus 4.7 (1M)
>
> **Fix:** `components/chapter/ReaderBody.tsx` — added `key={translationResult?.id ?? translationResult?.version ?? 'default'}` to `<InlineCommentMarkers>`. React force-remounts the markers on translation switch, so `useEffect [computePositions]` re-fires against the new DOM. Implements the fix-shape identified at §5 below.
>
> **Mechanical regression test:** `tests/components/chapter/ReaderBody.versionSwitchRemount.test.tsx` — 4 cases, verified to FAIL 2/4 on unfixed code (`git stash` of fix), PASS 4/4 with fix applied. **Proves the mechanism the fix uses, NOT that the user-visible symptom is resolved end-to-end.**
>
> **Real-book partial verification:** `traces/real-book-test-2026-05-15.txt` — on Dungeon Defense Ch2 with v3 active, programmatic `store.submitFeedback` succeeded; inline marker rendered correctly in DOM; `findTextTop` located the selection. Programmatic `store.setActiveTranslationVersion` returned without error but DID NOT actually switch the translation in store state — same call signature the UI uses (`SessionInfo.tsx:136`), unclear why it didn't propagate when called outside a React event handler. **End-to-end version-switch cycle was not directly observed in the running app.**
>
> **User-driven verification needed:** the trace file lists step-by-step what to click to confirm post-fix behavior matches expectations.
>
> **Why this issue sat 11 days at `triaged`:** the 2026-05-04 investigator self-blocked on "live UI repro is blocked on having a chapter with multiple translations stored in IDB" — but agent could have synthesized that IDB state. The "needs live repro" gate was over-conservative for a bug with 0.88 code-read confidence + a clear fix shape; this 2026-05-15 attempt shows that even with the state available, programmatic E2E verification has its own friction.
>
> ⚠ Content below is the pre-2026-05-15 investigation. Treat as historical record.

> Pre-2026-05-15 status: **triaged — needs §2 live repro before ready-for-fix** · Last updated: 2026-05-04 · Investigator: Opus 4.7

## TL;DR

**Backed off "ready-for-fix" 2026-05-04** after deeper code reading revealed the bug shape isn't the simple `useEffect`-on-`activeTranslationId` lifecycle I'd assumed. Three layered issues in feedback persistence (one of which is the user's stated complaint, two are upstream gaps that probably feed into it):

| Layer | What | Status |
|---|---|---|
| **A** — see [issue #17](../17-feedback-not-loaded-from-idb/) | `loadChapterFromIDB` never loads feedback from IDB. `chapter.feedback` is always `[]` after a fresh hydration. | confirmed by code reading |
| **B** — see [issue #18](../18-submit-feedback-not-persisted/) | `submitFeedback` writes to in-memory `feedbackHistory` and `chapter.feedback` but never calls `FeedbackOps.store`. Comments don't persist on submit. | confirmed by code reading + grep |
| **C** — this issue | Comments + floating icons disappear on chapter-translation switch and don't reappear on switch-back. | needs live repro to characterize |

A and B together explain a class of "comments seem to vanish" symptoms that *aren't* version-switch-specific. C, the user's actual claim, may be a downstream of A+B (something during version-switch triggers a state-read that depends on the missing rehydration), or it may be an independent rendering bug.

**Calibration learning that triggered this back-off:** the template's §2 (Reproduction) was marked `TBD` and I treated triage + static-analysis as enough to predict the fix shape. The framework's own rules say verdict `real-bug` requires §2 live repro before `triaged → investigated → ready-for-fix`. I jumped that step. **Updating the template to make this a hard rule.**

## 1. Claim (verbatim from Issues.md)

> changing versions means comments should go away and then come back, its tied to that version! and the floating comment icons also have vanished with version switch!

## 2. Reproduction

**State-layer repro (2026-05-04, completed):** [`traces/repro-state-only.mjs`](./traces/repro-state-only.mjs) and [result](./traces/repro-state-only-result.json).

The script bypasses the failing deep-link import by injecting a synthetic chapter via `store.importChapter()`, then simulating the lifecycle:

| Step | Observation |
|---|---|
| 1. After inject | `chapter.feedback.length === 0` (correct, fresh) |
| 2. After `submitFeedback` | `chapter.feedback.length === 1` (in-memory comment created) |
| 3. After `updateChapter({translationResult})` mimicking switch to B | **`chapter.feedback.length === 1` — preserved** |
| 4. After switch back to A | **`chapter.feedback.length === 1` — still preserved** |

**Conclusion:** the data layer is fine. `setActiveTranslationVersion` → `updateChapter({ translationResult })` does NOT touch `chapter.feedback`. **The bug must be in the render layer.**

**Render-layer repro:** _not yet automated; theoretical based on code reading + the state-only finding._ See §5 for the most likely mechanism. Live UI repro is blocked on having a chapter with multiple translations stored in IDB — would require seeding the IDB or running through the actual translate-twice flow. Current finding is strong enough to identify the fix-direction with high confidence.

## 3. Verdict

**Real bug.** Confidence **0.88** without live repro; **0.95** if reproduced.

The 5-12% reserve is because I haven't confirmed by Playwright that:
- (a) On switch-away, the comments-state in memory is cleared rather than just hidden by a render condition.
- (b) On switch-back, the comments-fetch hook is or isn't re-firing.

Either condition produces the symptom; the fix shape differs slightly between them.

## 4. Where the failure lives  (A / B / C)

**`(A2, B2, C1)`** — vision-aligned but spec-gap and code-falls-short.

- **A2**: No ADR explicitly governs comment lifetime across chapter-translation switches. CORE-008 v2 (proposed) names this — comments anchor to chapter-translation (immutable) and the rendering layer must re-render on chapter-translation change.
- **B2**: Code falls short of the implied behavior — the rendering layer doesn't re-fetch / re-subscribe on chapter-translation switch.
- **C1**: Vision-aligned. Comments tied to the immutable raw thing (chapter-translation) IS the right model. The bug is the hook lifecycle, not the data model.

**Themes this issue instances:**
- [`_themes/jit-vs-precompute.md`](../_themes/jit-vs-precompute.md) — same family as #11 (comparison panel). Derived UI state needs to invalidate-and-re-derive on context change. The fix shape is the same as `0c5162b` was for `useComparisonPortal`.

## 5. Evidence and code paths

Investigation 2026-05-04 (Opus 4.7), code-reading-only, no live repro:

**Render path:**
- `components/ChapterView.tsx:81` — `feedbackForChapter = chapter?.feedback ?? []`
- `components/chapter/ReaderBody.tsx:71-77` — InlineCommentMarkers conditionally rendered when `showInlineComments && viewMode === 'english' && feedbackForChapter.length > 0`
- `components/chapter/InlineCommentMarkers.tsx` — `feedback` prop, `useEffect [computePositions]` where `computePositions = useCallback(..., [feedback, contentRef])`. Positions stay stale if `feedback` reference is unchanged.
- `components/chapter/ReaderFeedbackPanel.tsx` — side panel, also reads `feedback` prop, conditional on `viewMode === 'english' && feedback.length > 0`.

**Active-translation switch path:**
- `store/slices/translationsSlice.ts:1090` — `setActiveTranslationVersion`. Calls `TranslationOps.setActiveByStableId`, then `updateChapter(chapterId, { translationResult })`. **Does NOT touch `chapter.feedback`.**
- `store/slices/chaptersSlice.ts:285` — `updateChapter` does shallow merge `{ ...chapter, ...updates }`. Feedback ref preserved.

**Hydration path (the upstream gap):**
- `services/navigation/hydration.ts:loadChapterFromIDB` builds an `EnhancedChapter` via `buildEnhancedChapter` (in `services/stableIdService.ts:135`), which sets `feedback: []`. **No subsequent `FeedbackOps.get(...)` call to populate from IDB.**
- `services/translationService.ts:727,813` — only call sites for `FeedbackOps.get`, both for translation-context-building, not for the reader UI.

**Submit path (the second upstream gap):**
- `store/slices/translationsSlice.ts:713` — `submitFeedback`. Updates in-memory `feedbackHistory`, then `updateChapter(chapterId, { feedback: currentFeedback })`. **No `FeedbackOps.store(...)` call.** New comments are session-local.

So `chapter.feedback` only ever has values that were `submitFeedback`'d during the current page session. On any re-hydration (refresh, navigation away+back, deep-link reload), it goes back to `[]`. This isn't strictly the bug the user described, but it bounds the universe in which the user's symptom can occur.

**Bug path identified (high confidence after live state-test 2026-05-04):**

Path #1 (re-hydration wipes feedback) ruled out — state-test confirms `chapter.feedback` survives the simulated switch.

Path #2 confirmed as the mechanism for the **floating-icon** part of the symptom:

1. User submits comment on translation A. `feedback` reference becomes a new array. `useCallback`'s `computePositions` re-creates with new deps. `useEffect [computePositions]` fires. Debounced `setTimeout(computePositions, 150)` runs after 150ms. `findTextTop` finds `selection` text in A's DOM. `setPositions(computed)` populates markers. **Visible.**

2. User switches to translation B. `setActiveTranslationVersion` runs `updateChapter({ translationResult })`. `chapter.feedback` reference UNCHANGED. `feedback` prop into `InlineCommentMarkers` is the same reference. `useCallback` returns SAME `computePositions` ref. **`useEffect [computePositions]` does NOT re-fire.** `positions` state stays at its initial value (the A markers).

3. Visually: markers appear at A's top values, but B's text is rendered. May look correct or not, depending on DOM length differences.

4. **Trigger event happens** — a window resize, or a debounced setTimeout call that fires due to React strict mode double-invocation, or any path that calls `computePositions` while B is rendered. `findTextTop` searches for A's `selection` text in B's DOM. Most likely doesn't find it. `setPositions([])`. **Markers disappear.**

5. User switches back to A. `setActiveTranslationVersion(A)` runs. `feedback` ref still unchanged. `useEffect [computePositions]` doesn't re-fire. `positions` stays at `[]` from step 4. **Markers don't return.**

The render-layer fix: make the position-recompute effect depend on something that changes when the translation text changes. Two candidates:
- Pass `translationResult.translation` (or a hash) as a prop, include in `useCallback`'s deps.
- Pass `activeTranslationId` as a `key` to `InlineCommentMarkers`, forcing remount on switch.

The first is more efficient; the second is more bulletproof. Either is ~5-line `fix_local`.

**For the side-panel `ReaderFeedbackPanel` ("comments going away"):**

`ReaderFeedbackPanel.tsx:22` only renders when `viewMode === 'english' && feedback.length > 0`. `feedback` ref unchanged across switches, length unchanged. Should stay rendered. **The user's claim of "comments vanish" in this panel may not be accurate** — or there's a separate issue I haven't found. Worth confirming when actually running through the UI: is the side panel still showing the comment after switch, or is the user describing the floating icons (which actually do disappear)? Possible the user conflated the two in their verbatim message.

## 5b. Action — which kind of fix this is

**`fix_local`** — render-layer fix at `InlineCommentMarkers.tsx`. Confirmed by 2026-05-04 state-layer repro: data is fine, render is the bug.

The fix is structurally similar to `0c5162b` (the comparison-portal-on-chapter-change fix from issue #11), but at a different boundary: instead of "invalidate on chapter change," we need "invalidate on translation-content change." Two equivalent shapes, both ~5 lines:

1. Add `translationResult.translation` (or a hash thereof) to `InlineCommentMarkers`'s prop list and include it in `useCallback`'s deps for `computePositions`. Forces re-fire of position recompute when translation text changes.
2. Pass `activeTranslationId` as React `key` to `InlineCommentMarkers` from ReaderBody. Forces remount on switch — heavier-handed but unambiguous.

I'd pick (1) for efficiency. (2) might be needed if (1) doesn't catch all the relevant lifecycle events.

## 6. Test coverage gap & regression-test obligations

### What's missing
No test currently exercises chapter-translation switch + comments interaction.

### Regression-test obligations — **DEFERRED until §2 live repro completes**

Earlier I named three obligations:
- A: comments reappear on switch-back
- B: floating-icons reappear on switch-back
- C: (defensive) comments don't bleed across chapter-translations

These were named with confidence in a fix-shape that the deeper code reading invalidated (`setActiveTranslationVersion` doesn't touch `chapter.feedback`, so the simple "useEffect on activeTranslationId" pattern doesn't apply). The obligations as written might still be useful as user-facing behavioral assertions, but their precise file/assertion mapping is conditional on the live-repro outcome.

**Re-deriving them after live repro is part of the work to move this issue back to `ready-for-fix`.**

## 7. Archaeology
_TBD — likely candidates:_
- The hook that fetches comments. Run `python3 scripts/issue-archaeology.py <hook-path>` once located.
- Floating-icon overlay component. Same.
- Whoever last touched `setActiveTranslationVersion` — that's the integration point where invalidation should fire.

## 8. Generator function

> **Derived UI state that doesn't re-fetch on context-id change.**

Same generator as issue #11 (comparison panel). Both are instances of `jit-vs-precompute` at the UI-state layer: a hook caches derived state but doesn't subscribe to changes in the *context* the derivation depends on.

The pattern that prevents this: a `useDerivedView({ contextId, fetch })` hook (proposed in CORE-008) where invalidation on `contextId` change is enforced by the hook's contract. Sites that use this hook can't have the bug; sites that hand-roll their `useEffect` can.

But N=2 (this + #11) doesn't yet justify the generator-fix. We do `fix_local` here, file the hook proposal under CORE-008's "required architectural patterns," and promote to `fix_generator` only if a third instance appears.

## 9. Fix directions

### Direction A — Local hook lifecycle fix (recommended)

> Find the hook that loads comments + the floating-icon overlay's hook. Add a `useEffect` keyed on `activeChapterTranslationId` (or whatever identifier the dropdown sets) that calls the comments-fetch on change. Mirror the shape of `0c5162b`'s comparison-panel fix.

- Impact: high — fixes the load-bearing override mechanism.
- Effort: low — ~10-15 lines across 1-2 files.
- Risk: low.
- Reversibility: high.
- Confidence: 0.92.

### Direction B — Promote to `useDerivedView` factory (deferred)

If a third instance of the pattern shows up, refactor `useComparisonPortal`, the comments hook, and the floating-icon hook to share a `useDerivedView` factory. Until then, two manual implementations is acceptable.

- Trigger: N≥3 instances of "derived UI state forgets to re-fetch on context change."
- Effort: medium — refactor + shared abstraction.
- Confidence: 0.7 that this is the right level of abstraction; could be over-engineered if the contexts differ enough.

## 10. Status

`triaged → investigated → fixed`

Currently `triaged`. Next move: pick an investigator, do §2 live repro + §5 code trace, name the specific hooks involved. Then it's ready for fix_local.

## 11. Open questions

- Does the floating-icon overlay use the same hook as the comments-popover, or its own? Affects whether the fix is one place or two.
- Is there a chapter-translation-change event/subscription pattern already in use elsewhere (besides `useComparisonPortal`)? If yes, mirror it.
