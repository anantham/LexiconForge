# Issue 14 — Failed translation has no retry path

> Status: **FIXED** · Last updated: 2026-05-04 · Investigator: Opus 4.7
>
> **Same-theme as #4 + #5 but different fix shape.** Per skill v0.2 twin-issues handling, this is NOT a skip-and-reference — the deltas are meaningful enough to warrant §4-§9.

## TL;DR

When a translation fails, the user sees an inline "Translation Failed" red box with the error text — and **no retry button**. The header retranslate button is also disabled because `canManualRetranslate = !!translationResult` and there's no result in the failed state. Result: the failed state is a dead-end; the user has to navigate away and come back, or change a setting to force re-translation.

Two-part fix:
- `canManualRetranslate` derivation extended to also be true when `translationError` is set, so the header button becomes clickable.
- New "Retry translation" button rendered inline in the failed-state UI (same place the user is already looking), with the silent-feedback-gaps pending-state pattern.

This brings silent-feedback-gaps theme to **N=3 confirmed-fixed**, crossing the threshold where extracting a shared primitive (`<AsyncButton>` / `useAsyncAction`) becomes a refactor rather than speculation. Notes on what that primitive should look like in §8.

## 1. Claim (verbatim from Issues.md)

> file:///var/folders/68/c0w7ryfj66xdbs8v0yx662h00000gn/T/TemporaryItems/NSIRD_screencaptureui_E17Pjj/Screenshot%202026-04-08%20at%2011.32.05%E2%80%AFPM.png - if translation fails then the retry red spinner should be clickable it should not just be like this

**Calibration check:** the user used "spinner" but in the failed state there shouldn't be an actual animation — most likely the user is referring to the round red icon (the `RefreshIcon` in the header retranslate button) and/or the red error box. The fix-shape interprets "spinner should be clickable" as "the failure state needs a clear retry path" — and provides one in both places (header button + inline button) to be safe.

## 2. Reproduction

Code-reading-confirmed (per skill v0.2 §3 hard rule). The bug is mechanically determinable from static analysis:

- `components/ChapterView.tsx:104` (pre-fix): `const canManualRetranslate = !!translationResult;` — false in failed state.
- `components/chapter/TranslationStatusPanel.tsx:81`: `retranslateDisabled = !canManualRetranslate && !isRetranslationActive;` — true in failed state (no result + not actively retranslating).
- `components/chapter/ChapterHeader.tsx:151`: `disabled={retranslateDisabled}` on the retranslate button.
- `components/chapter/ChapterContent.tsx:118-127` (pre-fix): renders the failed-state red box with NO retry control.

Net: failed state shows a dead-end. Verified by writing the failing-pre-fix tests and observing them fail.

## 3. Verdict

**Real bug.** Confidence **0.97**.

## 4. Where the failure lives  (A / B / C)

**`(A3, B2, C2)`** — same as #4 and #5.

- **A3**: No ADR or convention covers UX policy for failure-state recoverability. Same gap as silent-feedback-gaps theme broadly.
- **B2**: Code falls short — the failure UI exists (good!), but lacks a recovery action.
- **C2**: Drifted from vision. IndrasNet's "fast defaults are 'efficient mistakes'" — a failed action with no retry path forces the user into a slow, manual recovery (navigate away, come back). The fast default should be "let me click again."

**Theme:** [`silent-feedback-gaps`](../_themes/silent-feedback-gaps.md) — third confirmed-fixed instance.

## 5. Same theme, different fix shape

A pure twin port of #4 wouldn't fix this. The differences:

| Axis | #4 + #5 (silent click) | #14 (failed-state recovery) |
|---|---|---|
| Pre-bug condition | Click works; user sees no acknowledgment | Failure happened; user can't even click |
| Fix layer | Add pending state to the button itself | First fix: enable the button; then fix: add a retry button to the failed-state UI |
| Pending-state shape | Same as #4/#5 (useState + spinner swap) — the retry button itself benefits from the silent-feedback-gaps fix once it exists | — |

So #14's fix has TWO concerns:
1. Make the path from failed-state to retry exist at all (the "no recovery action" bug).
2. Make THAT new retry button itself satisfy the silent-feedback-gaps pattern (avoid creating a new instance of the bug we just fixed for #4/#5).

Both done in the same commit.

## 6. Test coverage gap & regression-test obligations

### What was missing
No tests for:
- Failed-translation state having a retry control
- `canManualRetranslate` being true in the failed state

### Regression tests added (closing-gate evidence)

`tests/components/chapter/ChapterContent.test.tsx` (extended, +4 new tests):

| Test | Pre-fix | Post-fix |
|---|---|---|
| Renders no retry button when `onRetryTranslation` undefined (default-off) | passes (button absent) | passes |
| Renders retry button when `onRetryTranslation` provided | **fails** (testid not found) | passes |
| Click fires handler + shows pending state (disabled, aria-busy, "Retrying", spinner SVG) | **fails** | passes |
| Re-clicks during pending window are blocked | **fails** | passes |
| Pending state clears when `translationError` clears (e.g. retry started) | **fails** | passes |

Pre-fix: 4 of 5 new tests fail. Post-fix: all 14 ChapterContent tests pass (10 existing + 4 new).

## 7. Archaeology

Skipped per skill v0.2 §7 skip-conditions — the bug is structural (the failed-state UI never had a retry button from inception; `canManualRetranslate` was always defined as `!!translationResult` from the day it was wired). No introducing commit to find.

## 8. Generator function

> **Failure UI without a recovery action; OR action available but only in a non-discoverable site.**
>
> The user reaches a failed state (translation failed, image generation failed, import failed). The failure UI announces what went wrong but provides no path forward. The retry mechanism either doesn't exist or lives somewhere far from the user's eye-line.

This is a sub-pattern of [`silent-feedback-gaps`](../_themes/silent-feedback-gaps.md): the broader theme is "feedback gap on user-initiated async work"; #14's variant is specifically "feedback gap on FAILURE recovery."

**Other places to check (deferred):**
- Image generation failures — does the failed-image UI have a retry path right there, or do users have to find it elsewhere?
- Import failures — if the deep-link import fails (#1's case), is there an inline "retry import" button?
- Audio generation failures — same question.

These would each be `fix_local` with the same shape if they're genuine instances.

## 8a. Theme reaches N=3 — `<AsyncButton>` extraction is now empirical

With #4 + #5 + #14 all fixed using variations of the same pattern, the case for a shared primitive is no longer speculative. But the three variants ARE different enough that extracting one primitive is a real design question:

| Issue | Pending bound by | Re-entry guard | Notes |
|---|---|---|---|
| #4 (portal) | `await` resolution of an async handler | `useRef` (synchronous) | Handler is a Promise-returning function |
| #5 (illustration) | Fixed timeout (1200ms) | Timeout-bounded | Handler is sync void; downstream signal isn't observable from here |
| #14 (retry) | External signal (translationError clears) | `useRef` + state | Handler is sync but outcome is observable in props |

A unified `useAsyncAction(action, { kind, ...opts })` hook is feasible but it's specifically a **3-shape primitive**, not a 1-shape primitive. The skill's "fix_generator" suggestion — extract a primitive once N≥2 confirmed — needs to be tempered with the recognition that not all instances of a theme share the same fix shape; the primitive needs to support multiple shapes.

I'm not building the primitive in this fix. Documented here for the next session that wants to do the generator-fix; the three issue READMEs collectively are the design spec.

## 9. Closing gate (satisfied)

- [x] Fix implemented in `components/ChapterView.tsx` (canManualRetranslate derivation + onRetryTranslation prop wiring) and `components/chapter/ChapterContent.tsx` (inline retry button)
- [x] 4 regression tests written and passing
- [x] Pre-fix verification: 4 of 4 new tests fail (verified via `git stash` of fix → tests fail → restore → tests pass)
- [x] silent-feedback-gaps theme roster updated to mark #14 as `addressed`
- [x] Theme N count: was 2 fixed + 1 suspected; now 3 fixed
- [x] Calibration learning logged in §1: "user said spinner; meant icon-and-error-box-no-retry-path"
- [ ] **Manual validation pending from Aditya** — trigger a translation failure (e.g., bad API key), confirm the inline retry button is visible and works, AND the header retranslate button is also clickable

## 10. Status

`triaged → fixed (test-gated)` · awaiting manual validation.

## 11. Open questions

- Should the inline retry button also handle the "retranslating" state (cancel button) for consistency with the header button? Current implementation: only renders when `translationError` is set, so it can't show during retranslating. Probably OK — the header button covers cancel; the inline button covers retry.
- Should the failed-state UI also show "what to try" hints based on the failure type (e.g., "this looks like a rate-limit; try a different provider")? `translationErrorTelemetry.failureType` is already plumbed for telemetry; could drive UX hints. Out of scope for this fix.
- The "extract `<AsyncButton>` / `useAsyncAction`" generator-fix now has 3 instances to design against. Worth a dedicated session to design the primitive carefully rather than rushing it as a follow-on.
