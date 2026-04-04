# Book Switching & Novel Shelf — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users switch between library novels without clearing cache, with a "Continue Reading" shelf on the library page.

**Architecture:** Active Novel Filter — all books stay in IndexedDB permanently, `activeNovelId` controls which novel's chapters are active. Explicit `appScreen` state machine replaces derived `hasSession`. Centralized `readerHydrationService` replaces 4 duplicated hydration paths.

**Phase 1 scope gate:** Newly imported library novels are fully supported. Existing cached novels that predate `novelId` persistence are treated as legacy until re-imported once. Phase 1 does not guess registry identity from ambiguous historical rows.

**Tech Stack:** TypeScript, React, Zustand, IndexedDB (idb wrapper), Vitest

**Spec:** `docs/superpowers/specs/2026-03-29-book-switching-shelf-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `services/readerHydrationService.ts` | Single entry point for "load a novel's chapters into the Zustand store." Replaces 4 duplicated hydration paths. |
| `types/bookshelf.ts` | `BookshelfState` and `BookshelfEntry` type definitions. |
| `tests/services/readerHydrationService.test.ts` | Unit tests for novel-scoped hydration. |
| `tests/store/appScreen.integration.test.ts` | Integration test for `appScreen` state machine transitions. |

### Modified Files (Phase 0)
| File | What Changes |
|------|-------------|
| `store/slices/uiSlice.ts` | Add `appScreen`, `activeNovelId`, `bookshelfState`, transition actions. |
| `MainApp.tsx` (repo root) | Replace `hasSession` with `appScreen` selector. |
| `store/bootstrap/initializeStore.ts` | Split into phases, stop auto-resume, load bookshelf eagerly, guard backfills. |
| `services/db/types.ts` | Add `novelId` to `ChapterRecord` and `UrlMappingRecord`. |
| `services/db/core/schema.ts` | Add v14 migration (fix v13 index omissions + add `chapters.novelId` index). |
| `services/db/core/connection.ts` | Ensure fresh databases create the same `novelId` / `novelChapter` indexes as schema v14. |
| `services/stableIdService.ts` | Use registry `novel.id` for library imports. |
| `services/importService.ts` | Thread optional `registryNovelId` through import entry points. |
| `services/db/operations/imports.ts` | Persist `novelId` on chapters and URL mappings. |
| `services/db/operations/chapters.ts` | Write `novelId`, scope `findByNumber` by `novelId`. |
| `services/db/operations/maintenance.ts` | Add `backfillNovelIds()`. |
| `services/db/operations/rendering.ts` | Add `fetchChaptersForNovel(novelId)`. |
| `services/db/operations/mappings.ts` | Novel-scoped lookup helpers. |
| `services/db/operations/index.ts` | Export new operations. |
| `components/NovelLibrary.tsx` | Replace inline hydration with `readerHydrationService`. |
| `store/bootstrap/importSessionData.ts` | Replace inline hydration with `readerHydrationService`. |
| `services/importService.ts` | Replace inline hydration with `readerHydrationService`. |
| `services/navigation/index.ts` | Preserve deep-link composition and return novel-aware navigation results. |
| `services/navigation/hydration.ts` | Propagate `novelId` into hydrated runtime chapters. |
| `store/slices/chaptersSlice.ts` | Scope `preloadNextChapters` and own `reader-loading -> reader` transitions after successful navigation. |

### Modified Files (Phase 1)
| File | What Changes |
|------|-------------|
| `store/bootstrap/clearSession.ts` | Reset `appScreen`, `activeNovelId`, delete `bookshelf-state`. |
| `components/NovelLibrary.tsx` | "Continue Reading" section, resume flow. |
| `components/NovelCard.tsx` | Optional progress props for shelf cards. |
| `components/InputBar.tsx` | Block URL-paste when `activeNovelId !== null`. |
| `components/ChapterView.tsx` | Pass Home button wiring to header. |
| `components/chapter/ChapterHeader.tsx` | Add Home/Library button. |

---

## Phase 0: Surgical Cleanup + Identity Foundation

### Task 1: BookshelfState types

**Files:**
- Create: `types/bookshelf.ts`

- [ ] **Step 1: Create the type file**

```typescript
// types/bookshelf.ts

export interface BookshelfEntry {
  novelId: string;
  versionId?: string;            // reserved for phase 2
  lastChapterId: string;         // source of truth for resume
  lastChapterNumber?: number;    // cached display field only (not authoritative)
  lastReadAtIso: string;         // ISO 8601 string
}

export type BookshelfState = Record<string, BookshelfEntry>;
```

- [ ] **Step 2: Commit**

```bash
git add types/bookshelf.ts
git commit -m "feat(shelf): add BookshelfState and BookshelfEntry types"
```

---

### Task 2: Add `appScreen` and `activeNovelId` to UI slice

**Files:**
- Modify: `store/slices/uiSlice.ts`
- Test: `tests/store/appScreen.integration.test.ts`

- [ ] **Step 1: Add appScreen and activeNovelId to UiState interface**

In `store/slices/uiSlice.ts`, add to `UiState` interface (after `isInitialized: boolean`):

```typescript
  // App screen routing
  appScreen: 'library' | 'reader-loading' | 'reader';
  activeNovelId: string | null;
  bookshelfState: BookshelfState;
```

Add to `UiActions` interface:

```typescript
  // Screen routing actions
  openNovel: (novelId: string) => void;
  setReaderReady: () => void;
  openLibrary: () => void;
```

Add import at top:

```typescript
import type { BookshelfState } from '../../types/bookshelf';
```

Add initial state in `createUiSlice` (after `isInitialized: false`):

```typescript
  appScreen: 'library' as const,
  activeNovelId: null,
  bookshelfState: {} as BookshelfState,
```

Add action implementations:

```typescript
  openNovel: (novelId) => set({
    appScreen: 'reader-loading' as const,
    activeNovelId: novelId,
  }),

  setReaderReady: () => set((state) => {
    if (state.appScreen !== 'reader-loading') return {};
    return { appScreen: 'reader' as const };
  }),

  openLibrary: () => set({
    appScreen: 'library' as const,
    activeNovelId: null,
  }),
```

- [ ] **Step 2: Confirm storeTypes does not need a direct edit**

No changes needed — `UiSlice` already includes `UiState & UiActions`, and `AppState` already includes `UiSlice`. Remove `store/storeTypes.ts` from the implementation surface rather than editing it.

Verify by checking: `store/storeTypes.ts` line 11: `type AppState = UiSlice & ...`

- [ ] **Step 3: Add the integration test**

```typescript
// tests/store/appScreen.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store';

describe('appScreen state machine', () => {
  beforeEach(() => {
    // Reset store to defaults
    useAppStore.setState({
      appScreen: 'library',
      activeNovelId: null,
    });
  });

  it('defaults to library with no active novel', () => {
    const state = useAppStore.getState();
    expect(state.appScreen).toBe('library');
    expect(state.activeNovelId).toBeNull();
  });

  it('openNovel sets reader-loading and activeNovelId', () => {
    useAppStore.getState().openNovel('orv-main');
    const state = useAppStore.getState();
    expect(state.appScreen).toBe('reader-loading');
    expect(state.activeNovelId).toBe('orv-main');
  });

  it('setReaderReady transitions from reader-loading to reader', () => {
    useAppStore.getState().openNovel('orv-main');
    useAppStore.getState().setReaderReady();
    expect(useAppStore.getState().appScreen).toBe('reader');
  });

  it('setReaderReady is a no-op if not in reader-loading', () => {
    // Still in library
    useAppStore.getState().setReaderReady();
    expect(useAppStore.getState().appScreen).toBe('library');
  });

  it('openLibrary transitions back to library', () => {
    useAppStore.getState().openNovel('orv-main');
    useAppStore.getState().setReaderReady();
    useAppStore.getState().openLibrary();
    const state = useAppStore.getState();
    expect(state.appScreen).toBe('library');
    expect(state.activeNovelId).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/store/appScreen.integration.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add store/slices/uiSlice.ts tests/store/appScreen.integration.test.ts
git commit -m "feat(shelf): add appScreen state machine and activeNovelId to UI slice"
```

---

### Task 3: Replace `hasSession` with `appScreen` in MainApp

**Files:**
- Modify: `MainApp.tsx` (repo root)

- [ ] **Step 1: Replace the hasSession derivation**

At `MainApp.tsx:85`, replace:

```typescript
const hasSession = chapters.size > 0 || currentChapterId !== null;
```

with:

```typescript
const appScreen = useAppStore((s) => s.appScreen);
```

- [ ] **Step 2: Update all references to `hasSession` in the render section**

Search for `hasSession` in `MainApp.tsx` and replace with `appScreen !== 'library'` (for the "show reader" case) or `appScreen === 'library'` (for the "show landing page" case).

The key conditional should become:

```typescript
{appScreen === 'library' ? (
  <LandingPage ... />
) : (
  // reader or reader-loading content
  ...
)}
```

- [ ] **Step 3: Verify app still compiles**

Run: `npx tsc --noEmit`
Expected: no errors related to `hasSession`

- [ ] **Step 4: Commit**

```bash
git add MainApp.tsx
git commit -m "fix(shelf): replace derived hasSession with explicit appScreen routing"
```

---

### Task 4: Add `novelId` to DB types and schema v14

**Files:**
- Modify: `services/db/types.ts`
- Modify: `services/db/core/schema.ts`
- Modify: `services/db/core/connection.ts`

- [ ] **Step 1: Add `novelId` to ChapterRecord**

In `services/db/types.ts`, add after `chapterNumber?: number;` (line 17):

```typescript
  novelId: string | null;  // registry novel.id for library novels; null for URL-paste
```

- [ ] **Step 2: Add `novelId` to UrlMappingRecord**

In `services/db/types.ts`, add after `dateAdded: string;` (line 149):

```typescript
  novelId: string | null;  // same semantics as ChapterRecord.novelId
```

- [ ] **Step 3: Add v14 migration in schema.ts**

Add to `SCHEMA_VERSIONS`:

```typescript
  NOVEL_IDENTITY: 14,
  CURRENT: 14,
```

Update `CURRENT: 13` to `CURRENT: 14`.

Add migration function:

```typescript
/**
 * Migration to version 14: Novel identity foundation
 * - Fixes v13 omission: re-adds novelId and novelChapter indexes on url_mappings
 * - Adds novelId index on chapters for novel-scoped queries
 */
function migrateToV14(db: IDBDatabase, transaction: IDBTransaction): void {
  console.log('[Migration v14] Adding novel identity indexes...');

  // Fix v13 omission: url_mappings was missing novelId and novelChapter indexes
  const urlStore = ensureStore(db, transaction, STORE_NAMES.URL_MAPPINGS, { keyPath: 'url' });
  ensureIndex(urlStore, 'novelId', 'novelId');
  ensureIndex(urlStore, 'novelChapter', ['novelId', 'chapterNumber']);

  // New: chapters.novelId index for efficient per-novel queries
  const chaptersStore = ensureStore(db, transaction, STORE_NAMES.CHAPTERS, { keyPath: 'url' });
  ensureIndex(chaptersStore, 'novelId', 'novelId');

  console.log('[Migration v14] Novel identity indexes complete.');
}
```

Register in `MIGRATIONS`:

```typescript
  14: migrateToV14,
```

- [ ] **Step 4: Update SchemaOps DB_VERSION**

In `services/db/operations/schema.ts`, verify `DB_VERSION` reads from `SCHEMA_VERSIONS.CURRENT` (which is now 14).

- [ ] **Step 5: Mirror the same indexes in fresh DB creation**

In `services/db/core/connection.ts`, update the create-if-missing paths so new databases also get:

```typescript
urlStore.createIndex('novelId', 'novelId', { unique: false });
urlStore.createIndex('novelChapter', ['novelId', 'chapterNumber'], { unique: false });
chaptersStore.createIndex('novelId', 'novelId', { unique: false });
```

Do not rely on `migrateToV14()` alone, because fresh databases can be created without needing the repair path.

- [ ] **Step 6: Verify app opens with migration**

Run: `npm run dev` and check console for `[Migration v14]` log.

- [ ] **Step 7: Commit**

```bash
git add services/db/types.ts services/db/core/schema.ts services/db/core/connection.ts
git commit -m "feat(shelf): add novelId to ChapterRecord/UrlMappingRecord + schema v14 migration"
```

---

### Task 5: Thread canonical `novelId` through the import pipeline

**Files:**
- Modify: `services/importService.ts`
- Modify: `components/NovelLibrary.tsx`
- Modify: `store/bootstrap/initializeStore.ts`
- Modify: `services/db/operations/imports.ts`
- Modify: `services/db/operations/chapters.ts`
- Modify: `services/stableIdService.ts`

- [ ] **Step 1: Add runtime `novelId` to chapter DTOs and stable payloads**

`EnhancedChapter` and the stable session payload need to carry canonical novel identity explicitly:

```typescript
export interface EnhancedChapter extends Chapter {
  ...
  novelId: string | null;
}

export interface StableSessionData {
  ...
  novelId?: string | null;
}
```

Do not rely on `stableId` to imply novel membership.

- [ ] **Step 2: Thread optional `registryNovelId` through import entry points**

Update import APIs so library callers can pass canonical identity explicitly:

```typescript
static async importFromUrl(
  url: string,
  onProgress?: (progress: ImportProgress) => void,
  options?: { registryNovelId?: string | null }
): Promise<any>

static async streamImportFromUrl(
  url: string,
  onProgress?: (progress: ImportProgress) => void,
  onFirstChaptersReady?: () => Promise<void> | void,
  options?: { registryNovelId?: string | null }
): Promise<any>
```

Callers:
- `NovelLibrary` passes `novel.id`
- `initializeStore` deep-link `?novel=` passes `novel.id`
- `InputBar` passes nothing (ephemeral import)

- [ ] **Step 3: Update `extractNovelInfo` to accept optional registry novelId**

In `services/stableIdService.ts`, change the function signature:

```typescript
export const extractNovelInfo = (
  chapters: ImportedChapter[],
  registryNovelId?: string
): NovelInfo => {
```

If `registryNovelId` is provided, use it directly instead of URL heuristic:

```typescript
  if (registryNovelId) {
    return {
      id: registryNovelId,
      title: chapters[0]?.title?.split('-')[0]?.trim(),
      source: 'library',
      chapterCount: chapters.length,
    };
  }
  // ... existing URL-based heuristic below
```

- [ ] **Step 4: Ensure parsed session data carries the canonical novelId**

When a library import comes through `ImportService`, inject `registryNovelId` into the stable session payload before calling the store import path. The import path must not read `stableData.novelId` unless that field has actually been added to the payload type.

- [ ] **Step 5: Update `importStableSessionData` to accept and persist `novelId`**

In `services/db/operations/imports.ts`, find the function `importStableSessionData` and add `novelId` parameter to the payload type, then include it in the `ChapterRecord` and URL mapping writes:

```typescript
// When creating chapter record, add:
novelId: stableData.novelId ?? null,

// When creating URL mapping record, add:
novelId: stableData.novelId ?? null,
```

- [ ] **Step 6: Update `ChapterOps` write path and mapping upserts**

In `services/db/operations/chapters.ts`, ensure the canonical chapter persistence path preserves `novelId` when writing/updating chapter records. Also update `ensureChapterUrlMappings(...)` so later mapping upserts do not strip `novelId` from existing rows.

- [ ] **Step 7: Scope `findByNumber` by novelId**

In `services/db/operations/chapters.ts`, update `findChapterModernByNumber`:

```typescript
export const findChapterModernByNumber = async (
  chapterNumber: number,
  novelId?: string | null
): Promise<ChapterRecord | null> => {
```

When the `novelId` index is available, use it to scope the query. When falling back to `getAll()`, filter results by `novelId` if provided.

- [ ] **Step 8: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 9: Commit**

```bash
git add services/importService.ts components/NovelLibrary.tsx store/bootstrap/initializeStore.ts services/stableIdService.ts services/db/operations/imports.ts services/db/operations/chapters.ts
git commit -m "feat(shelf): persist novelId on chapters and URL mappings during import"
```

---

### Task 6: Add `backfillNovelIds` normalization and legacy gate

**Files:**
- Modify: `services/db/operations/maintenance.ts`
- Modify: `components/NovelLibrary.tsx`

- [ ] **Step 1: Add the backfill function**

```typescript
/**
 * One-time normalization: replaces undefined novelId with null
 * for rows that predate novel identity tracking.
 *
 * Phase 1 does NOT try to recover registry novel IDs from ambiguous
 * historical data. Legacy rows remain novelId = null until re-import.
 *
 * Guarded by 'novelIdBackfilled' settings flag — runs once.
 */
static async backfillNovelIds(): Promise<void> {
  const alreadyDone = await SettingsOps.getKey<boolean>('novelIdBackfilled');
  if (alreadyDone) return;

  await withWriteTxn(
    STORE_NAMES.CHAPTERS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.CHAPTERS];
      const allChapters = await promisifyRequest(store.getAll()) as ChapterRecord[];

      let updated = 0;
      for (const chapter of allChapters) {
        if (chapter.novelId !== undefined) continue; // already has novelId

        const record = { ...chapter, novelId: null };
        await promisifyRequest(store.put(record));
        updated++;
      }

      console.log(`[Maintenance] backfillNovelIds: updated ${updated} chapters`);
    },
    'maintenance',
    'backfill',
    'novelIds'
  );

  await SettingsOps.set('novelIdBackfilled', true);
}
```

- [ ] **Step 2: Gate legacy cached novels in library flows**

`NovelLibrary` must only treat `fetchChaptersForNovel(novel.id).length > 0` as a cache hit. If the user has older cached chapters with `novelId === null`, do not resume from that ambiguous cache. Re-import the library novel once so it gains canonical identity.

- [ ] **Step 3: Commit**

```bash
git add services/db/operations/maintenance.ts components/NovelLibrary.tsx
git commit -m "feat(shelf): add one-time backfillNovelIds migration for existing chapters"
```

---

### Task 7: Novel-scoped rendering query

**Files:**
- Modify: `services/db/operations/rendering.ts`
- Modify: `services/db/operations/mappings.ts`
- Modify: `services/db/operations/index.ts`

- [ ] **Step 1: Add `fetchChaptersForNovel` to rendering.ts**

Add alongside the existing `fetchChaptersForReactRendering`:

```typescript
/**
 * Fetches chapters for a specific novel, filtered by novelId.
 * Uses the novelId index on chapters store (added in schema v14).
 */
export const fetchChaptersForNovel = async (
  novelId: string
): Promise<ChapterRenderingRecord[]> => {
  const deps: RenderingOpsDeps = {
    openDatabase: () => getConnection(),
    getActiveTranslation: (url) => TranslationOps.getActiveByUrl(url),
  };

  return getChaptersForNovel(deps, novelId);
};

const getChaptersForNovel = async (
  deps: RenderingOpsDeps,
  novelId: string
): Promise<ChapterRenderingRecord[]> => {
  const db = await deps.openDatabase();
  const tx = db.transaction([STORE_NAMES.CHAPTERS], 'readonly');
  const store = tx.objectStore(STORE_NAMES.CHAPTERS);

  let chapters: ChapterRecord[];
  try {
    const index = store.index('novelId');
    chapters = await promisifyRequest(index.getAll(novelId)) as ChapterRecord[];
  } catch {
    // Fallback: full scan + filter if index missing
    const all = await promisifyRequest(store.getAll()) as ChapterRecord[];
    chapters = all.filter(ch => ch.novelId === novelId);
  }

  // Build rendering records (same transform as getChaptersForReactRendering)
  const results: ChapterRenderingRecord[] = [];
  for (const ch of chapters) {
    const translation = await deps.getActiveTranslation(ch.url);
    results.push({
      url: ch.url,
      title: ch.title,
      content: ch.content,
      stableId: ch.stableId || '',
      canonicalUrl: ch.canonicalUrl || ch.url,
      originalUrl: ch.originalUrl,
      chapterNumber: ch.chapterNumber || 0,
      nextUrl: ch.nextUrl || null,
      prevUrl: ch.prevUrl || null,
      sourceUrls: [ch.url],
      fanTranslation: ch.fanTranslation || null,
      translationResult: translation || null,
    });
  }

  return results.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
};
```

- [ ] **Step 2: Add novel-scoped URL lookup to mappings.ts**

```typescript
/**
 * Gets all URL mappings for a specific novel.
 */
static async getMappingsForNovel(novelId: string): Promise<UrlMappingRecord[]> {
  return withReadTxn(
    STORE_NAMES.URL_MAPPINGS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.URL_MAPPINGS];
      try {
        const index = store.index('novelId');
        return (await promisifyRequest(index.getAll(novelId))) as UrlMappingRecord[];
      } catch {
        const all = (await promisifyRequest(store.getAll())) as UrlMappingRecord[];
        return all.filter(m => m.novelId === novelId);
      }
    },
    'mappings',
    'operations',
    'getMappingsForNovel'
  );
}
```

- [ ] **Step 3: Export new functions from index.ts**

Add `fetchChaptersForNovel` to the export from `./rendering`.

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add services/db/operations/rendering.ts services/db/operations/mappings.ts services/db/operations/index.ts
git commit -m "feat(shelf): add novel-scoped chapter and URL mapping queries"
```

---

### Task 8: Create `readerHydrationService`

**Files:**
- Create: `services/readerHydrationService.ts`
- Create: `tests/services/readerHydrationService.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/services/readerHydrationService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
vi.mock('../../services/db/operations', () => ({
  fetchChaptersForNovel: vi.fn(),
  fetchChaptersForReactRendering: vi.fn(),
  MappingsOps: { getMappingsForNovel: vi.fn(), getAllUrlMappings: vi.fn() },
  NavigationOps: { getHistory: vi.fn(), getLastActiveChapter: vi.fn() },
}));

describe('readerHydrationService', () => {
  it('hydrates only chapters for the requested novel', async () => {
    const mod = await import('../../services/readerHydrationService');
    expect(mod.loadNovelIntoStore).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/readerHydrationService.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement the service**

```typescript
// services/readerHydrationService.ts
/**
 * Reader Hydration Service
 *
 * Single entry point for "load a novel's chapters into the Zustand store."
 * Replaces 4 duplicated hydration paths in NovelLibrary.tsx (x2),
 * importSessionData.ts, and importService.ts.
 */

import { useAppStore } from '../store';
import { fetchChaptersForNovel, fetchChaptersForReactRendering, MappingsOps } from './db/operations';
import { normalizeUrlAggressively } from './stableIdService';
import type { EnhancedChapter } from './stableIdService';

/**
 * Hydrates the Zustand store with chapters for a specific novel.
 * Builds the chapters Map, urlIndex, and rawUrlIndex from IDB records.
 *
 * Library novels must use loadNovelIntoStore(novelId).
 * Full-session / ephemeral imports use loadAllIntoStore().
 */
export async function loadNovelIntoStore(novelId: string): Promise<string | null> {
  const chapters = await fetchChaptersForNovel(novelId);
  ...
}

export async function loadAllIntoStore(): Promise<string | null> {
  const chapters = await fetchChaptersForReactRendering();

  if (chapters.length === 0) return null;

  const newChapters = new Map<string, EnhancedChapter>();
  const newUrlIndex = new Map<string, string>();
  const newRawUrlIndex = new Map<string, string>();

  for (const ch of chapters) {
    const sourceUrls = ch.sourceUrls ?? [ch.url];
    newChapters.set(ch.stableId, {
      id: ch.stableId,
      title: ch.title,
      content: ch.content,
      originalUrl: ch.originalUrl ?? ch.url,
      nextUrl: ch.nextUrl ?? null,
      prevUrl: ch.prevUrl ?? null,
      chapterNumber: ch.chapterNumber ?? 0,
      canonicalUrl: ch.canonicalUrl ?? ch.url,
      sourceUrls,
      novelId: ch.novelId ?? null,
      fanTranslation: ch.fanTranslation ?? null,
      translationResult: ch.translationResult || null,
      feedback: [],
    });

    for (const rawUrl of sourceUrls) {
      if (!rawUrl) continue;
      newRawUrlIndex.set(rawUrl, ch.stableId);
      const normalized = normalizeUrlAggressively(rawUrl);
      if (normalized) {
        newUrlIndex.set(normalized, ch.stableId);
      }
    }
  }

  // Sort by chapter number, return first
  const sorted = Array.from(newChapters.values()).sort(
    (a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0)
  );
  const firstChapterId = sorted[0]?.id ?? null;

  useAppStore.setState({
    chapters: newChapters,
    urlIndex: newUrlIndex,
    rawUrlIndex: newRawUrlIndex,
  });

  return firstChapterId;
}
```

- [ ] **Step 4: Make the test assert real behavior**

The unit test must verify at least:
- `loadNovelIntoStore(novelId)` only hydrates that novel
- hydrated chapters preserve `novelId`
- `loadAllIntoStore()` still works for full-session / ephemeral imports
- the replaced call sites still restore any reader state they currently own, such as `currentChapterId` and `navigationHistory`; the service must not silently drop that behavior during consolidation

Do not stop at "module is importable."

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/services/readerHydrationService.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add services/readerHydrationService.ts tests/services/readerHydrationService.test.ts
git commit -m "feat(shelf): create readerHydrationService — single hydration entry point"
```

---

### Task 9: Replace 4 duplicated hydration paths

**Files:**
- Modify: `components/NovelLibrary.tsx`
- Modify: `store/bootstrap/importSessionData.ts`
- Modify: `services/importService.ts`

- [ ] **Step 1: Replace NovelLibrary cached-chapters branch (lines 69-118)**

Replace the inline `fetchChaptersForReactRendering()` + Map-building + `setState` block with:

```typescript
import { loadNovelIntoStore } from '../services/readerHydrationService';

// Inside handleStartReading, cached-chapters branch:
const firstChapterId = await loadNovelIntoStore(novel.id);
if (firstChapterId) {
  useAppStore.setState({ currentChapterId: firstChapterId });
}
```

- [ ] **Step 2: Replace NovelLibrary onFirstChaptersReady (lines 155-213)**

Same pattern — replace the inline hydration with `loadNovelIntoStore(novel.id)`.

- [ ] **Step 3: Replace importSessionData.ts hydration**

Find the section that calls `fetchChaptersForReactRendering()` and builds Maps. Replace with:

```typescript
import { loadAllIntoStore } from '../../services/readerHydrationService';

const firstChapterId = await loadAllIntoStore();
```

- [ ] **Step 4: Replace importService.ts hydration (around line 688)**

Use `loadNovelIntoStore(registryNovelId)` when the stream import came from the library or `?novel=` deep link. Use `loadAllIntoStore()` for ephemeral InputBar/file import.

- [ ] **Step 5: Verify app still works**

Run: `npm run dev`, open browser, load a novel from the library. Verify chapters display correctly.

- [ ] **Step 6: Commit**

```bash
git add components/NovelLibrary.tsx store/bootstrap/importSessionData.ts services/importService.ts
git commit -m "refactor(shelf): consolidate 4 hydration paths into readerHydrationService"
```

---

### Task 10: Split `initializeStore` into phases and stop auto-resume

**Files:**
- Modify: `store/bootstrap/initializeStore.ts`

- [ ] **Step 1: Extract named phase functions**

Split the single `createInitializeStore` body into:

```typescript
async function bootRepairs(ctx: BootstrapContext): Promise<void> {
  // Model field repair, URL mapping backfill, stableId normalization,
  // active translation backfill, translation metadata backfill,
  // chapter numbers backfill, novelId backfill.
  // Each guarded by a "done" flag (check existing patterns).
}

async function resolveDeepLinkIntent(ctx: BootstrapContext): Promise<void> {
  // ?novel and ?import handling (moved from current lines 65-112).
  // On ?novel: import with registryNovelId, hydrate, then transition to reader.
}

async function hydratePersistedState(ctx: BootstrapContext): Promise<void> {
  // URL mappings, navigation history.
  // Load BookshelfState eagerly (forward-compatible: returns empty until Phase 1 writes).
  // Do NOT auto-resume last chapter — appScreen stays 'library' by default.
}

async function initializeServices(ctx: BootstrapContext): Promise<void> {
  // Audio service init.
}
```

- [ ] **Step 2: Guard existing backfills with "done" flags**

The `chapterNumbersBackfilled` pattern already exists (line 148-160). Apply the same pattern to:
- `backfillUrlMappingsFromChapters` → guard with `'urlMappingsBackfilled'`
- `normalizeStableIds` → guard with `'stableIdsNormalized'`
- `backfillActiveTranslations` → guard with `'activeTranslationsBackfilled'`
- `backfillTranslationMetadata` → guard with `'translationMetadataBackfilled'` (already exists)
- `backfillNovelIds` → already guarded internally

- [ ] **Step 3: Remove auto-resume block (lines 204-232)**

Delete or comment out the `loadLastActiveChapter` section. The library will be the default landing screen. Resume happens explicitly when the user taps a shelf card (Phase 1).

- [ ] **Step 4: Add BookshelfState eager load**

```typescript
// In hydratePersistedState:
try {
  const bookshelfData = await SettingsOps.getKey<BookshelfState>('bookshelf-state');
  if (bookshelfData) {
    ctx.set({ bookshelfState: bookshelfData });
    bootstrapLog('bookshelfState loaded', { novels: Object.keys(bookshelfData).length });
  }
} catch (e) {
  console.warn('[Store] Failed to load bookshelf state:', e);
}
```

- [ ] **Step 5: Wire deep-link ?novel all the way to reader**

In `resolveDeepLinkIntent`, after successful novel import:

```typescript
ctx.get().openNovel(novel.id);
const firstChapterId = await loadNovelIntoStore(novel.id);
ctx.set({ currentChapterId: firstChapterId });
ctx.get().setReaderReady();
```

If `?novel` and `?chapter` are both present, keep `appScreen='reader-loading'` until the subsequent `handleNavigate()` succeeds.

- [ ] **Step 6: Verify app boots to library**

Run: `npm run dev`, open browser. Should see library (landing page), not auto-resume into a chapter.

- [ ] **Step 7: Commit**

```bash
git add store/bootstrap/initializeStore.ts
git commit -m "refactor(shelf): split initializeStore into phases, stop auto-resume, guard backfills"
```

---

### Task 11: Scope `preloadNextChapters` by novel

**Files:**
- Modify: `store/slices/chaptersSlice.ts`

- [ ] **Step 1: Update preloadNextChapters to pass novelId to findByNumber**

Find the `preloadNextChapters` function. Where it calls the equivalent of `findByNumber(chapterNumber + 1)`, pass `activeNovelId` from the store:

```typescript
const activeNovelId = get().activeNovelId;
// Pass to the scoped query
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add store/slices/chaptersSlice.ts
git commit -m "fix(shelf): scope preloadNextChapters by activeNovelId"
```

---

### Task 12: Update navigation layer for deep links

**Files:**
- Modify: `services/navigation/index.ts`
- Modify: `services/navigation/hydration.ts`
- Modify: `store/slices/chaptersSlice.ts`

- [ ] **Step 1: Propagate `novelId` through hydrated chapters**

In `services/navigation/hydration.ts`, when building `EnhancedChapter` from `ChapterRecord`, include `novelId: rec.novelId ?? null`.

- [ ] **Step 2: Keep navigation services store-agnostic**

Do not make `services/navigation/*` call store UI actions directly. Instead, in `store/slices/chaptersSlice.ts`, after a successful `handleNavigate()` result:

```typescript
if (result.chapter?.novelId) {
  get().openNovel(result.chapter.novelId);
}
get().setReaderReady();
```

This keeps `activeNovelId` / `appScreen` transitions in the store layer rather than inside low-level navigation services.

- [ ] **Step 3: Verify deep links still work**

Open: `http://localhost:5173/?novel=orv` — should import and open reader.
Open: `http://localhost:5173/?chapter=<encoded-url>` — should navigate to chapter.

- [ ] **Step 4: Commit**

```bash
git add services/navigation/index.ts services/navigation/hydration.ts store/slices/chaptersSlice.ts
git commit -m "feat(shelf): deep links set activeNovelId and appScreen coherently"
```

---

## Phase 1: Shelf Feature

### Task 13: Debounced bookmark auto-save

**Files:**
- Modify: `store/slices/chaptersSlice.ts`

- [ ] **Step 1: Add debounced bookmark persistence**

In the `setCurrentChapter` action (or wherever `currentChapterId` is set), add a debounced write to `bookshelf-state`:

```typescript
// At module level:
let bookmarkSaveTimer: ReturnType<typeof setTimeout> | null = null;

// Inside setCurrentChapter (after setting currentChapterId):
if (bookmarkSaveTimer) clearTimeout(bookmarkSaveTimer);
bookmarkSaveTimer = setTimeout(() => {
  const state = get();
  if (!state.activeNovelId || !state.currentChapterId) return;

  const chapter = state.getChapter(state.currentChapterId);
  const entry: BookshelfEntry = {
    novelId: state.activeNovelId,
    lastChapterId: state.currentChapterId,
    lastChapterNumber: chapter?.chapterNumber,
    lastReadAtIso: new Date().toISOString(),
  };

  const newBookshelfState = { ...state.bookshelfState, [state.activeNovelId]: entry };
  set({ bookshelfState: newBookshelfState });

  // Persist to IDB (fire-and-forget)
  SettingsOps.set('bookshelf-state', newBookshelfState).catch(() => {});
}, 2000);
```

- [ ] **Step 2: Commit**

```bash
git add store/slices/chaptersSlice.ts
git commit -m "feat(shelf): debounced bookmark auto-save on chapter change"
```

---

### Task 14: Update `clearSession` for shelf awareness

**Files:**
- Modify: `store/bootstrap/clearSession.ts`

- [ ] **Step 1: Add appScreen, activeNovelId, and bookshelfState to reset**

In `buildResetState`, add:

```typescript
  // Shelf state
  appScreen: 'library' as const,
  activeNovelId: null,
  bookshelfState: {},
```

- [ ] **Step 2: Delete bookshelf-state IDB key in clearSession**

In `createClearSession`, after `SessionManagementService.clearSession(options)`:

```typescript
// Clear bookshelf state from IDB
try {
  await SettingsOps.set('bookshelf-state', {});
} catch (e) {
  console.warn('[Store] Failed to clear bookshelf state:', e);
}
```

- [ ] **Step 3: Commit**

```bash
git add store/bootstrap/clearSession.ts
git commit -m "feat(shelf): clearSession resets appScreen, activeNovelId, bookshelfState"
```

---

### Task 15: Home/Library button in reader header

**Files:**
- Modify: `components/chapter/ChapterHeader.tsx`
- Modify: `components/ChapterView.tsx`
- Test: `tests/components/chapter/ChapterHeader.test.tsx`

- [ ] **Step 1: Add Home button to ChapterHeader**

Add to `ChapterHeaderProps`:

```typescript
  onGoHome?: () => void;
```

Add a Home button in the header layout (before the language toggles):

```typescript
{onGoHome && (
  <button
    onClick={onGoHome}
    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
    title="Return to Library"
  >
    <BookOpen className="h-4 w-4" />
    <span className="hidden sm:inline">Library</span>
  </button>
)}
```

Add `BookOpen` to the lucide-react import.

- [ ] **Step 2: Wire up in ChapterView**

In `ChapterView.tsx`, pass `onGoHome` prop to `ChapterHeader`:

```typescript
const openLibrary = useAppStore(s => s.openLibrary);

<ChapterHeader
  ...
  onGoHome={openLibrary}
/>
```

- [ ] **Step 3: Write test**

```typescript
// In tests/components/chapter/ChapterHeader.test.tsx
it('renders Home button when onGoHome is provided', () => {
  render(<ChapterHeader {...defaultProps} onGoHome={() => {}} />);
  expect(screen.getByTitle('Return to Library')).toBeInTheDocument();
});

it('does not render Home button when onGoHome is not provided', () => {
  render(<ChapterHeader {...defaultProps} />);
  expect(screen.queryByTitle('Return to Library')).not.toBeInTheDocument();
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/components/chapter/ChapterHeader.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/chapter/ChapterHeader.tsx components/ChapterView.tsx tests/components/chapter/ChapterHeader.test.tsx
git commit -m "feat(shelf): add Home/Library button to reader header"
```

---

### Task 16: "Continue Reading" section on library page

**Files:**
- Modify: `components/NovelLibrary.tsx`
- Modify: `components/NovelCard.tsx`

- [ ] **Step 1: Add Continue Reading section to NovelLibrary**

At the top of the library render (above `NovelGrid`), add:

```typescript
const bookshelfState = useAppStore(s => s.bookshelfState);
const openNovel = useAppStore(s => s.openNovel);
const setReaderReady = useAppStore(s => s.setReaderReady);

const shelvedNovels = Object.values(bookshelfState)
  .sort((a, b) => new Date(b.lastReadAtIso).getTime() - new Date(a.lastReadAtIso).getTime());
```

Render a "Continue Reading" section when `shelvedNovels.length > 0`:

```tsx
{shelvedNovels.length > 0 && (
  <div className="mb-8">
    <h3 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
      Continue Reading
    </h3>
    <div className="flex gap-4 overflow-x-auto pb-2">
      {shelvedNovels.map(entry => (
        <ShelfCard
          key={entry.novelId}
          entry={entry}
          novel={novels.find(n => n.id === entry.novelId)}
          onResume={async () => {
            openNovel(entry.novelId);
            const { loadNovelIntoStore } = await import('../services/readerHydrationService');
            const firstChapterId = await loadNovelIntoStore(entry.novelId);
            // Resume at bookmarked chapter, with stale-bookmark fallback
            const resumeChapterId = entry.lastChapterId; // TODO: verify exists, fallback
            useAppStore.setState({ currentChapterId: resumeChapterId || firstChapterId });
            setReaderReady();
          }}
        />
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: Create ShelfCard component (inline or extract)**

A shelf card shows: cover thumbnail, title, "Ch. X / Y", progress bar, "Last read X ago". Use the `NovelEntry` metadata for cover image and chapter count. Use `BookshelfEntry` for reading position.

This can start as an inline component within `NovelLibrary.tsx` and be extracted later if it grows.

- [ ] **Step 3: Add stale-bookmark fallback to resume flow**

```typescript
// In the onResume handler:
const chapters = useAppStore.getState().chapters;
let resumeId = entry.lastChapterId;

if (!chapters.has(resumeId)) {
  // Stale bookmark — try matching by chapter number
  const byNumber = Array.from(chapters.values()).find(
    ch => ch.chapterNumber === entry.lastChapterNumber
  );
  resumeId = byNumber?.id ?? Array.from(chapters.values())[0]?.id ?? null;
}
```

- [ ] **Step 4: Verify visually**

Run: `npm run dev`. After reading a library novel and going home, the "Continue Reading" section should appear.

- [ ] **Step 5: Commit**

```bash
git add components/NovelLibrary.tsx
git commit -m "feat(shelf): add Continue Reading section with shelf cards and resume flow"
```

---

### Task 17: Block URL-paste during active novel

**Files:**
- Modify: `components/InputBar.tsx`

- [ ] **Step 1: Add guard in handleSubmit**

At the top of the submit handler:

```typescript
const activeNovelId = useAppStore.getState().activeNovelId;
if (activeNovelId) {
  useAppStore.getState().showNotification(
    'Return to the library before pasting a URL.',
    'warning'
  );
  return;
}
```

- [ ] **Step 2: Commit**

```bash
git add components/InputBar.tsx
git commit -m "feat(shelf): block URL-paste when a library novel is active"
```

---

### Task 18: NovelLibrary creates BookshelfEntry on new book start

**Files:**
- Modify: `components/NovelLibrary.tsx`

- [ ] **Step 1: Complete the new-book reader transition first**

In the `handleStartReading` flow, the new-book library path must do all of these in order:

```typescript
openNovel(novel.id);
const firstChapterId = await loadNovelIntoStore(novel.id);
useAppStore.setState({ currentChapterId: firstChapterId });
setReaderReady();
```

Only after that should the code persist the initial bookshelf entry.

- [ ] **Step 2: Write shelf entry when starting a new book**

In the `handleStartReading` flow, after the reader is ready, create the initial bookshelf entry:

```typescript
const newEntry: BookshelfEntry = {
  novelId: novel.id,
  lastChapterId: firstChapterId,
  lastChapterNumber: 1,
  lastReadAtIso: new Date().toISOString(),
};

const currentBookshelf = useAppStore.getState().bookshelfState;
const updatedBookshelf = { ...currentBookshelf, [novel.id]: newEntry };
useAppStore.setState({ bookshelfState: updatedBookshelf });
SettingsOps.set('bookshelf-state', updatedBookshelf).catch(() => {});
```

- [ ] **Step 3: Commit**

```bash
git add components/NovelLibrary.tsx
git commit -m "feat(shelf): create BookshelfEntry when starting a new library novel"
```

---

### Task 19: Integration tests for shelf flows

**Files:**
- Modify: `tests/store/appScreen.integration.test.ts`
- Modify: `tests/components/NovelLibrary.test.tsx`

- [ ] **Step 1: Add shelf flow tests to appScreen integration test**

```typescript
describe('shelf flows', () => {
  it('shelving preserves bookshelf state', () => {
    const { getState } = useAppStore;
    getState().openNovel('orv-main');
    getState().setReaderReady();

    // Simulate bookmark save
    useAppStore.setState({
      bookshelfState: {
        'orv-main': {
          novelId: 'orv-main',
          lastChapterId: 'ch23_abc_def',
          lastChapterNumber: 23,
          lastReadAtIso: new Date().toISOString(),
        },
      },
    });

    // Shelve
    getState().openLibrary();

    // Bookshelf state survives
    expect(getState().bookshelfState['orv-main']).toBeDefined();
    expect(getState().bookshelfState['orv-main'].lastChapterId).toBe('ch23_abc_def');
    expect(getState().appScreen).toBe('library');
  });
});
```

- [ ] **Step 2: Add NovelLibrary test for Continue Reading section**

In `tests/components/NovelLibrary.test.tsx`, add a test that verifies the "Continue Reading" section renders when `bookshelfState` has entries.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All existing + new tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/store/appScreen.integration.test.ts tests/components/NovelLibrary.test.tsx
git commit -m "test(shelf): integration tests for shelf flows and Continue Reading UI"
```

---

### Task 20: Documentation

**Files:**
- Create: `docs/adr/CORE-007-book-switching-shelf.md`
- Modify: `docs/WORKLOG.md`

- [ ] **Step 1: Write ADR**

```markdown
# CORE-007: Book Switching & Novel Shelf

## Status
Accepted

## Context
Users could not switch between library novels without clearing all cached data.
Screen state was derived from session presence, bootstrap auto-resumed the last chapter,
and hydration logic was duplicated in 4 places.

## Decision
- Active Novel Filter: all books stay in IDB, `activeNovelId` controls which is displayed.
- Explicit `appScreen: 'library' | 'reader-loading' | 'reader'` state machine.
- `BookshelfState` persisted separately from `NovelInfo` catalog metadata.
- `novelId` added to `ChapterRecord` and `UrlMappingRecord` (schema v14).
- Single `readerHydrationService` replaces 4 duplicated hydration paths.
- URL-paste blocked during active library novel (phase 1).

## Consequences
- Cold boot always lands on library.
- Users can shelve 5-10 books and resume where they left off.
- Translations, images, and amendments survive book switching.
- Schema v14 fixes v13 omissions (novelId/novelChapter indexes on url_mappings).
```

- [ ] **Step 2: Update WORKLOG**

Add entry signaling the shelf feature work.

- [ ] **Step 3: Commit**

```bash
git add docs/adr/CORE-007-book-switching-shelf.md docs/WORKLOG.md
git commit -m "docs: ADR CORE-007 book switching shelf + WORKLOG update"
```

---

## Verification Checklist

After all tasks complete, verify:

- [ ] Cold boot (no params) → library page, not auto-resume
- [ ] Start reading a novel → reader view with chapters
- [ ] Tap Home button → library page, no data cleared
- [ ] "Continue Reading" section shows the shelved novel with correct chapter
- [ ] Start a second novel → reader view with different chapters
- [ ] Tap Home → "Continue Reading" shows both novels
- [ ] Tap first novel's shelf card → resumes at bookmarked chapter
- [ ] Refresh browser → library page, shelf cards still show
- [ ] `?novel=orv` deep link → imports and opens reader
- [ ] `?novel=orv&chapter=<url>` → imports novel, navigates to specific chapter
- [ ] URL-paste while reading → blocked with notification
- [ ] Clear session → library page, shelf empty, all data gone
- [ ] Existing translations/images survive book switching
- [ ] Legacy cached library novels without `novelId` re-import once before they appear on the shelf
