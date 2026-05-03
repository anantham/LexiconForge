# Issue 16 — Chapter-translation switch loses comments and floating-comment icons

> Status: **triaged · high priority** · Last updated: 2026-05-03 · Investigator: Opus 4.7

## TL;DR

**Real-bug, `fix_local`, UI re-render lifecycle, no data-model change.** This is the **load-bearing override mechanism** that makes auto-active-on-translate (issue-discovered behavior) acceptable. Without working switch-back-and-see-comments-again, generating a new translation effectively traps the user on the latest. So this isn't a UI papercut — it's the escape hatch for the entire auto-promote default.

Earlier confusion (mine): I read this as "comments are tied to version, and that's the bug — decouple them." Wrong. The user's verbatim claim says comments **should** be tied to the chapter-translation; the bug is they don't reappear when you switch back. Re-reading helped. Calibration learning logged in template.

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
_TBD — needs a 30-min trace through:_
- Where comments are loaded for the current chapter-translation. Likely a hook in `hooks/` or a slice subscription in `store/slices/`.
- Where the active chapter-translation changes flow through state — `setActiveTranslationVersion` at `store/slices/translationsSlice.ts:1090` is the likely entry point.
- Floating-comment icons: separate component, separate state — needs locating.

## 5b. Action — which kind of fix this is

**`fix_local`** — not a generator-class refactor; just a hook re-subscription / re-fetch on chapter-translation change at the comments rendering site.

This is structurally identical to commit `0c5162b` (the comparison-panel-on-chapter-change fix from issue #11): a `useEffect` that invalidates-and-re-fetches on the relevant identifier change. Pattern is established; apply it here.

If during implementation the same shape needs to be applied to floating-icon overlays AND the popover panel AND any other chapter-translation-tied UI, that's evidence for the `useDerivedView(contextId, derive)` hook factory proposed in CORE-008 — but for *this* issue, we're not promoting to generator yet. N=1 instance of "comments specifically lose state on chapter-translation switch."

## 6. Test coverage gap & regression-test obligations

### What's missing
No test currently exercises chapter-translation switch + comments interaction.

### Regression-test obligations (HARD GATE)

| Defect | Required regression test | Where |
|---|---|---|
| **A** — Comments don't reappear when switching back to a chapter-translation that had comments | Render the chapter view with chapter-translation A (with one comment in IDB anchored to A's chapter-translation-id). Assert comment renders. Switch active to B. Assert comment is hidden (not just invisible — fetched-state should be cleared OR the render predicate should be off). Switch active to A. **Assert comment renders again.** | `tests/components/chapter/Comments.test.tsx` (new) or extend an existing comments test |
| **B** — Floating-comment icons don't reappear on switch-back | Same shape, but assert the floating-icon overlay is present in the DOM after switch-back. The overlay is a separate component from the popover; it has its own state lifecycle. | Same test file — second assertion in the same test, or split if cleaner |
| **C** — (defensive) Comments don't bleed across chapter-translations | Render chapter-translation A with comment-on-A. Switch to chapter-translation B (no comments). Assert comment-on-A is NOT rendered. Catches a regression where someone "fixes" the re-render bug by always rendering all comments regardless of chapter-translation. | Same file |

These tests should fail today against the unfixed code (specifically test A and B; test C might already pass if the original bug is "doesn't re-fetch" rather than "fetched but kept hidden"). Verify failure-pre-fix in the PR.

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
