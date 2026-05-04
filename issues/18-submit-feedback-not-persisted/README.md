# Issue 18 — `submitFeedback` doesn't persist to IndexedDB

> Status: **triaged** · Last updated: 2026-05-04 · Investigator: Opus 4.7
>
> Surfaced during issue #16 investigation. Companion to issue #17 — both halves of the broken feedback-persistence pipeline.

## 1. Claim (agent-surfaced, not from Issues.md)

> `store/slices/translationsSlice.ts:713` — `submitFeedback` writes to in-memory `feedbackHistory` and updates `chapter.feedback` via `updateChapter(...)`. **Never calls `FeedbackOps.store(...)`.** Comments don't survive a page reload because they're never persisted.
>
> The IDB write API exists (`FeedbackOps.store(chapterUrl, feedback, translationId?)` at `services/db/operations/feedback.ts:5`) — even accepts a `translationId` parameter — but the only production-code call site is `services/db/migrationService.ts:131` (one-time migration). Search of `archive/useAppStore.ts:636` shows the legacy code DID call it; that wiring was lost during a refactor.

## 2. Reproduction
_TBD — easy:_
1. Submit a comment on a chapter (visible in side panel after submit).
2. Refresh the page.
3. Comment is gone — both because #17 (feedback not loaded) AND because the comment was never written to IDB to begin with.

Even if #17 is fixed, this issue independently means: **comments submitted in a session are lost on session end.**

## 3. Verdict

**Real bug** — silent data loss on every session. Confidence **0.95** based on grep (`FeedbackOps.store` has zero non-archive non-migration callers).

This is potentially worse than #17 because it's destructive: even if we fix loading, there's nothing in IDB to load.

## 4. Where the failure lives  (A / B / C)

`(A2, B2, C2)` _provisional_

- **A2**: No ADR commits to "user-generated annotations persist." Implied by Vision (raw is sacred, eternal) but not stated.
- **B2**: Code falls short — write API exists, ergonomic, ready to use; the call site doesn't use it.
- **C2**: Vision-drifted. "Raw is eternal" includes user annotations (per CORE-008 v2). Current behavior treats them as ephemeral.

**Themes:**
- Same family as #17 — feedback-persistence-pipeline.
- Possibly instances a "silent-data-loss" theme if more cases of "user-action result not persisted" surface (worth watching).

## 5. Evidence and code paths

- `store/slices/translationsSlice.ts:713-839` — `submitFeedback`. In-memory updates only.
- `archive/useAppStore.ts:621,636` — the legacy implementation called `indexedDBService.storeFeedback(url, item).catch(...)` after the in-memory update. Wiring was lost.
- `services/db/operations/feedback.ts:5-7` — `FeedbackOps.store(chapterUrl, feedback, translationId?)` exists and works.
- `services/db/repositories/FeedbackRepository.ts:50-71` — `storeFeedback` implementation, includes `translationId` in the record.

The fix:
- After the in-memory update at line 740-748, call `FeedbackOps.store(chapterUrl, newFeedback, activeTranslationId)`.
- Need to look up `chapterUrl` from the chapter and `activeTranslationId` from the active translation (both available via store getters).

## 6. Test coverage gap & regression-test obligations

**Gaps:** no test verifies submitFeedback persists to IDB.

**Regression-test obligations (HARD GATE):**

| Defect | Required regression test | Where |
|---|---|---|
| `submitFeedback` doesn't persist | Mock FeedbackOps.store. Call `submitFeedback(chapterId, ...)`. **Assert FeedbackOps.store was called with the right args (chapterUrl, feedbackItem, translationId).** | `tests/store/slices/translationsSlice.feedback.test.ts` (new) |
| End-to-end persistence (with #17 fixed) | Submit feedback, simulate reload, assert feedback re-renders. Requires #17 to be fixed first. | `tests/integration/feedback-persistence.test.ts` (cross-issue) |

The mocked-call test fails today (no FeedbackOps.store invocation) and will pass once the fix lands.

## 7. Archaeology

The wiring loss was probably during the `useAppStore` → slices refactor. `archive/useAppStore.ts:636` has the call; current `translationsSlice.ts:713` doesn't. Worth running:

```
python3 scripts/issue-archaeology.py store/slices/translationsSlice.ts --git
```

…and looking for the commit that introduced the new submitFeedback in slices. That commit likely just forgot to port the IDB call.

This may also be an instance of the [`co-mingled-commits`](../_themes/co-mingled-commits.md) theme — a refactor that touched many files and silently dropped a behavior. Worth flagging if archaeology confirms.

## 8. Generator function

> "Refactor moves a function across files; behavior at the new site is incomplete vs the old; no test catches the regression because nobody tests persistence end-to-end."

Adjacent to co-mingled-commits theme but at a different scale — not "title vs diff disagreement" but "behavioral parity not maintained across refactor."

## 9. Action

**`fix_local`** — add the FeedbackOps.store call. ~5-10 lines plus the test. Should land in a single small commit.

Order matters with #17: fixing this first means data starts persisting. Fixing #17 alone without this means we're loading nothing (same effective outcome). They probably ship together.

## 10. Status

`triaged → ready-for-fix` once §2 is live-confirmed. Same threshold as #17.

## 11. Open questions

- Does deleteFeedback / updateFeedbackComment also have the same gap? Worth checking; the same refactor probably affected them too.
- Should the persistence call await or fire-and-forget? Current legacy code at `archive/useAppStore.ts:636` was fire-and-forget (`.catch(() => {})`). For new code, await + error toast is probably better — silent failures here are exactly how this class of bug got introduced.
