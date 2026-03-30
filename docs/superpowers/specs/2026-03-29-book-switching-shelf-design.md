# Book Switching & Novel Shelf — Design Spec

**Date:** 2026-03-29
**Status:** Draft
**Author:** Opus (with Codex review)

## Problem

Once a user starts reading a book, the only way to switch to a different book is to clear the entire cache — destroying all translations, images, and progress across all books. There is no way to navigate back to the library from the reader view.

### Root Causes

1. **Screen state is derived, not explicit.** `MainApp.tsx:85` decides library vs reader from `chapters.size > 0 || currentChapterId !== null`. The dominant trigger is `initializeStore` setting `currentChapterId` via auto-resume (line 211: `state.currentChapterId || lastChapterData.id`), which alone makes `hasSession = true` and blocks the library. Note: the auto-resume has a guard — it's a no-op if `currentChapterId` was already set (e.g., by a deep link).
2. **Bootstrap auto-resumes.** `initializeStore.ts:204-232` loads the last active chapter on boot and sets `currentChapterId`, causing the app to skip the library.
3. **Global session assumption.** The injectable hydration function `getChaptersForReactRendering` is declared at `rendering.ts:64` (with `store.getAll()` at line 80); `fetchChaptersForReactRendering` is the public wrapper at line 231. Both scan every chapter in IndexedDB regardless of novel. `NovelLibrary.tsx:69` treats "any cached chapters exist" as "the requested book is cached."
4. **Duplicated hydration logic.** Four independent copies of "rebuild chapters Map + urlIndex + rawUrlIndex from IDB" exist. `NovelLibrary.tsx` alone has two — one in the cached-chapters branch (lines 69-118) and one inside the `onFirstChaptersReady` streaming callback (lines 155-213). The other two are in `importSessionData.ts:15` and `importService.ts:688`. All four independently call `fetchChaptersForReactRendering()`, build three Maps, and call `setState`.
5. **Boot-time backfills have become startup business logic.** `initializeStore.ts` runs model repair, URL mapping backfill, stable ID normalization, active translation backfill, translation metadata backfill, and chapter number backfill on every boot. These should be one-time migrations guarded by "done" flags, not hot-path work.
6. **Novel identity is heuristic and non-deterministic.** `stableIdService.ts:116` derives `novelId` from URL shape, hardcodes the BookToki `/novel/{id}` pattern (line 135), and falls back to `unknown_novel_${Date.now()}` (line 149) — a non-deterministic identity that creates debt.
7. **Chapter identity does not encode novel membership.** `generateStableChapterId` (stableIdService.ts:21) uses content hash + chapter number + title hash. Useful but not a domain identity — two novels with similar chapter 1 content could collide.
8. **Some core queries assume one active book.** `chapters.ts:227` does a global `findByNumber(chapterNumber)`, which breaks with multiple books in IDB.

## Design Decisions

### Approach: Active Novel Filter (Approach A)

All books stay in IndexedDB permanently. An `activeNovelId` controls which novel's chapters are loaded into RAM and displayed. Switching books = changing the filter, not clearing data.

Rejected alternatives:
- **Novel-scoped namespacing (B):** Prefix all keys with novelId. Requires schema migration, breaks existing stableId references, high risk of data loss.
- **Separate IDB databases per novel (C):** Each novel gets its own IndexedDB. Massive refactor, breaks single-connection model.

### Scope Boundaries

- Shelving applies only to curated library novels.
- URL-pasted chapters remain ephemeral — they do not appear on the shelf. For library novels, use the registry `novel.id` as canonical identity. For URL-pasted chapters, `novelId = null` is honest.
- Phase 1 resume is per `novelId`. Version-aware resume (`novelId + versionId`) is deferred but the data model supports it.
- Deep linking (`?novel=`, `?chapter=`) continues to work and takes precedence over shelf resume.

## Data Model

### UI Routing (uiSlice)

```typescript
appScreen: 'library' | 'reader-loading' | 'reader'
activeNovelId: string | null  // phase 2: { novelId, versionId? }
```

### Bookshelf State (persisted in IDB settings as `bookshelf-state`)

```typescript
type BookshelfState = {
  [novelId: string]: {
    novelId: string
    versionId?: string           // reserved for phase 2
    lastChapterId: string        // source of truth for resume
    lastChapterNumber?: number   // cached display field only (not authoritative)
    lastReadAtIso: string        // ISO 8601 string, not Date object
  }
}
```

Loaded eagerly during `initializeStore()` (alongside URL mappings and navigation history), not async in a component `useEffect`. This avoids a flash of empty shelf on cold boot.

### Extended Records

```typescript
// ChapterRecord gains (in services/db/types.ts):
novelId: string | null   // registry novel.id for library novels; null for URL-paste
                         // undefined only during transitional migration (backfill in progress)

// UrlMappingRecord gains (in services/db/types.ts):
// Note: IDB index on novelId already exists from schema v5-v7,
// but the TypeScript interface currently lacks this field.
novelId: string | null   // same semantics as ChapterRecord
```

### Unchanged

- `NovelInfo` stays static catalog metadata — no user state added.
- `translations`, `feedback`, `amendment_logs`, `imageCacheService` — all keyed by `chapterId`/`stableId` which remains stable. They survive shelving automatically.

### StableId Collision Risk

`generateStableChapterId` (`stableIdService.ts:21-42`) produces IDs like `ch1_a7b2c3d4_x9y8` from content hash (first 1000 chars, 8 base-36 digits = ~2.8 trillion values) + title hash (4 base-36 digits = ~1.7 million values) + chapter number. For two chapters from different novels to collide, they'd need the same chapter number, same first 1000 characters of content, AND same title. For curated library novels from different sources, this is effectively impossible.

**Phase 1 policy:** Accepted risk — no collision detection needed. The probability is near-zero for the library use case (distinct novels from different sources with different content). Translations and images are keyed by `stableId` alone, so a collision would cause aliasing — but the collision won't happen in practice.

**Phase 2 (if needed):** If the app ever supports novels with overlapping content (e.g., different translations of the same source), add `novelId` to `generateStableChapterId` hash to prevent collisions structurally.

## Screen State Machine

```
library  ──[tap shelf card / deep link]──>  reader-loading
reader-loading  ──[hydration complete]──>   reader
reader-loading  ──[import fails]──────>     library  (with error notification)
reader   ──[tap Home button]──────────>     library
```

## User Flows

### Cold Boot (no deep link)

1. `initializeStore()` runs — settings, prompt templates, one-time migrations.
2. `BookshelfState` loaded eagerly from IDB into store.
3. `appScreen` defaults to `'library'`. No auto-resume.
4. Library renders with "Continue Reading" section showing shelf cards.
5. User taps shelf card -> `reader-loading` -> hydrate novel -> `reader`.

### Cold Boot with Deep Link

Deep link params compose sequentially, not as alternatives:
- `?novel=Y` runs first (during `initializeStore`): imports the novel if not in IDB, sets `activeNovelId`.
- `?chapter=X` runs second (in `MainApp` after init): navigates to the specific chapter via `handleNavigate`.
- If both present: import the novel, then navigate to the chapter within it.
- If only `?chapter`: navigate directly (novel must already be cached or fetchable from the URL).
- If only `?novel`: import and open at chapter 1 (or last bookshelf position if shelved).
- Neither present: default to library.

### Shelving (reader -> library)

1. User taps Home/Library button in reader header.
2. `BookshelfState[activeNovelId]` is already up-to-date (debounced auto-save).
3. Set `appScreen = 'library'`, `activeNovelId = null`.
4. **No data cleared** — chapters, translations, images all stay in IDB.

### Resuming (library -> reader)

1. User taps shelf card for novel.
2. Read `BookshelfState[novelId].lastChapterId`.
3. Stale bookmark fallback: `lastChapterId` exists in IDB -> resume. Missing -> try `lastChapterNumber` match -> fall back to chapter 1.
4. If chapters in RAM -> set `currentChapterId`, `appScreen = 'reader'`.
5. If not in RAM -> hydrate from IDB filtered by `novelId` via `reader-loading`.

### Starting a New Book

1. User taps a novel they haven't read -> existing `handleStartReading` flow.
2. Import completes -> create `BookshelfState` entry at chapter 1.
3. Set `activeNovelId`, `appScreen = 'reader'`.

### Bookmark Auto-Save

- Persist `BookshelfState` on every `currentChapterId` change, debounced ~2s.
- Covers refresh, crash, tab close — at most ~2s of position loss.

### InputBar URL-Paste Behavior

**Phase 1 rule: URL-paste is not supported while a shelved library novel is active.**

When a URL is pasted into InputBar:
- If in `library` screen (no active novel): transition to `reader-loading` -> `reader`. Ephemeral — no shelf state written, no `activeNovelId` set.
- If in `reader` with an active library novel (`activeNovelId !== null`): show a notification asking the user to shelve the current book first ("Return to the library to paste a URL"). This prevents the current fetch path (`chaptersSlice.ts:382`) from merging ephemeral chapters into the active novel's maps and swapping `currentChapterId`.

**Phase 2:** Support a first-class `activeReadingTarget = { type: 'libraryNovel', novelId } | { type: 'ephemeralUrl' }` that allows mixed reading without interference.

## Library UI

A dedicated "Continue Reading" section appears at the top of the library page, above the full catalog grid. Each shelf card shows:
- Cover thumbnail
- Title
- Current chapter / total chapters
- Progress bar
- "Last read X ago" timestamp

The catalog grid below shows all novels (including in-progress ones) without progress indicators.

## Edge Cases

All behaviors described are post-implementation (Phase 1). Current app does not have these behaviors.

| Scenario | Behavior |
|----------|----------|
| Stale bookmark after reimport | `lastChapterId` not in IDB -> try `lastChapterNumber` match -> fall back to chapter 1 |
| Shelving during active translation | Warn user. If confirmed: cancel in-flight jobs, keep completed results |
| Shelving during image generation | Same as translation |
| Colliding stableIds across novels | Accepted risk — near-zero probability for distinct library novels. No import-time detection needed in phase 1. |
| Deep link for uninstalled novel | Import from registry -> `reader-loading` -> `reader`. Fail -> `library` with error |
| `?chapter` + `?novel` both present | Sequential: `?novel` imports the book, then `?chapter` navigates to specific chapter |
| Multi-tab | Last write wins for `bookshelf-state`. No locking |
| 10 novels shelved, RAM pressure | Phase 1: all stay in RAM. Phase 2: lazy eviction |
| URL-paste while reading library novel | Blocked in phase 1 — user must shelve first. Notification: "Return to the library to paste a URL." |
| `clearSession()` called | Resets `appScreen` to `'library'`, clears `activeNovelId`, clears `BookshelfState` |
| `findByNumber(chapterNumber)` with multiple books | Must be scoped by `novelId` in Phase 0 cleanup |

## Implementation Surface

### Phase 0: Surgical Cleanup + Identity Foundation

Phase 0 establishes novel identity and clean abstractions before adding shelf behavior.

| File | Change |
|------|--------|
| `store/slices/uiSlice.ts` | Add `appScreen`, `activeNovelId`, transition actions (`openNovel`, `shelveActiveNovel`, `openLibrary`) |
| `store/storeTypes.ts` | Add `appScreen` and `activeNovelId` to combined store type |
| `MainApp.tsx` (repo root, not `components/`) | Replace `hasSession` derivation (line 85) with `appScreen` selector |
| `store/bootstrap/initializeStore.ts` | Split into named phases: boot repairs, intent detection, hydration, service init. Stop auto-resuming. Install eager load of `BookshelfState` from IDB (returns empty/undefined until Phase 1 write path is active — this is a forward-compatible read, not a Phase 0 requirement). Guard each backfill with a "done" flag so they run once, not on every boot. |
| `services/db/types.ts` | Add `novelId?: string` to both `ChapterRecord` and `UrlMappingRecord` |
| `services/stableIdService.ts` | For library novels, use registry `novel.id` as canonical identity (not URL heuristic). For URL-paste, `novelId = null`. |
| `services/db/operations/imports.ts` | Persist `novelId` on chapters and URL mappings during import |
| `services/db/operations/chapters.ts` | Write `novelId` in canonical persistence path. Scope `findByNumber` by `novelId`. |
| `services/db/core/schema.ts` | Add v14 migration: fix missing `novelId` + `novelChapter` indexes on `url_mappings` (v13 bug), add `novelId` index on `chapters`. |
| `services/db/operations/maintenance.ts` | Add `backfillNovelIds()` — one-time full scan, guarded by a "done" flag. Note: no IDB index on `chapters.novelId` yet, so this is a full-table scan. For users with hundreds of chapters, this is a one-time boot cost. |
| `services/db/operations/rendering.ts` | Add `fetchChaptersForNovel(novelId)` alongside existing global query |
| `services/db/operations/mappings.ts` | Novel-scoped URL lookup helpers |
| `services/db/operations/index.ts` | Export new operations |
| New: `services/readerHydrationService.ts` | Single `loadNovelIntoStore(novelId)` replacing 4 duplicates. Now genuinely novel-scoped because `novelId` is persisted and queryable. |
| `components/NovelLibrary.tsx` | Use `loadNovelIntoStore` instead of inline hydration (both branches) |
| `store/bootstrap/importSessionData.ts` | Use `loadNovelIntoStore` |
| `services/importService.ts:688` | Use `loadNovelIntoStore` |
| `services/navigation/index.ts` | Deep-link `?chapter` resolution must set `activeNovelId` and `appScreen` coherently |
| `services/navigation/hydration.ts` | Chapter hydration must propagate novel context for `appScreen` transitions |
| `store/slices/chaptersSlice.ts:711` | Preload caller (`preloadNextChapters`) must pass novel context to `findByNumber` — without this, preload can hydrate the wrong next chapter once multiple books are cached |

### Phase 1: Shelf Feature

| File | Change |
|------|--------|
| `store/slices/chaptersSlice.ts` | Debounced bookmark save on `currentChapterId` change |
| `store/bootstrap/clearSession.ts` | Reset `appScreen` to `'library'`, clear `activeNovelId`, delete `bookshelf-state` IDB key |
| `components/NovelLibrary.tsx` | "Continue Reading" section, resume flow with stale-bookmark fallback |
| `components/NovelCard.tsx` | Optional progress props for shelf cards |
| `components/InputBar.tsx` | Block URL-paste when `activeNovelId !== null` (show notification). When no active novel, URL-paste sets `appScreen` to `reader-loading`/`reader`. |
| `components/ChapterView.tsx` | Pass Home button wiring to header |
| `components/chapter/ChapterHeader.tsx` | Add Home/Library button |

### Tests

| File | Coverage |
|------|----------|
| `tests/store/bootstrap/bootstrapHelpers.test.ts` | Boot-to-library default, deep-link precedence, no auto-resume |
| `tests/components/NovelLibrary.test.tsx` | Shelf section rendering, resume flow, stale bookmark fallback |
| `tests/components/chapter/ChapterHeader.test.tsx` | Home button presence and behavior |
| New: integration test for `appScreen` | State machine transitions: library -> reader-loading -> reader -> library |
| New: `readerHydrationService` unit test | Novel-scoped hydration, fallback for missing chapters |

### Documentation

| File | Change |
|------|--------|
| New ADR: `docs/adr/CORE-007-book-switching-shelf.md` | Architecture decision record |
| `docs/WORKLOG.md` | Signal active work |

## Schema Impact

- **Schema v14 required in Phase 0.** The v13 "comprehensive repair" migration (`schema.ts:286-363`) has a pre-existing bug: it re-creates all stores and indexes but **omits** the `novelId` index on `url_mappings` (compare v7 line 215 which has it, v13 lines 328-332 which don't). It also omits the `novelChapter` compound index from v6. This means any database that went through v13 repair may be missing these indexes. Phase 0 adds a v14 migration that:
  - Re-adds `novelId` index on `url_mappings` (fixing the v13 omission)
  - Re-adds `novelChapter` compound index on `url_mappings`
  - Adds `novelId` index on `chapters` (new, for efficient per-novel queries)
  - `novelId` field on records is backfilled once at boot (guarded by "done" flag).

## Phase 2 (Future)

- Version-aware resume: `activeNovelId` becomes `{ novelId, versionId? }`, `BookshelfState` keyed by `novelId + versionId`.
- Lazy RAM eviction: only active novel's chapters in RAM, others hydrate on demand.
- "Remove from shelf" action to delete a single novel's data without clearing everything.
- Add `novelId` to `generateStableChapterId` hash if cross-novel collisions surface (e.g., different translations of the same source novel).
- Support mixed reading: `activeReadingTarget = { type: 'libraryNovel', novelId } | { type: 'ephemeralUrl' }` to allow URL-paste without shelving first.
