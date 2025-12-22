# Decomposition Plan: `services/navigationService.ts`

**Status:** Draft
**Target:** Decompose the 994-line `navigationService.ts` into a cohesive navigation module.

## 1. Problem Analysis
`NavigationService` combines:
- **Routing**: URL resolution and history management.
- **Data Access**: Complex hydration from IndexedDB (Chapter + Translation + Diffs).
- **Fetching**: Network fetching via adapters and Import/Export normalization.
- **Validation**: URL checking and error messaging.

## 2. Target Architecture

We will create a `services/navigation/` directory:

```
services/navigation/
├── index.ts                  # Main NavigationService class (Facade)
├── types.ts                  # Interfaces (NavigationContext, NavigationResult)
├── validation.ts             # URL validation & supported site checks
├── converters.ts             # DTO mapping (adaptTranslationRecordToResult)
├── hydration.ts              # IDB loading logic (loadChapterFromIDB)
├── fetcher.ts                # Network fetching (handleFetch)
└── history.ts                # Browser history management
```

## 3. Module Responsibilities

### `converters.ts`
- `adaptTranslationRecordToResult`: Maps DB records to runtime objects.

### `hydration.ts`
- `loadChapterFromIDB`: The heavy lifter. Needs to import `ChapterOps`, `TranslationOps`, `DiffOps`.
- `tryServeChapterFromCache`: Short-circuit logic.

### `fetcher.ts`
- `handleFetch`: Orchestrates `fetchAndParseUrl`, `transformImportedChapters`, and `ImportOps`.

### `index.ts` (NavigationService)
- `handleNavigate`: The main entry point. Orchestrates the flow: Validation -> Cache Check -> Hydration -> (Fallback) -> Fetcher.

## 4. Execution Plan

1.  **Scaffold**: Create directory and `types.ts`.
2.  **Extract Utilities**: Move `converters.ts` and `validation.ts`.
3.  **Extract Core Logic**: Move `hydration.ts` (biggest chunk) and `fetcher.ts`.
4.  **Refactor Main Service**: `NavigationService` becomes a cleaner orchestrator importing these functions.

## 5. Verification
- **Critical Path**: Navigation is the core user loop.
- **Tests**: `tests/current-system/navigation.test.ts` must pass.
- **Manual**: Navigate to a new chapter, reload (hydration), navigate to a known chapter (cache).
