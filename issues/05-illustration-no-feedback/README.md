# Issue 5 — Illustration icon click has no visible feedback (until prompt)

> Status: **FIXED** · Last updated: 2026-05-04 · Investigator: Opus 4.7
>
> **Twin of issue #4** — see [`../04-portal-no-feedback/README.md`](../04-portal-no-feedback/README.md) for the full investigation. This file follows the skill v0.2 twin-issues handling pattern (skip-and-reference): same bug shape at a different site, mostly mechanical port. Skipping §4-§9 since the deltas are small and documented inline below.

## 1. Claim (verbatim from Issues.md)

> same with illustration icon, no indication that image is being generated, I mean from clicking the icon to the point when the image prompt is made, after that there is the spinner and everything is great

## 2. Reproduction

Code-reading-confirmed (per skill v0.2 §3 hard rule). The illustration button in [`components/FeedbackPopover.tsx:124`](../../components/FeedbackPopover.tsx#L124) and [`components/chapter/SelectionOverlay.tsx:115`](../../components/chapter/SelectionOverlay.tsx#L115) had no in-flight visual state — clicking dispatched `onFeedback({ type: '🎨' })` synchronously and returned. The downstream image generation has its own spinner that appears later (after the prompt is constructed); the bug is the gap between click and that downstream signal.

## 3. Verdict

**Real bug** — twin of #4. Confidence **0.95** pre-fix, 1.0 with tests in.

## Differences from #4

The shape isn't perfectly identical; the differences shape the fix:

| Axis | #4 (portal) | #5 (illustration) |
|---|---|---|
| Handler shape | `onSelfInsert: () => Promise<void>` (async, awaitable) | `onFeedback: (item) => void` (sync fire-and-forget) |
| Pending duration | Tied to `await` resolving | Fixed-duration timeout (1200ms) — long enough to feel like acknowledgment, short enough that the downstream spinner overlaps cleanly |
| Re-entry guard | `useRef`-based synchronous check | Timeout-bounded; state-only guard suffices |

The 1200ms duration is empirical: long enough to register as "click acknowledged" without overstaying the welcome of the downstream image-generation spinner. If user testing reveals the gap is consistently longer or shorter, this is the knob to turn — or the pattern auto-tunes from observed delays once we have telemetry.

## 4. Where the failure lives  (A / B / C)

**`(A3, B2, C2)`** — same as #4. No UX-feedback ADR exists; code lacks immediate signal; vision drifted (acausal/anticipative principle).

**Theme:** [`silent-feedback-gaps`](../_themes/silent-feedback-gaps.md) — N=2 confirmed (was N=1 confirmed + 2 suspected).

## 5. Action — applied

**`fix_local`** — same shape as #4 in both desktop (`FeedbackPopover.tsx`) and mobile (`SelectionOverlay.tsx`). The mechanical port took ~15 minutes including tests.

This twin port validates the prediction made when investigating #4: the silent-feedback-gaps fix shape generalizes to other async-triggering buttons. With #4 + #5 both confirmed-fixed using the same pattern, the case for extracting `<AsyncButton>` / `useAsyncAction` as the generator-fix becomes empirical rather than speculative.

## 6. Closing gate

- [x] Fix implemented in `FeedbackPopover.tsx` (desktop) and `SelectionOverlay.tsx` (mobile)
- [x] Regression tests added: 2 new in `tests/components/FeedbackPopover.spec.tsx` (pending-state-on-click + blocks-re-clicks-during-window)
- [x] Verified to fail pre-fix (the new tests look for `data-testid="illustration-button"` which didn't exist pre-fix)
- [x] All tests pass post-fix (11/11 across desktop + mobile + portal + illustration)
- [x] Theme roster updated to mark #5 as `addressed`
- [x] Theme N count: was 1 fixed + 2 suspected; now 2 fixed + 1 suspected (#14 retry-spinner remains)
- [ ] **Manual validation pending from Aditya** — click the 🎨 icon in the dev server, confirm spinner shows for ~1.2s

## 7. Status

`triaged → fixed (test-gated)` · awaiting manual validation.

## 8. Open questions

- The 1200ms is empirical. If user testing shows the downstream spinner consistently appears at a different cadence, the duration becomes a setting or auto-tunes from observed delays. Defer until evidence accumulates.
- After #14 (retry spinner) is also fixed, three confirmed instances justify extracting the pattern into `<AsyncButton>` or `useAsyncAction`. The twin-issues skip-and-reference pattern in this README is itself evidence that the pattern is mature enough to abstract.
