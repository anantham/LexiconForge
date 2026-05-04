# Issue 17 — `loadChapterFromIDB` doesn't load feedback from IDB

> Status: **triaged** · Last updated: 2026-05-04 · Investigator: Opus 4.7
>
> Surfaced during issue #16 investigation. Not a user-filed claim — agent-discovered upstream gap that probably contributes to #16's symptoms.

## 1. Claim (agent-surfaced, not from Issues.md)

> While tracing why "comments vanish on chapter-translation switch" (issue #16), discovered that `services/navigation/hydration.ts:loadChapterFromIDB` never reads feedback from IndexedDB. `buildEnhancedChapter` (in `services/stableIdService.ts:135`) sets `feedback: []` and no subsequent code populates it from IDB.
>
> The only callers of `FeedbackOps.get` are translation-context-building (for the "preceding chapters get even better" loop) and session export. Neither serves the reader UI.

## 2. Reproduction
_TBD — easy to demonstrate:_
1. Submit a comment on a chapter (it appears in `chapter.feedback` via `submitFeedback`'s in-memory update).
2. Refresh the page (or navigate away and back).
3. The comment is gone from `chapter.feedback`. *If* it had been persisted to IDB (it isn't — see issue #18), it still wouldn't render because this code path doesn't load it.

## 3. Verdict

**Real bug** (downstream consequence of an incomplete persistence pipeline). Confidence **0.95** based on code reading; live repro would push to 0.99.

## 4. Where the failure lives  (A / B / C)

`(A2, B2, C2)` _provisional, pre-live-repro_

- **A2**: No ADR explicitly covers feedback loading lifecycle. CORE-008 v2 (proposed) implicitly assumes annotations re-render on chapter-translation switch, which presupposes they're loaded.
- **B2**: Code falls short — the load function exists (`FeedbackOps.get`), there's even a translationId field on `FeedbackRecord`, but the reader's `loadChapterFromIDB` never calls it.
- **C2**: Vision-drifted. The comments-tied-to-chapter-translation model assumes durability across sessions; current code makes them session-local.

**Themes:**
- Same family as #16 — feedback-persistence-pipeline.
- Probably also instances `silent-failure-deep` (silent loss of user data on every reload).

## 5. Evidence and code paths

- `services/navigation/hydration.ts:15-189` — `loadChapterFromIDB`. Loads chapter record + active translation + diff cache. **No FeedbackOps.get call.**
- `services/stableIdService.ts:135` — `buildEnhancedChapter` returns `{...chapter fields..., feedback: []}`. The empty default never gets overridden.
- `services/db/operations/feedback.ts` — `FeedbackOps.get(chapterUrl)` is defined and works.
- `services/db/repositories/FeedbackRepository.ts:73` — `getFeedbackByChapter` returns ALL feedback for a chapter URL, NOT filtered by `translationId`.

A complete fix would:
- Call `FeedbackOps.get(chapterUrl)` inside `loadChapterFromIDB` after loading the chapter record.
- Map `FeedbackRecord[]` → `FeedbackItem[]` (using the existing `convertFeedbackRecordToItem` from `translationService.ts:728`).
- Populate `enhanced.feedback` with the result.
- (If we want chapter-translation-tied filtering: filter to records where `translationId` matches the active translation's id, OR include all and let the UI decide — depends on how issue #16's live repro shapes the requirement.)

## 6. Test coverage gap & regression-test obligations

**Gaps:** no tests cover feedback persistence end-to-end. Repro scenario above isn't tested.

**Regression-test obligations (HARD GATE):**

| Defect | Required regression test | Where |
|---|---|---|
| Feedback not loaded on chapter hydration | Seed IDB with chapter-record + N feedback-records for that chapter. Call `loadChapterFromIDB(stableId, ...)`. **Assert returned `EnhancedChapter.feedback.length === N` and contents match.** | `tests/services/navigation/hydration.test.ts` (new) |

This test fails today (chapter.feedback returns []) and will pass once the fix is applied.

## 7. Archaeology
_TBD — `python3 scripts/issue-archaeology.py services/navigation/hydration.ts --git`_

The empty `feedback: []` default was probably set when EnhancedChapter was first introduced, and nobody ever wired up the load call. Worth confirming via blame.

## 8. Generator function

> "Schema field defined for persistence with no read-side wiring. The IDB layer has the data; the in-memory layer has the field; nothing connects them."

This is adjacent to the `jit-vs-precompute` theme but distinct enough to deserve its own naming. It's the inverse of "stored derived view" — here, raw data is correctly stored, but the read path doesn't fetch it. Half-implemented persistence. Single-instance for now; if more show up, theme it.

## 9. Action

**`fix_local`** — straightforward: add a `FeedbackOps.get(chapterUrl)` call in `loadChapterFromIDB`, populate `enhanced.feedback`. ~10-15 lines.

## 10. Status

`triaged → ready-for-fix` once §2 is live-confirmed. Estimated <30 minutes for the fix + test.

## 11. Open questions

- Should feedback be filtered by active translationId at load time, or loaded all-at-once and filtered at render time? Choice depends on #16's resolution.
- Are there other half-implemented IDB read paths in this style? Worth a quick audit.
