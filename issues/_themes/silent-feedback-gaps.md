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

| # | What's missing | Provisional class |
|---|---|---|
| 4 | Portal symbol click → no portal animation, no spinner, no log, no toast. User keeps clicking. | `(A3, B2, C2)` |
| 5 | Illustration icon click → no signal until the prompt-construction phase finishes (which itself takes time) | `(A3, B2, C2)` |
| 14 | Failed translation: red retry spinner is visually present but not clickable; failed state is dead-end | `(A3, B2, C2)` |

All three are `A3` — there is no UX policy ADR or convention that says "every async user action must emit a signal within Nms."

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
