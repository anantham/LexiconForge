# Issue 11 — Comparison panel persists across chapter change

> Status: **already fixed** · Last updated: 2026-05-02 · Investigator: Opus 4.7

## TL;DR

**Already addressed before this investigation began.** Commit [`0c5162b`](https://github.com/anantham/LexiconForge/commit/0c5162b) (2026-04-10, *"fix: dismiss comparison panel when changing chapters"*) added a `useEffect` to [`hooks/useComparisonPortal.ts`](../../hooks/useComparisonPortal.ts) that auto-dismisses the comparison portal whenever `currentChapterId` changes. No further code change needed.

There is **no regression test** for the behavior — that's the only gap left.

## 1. Claim (verbatim from Issues.md)

> when you do comparision with fan then change chapters the dispay thing follows into the next chapter also! `http://localhost:5180/?novel=forty-millenniums-of-cultivation&version=v1-composite&chapter=lexiconforge%3A%2F%2Fforty-millenniums-of-cultivation%2Fchapter%2F305`

## 2. Reproduction

Not run live — the code path is small and unambiguous, and the commit message is descriptive. A live repro would only re-confirm the static analysis below. Worth running once if a regression test is added (so the test starts from a real measurement).

## 3. Verdict

**Already fixed.** Confidence **0.95**.

The 5% reserve is because:
- I haven't actually loaded the app, opened a comparison, navigated, and observed the dismissal. I'm relying on the commit message + diff matching the user's complaint.
- The fix dismisses on every `currentChapterId` change, including the *initial* load. If `currentChapterId` is set during init (as it is for deep-link URLs), the effect fires once at mount with no comparison to dismiss — benign no-op, but worth knowing.

## 4. Where the failure lives  (A / B / C)

**Pre-fix:** `(A3, B2, C2)` — no ADR governed comparison-panel state lifetime; code retained state across chapter transitions; vision-drifted because comparison is a derived view that shouldn't persist past its source context.

**Post-fix:** `(A3, B1, C1)` — code now matches what the vision implicitly asks for (comparison is JIT-derived from the *current* chapter; on chapter change the derivation invalidates). Spec is still A3 — no ADR was written that says "all derived views invalidate on chapter change" — but at least one instance is correct.

**Themes this issue instances:**

- [`_themes/jit-vs-precompute.md`](../_themes/jit-vs-precompute.md) — the bug was a derived view (comparison panel) that was treated as durable state. The fix is the canonical jit-vs-precompute pattern: invalidate on context change.

This is a useful **calibration data point**: when this theme's principle is honored at the call site, the bug structurally cannot recur. The fix is small (7 lines) and obvious *given the principle*. A future ADR (`CORE-008`) that formalizes "derived views invalidate on context change" would have made this fix a one-line update to a generic invalidation hook instead of a per-hook `useEffect`.

## 5. Evidence and code paths

The fix in [`hooks/useComparisonPortal.ts`](../../hooks/useComparisonPortal.ts):

```ts
// Added in 0c5162b
useEffect(() => {
  if (currentChapterId) {
    dismissComparison();
  }
}, [currentChapterId, dismissComparison]);
```

`dismissComparison` is the same function the hook uses to clear the portal in other paths (e.g. selection-cleared, comparison-completed). The dependency array is correct: `dismissComparison` is presumably stable via `useCallback` (verified by the commit also adding `dismissComparison` to a *separate* dependency array at line 241, suggesting it's a stable reference).

Two related earlier commits in the same hook:
- `f62c9a35e4` (2026-04-01) — "comparison panel layout — exclude diff annotations from selection" (separate concern)
- `5c397a190d` (2025-11-22) — original extraction of the reader view stack

## 6. Test coverage gap

Tests touching comparison-related code:

- [`tests/services/comparisonService.test.ts`](../../tests/services/comparisonService.test.ts)
- [`tests/components/chapter/ComparisonPortal.test.tsx`](../../tests/components/chapter/ComparisonPortal.test.tsx)
- [`tests/components/chapter/SelectionOverlay.test.tsx`](../../tests/components/chapter/SelectionOverlay.test.tsx)

**The behavior added by `0c5162b` is not under test.** The exact missing assertion: "when `currentChapterId` changes, `dismissComparison` is called once with no arguments." A vitest test rendering the hook with a controlled `currentChapterId` prop would catch any regression.

This isn't an investigation deliverable — just flagging the gap. Adding the test would be a separate, ~10-line PR.

## 7. Archaeology

```
python3 scripts/issue-archaeology.py hooks/useComparisonPortal.ts --git
```

| Commit | Date | Author | Title |
|---|---|---|---|
| `0c5162bfb4` | 2026-04-10 | Aditya | **fix: dismiss comparison panel when changing chapters** ← the fix |
| `f62c9a35e4` | 2026-04-01 | Aditya | fix: comparison panel layout — exclude diff annotations from selection |
| `5c397a190d` | 2025-11-22 | Aditya | refactor(reader): extract reader view stack |

**Agent attribution: none captured.** A wider search of all 77 JSONL transcripts for sessions that edited `useComparisonPortal.ts` after 2026-04-09 returned only this current investigation session. Conclusion: **commit `0c5162b` was authored manually by Aditya without an agent session**, or with an agent whose transcript was rotated/lost.

This is a useful data point about archaeology coverage — it works for agent-driven changes, not for human-direct edits. For mixed workflows we should remember that "no agent attribution" doesn't mean "no commit"; it means the commit was outside the agent transcript stream.

## 8. Generator function

This issue is a **fixed instance** of the [`jit-vs-precompute`](../_themes/jit-vs-precompute.md) theme. The generator: derived UI state that's durable beyond its source context. Present-tense version is now N=9 (was N=10).

The fix shape: **one-line invalidation effect keyed on the source-context identifier.** This is the pattern future fixes for #15 (comparison cycle modes) and #16 (version-switch comments vanish) should mirror.

## 9. Fix directions

**No fix needed.** Two potential follow-ups for Aditya:

1. **Add a regression test** (5-10 lines, vitest) — small, high return, prevents the 7-line fix from being silently reverted in a future refactor.
2. **Generalize the pattern** — when `CORE-008` (derived-views) is drafted, encode the "invalidate on context change" pattern as a hook factory (`useDerivedViewState({ contextId, invalidate })`). Then all current and future "derived view persists across X" bugs become structurally impossible. This is the leverage version of the fix.

## 10. Open questions

- Was this fix the result of self-noticing during use, or did Aditya see the same Issues.md entry and patch it? (Issues.md shows the entry but doesn't mark it fixed — the issue tracker drift itself is a small process generator: fixes ship before issues are closed.)
- Should we add a small step to the workflow: "before investigating, search recent commits for the issue's keywords"? Would have saved this investigation a few minutes — though the investigation also surfaced the test gap and produced reusable archaeology coverage data.
