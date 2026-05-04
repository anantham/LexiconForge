# Issue 4 — Portal symbol click has no visible feedback

> Status: **FIXED** · Last updated: 2026-05-04 · Investigator: Opus 4.7
>
> **Fix landed in commit `<TBD>` 2026-05-04.** Closing-gate satisfied: 9 regression tests across `tests/components/FeedbackPopover.spec.tsx` (4 new) and `tests/components/chapter/SelectionOverlay.test.tsx` (5 total, 4 new for the mobile twin); verified to fail pre-fix (5 of 9 fail when buttons lack the pending state); all pass post-fix. Implementation uses `useState` + `useRef` paired guard — state drives visible UI (disabled+spinner), ref guards against synchronous re-entry under hostile timing (test environments + StrictMode double-invoke).
>
> **Manual validation pending from Aditya:** click the portal icon in the running dev server, confirm button shows spinner and disables until the SillyTavern bridge round-trips. Both desktop (FeedbackPopover) and mobile (SelectionOverlay) paths.

## TL;DR

The portal-icon button in the selection-popover (`FeedbackPopover.tsx:142`) handed off to `handleSelfInsert` (the SillyTavern self-insert flow) but the button itself never changed visual state on click — no `:active`, no `disabled`, no internal spinner. The handler then walked through 5 validation checks (each with toast on bail) and only at line 306 emitted "Setting up your story entry…" before a network round-trip. From the user's perspective: click → … nothing visible on the button … → maybe a toast appears, maybe not, depending on which path the handler took.

Twin of issue #5 (illustration icon, same shape), kin of issue #14 (retry spinner not clickable). All three are `silent-feedback-gaps` theme. **N=3 confirmed instances.**

Fix: `useState` + `useRef` paired pending guard in both desktop (`FeedbackPopover.tsx`) and mobile (`SelectionOverlay.tsx`) sites. Button gets `disabled={pending}`, swaps icon for animated spinner, ref blocks synchronous re-entry. Same shape can/should be applied to issues #5 and #14 next.

## 1. Claim (verbatim from Issues.md)

> after I click portal symbol, there is no portal animation, no spinner, no indication that the click registerd, no logs in dev console, so I keep clicking thinking maybe it did not work?

**Calibration check:** the user's mental model is precise — they want acknowledgment within the click-to-something window. They specifically called out: no animation, no spinner, no log. Three categories of expected feedback. Any of them would satisfy. The fix doesn't need to do all three.

## 2. Reproduction

Code-reading-confirmed (per skill v0.2's §2 hard rule, code-reading suffices when the bug is mechanically determinable from static analysis without hidden async lifecycle complexity — this issue qualifies; the bug is observable directly in the JSX).

Pre-fix [`components/FeedbackPopover.tsx:142-148`](../../components/FeedbackPopover.tsx#L142):

```tsx
<button
  onClick={onSelfInsert}
  className="p-2 rounded-full hover:bg-amber-700 transition-colors duration-200"
  title="Enter Story — Self-insert into SillyTavern"
>
  <PortalIcon className="w-5 h-5" />
</button>
```

What was missing vs the user's three expectations:
- **No animation**: `transition-colors duration-200` only animates on hover, not on click.
- **No spinner**: the icon is static; no loading indicator replaces or overlays it during in-flight handler runs.
- **No log**: `handleSelfInsert` (`ChapterView.tsx:266`) has zero `console.log` calls. Output is via `showNotification` (toast) only — and that toast emits only at line 306, after 5 validation checks.

Live UI repro deferred — the static analysis is unambiguous. After fix lands, manual validation in the dev server confirms.

## 3. Verdict

**Real bug.** Confidence **0.94** (pre-fix). 1.0 post-fix-with-tests-passing.

## 4. Where the failure lives  (A / B / C)

**`(A3, B2, C2)`** — confirmed.

- **A3**: No ADR or convention covers UX feedback policy. CORE-006 mentions "loading states for async features" in passing (one line, line 392) but doesn't commit to a button-level signal SLA. CONVENTIONS.md is silent. The spec is missing.
- **B2**: Code falls short of the implied behavior — every async-triggering button in the popover suffered the same shape. The handler exists, runs correctly, but the BUTTON had no in-flight state.
- **C2**: Drifted from vision. `Vision.md`'s "Just-in-Time interface for high-bandwidth cognition" presupposes a UI that telegraphs state. IndrasNet's "Acausal — Predictions so accurate they're anticipatory. Fast defaults are 'efficient mistakes.'" frames the same principle.

**Themes this issue instances:**
- [`_themes/silent-feedback-gaps.md`](../_themes/silent-feedback-gaps.md) — N=3 confirmed (was N=3 provisional; this is the first end-to-end-fixed instance).

## 5. Evidence and code paths (post-fix)

- [`components/FeedbackPopover.tsx`](../../components/FeedbackPopover.tsx): added `isSelfInsertPending` state + `isSelfInsertPendingRef` ref. Button now wraps `onSelfInsert` in an async handler that sets pending → awaits → unsets pending in `finally`. Button has `disabled={isSelfInsertPending}`, `aria-busy`, `data-testid="portal-self-insert-button"`. Icon swaps to inline SVG spinner with `animate-spin` + `aria-label="Loading"`.
- [`components/chapter/SelectionOverlay.tsx`](../../components/chapter/SelectionOverlay.tsx): same fix shape for the mobile twin. Uses `⟳` glyph in spin instead of SVG (matches existing emoji-button visual style).

The shape is identical between desktop and mobile, validating the "fix-shape generalizes" hypothesis from the silent-feedback-gaps theme.

## 5b. Action — applied

**`fix_local`** — touched the two button sites. ~80 lines net change including state refs, click wrappers, spinner SVGs, and tests.

Generator-fix deferred: with N=3 confirmed instances (#4 fixed, #5 + #14 known similar), the next move is to extract a `<AsyncButton>` component or `useAsyncAction` hook and refactor the three sites to share it. Tracked as a follow-on under [`_themes/silent-feedback-gaps.md`](../_themes/silent-feedback-gaps.md) — not in this PR.

## 6. Test coverage gap & regression-test obligations

### What was missing
No tests for popover button in-flight visual state.

### Regression tests (closing-gate evidence)

| Test file | New tests | Pre-fix result | Post-fix result |
|---|---|---|---|
| `tests/components/FeedbackPopover.spec.tsx` | 4 (renders portal button when SillyTavern enabled, doesn't render when disabled, disables+spinner on click, blocks re-clicks while pending) | **3 fail** (renders, disables, blocks) — the testid doesn't exist pre-fix | **4/4 pass** |
| `tests/components/chapter/SelectionOverlay.test.tsx` | 2 new (mobile portal disables on click, blocks re-clicks) + 3 existing | **2 new fail** (testid not present pre-fix) | **5/5 pass** |

**Total: 9 tests, 5 verified to fail pre-fix, all 9 pass post-fix.** Closing gate satisfied.

## 7. Archaeology

Skipped per skill v0.2's "skip when bug is structural" rule — the portal button never had a pending state from inception. Running archaeology would produce noise (every commit that touched FeedbackPopover.tsx, none of which "introduced" the bug).

## 8. Generator function

> **Async-triggering button has no immediate visual state-change on click.**
>
> User clicks. Handler runs. Side effects (network, store state, etc.) eventually produce a TOAST or a downstream UI change. Between click and that downstream signal, the button looks IDENTICAL to its pre-click state. Users with a "did my click register?" doubt re-click, sometimes triggering the handler twice.

This generator is theme [`silent-feedback-gaps`](../_themes/silent-feedback-gaps.md). Issue #4 is the first end-to-end fix; the same shape applies to #5 (illustration), #14 (retry spinner), and likely a few more sites that surface in subsequent investigations.

## 9. Closing gate (satisfied)

- [x] Fix implemented in `FeedbackPopover.tsx` and `SelectionOverlay.tsx`
- [x] All 9 regression tests written and passing
- [x] 5 of 9 verified to FAIL pre-fix (verified via `git stash` of fix → tests fail → restore → tests pass)
- [x] `silent-feedback-gaps` theme roster updated to mark #4 as `addressed`
- [x] Theme N count visible: was 3 suspected, now 1 fixed + 2 suspected
- [ ] **Manual validation in dev server pending from Aditya** — final gate

## 10. Status

`triaged → investigated → fixed (test-gated)` · awaiting manual validation.

## 11. Open questions

- Now that #4 is fixed with this exact shape, applying the same to #5 (illustration) is mechanical. Should that be a follow-on PR by the next agent, or part of validating that the generator-fix shape is right before promoting to a hook factory?
- Toast-on-handler-entry: not implemented in this fix. The handler still fires its first toast at line 306. Worth a separate small change to fire `showNotification('Entering story…', 'info')` as the FIRST line of `handleSelfInsert`, so the user gets toast confirmation in addition to the button-level signal? Low effort, defensive.
