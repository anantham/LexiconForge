# ADR 001: Pre-loader Strategy for Cached and Web-based Content

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
