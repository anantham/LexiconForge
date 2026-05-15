# Issue 10 — Library label → Home icon

> Status: **FIXED 2026-05-15** · Last updated: 2026-05-15 · Investigator: Claude Opus 4.7 (1M)
>
> **Fix:** `components/chapter/ChapterHeader.tsx` (2 sites — desktop + mobile) — replaced `Library` text content with an inline SVG home icon. Added `aria-label="Return to library (home)"` for screen readers. Preserved `title="Return to the novel library"` for hover tooltip.
>
> **Verification ladder (§6a) achieved:**
> - [x] L1 Static — confidence 1.0 (cosmetic; user's claim is verbatim and unambiguous)
> - [x] L2 Unit-mechanical — 4 tests at `tests/components/chapter/ChapterHeader.test.tsx`, 4/4 PASS post-fix, 4/4 FAIL pre-fix (verified via git stash)
> - [x] L3 Programmatic data-path — N/A (no data flow involved)
> - [x] L4 Real-event chain — Playwright clicked the new home-icon button on a real chapter page (Dungeon Defense Ch2) → navigated to library. Trace: `traces/l4-headed-playwright-2026-05-15.txt`
> - [x] L5 User-driven manual — deferred (cosmetic; sr label preserves accessibility)

## 1. Claim (verbatim from Issues.md)

> change library word to Home symbol

## 2. Reproduction

**Pre-fix observation (live, 2026-05-15):** ChapterHeader.tsx renders `<button>Library</button>` in two responsive sites. User wants the text replaced with a home symbol/icon.

## 3. Verdict

**Preference** (light feature ask, not a bug) — Confidence: **1.0**.

Cosmetic change with a clear, unambiguous user intent. No design tradeoff requiring escalation. The bone-icon-vs-house-icon choice is the only ambiguity and a house icon is the obvious match for "Home symbol."

## 4. Where the failure lives (A / B / C)

**`(A3, B1, —)`** — confirmed from the index's provisional assignment.

- **A3** — No ADR governs icon-vs-text choices in nav UI.
- **B1** — Code did what the prior design specified (label = "Library").
- **C** — N/A. Preference, not a vision-alignment question.

## 5. Evidence and code paths

- `components/chapter/ChapterHeader.tsx:113-121` — desktop button (now icon)
- `components/chapter/ChapterHeader.tsx:181-188` — mobile button (now icon)

## 6. Test coverage gap & regression-test obligations

### What's missing pre-fix

- No test asserts the button uses an icon vs text. The existing test (`tests/components/chapter/ChapterHeader.test.tsx:48-56`) queried by `screen.getAllByText('Library')` — became broken after icon swap.

### Regression tests committed (4 cases)

| Case | What it asserts | Fails pre-fix? |
|---|---|---|
| renders library button when provided and invokes it | clicking aria-labelled button calls `onOpenLibrary` | ✓ |
| does NOT render literal "Library" text | button's text content trims to '' | ✓ |
| renders SVG home icon inside button | button has `<svg><path d^="M3 9.5"/></svg>` | ✓ |
| preserves title tooltip for hover | `title="Return to the novel library"` still set | ✓ |

All 4 verified to fail on pre-fix code (git stash run) and pass on fixed code.

## 7. Archaeology

`components/chapter/ChapterHeader.tsx` was created or refactored as part of the modular header extraction. The "Library" text was the original label. No bug introduction — just a label choice that the user later wanted updated.

## 8. Generator function

N/A — preference-class issue, not a generator instance.

## 9. Action — `fix_local`

Simple two-site UI swap. No ADR involved.

## 9a. Closing gate

- [x] Fix committed
- [x] Regression tests in place + verified pre-fix-fail / post-fix-pass
- [x] Verification ladder §6a populated (L1+L2+L4 achieved)
- [x] Theme assignment: none (preference)

## 10. Status

`fixed` — landed in feat/opus-issues-investigation.

## 11. Open questions

None. If you prefer a different icon shape (rounder house, outline-only, different stroke weight), tell me and I'll swap the path data. The current path is a standard "house with door cavity removed" outline.
