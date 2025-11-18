# Additional Architectural Issues

**Date**: 2025-11-12
**Context**: Comprehensive audit beyond the schema drift bug
**Related**: TECH-DEBT-REDUCTION-PLAN.md, INDEXEDDB-DECOMPOSITION-PLAN.md

---

## User-Identified Issues (Confirmed ✅)

-### 1. ✅ Dual Data Paths (CRITICAL - P0)
- **Legacy**: `services/indexeddb.ts` (former 2119 LOC monolith; deleted Nov 16, 2025)
- **New**: `services/db/operations/*` + `services/db/repositories/*`
- **Impact**: 40+ files *used to* import `indexedDBService` directly
- **Evidence**: `importService.ts`, `translationService.ts`, `navigationService.ts`, all store slices
- **Risk**: Every bug fix requires dual implementation; easy to regress
- **Blast Radius**: High - touches all data operations

### 2. ✅ Dual Connection Management (HIGH - P0)
- **Locations**:
  - (legacy) `services/indexeddb.ts:283-372` (openDatabase method)
  - `services/db/core/connection.ts:55-124` (getConnection function)
- **Impact**: Two singletons, two event handlers, two upgrade paths
- **Evidence**: Schema drift bug exposed this - createSchema in one, migrations in other
- **Risk**: Version mismatches, blocked upgrades, "works in dev" bugs

### 3. ✅ Hard-coded Verification Lists (MEDIUM - P1)
- **Locations**:
  - (legacy) `services/indexeddb.ts:76-87` (STORES constant)
  - `services/db/core/schema.ts:28-39` (STORE_NAMES constant)
  - `services/indexeddb.ts:379-381` (hardcoded required stores array)
- **Impact**: Added `DIFF_RESULTS` to one place, forgot others → schema drift
- **Evidence**: Verification logic didn't include diffResults, causing failures
- **Fix**: Completed in Phase 1 (now derives from STORE_NAMES)

### 4. ✅ Silent Error Handling (MEDIUM - P1)
- **Locations**:
  - 5 instances of `console.warn` in catch blocks (grep confirmed)
  - 6 instances of `.catch(() => {})` (empty handlers)
- **Examples**:
  - `services/db/index.ts` (shadow repo fallbacks)
  - `services/navigationService.ts` (4 silent catches)
  - Store bootstrap (prompt template failures)
- **Impact**: "initializeSession failing silently" reported by user
- **Risk**: Failures invisible until customer reports

### 5. ✅ Halfway Migrations (HIGH - P0)
- **Evidence**: `importService.ts` uses legacy facade exclusively
- **Counter-evidence**: `ChapterOps`, `TranslationOps` exist but underutilized
- **Impact**: Import/export hits old path, other features hit new path
- **Result**: Inconsistent behavior, harder to test

### 6. ✅ Testing Gaps (MEDIUM - P1)
- **Current state**: Good unit tests for new ops (`tests/services/db/*`)
- **Missing**:
  - ❌ Fresh install integration test (FIXED in Phase 1)
  - ❌ Full upgrade path tests (v8→v12, v11→v12)
  - ❌ Import/export round-trip tests
  - ❌ Streaming import stress tests
- **Impact**: Bugs like "initializeStore spinner" caught late

---

## Additional Issues Discovered (NEW 🆕)

### 7. 🆕 File Size Violations (CRITICAL - P0)

**CLAUDE.md Rules**:
- Files approaching ~300 LOC must be flagged for refactoring
- Components > 500 LOC require immediate splitting
- Services > 800 LOC are technical debt
- Test files > 400 LOC should be divided

**Violations**:
```
2119 LOC  services/indexeddb.ts *(legacy file removed; ops layer is modular)* 🔴🔴🔴
1777 LOC  services/epubService.ts     (222% over limit) 🔴🔴
1055 LOC  store/slices/imageSlice.ts  (211% over limit) 🔴🔴
 948 LOC  store/slices/translationsSlice.ts (190% over) 🔴
 914 LOC  services/navigationService.ts (114% over) 🔴
 891 LOC  services/importService.ts   (111% over) 🔴
 813 LOC  store/slices/chaptersSlice.ts (163% over) 🔴
 781 LOC  services/imageService.ts    (98% over limit) 🔴
```

**Total Debt**: 8 files representing ~10,000 LOC of oversized modules

**Impact**:
- High cognitive load per file
- Harder to reason about side effects
- Testing requires understanding entire file
- Refactoring becomes risky

---

### 8. 🆕 Type Safety Escape Hatches (HIGH - P0)

**Evidence**:
```
129 instances of "as any" / "as unknown"
 33 instances of bare "any" types
```

**Hotspots**:
- `services/db/index.ts` (memory repo, shadow repo)
- `services/importService.ts` (legacy DTO coercion)
- `store/slices/*` (Redux state casting)

**Impact**:
- TypeScript can't catch bugs at compile time
- Runtime type errors likely (as seen in schema drift)
- Refactoring safety net removed

**Root Cause**:
- DTO mismatches between old/new patterns
- Legacy data coercion (booleans as 1/0/true/false)
- Repository pattern half-migrated

---

### 9. 🆕 Service Class Inconsistency (MEDIUM - P1)

**Pattern Mismatch**:
- **Classes**: `ExportService`, `SessionManagementService`, `DiffAnalysisService`, `AudioService`
- **Singletons**: `indexedDBService`, `telemetryService`, `rateLimitService`
- **Functions**: `importService` (object literal), `navigationService` (function exports)

**Evidence**: 14 class definitions found via grep

**Impact**:
- Unclear instantiation rules (new vs import?)
- Testing requires different mocking strategies per pattern
- Dependency injection inconsistent

**Example Confusion**:
```typescript
// Which pattern to use?
import { indexedDBService } from './indexeddb';  // singleton
import { ExportService } from './exportService';  // class
import { importFromUrl } from './importService'; // function
```

---

### 10. 🆕 Bootstrap Initialization Race Conditions (HIGH - P0)

**Issue**: `store/bootstrap/initializeStore.ts` orchestrates complex async operations:
1. Load settings
2. Load prompt templates (or initialize defaults)
3. Check URL params for deep links
4. Potentially trigger import
5. Register audio service worker
6. Backfill chapter numbers migration
7. Load URL mappings

**Problems**:
- No dependency graph - operations in arbitrary order
- Silent failures at each step (try/catch with console.warn)
- No rollback mechanism
- No progress tracking (user sees spinner forever on failure)
- Deep link import runs in parallel with other init steps

**Evidence**:
```typescript
// Lines 31-33 - swallow prompt template errors
catch (e) {
  console.warn('[Store] Failed to load/initialize prompt templates:', e);
}

// Lines 104-112 - backfill fails silently
catch (error) {
  console.error('[Store] Chapter numbers backfill failed:', error);
  // Continues anyway!
}
```

**Impact**:
- User-reported "initializeStore spinner" bug
- Fresh installs may partially fail
- No way to diagnose which step failed

---

### 11. 🆕 No Transactional Guarantees (MEDIUM - P1)

**Issue**: Multi-store operations have no transaction coordination

**Examples**:
1. **Storing a translation**:
   - Insert translation record
   - Update chapter's lastAccessed
   - Recompute chapter summary
   - Update URL mappings
   - Each is separate transaction - can partial-fail

2. **Import operation**:
   - Stores chapters one-by-one
   - Stores translations one-by-one
   - Failure mid-stream leaves partial data
   - No rollback mechanism

**Evidence**: `services/db/operations/chapters.ts` and `translations.ts` use independent transactions

**Impact**:
- Data corruption possible on errors
- Orphaned records (translation without chapter)
- User must "clear all data" to recover

---

### 12. ✅ Migration Infrastructure Retired (LOW - P2)

**Status (2025-11-13)**:
- Deleted `services/db/migration/{phase-controller,service-adapter,shadow-validator}.ts`
- `services/db/index.ts` now exposes a single backend toggle (env `DB_BACKEND` or localStorage `lf:db-backend`) that switches between the modern repo, the legacy facade, or the memory fallback.

**Impact**:
- ~980 LOC removed, ~20KB bundle savings
- Simpler mental model for contributors (no phantom shadow phases)
- `dbUtils` still offers a rollback hook by toggling the backend preference

**Follow-up**:
- Keep documenting the new toggle in onboarding material
- Any future phased rollout should land as a separate feature flag rather than resurrecting the deleted controller

---

### 13. 🆕 Circular Dependency Risk (MEDIUM - P1)

**Evidence**:
```typescript
// services/indexeddb.ts imports from operations
import { exportFullSessionToJson as exportSessionOperation } from './db/operations/export';

// services/db/operations/chapters.ts imports indexeddb
import { indexedDBService } from '../indexeddb';

// services/db/operations/translations.ts imports indexeddb
import { indexedDBService } from '../indexeddb';
```

**Potential Issues**:
- Module initialization order matters
- Refactoring can introduce circular deps
- Hard to tree-shake

**Current Status**: No actual circular deps yet (TypeScript would fail), but structure is fragile

---

### 14. 🆕 No Idempotency Guarantees (MEDIUM - P1)

**Issue**: Operations not designed to be safely retried

**Examples**:
1. **Translation storage**: Doesn't check if version already exists before incrementing
2. **Chapter storage**: `dateAdded` overwritten on every call
3. **URL mappings**: No "upsert" semantics, can create duplicates
4. **Migrations**: Some check "if exists", others assume clean state

**Impact**:
- Retry on error can create duplicate data
- Network failures require manual cleanup
- Import the same file twice → corruption

---

### 15. 🆕 Store State Doesn't Reflect DB Reality (HIGH - P0)

**Issue**: Redux store and IndexedDB can desync

**Evidence**:
- Store slices (`chaptersSlice`, `translationsSlice`) cache data
- Direct IndexedDB writes (e.g., from import) don't update store
- No event bus for DB → store propagation
- User refreshes page to see imported data

**Example Flow**:
1. User imports JSON via `importService`
2. Import writes directly to IndexedDB
3. Redux store still shows old data
4. UI doesn't update
5. User reports "import didn't work"

**Workaround**: Reload page (seen in `importSessionData.ts`)

---

### 16. 🆕 Missing Validation Layer (MEDIUM - P1)

**Issue**: No schema validation before storing data

**Evidence**:
- `services/indexeddb.ts` stores whatever is passed
- No Zod/Yup schemas
- No runtime type checks
- Trusts import JSON structure completely

**Impact**:
- Malformed imports corrupt database
- No early error detection
- Hard to debug type mismatches

**Example**: Import JSON with `isActive: "true"` (string) instead of boolean → works, but queries fail

---

### 17. 🆕 Operation Layer Has No Interface (LOW - P2)

**Issue**: `services/db/operations/*` modules export functions, but no shared interface

**Evidence**:
```typescript
// No common contract
export const ChapterOps = { store, getByUrl, getByStableId, ... };
export const TranslationOps = { store, getVersionsByUrl, ... };
```

**Impact**:
- Can't swap implementations for testing
- No type-level guarantees of consistency
- Hard to build generic tooling

**Recommendation**: Define `IOperations` interface

---

### 18. 🆕 Backfill Migrations in Wrong Place (MEDIUM - P1)

**Issue**: Data migrations run at store initialization time, not DB upgrade time

**Evidence**: `store/bootstrap/initializeStore.ts:104-112` runs chapter number backfill

**Problems**:
- Happens on every app load (checks flag, but still runs transaction)
- Slows down initialization
- Failure blocks entire app (spinner forever)
- Should be in schema migration v10

**Impact**: Cold start perf + reliability

---

### 19. 🆕 No Metrics/Observability (MEDIUM - P1)

**Issue**: Telemetry exists (`telemetryService.ts`) but not integrated with DB operations

**Missing**:
- Operation timing (how long does storeChapter take?)
- Error rates per operation
- Cache hit/miss rates
- Migration success/failure tracking
- User-facing progress bars

**Impact**: Can't diagnose performance issues or identify common errors

---

### 20. 🆕 Export/Import Not Symmetric (HIGH - P0)

**Issue**: Export format doesn't match import expectations

**Evidence**:
- Export uses one DTO shape (`exportFullSessionToJson`)
- Import expects different shape (legacy format)
- `importTransformationService.ts` exists to bridge gap (891 LOC!)

**Impact**:
- Export → Import round-trip fails for some data
- User complaints about "lost data after export/import"
- 891 LOC of pure transformation code

**Root Cause**: Export written before new repos, Import written after

---

## Priority Matrix

### By Impact × Coupling

| Issue | Impact | Coupling | Priority | LOC Affected |
|-------|--------|----------|----------|--------------|
| #1 Dual Data Paths | 🔴 Critical | 🔴 40+ files | **P0** | 2000+ |
| #2 Dual Connection | 🔴 Critical | 🔴 All DB ops | **P0** | 500+ |
| #7 File Size Violations | 🔴 Critical | 🟡 Isolated | **P0** | 10,000+ |
| #8 Type Escape Hatches | 🔴 Critical | 🔴 All layers | **P0** | 1000+ |
| #10 Bootstrap Races | 🔴 Critical | 🟡 Init only | **P0** | 200 |
| #15 Store/DB Desync | 🔴 Critical | 🔴 All UI | **P0** | 500+ |
| #20 Export/Import Asymmetry | 🔴 Critical | 🟡 Import path | **P0** | 891 |
| #5 Halfway Migrations | 🟠 High | 🔴 All writes | **P1** | 1000+ |
| #11 No Transactions | 🟠 High | 🟡 Multi-step ops | **P1** | 300 |
| #3 Hard-coded Lists | 🟡 Medium | 🟡 Schema | **P1** | 50 *(FIXED)* |
| #4 Silent Errors | 🟡 Medium | 🔴 All services | **P1** | 100 |
| #13 Circular Dep Risk | 🟡 Medium | 🔴 Module graph | **P1** | N/A |
| #14 No Idempotency | 🟡 Medium | 🟡 Retries | **P1** | 200 |
| #16 No Validation | 🟡 Medium | 🟡 Import | **P1** | N/A |
| #18 Backfill in Wrong Place | 🟡 Medium | 🟡 Init | **P1** | 50 |
| #19 No Observability | 🟡 Medium | 🔴 All ops | **P1** | N/A |
| #6 Testing Gaps | 🟡 Medium | 🟡 Test suite | **P2** | N/A |
| #9 Service Pattern Inconsistency | 🟡 Medium | 🔴 All services | **P2** | N/A |
| #12 Dead Migration Code | 🟢 Low | 🟢 Isolated | **P2** | 980 |
| #17 No Operation Interface | 🟢 Low | 🟡 Ops layer | **P2** | N/A |

---

## Dependencies Between Issues

**Blocking Chain** (must fix in order):

```
#2 Dual Connection → #1 Dual Data Paths → #5 Halfway Migrations
                ↓                              ↓
            #15 Store/DB Desync            #20 Export/Import
                                               ↓
                                          #16 No Validation
```

**Parallel Tracks** (can fix independently):

- Track A: Connection & Data (2→1→5→15→20)
- Track B: Code Quality (7→8→4)
- Track C: Init & Perf (10→18→19)
- Track D: Architecture (9→13→17)

---

## Metrics

**Total Technical Debt**: ~17,000 LOC affected across 20 issues

**CLAUDE.md Violations**:
- File size: 8 files (10,000 LOC)
- Silent failures: 11 instances
- Type safety: 162 escape hatches
- Testing gaps: 4 critical scenarios

**Estimated Remediation**: 120-160 hours (3-4 weeks of focused work)

**Risk if Ignored**: Compounding bugs, slower feature velocity, eventual rewrite

---

## Next Steps

See `REMEDIATION-ROADMAP.md` for phased approach.
