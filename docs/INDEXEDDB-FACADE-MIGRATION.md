# IndexedDB Facade → Repository Migration Tracker

This tracker keeps a live view of every non-legacy call to `indexedDBService` so we can retire the monolithic facade. It groups call sites by subsystem, notes the preferred replacement, and outlines the migration batches.

_Last updated: 2025-11-13 (afternoon sync)_

## 1. Call Site Inventory (non-docs, non-archive, non-legacy)

### Store layer (0)

### Components / UI helpers (0)

### Service layer (0)
- (none remaining – runtime services now depend solely on the ops/repository layer.)

_Recently migrated:_ `services/db/index.ts` (session export bridge), `services/db/core/stable-ids.ts`, `services/imageMigrationService.ts`, `services/openrouterService.ts`, `services/providerCreditCacheService.ts`, `services/db/migrationService.ts`, `services/db/maintenanceService.ts`, `services/db/operations/{chapters,translations,imports,maintenance,mappings,sessionExport}`, and `scripts/backfillChapterNumbers.ts` now route through the ops/repository layer.

- 2025-11-13: Removed the unused migration controller/shadow-validator stack. `services/db/index.ts` now honors a single backend preference (env `DB_BACKEND` or localStorage `lf:db-backend`) to flip between the modern repo, the legacy facade, and the memory fallback.
- 2025-11-15: TranslationPersistenceService now uses `TranslationOps` directly; `adapters/repo/TranslationsRepo.ts` was deleted.
- 2025-11-15 (evening): `makeLegacyRepo`/`legacy/indexeddb-compat.ts` deleted; the backend toggle now only supports `'modern'` and `'memory'` (attempts to pick `'legacy'` log a warning and default to modern).
- 2025-11-16: `services/indexeddb.ts` now delegates stable-ID lookups, URL mapping queries, novel listings, and diff-result reads to `MappingsOps`/`DiffOps`. Later that night the schema opening/verification path moved into `SchemaOps`, so the facade just calls `openDatabaseWithMigrations()` and memoizes chapter-summary initialization. Prompt template CRUD now routes through `TemplatesOps` as well.
- 2025-11-16 (late): Chapter-summary recompute/delete calls were routed through `SchemaOps`, deleting the local `getSummaryDeps()` helper so the facade is no longer aware of summary wiring details.
- 2025-11-16 (late): React-rendering hydration now uses `fetchChaptersForReactRendering()` from RenderingOps; the facade no longer assembles its own dependency graph for that helper.
- 2025-11-16 (late): Chapter summary listing/diagnostics now flow through `fetchChapterSummaries()` and `getChapterSummaryDiagnostics()`; the facade no longer opens raw transactions for the summaries or comparison helpers.
- 2025-11-16 (late): Chapter lookup helpers (`findChapterByUrl`, `findChapterByNumber`, and `getMostRecentChapterStableId`) now call `ChapterOps`, eliminating the last raw chapter-store transactions inside the facade.
- 2025-11-16 (late): URL mapping upserts during `storeChapter` now delegate to `ChapterOps.ensureUrlMappings`, removing the facade’s bespoke mapping builder.
- 2025-11-16 (late): The schema test/diagnostic helper (`testStableIdSchema`) now proxies to `SchemaOps.testStableIdSchema()`, so schema/index inspection lives alongside the rest of the schema logic.
- 2025-11-16 (late): The dev-only window hooks (`cleanupDuplicateVersions`, `cleanupAndRefresh`, `resetIndexedDB`, `testStableIdSchema`) now live in `services/db/debugHooks.ts`, keeping the facade unaware of global debug plumbing.
- 2025-11-16 (late): The enhanced-chapter path now calls `ChapterOps.storeEnhanced`, and the unused local `normalizeUrlAggressively` helper was removed.
- 2025-11-16 (late): Translation deletions (`deleteTranslation`) now call a repository helper (`deleteTranslationVersionByChapter`), so the facade no longer scans versions manually.
- 2025-11-16 (late): The chapter-summary diagnostics logging now lives in `SummariesOps.logSummaryDiagnostics`, removing the final bespoke logging block from the facade.
- 2025-11-16 (late): `services/indexeddb.ts` was deleted entirely; shared types moved to `services/db/types.ts`, and the remaining tests now exercise the ops layer directly.

### Repository adapters (0)
- (none – legacy wrappers have been removed; only the shared `Repo` interface remains for archival tests.)

### DB operations still referencing the facade (0)
- (none – all ops now use the repository/txn layer.)

### Tests (11)
- Current-system suites (`tests/current-system/*.ts`)
- Store/bootstrap tests
- Adapter repo tests
- Smoke + e2e harnesses
- `tests/utils/db-harness.ts`

Tests will need patching once the production code stops exporting legacy helpers.

## 2. Target Replacements

| Area | Current Usage | Preferred Replacement |
|------|---------------|-----------------------|
| Store bootstrap (`initializeStore`, `importSessionData`) | Direct `indexedDBService` calls for backfills, navigation history, import/export | `services/db/operations/*` (`SummariesOps`, `MappingsOps`, `AmendmentOps`, `TranslationOps`, `RenderingOps`) plus new helper(s) where missing (e.g., navigation history DTO) |
| Store slices (`chapters`, `translations`, `image`, `export`) | Fetch/deletes via facade | `ChapterOps`, `TranslationOps`, `ImageOps`, `ExportOps`, `AmendmentOps` |
| Components (`SessionInfo`, `SettingsModal`, `InputBar`, `NovelLibrary`) | Fetch translations/exports/imports directly | Route through store actions or the repo adapters once they target the new ops; components should not talk to DB directly |
| Services (`importService`, `exportService`, etc.) | CRUD through facade | Inject repositories/ops (e.g., `TranslationOps`, `ChapterOps`, `MappingsOps`). `importService` should become a thin orchestrator over the ops layer plus DTO helpers |
| Repository adapters | Legacy compatibility wrapper | Replace implementations with repo/ops instances (or remove entirely and import the repos directly) |
| DB operations (legacy mode) | `indexedDBService` for fallback | After every consumer switches, drop legacy branches and benchmark-size the ops files |
| Tests | Interact with facade mocks | Update to mock repositories/ops or use the new test DB harness |

Missing helpers discovered during cataloguing:
- Stable `findChapterByNumber` and navigation-history helpers in `ChapterOps` (needed by `chaptersSlice` and bootstrap).
- URL mapping upsert helper (added via `upsertUrlMappingsForChapter` 2025-11-12).
- Import/export DTO definitions so services/components don’t assemble raw objects.

## 3. Migration Batches

1. **Bootstrap + Import/Export Services** ✅ _in progress_
   - ✅ `store/bootstrap/*`, `services/importService.ts`, `services/exportService.ts`, `components/NovelLibrary.tsx`, `components/InputBar.tsx`, and `store/slices/exportSlice.ts` now depend on ops (`SettingsOps`, `ChapterOps`, `TranslationOps`, `SessionExportOps`, etc.).
   - Remaining: `services/importTransformationService.ts` now uses ops but still needs a final DTO audit.

2. **Store Slices + Components**
   - Switch `translationsSlice`, `imageSlice`, `chaptersSlice`, `exportSlice`, `SessionInfo`, and `SettingsModal` to the ops layer.
   - Introduce any missing ops (e.g., amendment logging, chapter-number queries) so slices stay thin.

3. **Secondary Services + Providers** ✅
   - ✅ All runtime services now route through `ChapterOps`/`TranslationOps`/`SettingsOps`, and the ops layer itself (`chapters`, `translations`, `imports`, `maintenance`, `mappings`, `sessionExport`) no longer touches the facade.
   - Remaining: CLI scripts/workers plus the adapter/test harnesses that intentionally gate legacy fallbacks until their migrations land.
   - With ops isolated, `indexeddb.ts` now acts purely as a compatibility shim until the legacy harness is removed.

4. **Adapters & Tests**
   - Replace `adapters/repo/*` with thin wrappers over the new repos or remove them entirely.
   - Update test suites to use repo mocks/ops helpers and delete the legacy harnesses.

5. **Delete Legacy Paths**
   - Once `rg -l indexedDBService` only returns the facade itself (and the ops’ legacy branch), remove the legacy code, consolidate connection management, and document the new single entry point.

This document should be updated whenever a batch completes or new call sites are discovered. Once Batch 3 is done, we can realistically delete the facade after a short stabilization period.

## 4. Archived Diagnostics & Contract Suites

- 2025-11-15: The three high-signal archive suites now target the modern stack directly:
  - `translation-simple.legacy.ts` exercises ChapterOps/TranslationOps via a lightweight harness (no legacy repo dependency).
  - `migration-validation-clean.legacy.ts` and `actual-system-validation.legacy.ts` assert the modern StableId/Translation behaviors without shadowing legacy results.
- Retired suites (`migration-validation.legacy.ts`, `legacy-workaround.legacy.ts`, `diagnostic-investigation.legacy.ts`, `diagnostic-evidence.legacy.ts`) captured the following findings, now baked into the ops layer and ADRs:
  - Stable ID writes must auto-create URL mappings and tolerate hyphen/underscore variants.
  - Translation version assignment is sequential/atomic—concurrency issues documented by the legacy tests were caused by the old repo and are no longer actionable.
  - Field naming mismatches (`translation` vs `translatedContent`) no longer apply because TranslationOps normalizes payloads; keeping the logging-only suites added no coverage.
  - Session exports now include translations/settings/feedback, resolving the incomplete payloads those diagnostics highlighted.
- Any future regression hunting should add modern tests next to the ops/repository files rather than reviving the legacy harnesses.
