# Issue 16 — Chapter-translation switch loses comments and floating-comment icons

> Status: **triaged — needs §2 live repro before ready-for-fix** · Last updated: 2026-05-04 · Investigator: Opus 4.7

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
_TBD — testable manually:_
1. Open a chapter with multiple chapter-translation versions in the dropdown.
2. Make a comment on chapter-translation A.
3. Switch via the dropdown to chapter-translation B. Comment should disappear (correct).
4. Switch back to A. **Comment + floating-comment icons should reappear. They don't.**

Live repro at `localhost:5180` after a chapter has multiple versions; this gets done when an investigator picks this up. The static-analysis verdict is high enough confidence to act on now without live repro blocking the fix-direction.

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

**Plausible bug paths for the user's stated symptom (need live repro to disambiguate):**
1. Translation switch is somehow triggering re-hydration that wipes `chapter.feedback`. (Unlikely given the code, but possible via some side-effect chain I haven't traced.)
2. The `findTextTop` lookup in `InlineCommentMarkers.tsx:16` fails when the new translation's text doesn't contain the comment's `selection` string — markers don't render. On switch-back, `useEffect` doesn't re-fire because deps didn't change, so positions stay stale. The icons don't "reappear" because they're not being recomputed against the now-correct DOM.
3. A different code path I haven't found.

Path #2 is the most plausible given current code. It would render as: comments visible in side panel (ReaderFeedbackPanel) BUT floating icons mispositioned/missing in body. The user says BOTH go away, which would only fit #2 if the side panel also has a similar conditional render bug — possible since it shares the `feedback.length > 0` predicate but doesn't filter by translation match. Worth checking under live repro.

## 5b. Action — which kind of fix this is

**`wait` until live repro is done.** Earlier I marked this `fix_local` based on static analysis only; pulling that back. The fix-direction depends on the live-repro outcome:

- If the symptom is "comments visible during session, but version-switch causes a re-hydration that resets them": fix is at the rehydration site (probably tied to issue #17 — load feedback from IDB during `loadChapterFromIDB`).
- If the symptom is "InlineCommentMarkers' positions don't recompute on translation-text change": fix is local to the marker hook (still `fix_local`, but a different hook than I'd find without the repro).
- If the symptom is "ReaderBody's conditional render on `feedbackForChapter.length > 0` flips somehow": deeper trace needed.

The `0c5162b` shape may or may not apply; without live evidence the assumption is unsafe.

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
