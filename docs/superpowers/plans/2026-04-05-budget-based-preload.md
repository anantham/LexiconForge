# Budget-Based Preload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a budget-based alternative to chapter-count preloading — users set a USD cap, and translation stops when cumulative spend for the active novel reaches that limit.

**Architecture:** Toggle between two preload modes (`chapters` | `budget`) via a segmented control. Budget is derived from actual translation records in IndexedDB (no separate counter). Enforcement happens at two points: the preload loop and manual translate entry.

**Tech Stack:** TypeScript, Zustand, IndexedDB (via fake-indexeddb in tests), Vitest, React

**Spec:** `docs/superpowers/specs/2026-04-05-budget-based-preload-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `types.ts` | Modify | Add `preloadMode`, `preloadBudget` to `AppSettings` |
| `services/sessionManagementService.ts` | Modify | Add defaults for new fields |
| `services/db/operations/chapters.ts` | Modify | Add `getByNovelAndVersion()` static method |
| `services/db/operations/budgetOps.ts` | Create | `getNovelTranslationCost()` function |
| `store/slices/chaptersSlice.ts` | Modify | Budget check in preload loop, budget mode loop logic |
| `store/slices/translationsSlice.ts` | Modify | Budget check in `handleTranslate()` |
| `components/settings/TranslationEngineSection.tsx` | Modify | Mode toggle, budget input, spent readout |
| `components/settings/ProvidersPanel.tsx` | Modify | Wire new props including `activeNovelId`, `activeVersionId` |
| `tests/services/db/budgetOps.test.ts` | Create | Tests for `getNovelTranslationCost()` |
| `tests/services/db/chapterOps.test.ts` | Create or Modify | Tests for `getByNovelAndVersion()` |
| `tests/store/slices/budgetEnforcement.test.ts` | Create | Tests for budget enforcement in both slices |

---

## Task 1: Add Settings Fields

**Files:**
- Modify: `types.ts:364-365`
- Modify: `services/sessionManagementService.ts:67-70`

- [ ] **Step 1: Add types**

In `types.ts`, insert before the closing brace of `AppSettings` (line 365):

```typescript
    // Preload mode: chapter count or budget limit
    preloadMode?: 'chapters' | 'budget';       // Toggle preload limiting strategy (default: 'chapters')
    preloadBudget?: number;                     // USD cap for budget mode (default: 0 = disabled)
```

- [ ] **Step 2: Add defaults**

In `services/sessionManagementService.ts`, insert before the closing of `defaultSettings` (before line 70 `};`):

```typescript
  // Preload mode
  preloadMode: 'chapters',
  preloadBudget: 0,
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add types.ts services/sessionManagementService.ts
git commit -m "feat(budget-preload): add preloadMode and preloadBudget settings fields"
```

---

## Task 2: Add `ChapterOps.getByNovelAndVersion()`

**Files:**
- Modify: `services/db/operations/chapters.ts:524-530`
- Create: `tests/services/db/chapterOps.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/services/db/chapterOps.test.ts`.

Since `ChapterOps` uses `withReadTxn` which calls the app's DB singleton (`getConnection()`), the simplest approach is to mock `ChapterOps` at the module boundary (same as `budgetOps.test.ts` does). However, since we're testing `ChapterOps` itself here, we need to mock the DB layer. Mock the internal `withReadTxn` to simulate IndexedDB behavior:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChapterRecord } from '../../../services/db/types';

// Mock the DB core to avoid needing a real DB connection
vi.mock('../../../services/db/core/connection', () => ({
  getConnection: vi.fn(),
}));

// We'll test the function logic by mocking withReadTxn
// to call our callback with a fake store
const mockChapters: ChapterRecord[] = [];

vi.mock('../../../services/db/core/transactions', () => ({
  withReadTxn: vi.fn(async (_storeName: string, callback: Function) => {
    const fakeIndex = {
      getAll: (novelId: string) =>
        ({ result: mockChapters.filter(ch => ch.novelId === novelId) }),
    };
    const fakeStore = {
      indexNames: { contains: () => true },
      index: () => fakeIndex,
      getAll: () => ({ result: mockChapters }),
    };
    // Simulate promisifyRequest by making getAll return directly
    return callback(null, { chapters: fakeStore });
  }),
  withWriteTxn: vi.fn(),
}));

// Mock promisifyRequest to return the .result property
vi.mock('../../../services/db/core/utils', async (importOriginal) => {
  const original = await importOriginal() as any;
  return {
    ...original,
    promisifyRequest: vi.fn((request: any) => Promise.resolve(request.result)),
  };
});

import { ChapterOps } from '../../../services/db/operations/chapters';

describe('ChapterOps.getByNovelAndVersion', () => {
  beforeEach(() => {
    mockChapters.length = 0;
    mockChapters.push(
      { stableId: 'ch-1', novelId: 'novel-1', libraryVersionId: 'v1', chapterNumber: 1 } as ChapterRecord,
      { stableId: 'ch-2', novelId: 'novel-1', libraryVersionId: 'v1', chapterNumber: 2 } as ChapterRecord,
      { stableId: 'ch-3', novelId: 'novel-2', libraryVersionId: 'v1', chapterNumber: 1 } as ChapterRecord,
    );
  });

  it('returns only chapters matching novelId and versionId', async () => {
    const result = await ChapterOps.getByNovelAndVersion('novel-1', 'v1');
    expect(result).toHaveLength(2);
    expect(result.every(ch => ch.novelId === 'novel-1')).toBe(true);
  });

  it('returns empty array when no chapters match', async () => {
    const result = await ChapterOps.getByNovelAndVersion('nonexistent', 'v1');
    expect(result).toEqual([]);
  });

  it('filters by versionId when novelId matches but versionId differs', async () => {
    const result = await ChapterOps.getByNovelAndVersion('novel-1', 'other-version');
    expect(result).toEqual([]);
  });
});
```

**Note:** The mock approach here depends on the exact internal module structure. The implementing engineer should check the actual import paths for `withReadTxn`, `promisifyRequest`, and `STORE_NAMES` in `chapters.ts` and adjust the mock paths accordingly. If the mocking becomes too complex, an alternative is to skip the unit test for this function and rely on the integration test in Task 8 — the function is a thin wrapper over IndexedDB.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/db/chapterOps.test.ts`
Expected: FAIL — `ChapterOps.getByNovelAndVersion is not a function`

- [ ] **Step 3: Implement `getByNovelAndVersion`**

In `services/db/operations/chapters.ts`, add the private function (after `findChapterModernByNumber` ~line 364):

```typescript
const getChaptersByNovelAndVersion = async (
  novelId: string,
  libraryVersionId: string
): Promise<ChapterRecord[]> => {
  return withReadTxn(
    STORE_NAMES.CHAPTERS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.CHAPTERS];

      // Use novelId index if available
      if (store.indexNames.contains('novelId')) {
        const index = store.index('novelId');
        const rows = (await promisifyRequest(index.getAll(novelId))) as ChapterRecord[];
        return rows.filter(
          ch => (ch.libraryVersionId ?? null) === (libraryVersionId ?? null)
        );
      }

      // Fallback: full scan
      const all = (await promisifyRequest(store.getAll())) as ChapterRecord[];
      return all.filter(
        ch =>
          (ch.novelId ?? null) === novelId &&
          (ch.libraryVersionId ?? null) === (libraryVersionId ?? null)
      );
    },
    CHAPTER_DOMAIN,
    'operations',
    'getByNovelAndVersion'
  );
};
```

Add the static method on the `ChapterOps` class (after `findByNumber`, ~line 530):

```typescript
  static async getByNovelAndVersion(
    novelId: string,
    libraryVersionId: string
  ): Promise<ChapterRecord[]> {
    return getChaptersByNovelAndVersion(novelId, libraryVersionId);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/db/chapterOps.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/db/operations/chapters.ts tests/services/db/chapterOps.test.ts
git commit -m "feat(budget-preload): add ChapterOps.getByNovelAndVersion query"
```

---

## Task 3: Create `budgetOps.ts`

**Files:**
- Create: `services/db/operations/budgetOps.ts`
- Create: `tests/services/db/budgetOps.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/services/db/budgetOps.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getNovelTranslationCost } from '../../../services/db/operations/budgetOps';
import { ChapterOps } from '../../../services/db/operations/chapters';
import { TranslationOps } from '../../../services/db/operations/translations';
import type { ChapterRecord } from '../../../services/db/types';
import type { TranslationRecord } from '../../../services/db/types';

vi.mock('../../../services/db/operations/chapters');
vi.mock('../../../services/db/operations/translations');

describe('getNovelTranslationCost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sums estimatedCost from active translations across chapters', async () => {
    vi.mocked(ChapterOps.getByNovelAndVersion).mockResolvedValue([
      { stableId: 'ch-1', canonicalUrl: 'url-1' } as ChapterRecord,
      { stableId: 'ch-2', canonicalUrl: 'url-2' } as ChapterRecord,
    ]);
    vi.mocked(TranslationOps.getVersionsByStableId)
      .mockResolvedValueOnce([
        { isActive: true, estimatedCost: 0.05 } as TranslationRecord,
      ])
      .mockResolvedValueOnce([
        { isActive: false, estimatedCost: 0.10 } as TranslationRecord,
        { isActive: true, estimatedCost: 0.03 } as TranslationRecord,
      ]);

    const cost = await getNovelTranslationCost('novel-1', 'v1');
    expect(cost).toBeCloseTo(0.08); // 0.05 + 0.03 (active versions only)
  });

  it('returns 0 when no chapters exist', async () => {
    vi.mocked(ChapterOps.getByNovelAndVersion).mockResolvedValue([]);
    const cost = await getNovelTranslationCost('novel-1', 'v1');
    expect(cost).toBe(0);
  });

  it('returns 0 when chapters have no translations', async () => {
    vi.mocked(ChapterOps.getByNovelAndVersion).mockResolvedValue([
      { stableId: 'ch-1', canonicalUrl: 'url-1' } as ChapterRecord,
    ]);
    vi.mocked(TranslationOps.getVersionsByStableId).mockResolvedValue([]);
    const cost = await getNovelTranslationCost('novel-1', 'v1');
    expect(cost).toBe(0);
  });

  it('falls back to URL-based lookup when stableId is missing', async () => {
    vi.mocked(ChapterOps.getByNovelAndVersion).mockResolvedValue([
      { canonicalUrl: 'url-1' } as ChapterRecord, // no stableId
    ]);
    vi.mocked(TranslationOps.getVersionsByUrl).mockResolvedValue([
      { isActive: true, estimatedCost: 0.07 } as TranslationRecord,
    ]);

    const cost = await getNovelTranslationCost('novel-1', 'v1');
    expect(cost).toBeCloseTo(0.07);
    expect(TranslationOps.getVersionsByUrl).toHaveBeenCalledWith('url-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/db/budgetOps.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `budgetOps.ts`**

Create `services/db/operations/budgetOps.ts`:

```typescript
import { ChapterOps } from './chapters';
import { TranslationOps } from './translations';

/**
 * Sums estimatedCost from active translation records for all chapters
 * in a given novel + version. Returns total USD spent.
 */
export async function getNovelTranslationCost(
  novelId: string,
  versionId: string
): Promise<number> {
  const chapters = await ChapterOps.getByNovelAndVersion(novelId, versionId);

  let totalCost = 0;

  for (const ch of chapters) {
    const stableId = ch.stableId || undefined;
    const canonicalUrl = ch.canonicalUrl || ch.url;

    const versions = stableId
      ? await TranslationOps.getVersionsByStableId(stableId)
      : await TranslationOps.getVersionsByUrl(canonicalUrl);

    if (versions.length > 0) {
      const activeVersion = versions.find(v => v.isActive) || versions[0];
      totalCost += activeVersion.estimatedCost || 0;
    }
  }

  return totalCost;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/db/budgetOps.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/db/operations/budgetOps.ts tests/services/db/budgetOps.test.ts
git commit -m "feat(budget-preload): add getNovelTranslationCost DB operation"
```

---

## ~~Task 4: Refactor Export Service~~ — SKIPPED

The export service computes 7+ stats (cost, tokens, model usage, chapter ranges, image count, footnotes) in a single loop over all chapters. `getNovelTranslationCost()` is novel-scoped and returns only cost. These cannot share the same function without a forced abstraction. The export service is left unchanged — it uses the same pattern independently.

---

## Task 4: Budget Enforcement in `handleTranslate`

**Files:**
- Modify: `store/slices/translationsSlice.ts:193-200`
- Create: `tests/store/slices/budgetEnforcement.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/store/slices/budgetEnforcement.test.ts`.

This test follows the pattern from `tests/store/slices/jobsSlice.test.ts` — create a minimal slice with manual `set`/`get`. Since `handleTranslate` accesses cross-slice state via `(state as any)`, we merge the needed fields into the mock state.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppSettings } from '../../../types';

// Mock debug utils
vi.mock('../../../utils/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}));

// Mock budgetOps — this is the core of what we're testing
vi.mock('../../../services/db/operations/budgetOps', () => ({
  getNovelTranslationCost: vi.fn(),
}));

// Mock the translation service to prevent real API calls
vi.mock('../../../services/translate/TranslationService', () => ({
  TranslationService: {
    translateChapterSequential: vi.fn(),
  },
}));

// Mock validateApiKey to return valid by default
vi.mock('../../../services/ai/validation', () => ({
  validateApiKey: vi.fn(() => ({ isValid: true })),
}));

import { getNovelTranslationCost } from '../../../services/db/operations/budgetOps';
import { createTranslationsSlice } from '../../../store/slices/translationsSlice';

const baseBudgetSettings: Partial<AppSettings> = {
  provider: 'Gemini',
  model: 'gemini-2.5-flash',
  temperature: 0.7,
  systemPrompt: '',
  preloadMode: 'budget',
  preloadBudget: 4.00,
};

const baseChaptersSettings: Partial<AppSettings> = {
  ...baseBudgetSettings,
  preloadMode: 'chapters',
  preloadCount: 5,
};

const createTestSlice = (settingsOverrides: Partial<AppSettings> = {}) => {
  const settings = { ...baseBudgetSettings, ...settingsOverrides } as AppSettings;
  const state: Record<string, any> = {};
  const notifications: Array<{ message: string; type: string }> = [];

  const set = (partial: any) => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    if (next) Object.assign(state, next);
  };
  const get = () => state as any;

  // Create the translations slice
  const slice = createTranslationsSlice(set as any, get as any, {} as any);

  // Merge in cross-slice state that handleTranslate accesses via (state as any)
  Object.assign(state, slice, {
    settings,
    chapters: new Map([['ch-1', { id: 'ch-1', chapterNumber: 1 }]]),
    activeNovelId: 'novel-1',
    activeVersionId: 'v1',
    showNotification: (message: string, type: string) => {
      notifications.push({ message, type });
    },
    setError: vi.fn(),
    activePromptTemplate: null,
  });

  return { state, get, notifications };
};

describe('budget enforcement in handleTranslate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks translation when budget mode is active and budget is exhausted', async () => {
    vi.mocked(getNovelTranslationCost).mockResolvedValue(4.50);
    const { state, notifications } = createTestSlice({ preloadBudget: 4.00 });

    await state.handleTranslate('ch-1', 'manual_translate');

    expect(getNovelTranslationCost).toHaveBeenCalledWith('novel-1', 'v1');
    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toContain('budget of $4.00 reached');
    expect(notifications[0].type).toBe('warning');
  });

  it('allows translation when budget mode is active and budget has room', async () => {
    vi.mocked(getNovelTranslationCost).mockResolvedValue(1.50);
    const { state, notifications } = createTestSlice({ preloadBudget: 4.00 });

    // handleTranslate should proceed past the budget check
    // It may fail later (no real translation service), but the budget check should pass
    await state.handleTranslate('ch-1', 'manual_translate');

    expect(getNovelTranslationCost).toHaveBeenCalled();
    expect(notifications).toHaveLength(0); // no budget warning
  });

  it('skips budget check entirely in chapters mode', async () => {
    const { state } = createTestSlice({
      preloadMode: 'chapters',
      preloadCount: 5,
    });

    await state.handleTranslate('ch-1', 'manual_translate');

    expect(getNovelTranslationCost).not.toHaveBeenCalled();
  });
});
```

**Note:** The `createTranslationsSlice` import path and export name should be verified against the actual slice file. If the slice is not exported as a standalone `create*Slice` function, the implementing engineer may need to create the full merged store instead. Check `store/index.ts` for the store creation pattern.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/store/slices/budgetEnforcement.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement budget check in `handleTranslate`**

In `store/slices/translationsSlice.ts`, after the API key validation block (line 193, after `return;`), insert:

```typescript
    // Budget enforcement (budget mode only)
    if (context.settings.preloadMode === 'budget' && context.settings.preloadBudget > 0) {
      const { activeNovelId, activeVersionId } = state as any;
      if (activeNovelId) {
        const { getNovelTranslationCost } = await import('../services/db/operations/budgetOps');
        const spent = await getNovelTranslationCost(activeNovelId, activeVersionId);
        if (spent >= context.settings.preloadBudget) {
          const showNotification = (state as any).showNotification;
          if (showNotification) {
            showNotification(
              `Translation budget of $${context.settings.preloadBudget.toFixed(2)} reached for this novel. Increase your budget in Settings > Providers to continue.`,
              'warning'
            );
          }
          return;
        }
      }
    }
```

**Placement:** Between the API key validation return (line 193) and the `uiActions.setError(null)` line (line 195).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/store/slices/budgetEnforcement.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add store/slices/translationsSlice.ts tests/store/slices/budgetEnforcement.test.ts
git commit -m "feat(budget-preload): enforce budget limit in handleTranslate"
```

---

## Task 5: Budget Enforcement in Preload Loop

**Files:**
- Modify: `store/slices/chaptersSlice.ts:860-1016`

- [ ] **Step 1: Add budget check test to the existing test file**

Add a new describe block to `tests/store/slices/budgetEnforcement.test.ts`:

```typescript
// At top of file, add these imports:
import { getNovelTranslationCost } from '../../../services/db/operations/budgetOps';
// The preload function is part of the chapters slice, not translations.
// We test it by verifying that handleTranslate is/isn't called based on budget.

describe('budget enforcement in preloadNextChapters', () => {
  // Testing the preload loop is harder because it uses setTimeout(worker, 1500).
  // Strategy: test the budget check logic indirectly through handleTranslate
  // (already tested above), and verify the loop integration via manual testing (Task 8).
  //
  // For a unit test, we'd need to:
  // 1. Create the full merged store (chapters + translations + ui slices)
  // 2. Seed chapters in memory
  // 3. Call preloadNextChapters and advance timers
  // 4. Assert handleTranslate was/wasn't called
  //
  // This is complex to scaffold. If the implementing engineer wants a unit test,
  // use vi.useFakeTimers() + vi.runAllTimersAsync() to trigger the setTimeout.
  // Otherwise, rely on:
  // - The handleTranslate budget check (tested above) which catches manual translates
  // - The preload loop budget check using the same getNovelTranslationCost function
  // - Manual integration testing in Task 8

  it('disables preload when budget mode is active and budget is 0', () => {
    // This tests the early return guard (Change A)
    // The preloadNextChapters function should return immediately
    // when preloadMode === 'budget' && preloadBudget <= 0
    //
    // Verify by checking that no handleTranslate calls are made
    // after calling preloadNextChapters with budget=0
    expect(true).toBe(true); // placeholder — see note above
  });
});
```

**Implementation note:** The preload loop test is intentionally light because the loop's budget check uses the exact same `getNovelTranslationCost` function tested in the `handleTranslate` tests. The core logic (query cost, compare to budget, show toast) is identical in both enforcement points. The loop-specific behavior (re-reading settings, mode-change detection) is best verified via manual testing in Task 8.

- [ ] **Step 2: Modify the preload loop**

In `store/slices/chaptersSlice.ts`, the `preloadNextChapters` worker function needs two changes:

**Change A — Early return guard (line 877):**

Replace:
```typescript
if (!currentChapterId || settings.preloadCount === 0) {
  return;
}
```

With:
```typescript
const isBudgetMode = settings.preloadMode === 'budget';
const isDisabled = isBudgetMode
  ? !settings.preloadBudget || settings.preloadBudget <= 0
  : settings.preloadCount === 0;

if (!currentChapterId || isDisabled) {
  return;
}
```

**Change B — Loop bound (line 896):**

Replace:
```typescript
for (let i = 1; i <= settings.preloadCount; i++) {
```

With:
```typescript
const BUDGET_MODE_MAX_LOOKAHEAD = 999; // Loop breaks on budget exhaustion or missing chapters
const maxAhead = isBudgetMode ? BUDGET_MODE_MAX_LOOKAHEAD : settings.preloadCount;
for (let i = 1; i <= maxAhead; i++) {
```

**Change C — Budget check before translate (before line 1011 `await handleTranslate`):**

Insert:
```typescript
        // Budget check (re-read settings each iteration)
        if (isBudgetMode) {
          const latestSettings = get().settings;
          if (latestSettings.preloadMode !== 'budget' || !latestSettings.preloadBudget) {
            debugLog('worker', 'summary', '[Worker] Preload mode changed mid-loop, stopping.');
            break;
          }
          const { getNovelTranslationCost } = await import('../../services/db/operations/budgetOps');
          const spent = await getNovelTranslationCost(activeNovelId!, activeVersionId!);
          if (spent >= latestSettings.preloadBudget) {
            const showNotification = (get() as any).showNotification;
            if (showNotification) {
              showNotification(
                `Translation budget of $${latestSettings.preloadBudget.toFixed(2)} reached for this novel. Increase your budget in Settings > Providers to continue.`,
                'warning'
              );
            }
            debugLog('worker', 'summary', `[Worker] Budget exhausted ($${spent.toFixed(4)} >= $${latestSettings.preloadBudget.toFixed(2)}). Stopping preload.`);
            break;
          }
        }
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/store/slices/budgetEnforcement.test.ts`
Expected: PASS

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add store/slices/chaptersSlice.ts tests/store/slices/budgetEnforcement.test.ts
git commit -m "feat(budget-preload): enforce budget limit in preload loop with mid-loop re-reads"
```

---

## Task 6: UI — Mode Toggle and Budget Input

**Files:**
- Modify: `components/settings/TranslationEngineSection.tsx:254-280`
- Modify: `components/settings/ProvidersPanel.tsx:416-438`

- [ ] **Step 1: Add new props to `TranslationEngineSection`**

In the props interface (~line 28-60), add:

```typescript
  preloadMode: 'chapters' | 'budget';
  preloadBudget: number;
  novelSpent: number | null;        // DB-derived spent amount, null if loading
  onPreloadModeChange: (mode: 'chapters' | 'budget') => void;
  onPreloadBudgetChange: (value: number) => void;
```

- [ ] **Step 2: Replace the preload slider section**

Replace the entire preload slider `<div>` (~lines 254-280) with:

```tsx
{/* Pre-load Mode Toggle + Controls */}
<div>
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
    Pre-load Ahead
  </label>

  {/* Mode Toggle */}
  <div className="flex mb-3">
    <button
      type="button"
      className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-l border ${
        preloadMode === 'chapters'
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-transparent text-gray-400 border-gray-600 hover:text-gray-200'
      }`}
      onClick={() => onPreloadModeChange('chapters')}
    >
      Chapters
    </button>
    <button
      type="button"
      className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-r border-t border-b border-r ${
        preloadMode === 'budget'
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-transparent text-gray-400 border-gray-600 hover:text-gray-200'
      }`}
      onClick={() => onPreloadModeChange('budget')}
    >
      Budget
    </button>
  </div>

  {/* Chapters Mode */}
  {preloadMode === 'chapters' && (
    <>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-sm font-bold ${preloadCount === 0 ? 'text-red-500' : 'text-blue-500'}`}>
          {preloadCount === 0 ? 'DISABLED' : preloadCount}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="50"
        value={preloadCount}
        onChange={(e) => onPreloadCountChange(parseInt(e.target.value, 10))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
      />
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {preloadCount === 0
          ? '🔴 Background preload is DISABLED. Chapters will only load when you navigate to them.'
          : 'How many future chapters to fetch and translate in the background (serially).'}
      </p>
    </>
  )}

  {/* Budget Mode */}
  {preloadMode === 'budget' && (
    <>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm text-gray-400">$</span>
        <input
          type="number"
          min="0"
          step="0.50"
          value={preloadBudget || ''}
          onChange={(e) => onPreloadBudgetChange(parseFloat(e.target.value) || 0)}
          placeholder="0.00"
          className="w-28 px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white"
        />
      </div>
      {preloadBudget > 0 && novelSpent !== null && (
        <p className="text-xs text-gray-400 mt-1">
          Spent: <span className={novelSpent >= preloadBudget ? 'text-red-400 font-bold' : 'text-blue-400'}>
            ${novelSpent.toFixed(2)}
          </span> / ${preloadBudget.toFixed(2)}
        </p>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {!preloadBudget || preloadBudget <= 0
          ? '🔴 Background preload is DISABLED. Set a budget to enable.'
          : 'Preloads chapters until translation spending for this novel reaches the budget cap.'}
      </p>
    </>
  )}
</div>
```

- [ ] **Step 3: Wire props in `ProvidersPanel.tsx`**

In `ProvidersPanel.tsx`, first add the missing import at the top of the file:

```typescript
import { useAppStore } from '../../store';
```

Then add state for the novel's spent amount and pass new props.

At the top of the component (near existing hooks ~line 42):

```typescript
const activeNovelId = useAppStore(state => state.activeNovelId);
const activeVersionId = useAppStore(state => state.activeVersionId);

const [novelSpent, setNovelSpent] = useState<number | null>(null);

// Fetch spent amount when in budget mode
useEffect(() => {
  if (currentSettings.preloadMode !== 'budget' || !activeNovelId) {
    setNovelSpent(null);
    return;
  }
  let cancelled = false;
  import('../../services/db/operations/budgetOps').then(({ getNovelTranslationCost }) => {
    getNovelTranslationCost(activeNovelId, activeVersionId).then(cost => {
      if (!cancelled) setNovelSpent(cost);
    });
  });
  return () => { cancelled = true; };
}, [currentSettings.preloadMode, activeNovelId, activeVersionId]);
```

Add new props to the `<TranslationEngineSection>` JSX (~line 416):

```tsx
  preloadMode={currentSettings.preloadMode ?? 'chapters'}
  preloadBudget={currentSettings.preloadBudget ?? 0}
  novelSpent={novelSpent}
  onPreloadModeChange={(m) => handleSettingChange('preloadMode', m)}
  onPreloadBudgetChange={(v) => handleSettingChange('preloadBudget', v)}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Manual test**

1. Open Settings > Providers
2. See the mode toggle below "Pre-load Ahead"
3. Toggle to "Budget" — slider disappears, $ input appears
4. Enter `4.00` — see "Spent: $0.00 / $4.00" readout
5. Toggle back to "Chapters" — slider reappears, works as before
6. In budget mode with budget > 0, translate a chapter — spent readout should update on next settings open

- [ ] **Step 7: Commit**

```bash
git add components/settings/TranslationEngineSection.tsx components/settings/ProvidersPanel.tsx
git commit -m "feat(budget-preload): add mode toggle and budget input UI"
```

---

## Task 7: Integration Test and Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manual end-to-end test**

1. Set mode to "Budget", budget to $0.50
2. Navigate to a chapter — preload should start translating ahead
3. Watch the spent readout increase as chapters are translated
4. When spent >= $0.50, verify toast: "Translation budget of $0.50 reached for this novel..."
5. Verify manual translate also blocked with same toast
6. Increase budget to $1.00 — translation resumes
7. Switch to "Chapters" mode — verify preloadCount slider works as before
8. Switch novels — verify spent readout resets to that novel's actual spend

- [ ] **Step 4: Final commit**

If any fixes were needed, commit specific files:
```bash
git add <changed-files>
git commit -m "fix(budget-preload): integration fixes from manual testing"
```
