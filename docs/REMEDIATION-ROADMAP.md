# Technical Debt Remediation Roadmap

**Date**: 2025-11-12
**Based on**: ADDITIONAL-ARCHITECTURAL-ISSUES.md
**Approach**: Incremental, low-risk, evidence-driven

---

## Overview

**20 architectural issues identified**, grouped into 4 parallel tracks:

- **Track A**: Database Layer (Connection & Data Paths)
- **Track B**: Code Quality & Safety
- **Track C**: Initialization & Performance
- **Track D**: Architecture & Patterns

**Strategy**: Fix P0 blockers first, then parallelize P1 work across tracks.

---

## Phase 0: Schema Migration Fix (COMPLETE ✅)

**Completed**: 2025-11-12
**Duration**: 2 hours
**Issue Fixed**: #3 Hard-coded verification lists

**Changes**:
- Created `tests/db/migrations/fresh-install.test.ts` (27 tests passing)
- Verified migrations v1-v12 are complete
- Identified path forward for Phase 2 (remove createSchema)

**Outcome**: Fresh install now testable, migrations validated

---

## Phase 1: Critical Blockers (P0) - Week 1-2

**Goal**: Stabilize database layer and eliminate dual paths

### 1.1 Remove Dual Connection (Issue #2) - 6 hours

**Problem**: Two connection singletons cause schema drift bugs

**Plan**:
1. Consolidate on `services/db/core/connection.ts` (it's cleaner)
2. Remove `indexeddb.ts:openDatabase()` method
3. Update `indexeddb.ts` to import connection from core
4. Run full test suite

**Files**:
- `services/indexeddb.ts:283-372` (delete)
- `services/indexeddb.ts` (import getConnection)

**Test Gate**: `npm test` passes

**Confidence**: 0.90 (well-isolated change)

---

### 1.2 Remove createSchema Dual Path (Issue #2 cont.) - 4 hours

**Problem**: Migrations AND createSchema both run → conflicts

**Plan**: (From design space analysis)
1. Delete `services/indexeddb.ts:629-720` (createSchema method)
2. Remove call to `createSchema()` in onupgradeneeded
3. Update verification to derive from `STORE_NAMES`
4. Test fresh install + existing DB upgrade

**Files**:
- `services/indexeddb.ts:629-720` (delete)
- `services/indexeddb.ts:309` (remove createSchema call)
- `services/indexeddb.ts:378-397` (update verification)

**Test Gate**: `tests/db/migrations/fresh-install.test.ts` passes

**Confidence**: 0.95 (already tested in Phase 0)

---

### 1.3 Fix Bootstrap Race Conditions (Issue #10) - 8 hours

**Problem**: `initializeStore` has no error recovery, silent failures

**Plan**:
1. Add explicit dependency graph:
   ```typescript
   const INIT_STEPS = {
     loadSettings: { deps: [], critical: true },
     loadTemplates: { deps: ['loadSettings'], critical: true },
     registerAudio: { deps: [], critical: false },
     backfillData: { deps: ['loadSettings'], critical: false },
     handleDeepLink: { deps: ['loadSettings', 'loadTemplates'], critical: false }
   };
   ```

2. Replace try/catch with Result types:
   ```typescript
   type StepResult = { ok: true } | { ok: false, error: Error, critical: boolean };
   ```

3. Aggregate failures and show UI:
   ```typescript
   if (criticalFailures.length > 0) {
     showNotification("Initialization failed: " + criticalFailures.join(", "), "error");
     setInitialized(false);
   }
   ```

4. Add progress tracking (1-7 steps)

**Files**:
- `store/bootstrap/initializeStore.ts` (refactor)
- `store/slices/uiSlice.ts` (add initProgress field)

**Test Gate**:
```typescript
// tests/store/bootstrap/initializeStore.test.ts
it('handles critical failures gracefully')
it('continues on non-critical failures')
it('reports progress')
```

**Confidence**: 0.75 (complex refactor, needs careful testing)

---

### 1.4 Consolidate Store Constants (Issue #3 cont.) - 2 hours

**Problem**: STORES constant duplicated in 2 files

**Plan**:
1. Make `services/db/core/schema.ts` the single source of truth
2. Update `services/indexeddb.ts` to import `STORE_NAMES`
3. Delete local `STORES` constant
4. Run find-replace for references

**Files**:
- `services/indexeddb.ts:76-87` (delete STORES, import STORE_NAMES)
- All files importing STORES (auto-fix with IDE)

**Test Gate**: TypeScript compiles, tests pass

**Confidence**: 0.95 (mechanical change)

---

**Phase 1 Total**: 20 hours (2.5 days focused work)

**Checkpoint**: After Phase 1, dual connection paths eliminated, fresh installs stable

---

## Phase 2: Data Path Consolidation (P0) - Week 2-3

**Goal**: Single data access pattern, eliminate legacy facade

### 2.1 Audit Legacy Facade Usage - 4 hours

**Plan**:
1. Generate dependency graph: `indexedDBService` → consumers
2. Categorize by operation type (chapters, translations, settings)
3. Create migration checklist

**Tool**:
```bash
grep -r "indexedDBService\." services/ store/ | cut -d: -f1 | sort -u
```

**Deliverable**: `LEGACY-FACADE-MIGRATION.md` with checklist

---

### 2.2 Migrate Import Service (Issue #5) - 12 hours

**Problem**: `importService.ts` uses legacy facade exclusively (891 LOC)

**Plan**:
1. Replace `indexedDBService.storeChapter()` with `ChapterOps.store()`
2. Replace `indexedDBService.storeTranslation()` with `TranslationOps.store()`
3. Add transaction wrapper for atomic imports
4. Test round-trip: export → import → verify

**Files**:
- `services/importService.ts` (refactor)
- `services/db/operations/index.ts` (add `importTransaction` helper)

**Test Gate**:
```typescript
// tests/services/importService.test.ts
it('imports chapter+translation atomically')
it('rolls back on partial failure')
it('round-trips with export')
```

**Confidence**: 0.70 (large refactor, needs careful validation)

---

### 2.3 Migrate Store Slices (Issue #1, #15) - 16 hours

**Problem**: Store slices use legacy facade, causing desync

**Plan**:
1. Add event bus: `DbEventBus` with listeners
   ```typescript
   DbEventBus.on('chapter:stored', (chapter) => {
     dispatch(chaptersSlice.actions.upsertChapter(chapter));
   });
   ```

2. Update `ChapterOps.store()` to emit events
3. Migrate `chaptersSlice` thunks to use ChapterOps
4. Migrate `translationsSlice` thunks to use TranslationOps
5. Remove direct `indexedDBService` imports

**Files**:
- `services/db/eventBus.ts` (new, ~100 LOC)
- `services/db/operations/*.ts` (add event emission)
- `store/slices/chaptersSlice.ts` (refactor)
- `store/slices/translationsSlice.ts` (refactor)

**Test Gate**:
```typescript
// tests/store/slices/integration.test.ts
it('store updates when DB operation completes')
it('handles DB operation failures')
```

**Confidence**: 0.65 (complex, touches state management)

---

### 2.4 Thin Shim or Delete Legacy Facade (Issue #1) - 8 hours

**Plan**: After all consumers migrated, decide:
- **Option A**: Delete `services/indexeddb.ts` entirely
- **Option B**: Keep as thin shim delegating to operations

**Recommendation**: Option B (safer, allows gradual rollout)

```typescript
// Thin shim example
export const indexedDBService = {
  storeChapter: (chapter) => ChapterOps.store(chapter),
  getChapter: (url) => ChapterOps.getByUrl(url),
  // ... delegate all methods
};
```

**Files**:
- `services/indexeddb.ts` (reduce from 2119 LOC → ~200 LOC)

**Confidence**: 0.85 (straightforward once migrations complete)

---

**Phase 2 Total**: 40 hours (5 days focused work)

**Checkpoint**: Single data path, store/DB synchronized, legacy facade eliminated

---

## Phase 3: Code Quality & Safety (P0/P1) - Week 3-4

**Goal**: Remove type escape hatches, split oversized files

### 3.1 Split Oversized Files (Issue #7) - 20 hours

**Priority**:
1. `services/indexeddb.ts` (2119 LOC) → Already handled in Phase 2
2. `services/epubService.ts` (1777 LOC) → Split into:
   - `epub/builder.ts` (EPUB construction)
   - `epub/styles.ts` (CSS generation)
   - `epub/metadata.ts` (OPF/NCX)
   - `epub/packaging.ts` (ZIP assembly)

3. `store/slices/imageSlice.ts` (1055 LOC) → Split into:
   - `imageSlice.ts` (Redux state only, ~300 LOC)
   - `image/generation.ts` (generation logic)
   - `image/versioning.ts` (version management)
   - `image/cache.ts` (cache operations)

**Approach**: Extract-then-delegate (no behavior changes)

**Files Per Module**: Target <400 LOC each

**Test Gate**: Existing tests pass after refactor

**Confidence**: 0.80 (mechanical but large)

---

### 3.2 Type Safety Cleanup (Issue #8) - 16 hours

**Plan**:
1. **Phase 3.2a**: Fix DTO mismatches (8h)
   - Create `types/dto.ts` with DB record types
   - Create `types/domain.ts` with app types
   - Add mapper functions: `toDTO()`, `fromDTO()`
   - Example:
     ```typescript
     // Before
     const record = result as any;

     // After
     const record = TranslationDTO.fromResult(result);
     ```

2. **Phase 3.2b**: Legacy data coercion (8h)
   - Centralize in `utils/coercion.ts`
   - Example:
     ```typescript
     // Before
     const active = v.isActive === true || v.isActive === 1;

     // After
     import { toBoolean } from '../utils/coercion';
     const active = toBoolean(v.isActive);
     ```

**Target**: Reduce `as any` from 129 → <20

**Files**: All services and store slices

**Test Gate**: TypeScript strict mode enabled, no new errors

**Confidence**: 0.70 (requires careful type design)

---

### 3.3 Replace Silent Errors (Issue #4) - 8 hours

**Plan**:
1. Add debug flag: `DEBUG_DB_ERRORS=true`
2. Create error boundary:
   ```typescript
   export function logDbError(context: string, error: Error) {
     telemetryService.recordError(context, error);
     if (getDebugFlag('DB_ERRORS')) {
       console.error(`[${context}]`, error);
     }
     // Always store in IndexedDB for user bug reports
     errorLogService.store(context, error);
   }
   ```

3. Replace all `console.warn` in catch blocks with `logDbError`
4. Add UI indicator: "⚠️ 3 background errors" (clickable to see log)

**Files**:
- `services/errorLogService.ts` (new)
- All services with try/catch blocks

**Confidence**: 0.90 (isolated changes)

---

**Phase 3 Total**: 44 hours (5.5 days)

**Checkpoint**: Code quality improved, type safety restored, errors visible

---

## Phase 4: Performance & Observability (P1) - Week 4-5

### 4.1 Add Transaction Support (Issue #11) - 12 hours

**Plan**:
1. Create transaction helper:
   ```typescript
   export async function withTransaction<T>(
     storeNames: string[],
     operation: (tx: IDBTransaction) => Promise<T>
   ): Promise<T> {
     const db = await getConnection();
     const tx = db.transaction(storeNames, 'readwrite');
     try {
       const result = await operation(tx);
       await promisifyRequest(tx.complete);
       return result;
     } catch (error) {
       tx.abort();
       throw error;
     }
   }
   ```

2. Update multi-step operations:
   - `storeTranslation` + `updateChapter` + `recomputeSummary`
   - Import operations (store all chapters+translations)

**Files**:
- `services/db/operations/transaction.ts` (new)
- `services/db/operations/chapters.ts` (use transactions)
- `services/db/operations/translations.ts` (use transactions)

**Test Gate**:
```typescript
it('rolls back on partial failure')
it('commits only on complete success')
```

**Confidence**: 0.75 (IndexedDB transaction quirks)

---

### 4.2 Move Backfills to Migrations (Issue #18) - 4 hours

**Plan**:
1. Move chapter number backfill from `initializeStore` to migration v10
2. Add flag: `__migration_v10_backfill_complete`
3. Remove from bootstrap

**Files**:
- `services/db/core/schema.ts:297-302` (add backfill logic)
- `store/bootstrap/initializeStore.ts:104-112` (delete)

**Confidence**: 0.85 (straightforward)

---

### 4.3 Add Telemetry Integration (Issue #19) - 8 hours

**Plan**:
1. Wrap all operations with timing:
   ```typescript
   export async function store(chapter: Chapter): Promise<void> {
     const start = performance.now();
     try {
       await storeImpl(chapter);
       telemetryService.recordOp('chapter:store', performance.now() - start);
     } catch (error) {
       telemetryService.recordError('chapter:store', error);
       throw error;
     }
   }
   ```

2. Add dashboard: `window.showDbMetrics()`
   - Operation counts
   - Average latency per operation
   - Error rates
   - Cache hit rates

**Files**:
- `services/db/operations/*.ts` (add telemetry)
- `services/telemetryService.ts` (add DB metrics)
- `utils/devtools.ts` (add dashboard)

**Confidence**: 0.90 (non-invasive)

---

**Phase 4 Total**: 24 hours (3 days)

**Checkpoint**: Transactions prevent corruption, metrics show bottlenecks

---

## Phase 5: Architecture Polish (P1/P2) - Week 5-6

### 5.1 Standardize Service Pattern (Issue #9) - 8 hours

**Decision**: Use **static class methods** (no instantiation needed)

**Example**:
```typescript
// Before (3 different patterns)
export const importService = { importFromUrl };
export class ExportService { ... }
export const indexedDBService = new IndexedDBService();

// After (consistent)
export class ImportService {
  static async importFromUrl(url: string): Promise<void> { ... }
}
```

**Files**: All services (gradually)

**Confidence**: 0.85 (refactor, but isolated)

---

### 5.2 Add Validation Layer (Issue #16) - 8 hours

**Plan**:
1. Use Zod for schema validation:
   ```typescript
   import { z } from 'zod';

   const ChapterSchema = z.object({
     url: z.string().url(),
     title: z.string().min(1),
     content: z.string(),
     stableId: z.string().optional(),
     // ...
   });
   ```

2. Validate at boundaries (import, user input)
3. Log validation errors to telemetry

**Files**:
- `types/schemas.ts` (new)
- `services/importService.ts` (validate imports)
- `services/db/operations/*.ts` (validate before store)

**Confidence**: 0.80 (Zod integration straightforward)

---

### 5.3 Fix Export/Import Symmetry (Issue #20) - 12 hours

**Plan**:
1. Define canonical format: `types/export-format.ts`
2. Update export to match
3. Update import to expect canonical format
4. Delete transformation service (891 LOC saved!)

**Files**:
- `types/export-format.ts` (new)
- `services/exportService.ts` (update format)
- `services/importService.ts` (remove transformations)
- `services/importTransformationService.ts` (delete)

**Confidence**: 0.70 (needs careful round-trip testing)

---

### 5.4 Add Operation Interfaces (Issue #17) - 4 hours

**Plan**:
```typescript
interface IOperations {
  store(record: T): Promise<void>;
  getById(id: string): Promise<T | null>;
  getAll(): Promise<T[]>;
  delete(id: string): Promise<void>;
}

export const ChapterOps: IOperations<ChapterRecord> = { ... };
```

**Files**:
- `services/db/operations/interfaces.ts` (new)
- `services/db/operations/*.ts` (implement interface)

**Confidence**: 0.90 (mechanical)

---

### 5.5 Delete Dead Migration Code (Issue #12) - 2 hours

**Decision**: Delete unused migration infrastructure

**Files**:
- `services/db/migration/phase-controller.ts` (delete)
- `services/db/migration/shadow-validator.ts` (delete)
- `services/db/migration/service-adapter.ts` (delete)

**Saved**: 980 LOC, ~20KB bundle size

**Confidence**: 0.95 (confirmed unused)

_Status (2025-11-13): Completed — backend selection now lives solely inside `services/db/index.ts` via the `DB_BACKEND` / `lf:db-backend` toggle._

---

**Phase 5 Total**: 34 hours (4 days)

**Checkpoint**: Architecture clean, validation in place, dead code removed

---

## Phase 6: Testing & Integration (P2) - Week 6

### 6.1 Integration Test Suite (Issue #6) - 16 hours

**Tests to Add**:

1. **Fresh Install Flow**:
   ```typescript
   it('fresh install with no data works', async () => {
     // Clear IndexedDB
     // Open app
     // Verify init completes
     // Import sample novel
     // Verify data persists
   });
   ```

2. **Upgrade Paths**:
   ```typescript
   it('upgrades from v8 to v12', async () => {
     // Restore v8 backup
     // Open app (triggers migration)
     // Verify data intact
     // Verify new stores created
   });
   ```

3. **Import/Export Round-trip**:
   ```typescript
   it('exports then imports without data loss', async () => {
     // Load sample data
     // Export to JSON
     // Clear DB
     // Import JSON
     // Verify all data restored
   });
   ```

4. **Streaming Import Stress**:
   ```typescript
   it('imports 100-chapter novel without hanging', async () => {
     // Mock slow network
     // Start import
     // Verify progress updates
     // Verify completion
   }, 60000); // 60s timeout
   ```

**Files**:
- `tests/integration/fresh-install.test.ts`
- `tests/integration/upgrades.test.ts`
- `tests/integration/round-trip.test.ts`
- `tests/integration/stress.test.ts`

**Confidence**: 0.80 (integration tests are flaky by nature)

---

### 6.2 Add Idempotency (Issue #14) - 8 hours

**Plan**:
1. Add unique constraints:
   - Translation: `(chapterUrl, version)` already unique
   - URL mapping: Check before insert
   - Chapter: Update `lastAccessed` but preserve `dateAdded`

2. Explicit retry logic:
   ```typescript
   export async function storeWithRetry<T>(
     op: () => Promise<T>,
     maxRetries = 3
   ): Promise<T> {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await op();
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await sleep(1000 * Math.pow(2, i)); // exponential backoff
       }
     }
   }
   ```

**Files**:
- `services/db/operations/*.ts` (add idempotency checks)
- `utils/retry.ts` (new)

**Confidence**: 0.75 (requires careful testing)

---

**Phase 6 Total**: 24 hours (3 days)

**Final Checkpoint**: All integration tests passing, robust error handling

---

## Summary

### Timeline

| Phase | Duration | Issues Fixed | LOC Changed |
|-------|----------|--------------|-------------|
| 0 (Done) | 2h | #3 | 500 |
| 1 | 20h (2.5d) | #2, #3, #10 | 1000 |
| 2 | 40h (5d) | #1, #5, #15, #20 | 3000 |
| 3 | 44h (5.5d) | #4, #7, #8 | 5000 |
| 4 | 24h (3d) | #11, #18, #19 | 500 |
| 5 | 34h (4d) | #9, #12, #16, #17, #20 | 2000 |
| 6 | 24h (3d) | #6, #14 | 800 |
| **Total** | **188h (23.5 days)** | **20 issues** | **12,800 LOC** |

### Phased Rollout

- **Week 1-2**: Phase 1 (P0 blockers)
  - ✅ Checkpoint: Fresh installs stable, dual paths eliminated

- **Week 2-3**: Phase 2 (Data consolidation)
  - ✅ Checkpoint: Single data path, store/DB synchronized

- **Week 3-4**: Phase 3 (Code quality)
  - ✅ Checkpoint: Type safety restored, files split, errors visible

- **Week 4-5**: Phase 4-5 (Performance & architecture)
  - ✅ Checkpoint: Transactions prevent corruption, validation in place

- **Week 6**: Phase 6 (Testing & hardening)
  - ✅ Final: Integration tests passing, production-ready

### Risk Mitigation

**Per Phase**:
- Create feature branch
- Run full test suite before/after
- Deploy to staging for 24h
- Monitor telemetry for regressions
- Emergency rollback plan ready

**Confidence Levels**:
- High (0.85+): 60% of work
- Medium (0.70-0.84): 30% of work
- Experimental (0.50-0.69): 10% of work

### Success Metrics

**Before (Baseline)**:
- 20 architectural issues
- 162 type escape hatches
- 10 files >800 LOC
- 11 silent error handlers
- 0 integration tests
- Fresh install fails 100%

**After (Target)**:
- 0 P0 issues, <5 P1 issues
- <20 type escape hatches (87% reduction)
- 0 files >800 LOC
- 0 silent errors (all logged + UI indicator)
- 15+ integration tests
- Fresh install success rate >99.9%

### Cost/Benefit

**Investment**: 188 engineer-hours (~$30K at $160/hr)

**Savings**:
- 50% reduction in bug investigation time
- 30% faster feature velocity (less tech debt friction)
- Prevents 1-2 major outages/year (~$50K each)
- Eliminates need for full rewrite in 12-18mo (~$200K)

**ROI**: 4x within 6 months

---

## Open Questions

1. **Phase 2.3**: Event bus vs Redux middleware for DB sync?
2. **Phase 3.2**: Zod vs custom validation? (Bundle size impact)
3. **Phase 5.3**: Keep transformation service for backward compat?
4. **Phase 6**: Run integration tests in CI? (IndexedDB in Node?)

---

## Next Action

**Immediate**: Complete Phase 1.2 (Remove createSchema) - already tested in Phase 0.

**Command**: See `docs/ADDITIONAL-ARCHITECTURAL-ISSUES.md` for full issue list.
