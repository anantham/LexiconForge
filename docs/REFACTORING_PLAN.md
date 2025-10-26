# Refactoring Plan - Monolithic Files Migration

**Date:** 2025-10-19
**Status:** Active Migration in Progress
**Target:** All services ≤200 LOC, components ≤250 LOC per ADR-005

---

## Table of Contents

1. [Current State Audit](#current-state-audit)
2. [Dependency Inventory](#dependency-inventory)
3. [Migration Checklist](#migration-checklist)
4. [Refactoring Roadmap](#refactoring-roadmap)
5. [Success Metrics](#success-metrics)

---

## Current State Audit

### Monolith Watchlist (files exceeding LOC thresholds)

| Path | LOC | Issue | Next Step |
|------|-----|-------|-----------|
| `services/aiService.ts` | 1,354 | Provider orchestration, validation, and utilities tangled together. | Split into `core/router`, `providers/*`, `validation/*`. Leverage new unit suites to enforce seams. |
| `store/slices/translationsSlice.ts` | 884 | State + effects + persistence + event dispatch in one module. | Extract selectors/reducers from async effects, route persistence via `services/db/operations/translations`. |
| `store/slices/imageSlice.ts` | 904 | Image cache, job orchestration, and persistence combined. | Create `imageCacheSlice` + `imageJobsSlice`; isolate DB calls. |
| `store/slices/chaptersSlice.ts` | 768 | Fetch, hydration, and navigation coupling. | Introduce `chaptersState.ts` + service layer using new ChapterOps. |
| `store/slices/exportSlice.ts` | 438 | Export/import logic mixed with UI state. | Move IO helpers into `services/export`, keep slice lean. |
| `services/navigationService.ts` | 661 | URL mapping + DB lookup + queue management. | Break into `navigation/db`, `navigation/cache`, `navigation/prefetch`. |
| `services/translationService.ts` | 697 | Translation queue + persistence + data shaping. | Offload persistence to operations layer; ensure translator focuses on orchestration. |
| `components/ChapterView.tsx` | 1,933 | Rendering, diff gutters, edit mode, media handling. | Continue Flow-based extraction (`ChapterView/Gutter`, `ChapterView/Editor`, etc.). |

> ⚠️ Requirement: any file listed above must be split before new features land (per ADR-005).

### services/db/ Structure (Modern Architecture)

**Status:** Scaffolding complete, operations still delegate to legacy monolith

#### Core Infrastructure ✅ Complete
```
services/db/core/
├── schema.ts (405 LOC) - Object store definitions, schema versions
├── connection.ts (242 LOC) - Database opening, upgrade handling
├── txn.ts (189 LOC) - Transaction helpers
├── errors.ts (138 LOC) - Error types and handling
└── stable-ids.ts (95 LOC) - StableID management and URL mapping
```

#### Migration & Maintenance ✅ Complete
```
services/db/migration/
├── phase-controller.ts (412 LOC) - Migration orchestration
├── shadow-validator.ts (391 LOC) - Dual-write validation
└── service-adapter.ts (312 LOC) - Adapter pattern for repos

services/db/
├── migrationService.ts (151 LOC) - localStorage → IndexedDB
└── maintenanceService.ts (87 LOC) - Cleanup utilities
```

#### Operations (Thin Wrappers) ⚠️ Delegate to Legacy
```
services/db/operations/
├── translations.ts (82 LOC) - TranslationOps class
├── chapters.ts (37 LOC) - ChapterOps class
├── templates.ts (19 LOC) - PromptTemplateOps class
├── settings.ts (17 LOC) - SettingsOps class
├── mappings.ts (16 LOC) - UrlMappingOps class
├── feedback.ts (14 LOC) - FeedbackOps class
├── export.ts (7 LOC) - ExportOps class
└── index.ts (8 LOC) - Barrel exports
```

**Key Finding:** All operations classes delegate to `indexedDBService.*` methods. No independent implementation yet.

#### Factory Pattern ✅ In Place
```
services/db/index.ts (390 LOC)
- Hybrid factory choosing between:
  • Legacy repo (indexedDBService wrapper)
  • Memory repo (testing)
  • Shadow repo (dual-write validation)
  • New repo (re-exports operations classes)
- Switch at line 202
- Sits in front of monolith, doesn't replace it
```

---

## Dependency Inventory

### Summary
- **Total uses:** 275 references to `indexedDBService`
- **Files affected:** 41 files
- **Domains:** 8 major areas

### By Domain (Prioritized by Impact)

#### 1. 🔴 CRITICAL - Store Slices (Hot Path)
**Impact:** Runs every render, highest traffic

```
store/slices/translationsSlice.ts (884 LOC)
├── Line 18: import { indexedDBService }
├── 47 calls to indexedDBService methods
└── Methods: storeTranslation, getTranslationVersions, setActiveTranslation, etc.

store/slices/chaptersSlice.ts (768 LOC)
├── Line 16: import { indexedDBService }
├── 38 calls to indexedDBService methods
└── Methods: storeChapter, getChapter, getAllChapters, etc.

store/slices/imageSlice.ts (904 LOC)
├── 12 calls to indexedDBService methods
└── Methods: deleteImageVersion, storeImageData, etc.

store/slices/exportSlice.ts (438 LOC)
├── 8 calls to indexedDBService methods
└── Methods: exportFullSessionToJson, importFullSessionData
```

**Migration Path:**
- Replace with `services/db/operations/*` imports
- Example: `indexedDBService.storeChapter(ch)` → `ChapterOps.store(ch)`

---

#### 2. 🟠 HIGH - Core Services (Feature Logic)
**Impact:** Translation, navigation, session management

```
services/translationService.ts (697 LOC)
├── 15 calls to indexedDBService methods
└── Methods: storeTranslation, getActiveTranslation

services/navigationService.ts (661 LOC)
├── Line 32: import { indexedDBService }
├── 22 calls to indexedDBService methods
└── Methods: getChapter, storeChapter, getStableIdByUrl

services/sessionManagementService.ts
├── 8 calls to indexedDBService methods
└── Methods: getSettings, storeSettings

services/importService.ts
├── 6 calls to indexedDBService methods
└── Methods: importFullSessionData

services/importTransformationService.ts
├── 4 calls to indexedDBService methods
└── Methods: storeChapter, getAllChapters
```

**Migration Path:**
- Replace with `services/db/operations/*` or `services/db/index`
- May need custom methods for complex operations

---

#### 3. 🟡 MEDIUM - Adapters (Abstraction Layer)
**Impact:** Already wrapped, lower priority

```
adapters/repo/
├── ChaptersRepo.ts - Wrapper around indexedDBService.chapters
├── TranslationsRepo.ts - Wrapper around indexedDBService.translations
├── SettingsRepo.ts - Wrapper around indexedDBService.settings
├── FeedbackRepo.ts - Wrapper around indexedDBService.feedback
├── PromptTemplatesRepo.ts - Wrapper around indexedDBService.templates
├── NovelsRepo.ts - Wrapper around indexedDBService.novels
├── UrlMappingsRepo.ts - Wrapper around indexedDBService.mappings
└── IndexedDbRepo.ts - Meta-wrapper
```

**Migration Path:**
- These can be deprecated entirely once store slices migrate
- Or refactored to use `services/db/operations/*`

---

#### 4. 🟢 LOW - DB Infrastructure (Self-Contained)
**Impact:** Already part of new architecture

```
services/db/operations/*.ts
├── All 7 operation files delegate to indexedDBService
└── These ARE the migration target, not dependents

services/db/core/stable-ids.ts
├── Uses indexedDBService.getAllUrlMappings()
└── Part of new architecture

services/db/maintenanceService.ts
services/db/migrationService.ts
├── Utility functions for migration
└── Can stay on legacy until final cutover
```

**Migration Path:**
- Replace delegation with direct IndexedDB operations
- This is the core refactoring work

---

#### 5. 🔵 LEGACY - Compatibility Layers
**Impact:** Intentional legacy, deprecate last

```
legacy/indexeddb-compat.ts
├── Explicit compatibility shim
└── Can stay until very end

services/indexeddb.ts (3191 LOC)
├── The monolith itself
└── Becomes thin facade, then deleted
```

**Migration Path:**
- Leave alone until all consumers migrated
- Then delete or turn into re-export shim

---

#### 6. 📦 SPECIAL - UI Components
**Impact:** Direct DB access from UI (anti-pattern)

```
components/SettingsModal.tsx (2177 LOC)
├── 5 calls to indexedDBService methods
└── Methods: getSettings, storeSettings, exportFullSessionToJson

services/imageMigrationService.ts
services/openrouterService.ts
services/providerCreditCacheService.ts
├── Miscellaneous services
└── Low call count, migrate opportunistically
```

**Migration Path:**
- SettingsModal should use store/slices, not direct DB access
- Other services can migrate to `services/db/operations/*`

---

#### 7. 🧪 TESTS
**Impact:** Update after migration

```
tests/
├── adapters/repo/*.test.ts
├── current-system/export-import.test.ts
├── current-system/translation.test.ts
├── db/open-singleton.test.ts
├── store/amendmentProposal.test.ts
└── utils/db-harness.ts
```

**Migration Path:**
- Port tests during each domain migration
- Use shadow validation helpers

---

## Migration Checklist

### Pre-flight ✅ (2025-10-13 status)

- Golden diff tests deterministic (cassettes recorded; replay verified).
- aiService/provider coverage in place (new unit suites guard translation router).
- ChapterView Flow #1 integration test active.

### Phase 1: Core Operations Implementation (2-3 weeks)

**Goal:** Make `services/db/operations/*` classes independent

#### 1.0 Parallel Decomposition Track

- [x] Extract `services/aiService` into `translatorRouter`, `providerAdapters`, `responseValidators`. (Completed 2025-10-13 – see new modules under `services/ai/` and passing coverage suites.)
- [ ] Split `store/slices/translationsSlice.ts` into:
  - `translationsState.ts` (reducers/selectors only)
  - `translationsEffects.ts` (async logic using new operations layer)
  - `translationsEvents.ts` (window events, diff dispatch)
- [ ] Create `store/slices/imageCacheSlice.ts` + `imageJobsSlice.ts`; move persistence into operations layer.
- [ ] Draft RFC for `components/ChapterView` extraction (gutter, editor, metadata panes) referencing Flow #1 tests.

#### 1.1 ChapterOps → Direct IndexedDB ✅ Can Start Now
```
Current: services/db/operations/chapters.ts (37 LOC)
Status: Thin wrapper over indexedDBService

Tasks:
[ ] Implement direct IndexedDB operations
    - store(): Add chapter to CHAPTERS store
    - getByUrl(): Query by URL index
    - getByStableId(): Query by stableId index
    - getAll(): Cursor over all chapters
[ ] Add proper error handling
[ ] Add transaction wrappers (use txn.ts)
[ ] Port existing tests
[ ] Shadow validate against legacy

Update 2025-10-13: Direct chapter ops implemented behind `LF_DB_V2` feature flag (`services/db/operations/chapters.ts`). Enable flag + compare against legacy before flipping default.

Dependencies: None (core infrastructure ready)
Estimate: 3-4 hours
```

#### 1.2 TranslationOps → Direct IndexedDB
```
Current: services/db/operations/translations.ts (82 LOC)
Status: Thin wrapper over indexedDBService

Tasks:
[ ] Implement direct IndexedDB operations
    - store(): Add translation to TRANSLATIONS store
    - getVersionsByUrl(): Query translations index
    - setActiveByUrl(): Update active translation record
    - Atomic version assignment logic
[ ] Handle version numbering (currently in legacy)
[ ] Add proper error handling
[ ] Port existing tests
[ ] Shadow validate

Update 2025-10-13: Direct translation ops implemented behind `LF_DB_V2` flag (`services/db/operations/translations.ts`). Enable flag alongside ChapterOps for side-by-side validation before defaulting.

Dependencies: ChapterOps complete (for URL resolution)
Estimate: 4-5 hours
```

#### 1.3 SettingsOps, FeedbackOps, TemplatesOps, MappingsOps
```
Similar pattern for each:
[ ] Implement direct CRUD operations
[ ] Add error handling
[ ] Port tests
[ ] Shadow validate

Estimate: 2-3 hours each (8-12 hours total)
```

#### 1.4 ExportOps → Complex
```
Current: services/db/operations/export.ts (7 LOC)
Status: Delegates to indexedDBService.exportFullSessionToJson

Tasks:
[ ] Refactor export logic from indexedDBService (lines 1789-2020)
[ ] Split into modular export pipeline:
    - Gather chapters
    - Gather translations
    - Gather settings
    - Gather images (if enabled)
    - Assemble JSON
[ ] Test with real sessions
[ ] Ensure backwards compatibility

Dependencies: All other Ops complete
Estimate: 8-10 hours (most complex)
```

---

### Phase 2: Store Slices Migration (2-3 weeks)

**Goal:** Migrate hot paths to new DB operations

#### 2.1 translationsSlice.ts (Priority 1)
```
Current: 884 LOC, 47 calls to indexedDBService
Target: Use services/db/operations/translations

Tasks:
[ ] Replace all indexedDBService.storeTranslation → TranslationOps.store
[ ] Replace getTranslationVersions → TranslationOps.getVersionsByUrl
[ ] Replace setActiveTranslation → TranslationOps.setActiveByUrl
[ ] Update imports
[ ] Test translation flow end-to-end
[ ] Monitor for regressions

Estimate: 6-8 hours (careful testing required)
```

#### 2.2 chaptersSlice.ts (Priority 2)
```
Current: 768 LOC, 38 calls to indexedDBService
Target: Use services/db/operations/chapters

Tasks:
[ ] Replace storeChapter → ChapterOps.store
[ ] Replace getChapter → ChapterOps.getByUrl
[ ] Replace getAllChapters → ChapterOps.getAll
[ ] Update preload logic
[ ] Test navigation flow
[ ] Monitor for regressions

Estimate: 6-8 hours
```

#### 2.3 imageSlice.ts, exportSlice.ts
```
Similar pattern:
[ ] Replace indexedDBService calls
[ ] Update imports
[ ] Test workflows
[ ] Monitor

Estimate: 4-5 hours each
```

---

### Phase 3: Core Services Migration (1-2 weeks)

**Goal:** Migrate services/translationService, navigationService, etc.

#### 3.1 translationService.ts
```
Tasks:
[ ] Replace 15 indexedDBService calls
[ ] Use TranslationOps
[ ] Test translation pipeline
[ ] Monitor performance

Estimate: 3-4 hours
```

#### 3.2 navigationService.ts
```
Tasks:
[ ] Replace 22 indexedDBService calls
[ ] Use ChapterOps + UrlMappingOps
[ ] Test scraper integration
[ ] Monitor performance

Estimate: 4-5 hours
```

#### 3.3 Other Services
```
sessionManagementService, importService, etc.
Estimate: 2-3 hours each
```

---

### Phase 4: Component Migration (1 week)

**Goal:** Remove direct DB access from UI components

#### 4.1 SettingsModal.tsx
```
Current: 2177 LOC with direct DB access (anti-pattern)

Tasks:
[ ] Move DB operations to settingsSlice
[ ] SettingsModal only dispatches store actions
[ ] Remove direct indexedDBService imports
[ ] Test settings save/load
[ ] Monitor

Estimate: 3-4 hours
```

---

### Phase 5: Adapter Deprecation (1 week)

**Goal:** Remove adapters/repo/* wrappers

#### 5.1 Assess Need
```
Tasks:
[ ] Check if anything still uses adapters/repo/*
[ ] If yes, migrate those callers
[ ] If no, delete adapter files
[ ] Update imports

Estimate: 2-4 hours
```

---

### Phase 6: Legacy Retirement (1 week)

**Goal:** Delete services/indexeddb.ts

#### 6.1 Verify No Remaining Deps
```
Tasks:
[ ] grep -r "indexedDBService" (should only find legacy/*, db/*, tests/*)
[ ] Confirm all operations in services/db/operations/* are independent
[ ] Run full test suite
[ ] Monitor production for 1 week
```

#### 6.2 Turn into Re-Export Shim
```typescript
// services/indexeddb.ts (temporary compatibility)
export { ChapterOps as chapterOps } from './db/operations/chapters';
export { TranslationOps as translationOps } from './db/operations/translations';
// ... etc

// Or direct re-export:
export const indexedDBService = {
  storeChapter: ChapterOps.store,
  getChapter: ChapterOps.getByUrl,
  // ... etc
};
```

#### 6.3 Final Deletion
```
Tasks:
[ ] Delete services/indexeddb.ts (3191 lines removed!)
[ ] Delete legacy/indexeddb-compat.ts
[ ] Update all remaining imports
[ ] Update documentation
[ ] Celebrate 🎉

Estimate: 1-2 hours
```

---

## Refactoring Roadmap (Other Monoliths)

### Corrected Line Counts (Actual 2025-10-19)

```
CRITICAL (>1500 LOC):
├── services/indexeddb.ts → 3,191 LOC (migration in progress)
├── components/SettingsModal.tsx → 2,177 LOC (needs tab extraction)
├── components/ChapterView.tsx → 1,787 LOC (needs component split)
└── services/epubService.ts → 1,653 LOC (generators exist, needs assembly)

HIGH (>800 LOC):
├── services/aiService.ts → 1,285 LOC (adapters exist, needs utils extraction)
├── store/slices/imageSlice.ts → 904 LOC (needs sub-slice split)
├── store/slices/translationsSlice.ts → 884 LOC (needs sub-slice split)
└── store/slices/chaptersSlice.ts → 768 LOC (within reason, low priority)

MEDIUM (>600 LOC):
├── services/imageService.ts → 701 LOC (provider split)
├── services/translationService.ts → 697 LOC (orchestration + validation)
├── services/navigationService.ts → 661 LOC (scraper + history)
└── components/SessionInfo.tsx → 639 LOC (info display + actions)
```

---

### components/SettingsModal.tsx (2177 LOC)

**Target Structure:**
```
components/settings/
├── SettingsModal.tsx (~150 LOC) - Tab wrapper, save/cancel
├── tabs/
│   ├── GeneralTab.tsx (~200 LOC)
│   ├── TranslationTab.tsx (~200 LOC)
│   ├── ImageGenerationTab.tsx (~250 LOC)
│   ├── EpubExportTab.tsx (~200 LOC)
│   ├── ApiKeysTab.tsx (~200 LOC)
│   ├── AdvancedTab.tsx (~200 LOC)
│   ├── AudioTab.tsx (~150 LOC)
│   └── MemoryDiagnosticsTab.tsx (~200 LOC)
└── shared/
    ├── SettingField.tsx (~50 LOC)
    ├── SliderInput.tsx (~50 LOC)
    ├── ApiKeyInput.tsx (~100 LOC)
    └── ModelSelector.tsx (~150 LOC)
```

**Migration Steps:**
1. Create `components/settings/` directory
2. Extract GeneralTab first (least dependencies)
3. Extract shared components as needed
4. Extract remaining tabs one by one
5. Refactor SettingsModal to use tabs

**Estimate:** 12-16 hours

---

### components/ChapterView.tsx (1787 LOC)

**Target Structure:**
```
components/chapter/
├── ChapterView.tsx (~200 LOC) - Main container
├── content/
│   ├── ChapterContent.tsx (~200 LOC)
│   ├── TextSelectionHandler.tsx (~150 LOC)
│   └── InlineEditor.tsx (~150 LOC)
├── annotations/
│   ├── FootnoteDisplay.tsx (~150 LOC)
│   ├── IllustrationDisplay.tsx (~200 LOC)
│   └── ComparisonView.tsx (~200 LOC)
├── toolbar/
│   ├── FloatingToolbar.tsx (~150 LOC)
│   └── FeedbackButtons.tsx (~100 LOC)
└── versions/
    └── TranslationVersionSelector.tsx (~100 LOC)
```

**Migration Strategy:**
- Start with most isolated features (diff gutter, comparison pane)
- Keep live diff work safe
- Extract in controlled increments

**Estimate:** 16-20 hours

---

### services/epubService.ts (1653 LOC)

**Current State:**
- `services/epub/templates/**` exists
- Core generator still monolithic

**Target Structure:**
```
services/epub/
├── EpubService.ts (~200 LOC) - Orchestrator
├── generators/
│   ├── TocGenerator.ts (~150 LOC) ← Start here
│   ├── MetadataGenerator.ts (~100 LOC)
│   ├── ChapterGenerator.ts (~200 LOC) ← Then this
│   ├── StatisticsGenerator.ts (~200 LOC)
│   └── StyleGenerator.ts (~150 LOC)
├── sanitizers/
│   ├── HtmlSanitizer.ts (~200 LOC)
│   └── ImageAssetResolver.ts (~200 LOC)
└── packagers/
    ├── ZipPackager.ts (~150 LOC)
    └── MimeTypeGenerator.ts (~50 LOC)
```

**Migration Steps:**
1. Extract TocGenerator (pure function, easy to test)
2. Extract ChapterGenerator
3. Extract remaining generators
4. Extract sanitizers/packagers
5. Refactor EpubService as pipeline orchestrator

**Estimate:** 12-16 hours

---

### services/aiService.ts (1285 LOC)

**Current State:**
- Provider adapters exist: `adapters/providers/*`
- Shared mechanics need extraction

**Target Structure:**
```
services/ai/
├── AiService.ts (~200 LOC) - Facade
├── utils/
│   ├── ApiKeyValidator.ts (~100 LOC)
│   ├── CostCalculator.ts (~150 LOC)
│   ├── ErrorHandler.ts (~150 LOC)
│   └── ResponseParser.ts (~150 LOC)
└── telemetry/
    └── TelemetryCollector.ts (~150 LOC)
```

**Migration Steps:**
1. Extract ApiKeyValidator
2. Extract CostCalculator
3. Extract ErrorHandler + retry logic
4. Extract ResponseParser
5. Refactor AiService to use utils

**Estimate:** 10-12 hours

---

## Success Metrics

### Before Migration
- Files >1000 LOC: 6
- Files >500 LOC: 14
- Average service size: ~450 LOC
- AI review success rate: ~40%
- Direct DB calls from UI: Yes (anti-pattern)
- Independent testing: Impossible (coupled to monolith)

### After Phase 1 (DB Ops)
- services/indexeddb.ts reduced to facade
- services/db/operations/* fully independent
- Store slices use clean DB API
- Shadow validation proves correctness

### After All Phases
- Files >1000 LOC: 0
- Files >500 LOC: 0
- Average service size: ~175 LOC
- AI review success rate: ~95%
- Direct DB calls from UI: No (proper architecture)
- Independent testing: Yes (mockable services)
- Total lines reduced: ~5000 LOC eliminated via deduplication

---

## Process Guidelines

### Incremental Migration (One Domain per PR)
- ✅ Safer than big bang
- ✅ Easier code review
- ✅ Reduces merge conflicts
- ✅ Allows rollback if issues found

### Keep Legacy Facade Active
- Don't delete `services/indexeddb.ts` until last consumer gone
- Use as compatibility shim during transition
- Remove only when grep shows no remaining deps

### Test During Extraction
- Port tests to new module immediately
- Don't wait until end to validate
- Use shadow helpers (`services/db/migration/shadow-validator.ts`)
- Compare legacy vs. new results during rollout

### Shadow Validation Pattern
```typescript
// Example from shadow-validator.ts pattern
const legacyResult = await indexedDBService.storeChapter(chapter);
const newResult = await ChapterOps.store(chapter);

if (!deepEqual(legacyResult, newResult)) {
  logDivergence('storeChapter', { legacy, new });
}
```

---

## Next Immediate Actions

### Week 1: ChapterOps + TranslationOps
1. Implement ChapterOps with direct IndexedDB (3-4 hours)
2. Implement TranslationOps with direct IndexedDB (4-5 hours)
3. Add tests and shadow validation (2-3 hours)
4. **PR #1:** Independent DB operations

### Week 2: Store Slices Migration
1. Migrate translationsSlice.ts (6-8 hours)
2. Migrate chaptersSlice.ts (6-8 hours)
3. **PR #2:** Store uses new DB ops

### Week 3: Settings Infrastructure
1. Extract SettingsOps (2 hours)
2. Migrate SettingsModal to use store (3-4 hours)
3. **PR #3:** Settings infrastructure

### Week 4-6: Continue with remaining operations and services

---

## Questions & Decisions Needed

1. **Shadow Validation:** Enable for all operations during Phase 1?
2. **Breaking Changes:** Any backwards compatibility concerns?
3. **Performance:** Should we benchmark before/after?
4. **Rollout Strategy:** Feature flag for new DB path?
5. **Test Coverage:** Minimum coverage % before migration?

---

**Status:** Ready to begin Phase 1 - ChapterOps Implementation
**Owner:** TBD
**Timeline:** 8-12 weeks for complete migration
**Risk Level:** Medium (incremental approach mitigates)

---

**Last Updated:** 2025-10-19
**Next Review:** After Phase 1 completion
