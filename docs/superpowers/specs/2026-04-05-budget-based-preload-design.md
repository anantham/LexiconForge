# Budget-Based Preload Limit

**Date:** 2026-04-05
**Status:** Approved

## Problem

The preload-ahead feature currently limits by chapter count (0–50). Users want an alternative: set a USD budget cap so preloading continues until the budget is exhausted, regardless of how many chapters that covers.

## Requirements

1. **Toggle between modes:** Users choose "Chapters" (existing behavior) or "Budget" (new) via a segmented control in Settings > Providers.
2. **Cumulative budget:** Budget tracks total translation spend for the active novel, derived from DB records. Survives refreshes. Budget is per-novel (scoped to active novel).
3. **All translations count:** Both preload and manual translations draw from the same budget.
4. **Notify and stop:** When budget is exhausted, show a toast and stop translating. No silent failures.
5. **Zero = disabled:** Setting budget to $0.00 disables preloading when in budget mode. In chapters mode, `preloadBudget` is ignored entirely.

## Design

### Settings Model

Two new fields in `AppSettings` (`types.ts`):

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `preloadMode` | `'chapters' \| 'budget'` | `'chapters'` | Which limit mode is active |
| `preloadBudget` | `number` | `0` | USD cap for budget mode |

Existing `preloadCount` is unchanged and active only in chapters mode.

Default values added to `SessionManagementService.ts`.

### Budget Query (DB-Derived)

New function in a dedicated operations module:

**File:** `services/db/operations/budgetOps.ts`

```typescript
async function getNovelTranslationCost(novelId: string, versionId: string): Promise<number>
```

This lives in a new operations file (not `TranslationRepository`) because it needs to cross repository boundaries — querying chapters first, then their translations.

**Implementation:**
1. Query chapters by novelId + versionId via a new `ChapterOps.getByNovelAndVersion(novelId, versionId)` method
2. For each chapter, get the active translation version via `TranslationOps.getVersionsByStableId()`
3. Sum `estimatedCost` across all active translations
4. Return total in USD

This pattern already exists in `exportService.ts:770-824`. Extract it into `budgetOps.ts` so both export and budget enforcement can use it. Update `exportService.ts` to call the shared function.

**New chapter query needed:** `ChapterOps.getByNovelAndVersion(novelId, versionId)` — queries chapters filtered by novel, avoiding the N+1 problem of `getAll()` + JS filter. The chapters store already has a `novelId` index.

**Performance:** For a 500-chapter novel, this performs 1 indexed query for chapters + N `getVersionsByStableId` lookups. Measure on first implementation — if >200ms, add caching with invalidation on new translations.

### Budget Enforcement

Two enforcement points, both gated on `preloadMode === 'budget'`:

**A) Preload loop** (`chaptersSlice.ts:preloadNextChapters`):
- Before each `handleTranslate()` call, re-read settings from `get()` and query cumulative cost
- If `spent >= preloadBudget`, break the loop and fire toast
- Re-reading settings each iteration ensures mid-loop budget changes take effect

**B) Manual translate** (`translationsSlice.ts:handleTranslate`):
- At function entry, query cumulative cost
- If `spent >= preloadBudget`, show toast and return early

**Toast message:** "Translation budget of $X.XX reached for this novel. Increase your budget in Settings > Providers to continue."

In chapters mode, no budget check runs — existing `preloadCount` logic is unchanged.

**Race condition (accepted):** Since translations are serial in the preload loop and `handleTranslate` is async, at most one translation can overshoot the budget before the next check catches it. This is acceptable — the overshoot is bounded to a single chapter's cost.

### Preload Loop in Budget Mode

When `preloadMode === 'budget'`:
- The loop upper bound becomes effectively unlimited (no chapter count cap) — it continues preloading sequential chapters until:
  - Budget is exhausted
  - No more chapters are available (locally or via web fetch)
  - Any existing break condition fires (invalid URL, missing API key, etc.)
- Each iteration re-reads settings from `get()` so mode/budget changes mid-loop take effect

When `preloadMode === 'chapters'`:
- Existing behavior unchanged. Budget settings are ignored entirely.

### UI Changes

In `TranslationEngineSection.tsx`, the preload slider area becomes a toggled section:

**Toggle:** Segmented control — `Chapters | Budget`

**Chapters mode (selected):**
- Existing slider (0–50), unchanged behavior

**Budget mode (selected):**
- Text input with `$` prefix, accepts decimal (e.g., `4.00`)
- Live readout below: "Spent: $1.23 / $4.00" (DB-derived, queried on mount and after translations)
- When budget = 0 or empty: red DISABLED indicator, same style as preloadCount=0

**Accessing novel context:** The spent readout needs `activeNovelId` and `activeVersionId` from the Zustand store. `ProvidersPanel` will read these from the store via `useAppStore` and pass them as props to `TranslationEngineSection`.

**Shared:** The mode toggle itself doesn't trigger preload — only value changes do.

### Known Limitations

- **Zero-cost models:** If a model has no pricing data (obscure OpenRouter model), `estimatedCost` will be 0 and the budget will never be "exhausted." This is a pre-existing limitation of the cost tracking system.
- **Per-novel scoping:** Budget cap is a global setting but spending is tracked per-novel. Switching novels resets the "spent" counter to that novel's actual spend. This is by design — a novel you haven't translated yet starts at $0.
- **No reset mechanism in v1:** To "reset" spending, the user increases the budget number. A "reset spent" button is out of scope for v1.

## Files to Modify

| File | Change |
|------|--------|
| `types.ts` | Add `preloadMode`, `preloadBudget` to `AppSettings` |
| `services/sessionManagementService.ts` | Add defaults for new fields |
| `services/db/operations/budgetOps.ts` | **New file** — `getNovelTranslationCost()` |
| `services/db/operations/chapters.ts` | Add `getByNovelAndVersion()` query |
| `services/exportService.ts` | Refactor to use shared `getNovelTranslationCost()` |
| `store/slices/chaptersSlice.ts` | Budget check in `preloadNextChapters()`, re-read settings per iteration |
| `store/slices/translationsSlice.ts` | Budget check in `handleTranslate()` |
| `components/settings/TranslationEngineSection.tsx` | Mode toggle + budget input + spent readout |
| `components/settings/ProvidersPanel.tsx` | Wire new props (including `activeNovelId`, `activeVersionId`) |

## Approach: DB-Derived (No Persistent Counter)

**Why:** Translation records already store `estimatedCost`. Deriving the total from actual DB records means no drift, no reset surprises, no second source of truth.

**Rejected alternatives:**
- In-memory accumulator: loses state on refresh
- Persistent counter in settings: can drift from actual DB records
