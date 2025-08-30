# ADR-001: Decompose Monolithic IndexedDB Service into Domain Services

**Date:** 2025-01-13  
**Status:** Proposed  
**Authors:** Development Team  
**Supersedes:** N/A  

## Context

### Current State (January 2025)
- **Monolithic Service**: `services/indexeddb.ts` contains 2,288 lines handling all database operations
- **25+ Dependencies**: Store slices, services, and repositories all depend on the monolithic `indexedDBService`
- **Mixed Concerns**: Single file contains database connection, CRUD operations, business logic, migrations, and maintenance
- **Review Burden**: 2,288-line files are difficult for human and AI code review
- **Successful Pattern**: We successfully migrated `useAppStore.ts` (2,218 lines) to slice-based architecture

### Business Requirements
- **1000+ chapters** with 5 translation versions each in production usage
- **2-4 concurrent browser tabs** accessing same data
- **Critical path operations**: Chapter navigation, translation display must be <200ms
- **Monthly schema changes** require backward compatibility
- **Agent-first maintenance**: Optimize for AI assistant code development and review

### Technical Constraints
- IndexedDB transaction limitations and concurrency requirements
- Bundle size: ≤200-250KB app shell target
- Tree-shaking capability for lazy loading
- Existing 25+ file dependencies must be migrated gradually

## Decision

**Decompose the monolithic `indexedDBService` into 8 focused domain services based on IndexedDB object stores:**

```typescript
// Domain Services (≤200 LOC each)
- ChapterDataService     → chapters store operations
- TranslationDataService → translations store operations  
- ImageDataService       → images store operations
- FeedbackDataService    → feedback store operations
- PromptDataService      → prompt_templates store operations
- SettingsDataService    → settings store operations
- NovelDataService       → novels store operations
- UrlMappingDataService  → url_mappings store operations

// Cross-Cutting Services
- ConnectionService      → database setup, connections
- TransactionService     → multi-store transaction management
- MigrationService       → schema evolution (already exists)
- MaintenanceService     → cleanup, integrity checks (already exists)
- VersioningService      → version number management, cascades
- MetricsService         → cost/time analytics
```

## Rationale

### Pros
1. **Agent-Friendly Maintenance**
   - ≤200 LOC files enable reliable AI code review and modification
   - Single-responsibility services reduce cross-coupling errors
   - Clear contracts make automated refactoring safer

2. **Improved Developer Experience**
   - Focused services are easier to understand and test
   - Clear separation of concerns reduces cognitive load
   - Domain boundaries align with business operations

3. **Better Testing**
   - Unit test individual services with fake-indexeddb
   - Integration test atomic operations across services
   - Invariant testing for data consistency rules

4. **Performance Benefits**
   - Tree-shaking eliminates unused database operations
   - Lazy loading of heavy features (EPUB export, image generation)
   - Clear transaction boundaries optimize critical paths

5. **Proven Pattern**
   - `useAppStore` migration (2,218→0 lines) was successful using slice decomposition
   - Repository pattern already abstracts database operations
   - Store slices provide clean integration points

### Cons
1. **Initial Migration Complexity**
   - 25+ files need gradual migration from monolithic service
   - Transaction coordination across services requires careful design
   - Risk of introducing bugs during decomposition

2. **Increased File Count**
   - 1 monolithic file becomes ~12 focused services
   - More imports and dependency management
   - Potential for circular dependencies

3. **Transaction Management**
   - Multi-store operations need coordination layer
   - IndexedDB transaction passing adds complexity
   - Risk of breaking atomicity guarantees

## Implementation Strategy

### Phase 1: Service Extraction (Weeks 1-2)
```typescript
// 1. Extract domain services with interfaces
export interface ChapterDataService {
  get(chapterId: string, tx?: Tx): Promise<Chapter>;
  put(chapter: Chapter, tx?: Tx): Promise<void>;
  delete(chapterId: string, tx?: Tx): Promise<void>;
  listByNovel(novelId: string, tx?: Tx): Promise<Chapter[]>;
}

// 2. Factory pattern for tree-shaking
export const createChapterService = (db: IDBDatabase): ChapterDataService => ({
  async get(chapterId: string, tx?: Tx) {
    const store = tx ? tx.stores['chapters'] : 
      db.transaction(['chapters'], 'readonly').objectStore('chapters');
    return await promisify(store.get(chapterId));
  },
  // ... other operations
});
```

### Phase 2: Transaction Coordination (Weeks 3-4)
```typescript
// UnitOfWork pattern for multi-store operations
export class TransactionService {
  constructor(private db: IDBDatabase) {}
  
  async execute<T>(
    stores: string[], 
    mode: IDBTransactionMode,
    operation: (tx: Tx) => Promise<T>
  ): Promise<T> {
    const tx = this.openTx(stores, mode);
    try {
      const result = await operation(tx);
      await this.commit(tx);
      return result;
    } catch (error) {
      await this.rollback(tx);
      throw error;
    }
  }
}
```

### Phase 3: Gradual Migration (Weeks 5-6)
- Update repository adapters to use new services
- Migrate store slices one by one
- Maintain backward compatibility during transition
- Comprehensive testing at each step

## Data Model

### Enhanced Schema (January 2025)
```typescript
// Version-centric design with explicit relationships
novels: { 
  novel_id: string, 
  title: string, 
  source: string, 
  createdAt: string 
}

chapters: { 
  chapter_id: string,
  novel_id: string, 
  index: number,
  title: string, 
  source_url: string, 
  latest_version: number, 
  active_language_map: Record<string, number>, 
  createdAt: string 
}

translations: { 
  translation_id: string,     // Stable anchor for cascades
  chapter_id: string, 
  language: string,
  version_no: number, 
  text: string, 
  meta: {
    model: string,
    settings_signature: string,  // Hash of temp, penalties, schema
    seed: number,
    system_prompt_title: string,
    cost: number,
    gen_ms: number,
    createdAt: string,
    lastViewedAt: string
  }
}

images: { 
  image_id: string,
  chapter_id: string,
  translation_id: string,     // Version-specific
  kind: 'illustration' | 'steering',
  prompt: string,
  negative?: string,
  steering_ref?: string,
  blob: Blob,
  createdAt: string 
}

feedback: { 
  feedback_id: string,
  translation_id: string,     // Version-specific
  span: { start: number, end: number },
  type: '👍' | '👎' | '?' | '🎨',
  payload: any,
  createdAt: string 
}
```

### Key Invariants
- **FK1**: Every `translations.chapter_id` exists in `chapters`
- **FK2**: Every `feedback.translation_id` and `images.translation_id` exists in `translations`
- **UNIQ**: Unique index on `(chapter_id, language, version_no)` in translations
- **LV**: `chapters.latest_version = max(version_no)` for the chapter
- **AL**: `chapters.active_language_map[lang]` points to existing translation

## Atomic Operations Mapping

### Critical Path Operations
1. **Next Chapter** (cache hit): Read-only, no transaction
2. **Next Chapter** (scrape): `Tx(chapters, translations, url_mappings)`
3. **Toggle Translation**: `Tx(chapters, translations)` 
4. **Generate Image**: `Tx(images)` only (non-blocking)
5. **Emoji Feedback**: `Tx(feedback)` (single store)
6. **Delete Version**: `Tx(translations, images, feedback, chapters)` (cascade)

### Background Operations
- Export JSON: Read-only across all stores
- Import Session: Chunked `Tx(all stores)` in batches
- Metrics computation: Read-only with optional cache writes

## Migration Path

### Backward Compatibility
1. **Gradual Replacement**: Old `indexedDBService` remains during migration
2. **Service Composition**: New `services/db/index.ts` exposes composed interface
3. **Feature Flags**: Toggle between old/new services per operation
4. **Repository Layer**: Adapters isolate consumers from service changes

### Risk Mitigation
1. **Rollback Strategy**: Git revert to previous architecture if issues
2. **A/B Testing**: Gradual rollout to subset of operations
3. **Invariant Testing**: Comprehensive data consistency checks
4. **Performance Monitoring**: Track critical path timing throughout migration

## Success Metrics

### Development Experience
- **File Size**: All database services ≤200 LOC
- **Review Time**: PR review time decreased by >50%
- **AI Assistance**: Successful AI-generated patches without human intervention

### Performance
- **Bundle Size**: App shell ≤250KB (current baseline TBD)
- **Critical Path**: P95 language switch <200ms, chapter navigation <150ms
- **Concurrent Access**: 2-4 tabs with consistent data via BroadcastChannel

### Maintainability  
- **Test Coverage**: >90% service-level test coverage
- **Schema Evolution**: Monthly migrations complete without data loss
- **Refactoring Safety**: Invariant tests prevent regression introduction

## Follow-up ADRs

This ADR triggers the need for:
- **ADR-002**: Atomic Transaction Boundaries for User Actions
- **ADR-003**: Version-Centric Data Model and Cascade Strategy  
- **ADR-004**: Service Layer Architecture with Transaction Injection
- **ADR-005**: Agent-First Code Organization Standards
- **ADR-006**: Tree-Shakeable Service Architecture

## Review Schedule

- **Month 1**: Compare actual implementation with ADR predictions
- **Month 3**: Evaluate AI maintenance effectiveness and developer experience
- **Month 6**: Performance analysis and bundle size optimization review