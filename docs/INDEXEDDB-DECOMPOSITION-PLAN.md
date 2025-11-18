# IndexedDB Decomposition Plan
_Updated: 2025-11-10_

## 1. Goals
- Reduce `services/indexeddb.ts` from 3,938 LOC to <500 LOC (facade only) → (*Completed 2025‑11‑16 by deleting the facade; persistence now lives under `services/db/operations/*` + repositories.*)
- Extract domain-specific repositories with isolated tests.
- Preserve feature parity and dual-write safety (legacy + modern backends).


## 2. Current Landscape

| Concern | Methods (line numbers) | Notes |
|---------|------------------------|-------|
| Chapter CRUD | `storeChapter` (1105), `deleteChapter` (1210), `getChapter` (1210), `getAllChapterUrls` (1845), `findChapterByUrl` (3190) | Handles normalization, stable IDs, URL mapping. |
| Translation CRUD + versioning | `storeTranslation` (1301), `storeTranslationAtomic` (1427), `getTranslation` (1634), `getTranslationVersions` (1596), `deleteTranslationVersion` (1796), `setActiveTranslation` (1689) | Responsible for versioning, usage metrics, image cache references. |
| Settings/Templates | `saveSettings` (2801), `loadSettings` (2839), `savePromptTemplate` (2901), `getPromptTemplates` (2968) | Mostly simple transactions but buried among other logic. |
| Feedback | `storeFeedback` (1980), `getFeedback` (2057) | Uses translation IDs, chapter IDs; type mismatches currently flagged by `tsc`. |
| Export/Import | `exportSession` (2236), `importSession` (2296), plus CSV/EPUB helpers | Mixed responsibilities with telemetry and throttle logging. |
| Image cache helpers | `saveImageAsset`, `getImageAssets`, etc. near lines 2400+ | Manage `diffResults`, cached blobs, telemetry. |
| Telemetry hooks | scattered (e.g., `telemetryService.captureError` around migrations) | Should be limited to repository boundaries. |


## 3. Target Structure
```
services/db/
  repositories/
    ChapterRepository.ts
    TranslationRepository.ts
    SettingsRepository.ts
    FeedbackRepository.ts
    TemplateRepository.ts
    ImageRepository.ts
  interfaces/
    IChapterRepository.ts
    ...
  impl/
    (optional) MemoryRepository for tests
services/db/index.ts → single entry point (legacy facade removed)
tests/services/db/
  chapterRepository.test.ts
  translationRepository.test.ts
```


## 4. Extraction Phases

### Phase 0 – Safety Net (done)
- `IIndexedDBService` + `MockIndexedDBService` + contract tests (8 vitest cases).

### Phase 1 – Documentation & Interfaces (today)
1. Record method boundaries (done above).
2. Define repository interfaces (one per domain) mirroring existing method signatures.
3. Decide shared utilities (stable ID helpers, telemetry logging).

### Phase 2 – Chapter Repository *(completed; now standard practice)*
1. Create `services/db/repositories/ChapterRepository.ts`.
2. Move logic from lines 1105-1300 (`storeChapter`, `getChapter`, `deleteChapter`, `getAllChapterUrls`, `findChapterByUrl`).
3. Provide constructor `(getDb: () => Promise<IDBDatabase>)`.
4. *(Legacy step; superseded by facade removal.)*
5. Add unit tests (fake `IDBDatabase` via `fake-indexeddb`) for insert/update/delete.

### Phase 3 – Translation Repository
_Status (2025-11-15): ✅ repository + unit tests merged. `services/indexeddb.ts` now delegates store/get/delete/activation via `TranslationRepository`, `services/db/operations/translations.ts` call the shared facade, and `TranslationPersistenceService` uses `TranslationOps` directly (legacy `adapters/repo/TranslationsRepo.ts` removed). `tests/services/db/TranslationRepository.test.ts` covers stableId lookups, ensureActive, getById/all. Legacy `storeTranslationAtomic` removed._

1. Extract lines 1301-1800 (store, versioning, active toggle, delete).
2. Ensure usage metrics + suggested illustrations copying stays intact.
3. Provide APIs:
   - `store(chapterUrl, translation, settings, options)` returning record.
   - `getLatest`, `getByVersion`, `listVersions`, `deleteVersion`, `setActive`.
4. Update dependent services (TranslationPersistenceService, TranslationOps) to prefer new repo.

### Phase 4 – Settings, Templates, Feedback
1. Extract `SettingsRepository` (save/load).
2. Extract `TemplateRepository` (CRUD for prompt templates).
3. Extract `FeedbackRepository` (store & fetch), unify feedback type mismatch flagged by `tsc`.

### Phase 5 – Image Assets + Export
1. Move image cache helpers & export/import code into dedicated modules.
2. Keep only orchestration & wiring in `indexeddb.ts`.

### Phase 6 – Delete Legacy Code paths *(completed 2025-11-16)*
1. Removed legacy logic and deleted `services/indexeddb.ts`.
2. Updated `adapters/repo/*` consumers and tests to rely on the ops layer.
3. Wired repository factory into `services/db/index.ts` to supply DI-ready repos.


## 5. Verification Strategy

| Stage | Tests | Checks |
|-------|-------|--------|
| After each repo extraction | `vitest` suite + interface tests | `npm run check:loc`, `npx tsc --noEmit` |
| Dual-write period | Run existing e2e/regression tests + compare output from legacy vs new repo via shadow backend. |
| Final migration | Switch `DB_BACKEND=modern`, run regression tests, monitor telemetry. |


## 6. Risks & Mitigations
- **Risk:** Breaking existing call sites expecting side-effects from big service.  
  **Mitigation:** Keep facade methods (`indexedDBService.storeChapter`) delegating to repositories until all consumers updated.

- **Risk:** Dual-write divergence.  
  **Mitigation:** Use the backend toggle (`DB_BACKEND` / `lf:db-backend`) to flip between the legacy and modern repos for comparison, and lean on export/import diffs or new integration tests instead of runtime dual writes.

- **Risk:** Missing telemetry/logging.  
  **Mitigation:** Centralize logging inside repositories and expose hooks; ensure `telemetryService` only instantiated in top-level service.


## 7. Checklist Per Repository
1. Extract methods + tests.
2. Update facade to delegate.
3. Replace direct `indexedDBService` imports where possible (e.g., `ChapterOps` should consume new repo).
4. Run `npm run check:loc`, `npx tsc --noEmit`, `npm test`.
5. Update `docs/WORKLOG.md` + architecture docs.

Use this document as the canonical plan; append new sections as repositories land or requirements change.***
