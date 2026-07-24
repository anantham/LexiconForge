# FEAT-001: Pre-loader Strategy for Cached and Web-based Content

**Status:** Implemented
**Date:** 2025 (original)

## Context

The pre-loading worker is a feature designed to improve the user experience by fetching and translating upcoming chapters in the background, preventing the user from having to wait.

The initial implementation of this worker behaved like a simple web crawler. It inspected the currently viewed chapter for a `nextUrl` property and followed it to find the next chapter to process.

A problem was discovered with this approach when dealing with chapters that were not fetched from the web, but were imported from a single JSON file. These "cached" chapter objects did not contain the `nextUrl` property, causing the pre-loader to stop silently, as it had no link to follow.

## Decision

We decided to re-implement the pre-loader with a more robust, number-based strategy that supports both web-fetched and cached chapters.

The new logic is as follows:
1.  The worker gets the `chapterNumber` of the current chapter.
2.  It iterates from `1` to the user's configured `preloadCount`.
3.  In each iteration, it finds the next chapter by looking for the object with `chapterNumber: currentChapter.chapterNumber + i`. This works for any set of chapters, as long as they are numbered sequentially.

Furthermore, based on user feedback, the goal of the pre-loader was refined. The primary goal is to ensure *a* translation is available to prevent waiting, not necessarily to ensure the translation is perfectly up-to-date with the latest settings.

Therefore, a second decision was made:
1.  Before translating a pre-loaded chapter, the worker will first check if *any* translation versions already exist for it in the database.
2.  If one or more versions exist, the worker will skip translating this chapter and move to the next one. It will only perform a translation if zero versions are found.

## Consequences

### Positive
- The pre-loader now works correctly for all content sources, whether fetched from the web or imported from a file.
- The pre-loader's behavior is better aligned with its primary goal of improving reading flow, by not re-translating chapters that already have a usable version.
- The logic is more resilient and less dependent on the data structure of individual chapter objects (i.e., the presence of `nextUrl`).

### Negative
- The new logic is slightly less efficient for finding the next chapter, as it may require an iteration to find a chapter by its number rather than a direct lookup via a URL index. However, given the small size of the in-memory chapter map, this performance impact is negligible.
- This strategy assumes chapters are numbered sequentially. It will not be able to preload chapters across non-sequential gaps (e.g., jumping from chapter 5 to chapter 7). This is considered an acceptable trade-off.

---

## Implementation Notes

**Files:**
- Pre-loader logic lives in `workers/translate.worker.ts`
- Chapter numbering resolved via `services/scraping/chapterNumber.ts`
- Translation version check uses `services/db/operations/translations.ts`

**Deviations from proposal:** The number-based strategy was implemented as described. The "skip if any version exists" optimization is active in the worker's preload loop.

---

## Amendment 2026-05-06 — Implementation moved out of `workers/`; preload invariant now enforced by CORE-012

### File location update (refactor history)

The implementation pointer above is **stale**. The `workers/` directory has since been removed entirely (as of 2026-07; both `translate.worker.ts` and `epub.worker.ts` are gone). The preload logic was moved into the store layer during an earlier refactor that this ADR was never updated to reflect.

**Current files (verified 2026-05-06):**
- Pre-loader entry point: `store/slices/chaptersSlice.ts:preloadNextChapters` (~lines 878-1027). Triggered by setting `currentChapterId`; iterates from `1` to `settings.preloadCount` looking up chapters by `chapterNumber: currentChapter.chapterNumber + i`.
- Chapter numbering resolution: `services/scraping/chapterNumber.ts` (unchanged from original; still authoritative).
- Translation version check: `services/db/operations/translations.ts:getVersionsByStableId` (entered via `TranslationOps.getVersionsByStableId`). The "skip if any version exists" optimization is honored at the slice layer in `handleTranslate` — when `existingVersions.length > 0` and `origin === 'auto_preload'`, the translation is blocked.

### Preload invariant: now enforced end-to-end (was previously broken in transit)

This ADR's stated goal — *"ensure a translation is available to prevent waiting"* — was being **defeated at navigation time** by an `setCurrentChapter` side effect that cancelled in-flight translations (including preloaded ones) every time the user navigated to a different chapter. Issue #12 ("when i move away from the page and get back the background preload ahead chapters are freshly api called rather than showing the calls that were sent in the background") is the user-facing report of this invariant break.

[`CORE-012`](./CORE-012-background-work-survives-navigation.md) formalizes the principle this ADR always implied — *"in-flight background work survives navigation; cancellation is explicit-only"* — and ships the fix:
- The auto-cancel in `setCurrentChapter` is removed
- Preload-triggered work now uses a distinct `'auto_preload'` origin so future scheduler/cost work has a hook
- Per-origin policy: preload never auto-fires expensive image generation (image gen is gated to `auto_visit` and `manual_translate` only, where the user is actively engaged with the chapter)

After CORE-012, FEAT-001's preload no longer wastes LLM tokens on chapters the user navigated away from. The reading-flow promise holds end-to-end.

### Related

- [`CORE-012`](./CORE-012-background-work-survives-navigation.md) — restored this ADR's implicit invariant; specifies origin taxonomy and explicit-cancellation rule
- Issue [`12-background-preload-spinner-restart`](../../issues/12-background-preload-spinner-restart/) — user verbatim claim that surfaced the broken invariant
- Issue [`19-translation-survives-nav-policy`](../../issues/19-translation-survives-nav-policy/) — the broader investigation, Phase 0 spec, and phased shipping plan
