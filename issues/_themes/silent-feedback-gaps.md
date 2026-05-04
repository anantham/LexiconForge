# Theme — Silent Feedback Gaps

## Statement

> User performs an action (clicks portal, clicks illustration icon, retries failed translation). Async work begins. **No UI signal** appears between the click and the much-later "real" feedback (image preview, translation prompt, retried result). User clicks again, thinking the first click failed.

## Why this matters

The IndrasNet vision (`../../../TemporalCoordination/docs/indrasnet/PHILOSOPHY_ALIGNMENT_NOTES.md`) explicitly names this:

> **Acausal** — Predictions so accurate they're anticipatory. Fast defaults are "efficient mistakes."

A click without an immediate signal is the opposite — the system is internally responsive but externally indistinguishable from a dead button. The fast default ("show me you heard me") is not a luxury; it's a vision-level commitment. From `Vision.md`, the affordances "guide the eye" and "subtly color code" — both presuppose a UI that telegraphs state. Silent buttons betray that.

## The shape

```tsx
<button onClick={async () => {
  await someAsyncWork();        // takes 3-30 seconds
  setSomeState(result);         // ← only feedback fires here
}}>
  Click me
</button>
```

What's missing: an immediate `setSomeState({ status: 'pending' })` before the await. A spinner overlay. A toast. *Any* signal.

## Instances (current)

| # | What's missing | Class | Status |
|---|---|---|---|
| 4 | Portal-icon button has no pending visual state; handler emits toast only at line 306 of `handleSelfInsert`, after 5 validation checks | `(A3, B2, C2)` | **FIXED 2026-05-04** — `useState` + `useRef` pending guard in both `FeedbackPopover.tsx` (desktop) and `SelectionOverlay.tsx` (mobile); 9 regression tests passing |
| 5 | Illustration-icon button has same shape — no immediate visual feedback between click and prompt construction | `(A3, B2, C2)` | **FIXED 2026-05-04** — twin of #4, fixed mechanically using same pattern; 1200ms minimum-duration acknowledgment in both `FeedbackPopover.tsx` (desktop) and `SelectionOverlay.tsx` (mobile); 2 new regression tests passing |
| 14 | Failed translation: header retranslate button disabled (gray); inline failure UI had no retry control. Different fix-shape from #4/#5 — see issue #14 §5 | `(A3, B2, C2)` | **FIXED 2026-05-04** — `canManualRetranslate` extended to include failed state; new "Retry translation" button in inline failure UI with silent-feedback-gaps pending-state pattern; 4 new regression tests passing |

All three are `A3` — there is no UX policy ADR or convention that says "every async user action must emit a signal within Nms."

**Theme reaches N=3 confirmed-fixed on 2026-05-04** (was N=3 suspected before the #4 investigation kicked off this session).
- #4 (portal): fixed with `useState` + `useRef` + spinner-on-click. Async handler awaited.
- #5 (illustration): fixed with same pattern but timeout-bounded duration (1200ms). Sync fire-and-forget handler.
- #14 (retry): fixed with same pattern but externally-cleared pending state (clears when `translationError` clears). Plus a separate fix-aspect: enabling `canManualRetranslate` in the failed state.

The three variants share a button-level pending-state shape but differ in pending-bound semantics (await / timeout / external-signal) and re-entry guard mechanism. Generator-fix (`<AsyncButton>` / `useAsyncAction`) is now empirically grounded but needs to support all three shapes — design spec lives in the three issue READMEs collectively. Not extracting in this round; deferred to a dedicated session.

## Leverage point

**Two complementary moves**, both light:

1. **Write a UX-policy ADR.** Working title: `CORE-010-immediate-action-feedback`. One paragraph: every user-initiated async action MUST update visible UI within 16ms (one frame) of the click. Acceptable signals: spinner overlay, button-state change, toast, animation start, log line in the dev console at minimum.

2. **Provide a utility component.** A small `<AsyncButton>` wrapper or `useAsyncAction` hook that pairs the click handler with an automatic pending-state, so the policy is the path of least resistance, not extra work.

Once both exist, issues 4, 5, 14 collapse to "use the wrapper at the click site."

## Connection to other themes

- **silent-failure-deep**: feedback gap on a failure is even worse than feedback gap on success — user assumes nothing happened, retries, racks up retries against a deterministic failure.
- **completion-only-guards**: a click that fires a single-flighted async means the second click is a no-op. The signal still has to fire on the second click, even if the work isn't redone, otherwise the user gets the silent-button experience anyway.

## Tests that would have caught this earlier (none exist)

- Playwright assertion: "click portal → some DOM mutation occurs within N frames."
- Same for illustration icon.
- "Failed translation row has a clickable retry control."
