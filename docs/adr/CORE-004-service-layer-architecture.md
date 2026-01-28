# CORE-004: Service Layer Architecture with Transaction Injection

**Date:** 2025-01-13
**Status:** Proposed
**Authors:** Development Team
**Depends on:** DB-001 (Service Decomposition), DB-002 (Atomic Transactions)

## Context

### Transaction Coordination Challenge (January 2025)
Based on the service decomposition in DB-001 and atomic operation boundaries in DB-002, we need an architecture that enables:

- **Multi-Store Atomicity**: Critical user actions span multiple IndexedDB stores (e.g., translation toggle affects both `translations` and `chapters` stores)
- **Service Boundaries**: Each domain service owns a single store but must participate in cross-store transactions
- **Loose Coupling**: Services should not directly depend on each other
- **Testing Isolation**: Each service must be unit testable with mock transactions

### Current Architecture Problems (January 2025)
- **Tight Coupling**: Monolithic `indexedDBService` handles all cross-store logic internally
- **Transaction Leakage**: Transaction management scattered across business logic
- **Testing Difficulty**: Cannot test individual services in isolation
- **Code Duplication**: Transaction boilerplate repeated across operations

### IndexedDB Transaction Constraints
- **Upfront Declaration**: Must declare all required stores when creating transaction
- **Single Writer**: Only one readwrite transaction per store at a time
- **Auto-Commit**: Transactions automatically commit when microtask queue empties
- **No Nesting**: Cannot create new transactions within existing transaction scope

## Decision

**Implement Service Layer Architecture with Optional Transaction Injection using the UnitOfWork pattern.**

### Core Principles

1. **Optional Transaction Parameter**: Every service method accepts `tx?: Tx` parameter
2. **UnitOfWork Orchestration**: High-level operations manage transaction lifecycle
3. **Service Composition**: Services remain ignorant of each other but composable via transactions
4. **Clean Boundaries**: Clear separation between domain services and orchestration logic

## Architecture Design

### Transaction Service Interface
```typescript
export interface TransactionService {
  execute<T>(
    stores: string[],
    mode: IDBTransactionMode,
    operation: (tx: Tx) => Promise<T>
  ): Promise<T>;
  
  // Convenience methods for common patterns
  singleStore<T>(store: string, operation: (tx: Tx) => Promise<T>): Promise<T>;
  readOnly<T>(stores: string[], operation: (tx: Tx) => Promise<T>): Promise<T>;
  
  // Batch operations for imports
  batch<T>(
    store: string,
    items: T[],
    chunkSize: number,
    operation: (items: T[], tx: Tx) => Promise<void>
  ): Promise<void>;
}
```

### Enhanced Transaction Type
```typescript
export type Tx = IDBTransaction & {
  stores: Record<string, IDBObjectStore>;
  metadata: {
    startTime: number;
    storeNames: string[];
    mode: IDBTransactionMode;
    operationId: string;
  };
};

export function createTx(
  db: IDBDatabase,
  storeNames: string[],
  mode: IDBTransactionMode,
  operationId: string
): Tx {
  const tx = db.transaction(storeNames, mode) as Tx;
  tx.stores = Object.fromEntries(storeNames.map(name => [name, tx.objectStore(name)]));
  tx.metadata = {
    startTime: Date.now(),
    storeNames,
    mode,
    operationId
  };
  return tx;
}
```

### Domain Service Pattern
```typescript
// Each domain service follows this contract
export interface BaseDataService<T> {
  get(id: string, tx?: Tx): Promise<T | undefined>;
  put(item: T, tx?: Tx): Promise<void>;
  delete(id: string, tx?: Tx): Promise<void>;
  list(tx?: Tx): Promise<T[]>;
}

// Example: ChapterDataService implementation
export interface ChapterDataService extends BaseDataService<Chapter> {
  listByNovel(novelId: string, tx?: Tx): Promise<Chapter[]>;
  updateMetadata(chapterId: string, updates: Partial<Chapter>, tx?: Tx): Promise<void>;
}

export const createChapterService = (db: IDBDatabase): ChapterDataService => ({
  async get(chapterId: string, tx?: Tx): Promise<Chapter | undefined> {
    const store = tx ? tx.stores['chapters'] : 
      db.transaction(['chapters'], 'readonly').objectStore('chapters');
    return await promisify(store.get(chapterId));
  },

  async put(chapter: Chapter, tx?: Tx): Promise<void> {
    const store = tx ? tx.stores['chapters'] :
      db.transaction(['chapters'], 'readwrite').objectStore('chapters');
    await promisify(store.put(chapter));
  },

  async delete(chapterId: string, tx?: Tx): Promise<void> {
    const store = tx ? tx.stores['chapters'] :
      db.transaction(['chapters'], 'readwrite').objectStore('chapters');
    await promisify(store.delete(chapterId));
  },

  async list(tx?: Tx): Promise<Chapter[]> {
    const store = tx ? tx.stores['chapters'] :
      db.transaction(['chapters'], 'readonly').objectStore('chapters');
    return await promisify(store.getAll());
  },

  async listByNovel(novelId: string, tx?: Tx): Promise<Chapter[]> {
    const store = tx ? tx.stores['chapters'] :
      db.transaction(['chapters'], 'readonly').objectStore('chapters');
    const index = store.index('by_novel_index');
    return await promisify(index.getAll(IDBKeyRange.bound([novelId, 0], [novelId, Infinity])));
  },

  async updateMetadata(chapterId: string, updates: Partial<Chapter>, tx?: Tx): Promise<void> {
    const existingChapter = await this.get(chapterId, tx);
    if (!existingChapter) throw new Error(`Chapter ${chapterId} not found`);
    
    const updatedChapter = { ...existingChapter, ...updates };
    await this.put(updatedChapter, tx);
  }
});
```

### Orchestration Services Pattern
```typescript
// High-level business operations that coordinate multiple services
export class ChapterNavigationOrchestrator {
  constructor(
    private db: IDBDatabase,
    private transactionService: TransactionService,
    private chapterService: ChapterDataService,
    private translationService: TranslationDataService,
    private urlMappingService: UrlMappingDataService
  ) {}

  async navigateToNext(currentChapterId: string): Promise<NavigationResult> {
    const nextChapter = await this.findNextChapter(currentChapterId);
    
    if (nextChapter.cached) {
      return await this.nextChapterCacheHit(nextChapter.id);
    } else {
      return await this.nextChapterScrape(nextChapter.url);
    }
  }

  private async nextChapterCacheHit(chapterId: string): Promise<NavigationResult> {
    // Read-only operation - no transaction needed
    const [chapter, translations] = await Promise.all([
      this.chapterService.get(chapterId),
      this.translationService.listByChapter(chapterId)
    ]);
    
    return { chapter, translations, fromCache: true };
  }

  private async nextChapterScrape(url: string): Promise<NavigationResult> {
    // Atomic write of scraped content
    return await this.transactionService.execute(
      ['chapters', 'translations', 'url_mappings'],
      'readwrite',
      async (tx) => {
        const chapterData = await scrapeChapter(url);
        
        await this.chapterService.put(chapterData.chapter, tx);
        await this.translationService.put(chapterData.rawTranslation, tx);
        await this.urlMappingService.put({
          source_url: url,
          chapter_id: chapterData.chapter.chapter_id
        }, tx);
        
        return {
          chapter: chapterData.chapter,
          translations: [chapterData.rawTranslation],
          fromCache: false
        };
      }
    );
  }
}

// Translation management orchestrator
export class TranslationOrchestrator {
  constructor(
    private transactionService: TransactionService,
    private chapterService: ChapterDataService,
    private translationService: TranslationDataService
  ) {}

  async generateTranslation(
    chapterId: string,
    settings: TranslationSettings
  ): Promise<Translation> {
    // API call outside transaction for performance
    const translationResult = await translateChapter(chapterId, settings);
    
    // Atomic write to database
    return await this.transactionService.execute(
      ['chapters', 'translations'],
      'readwrite',
      async (tx) => {
        // Write new translation
        await this.translationService.put(translationResult.translation, tx);
        
        // Update chapter metadata
        const chapter = await this.chapterService.get(chapterId, tx);
        if (!chapter) throw new Error(`Chapter ${chapterId} not found`);
        
        const updatedChapter = {
          ...chapter,
          latest_version: Math.max(
            chapter.latest_version ?? 0,
            translationResult.translation.version_no
          ),
          active_language_map: {
            ...chapter.active_language_map,
            [translationResult.translation.language]: translationResult.translation.version_no
          }
        };
        
        await this.chapterService.put(updatedChapter, tx);
        
        return translationResult.translation;
      }
    );
  }
}
```

### Service Factory Pattern
```typescript
// Service composition with dependency injection
export interface DatabaseServices {
  chapters: ChapterDataService;
  translations: TranslationDataService;
  images: ImageDataService;
  feedback: FeedbackDataService;
  prompts: PromptDataService;
  settings: SettingsDataService;
  novels: NovelDataService;
  urlMappings: UrlMappingDataService;
}

export interface Orchestrators {
  chapterNavigation: ChapterNavigationOrchestrator;
  translationManagement: TranslationOrchestrator;
  versionManagement: VersionManagementOrchestrator;
  exportImport: ExportImportOrchestrator;
}

export function createDatabaseServices(db: IDBDatabase): DatabaseServices {
  return {
    chapters: createChapterService(db),
    translations: createTranslationService(db),
    images: createImageService(db),
    feedback: createFeedbackService(db),
    prompts: createPromptService(db),
    settings: createSettingsService(db),
    novels: createNovelService(db),
    urlMappings: createUrlMappingService(db)
  };
}

export function createOrchestrators(
  db: IDBDatabase,
  services: DatabaseServices
): Orchestrators {
  const transactionService = createTransactionService(db);
  
  return {
    chapterNavigation: new ChapterNavigationOrchestrator(
      db,
      transactionService,
      services.chapters,
      services.translations,
      services.urlMappings
    ),
    translationManagement: new TranslationOrchestrator(
      transactionService,
      services.chapters,
      services.translations
    ),
    versionManagement: new VersionManagementOrchestrator(
      transactionService,
      services.chapters,
      services.translations,
      services.images,
      services.feedback
    ),
    exportImport: new ExportImportOrchestrator(
      transactionService,
      services
    )
  };
}
```

## Rationale

### Design Principles

1. **Inversion of Control**
   - Services don't create their own transactions
   - Orchestrators manage transaction lifecycle
   - Services remain focused on single-store operations

2. **Composability**
   - Services can be composed in any combination
   - Transaction boundaries defined at orchestration level
   - Clear separation between data access and business logic

3. **Testability**
   - Services can be tested with mock transactions
   - Orchestrators can be tested with mock services
   - Clear dependency injection points

4. **Performance Optimization**
   - External API calls kept outside transaction scope
   - Minimal transaction duration for critical path
   - Optional transaction parameter avoids overhead for single operations

### Advantages

1. **Clear Boundaries**: Each layer has well-defined responsibilities
2. **Flexible Composition**: Can combine services in different ways for different operations
3. **Testing Isolation**: Each service and orchestrator can be tested independently
4. **Performance Control**: Transaction scope is explicit and optimizable
5. **Migration Safety**: Can gradually migrate from monolithic service

### Trade-offs

1. **Increased Complexity**: More layers and interfaces to manage
2. **Parameter Threading**: Need to pass transaction parameter through call chains
3. **Coordination Overhead**: Orchestrators add indirection for simple operations

## Implementation Strategy

### Phase 1: Core Infrastructure (Week 1)
```typescript
// 1. Implement base transaction service
export class TransactionServiceImpl implements TransactionService {
  constructor(private db: IDBDatabase) {}

  async execute<T>(
    stores: string[],
    mode: IDBTransactionMode,
    operation: (tx: Tx) => Promise<T>
  ): Promise<T> {
    const operationId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tx = createTx(this.db, stores, mode, operationId);
    
    try {
      const result = await operation(tx);
      await this.commitTransaction(tx);
      this.logTransactionSuccess(tx, result);
      return result;
    } catch (error) {
      await this.rollbackTransaction(tx);
      this.logTransactionError(tx, error);
      throw error;
    }
  }
  
  // Implementation of convenience methods...
}

// 2. Create base service interfaces and factories
// 3. Implement transaction lifecycle helpers
```

### Phase 2: Domain Services (Week 2)
```typescript
// Extract each domain service following the pattern:
// 1. Define TypeScript interface
// 2. Implement with optional transaction parameter
// 3. Create factory function
// 4. Add comprehensive tests with fake-indexeddb
```

### Phase 3: Orchestration Layer (Week 3)
```typescript
// Implement orchestrators for critical user actions:
// 1. ChapterNavigationOrchestrator
// 2. TranslationOrchestrator  
// 3. VersionManagementOrchestrator
// 4. ExportImportOrchestrator
```

### Phase 4: Migration & Integration (Week 4)
```typescript
// Gradual migration strategy:
// 1. Update repository adapters to use new services
// 2. Replace monolithic service calls one by one
// 3. Add integration tests
// 4. Performance validation
```

## Error Handling Strategy

### Transaction Error Types
```typescript
export enum TransactionErrorType {
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',
  STORAGE_EXCEEDED = 'STORAGE_EXCEEDED',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class TransactionError extends Error {
  constructor(
    message: string,
    public readonly type: TransactionErrorType,
    public readonly stores: string[],
    public readonly operationId: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}
```

### Retry Strategy
```typescript
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries: number;
    backoffMs: number;
    retryableErrors: TransactionErrorType[];
  }
): Promise<T> {
  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (
        attempt === options.maxRetries ||
        !isRetryableError(error, options.retryableErrors)
      ) {
        throw error;
      }
      await delay(options.backoffMs * Math.pow(2, attempt - 1));
    }
  }
  throw new Error('Unreachable');
}
```

## Success Metrics

### Performance Targets
- **Critical Path Operations**: P95 < 200ms (translation toggle, chapter navigation)
- **Transaction Duration**: P95 < 50ms for multi-store operations
- **Service Isolation**: Each service testable independently with <10ms mock operations

### Code Quality Metrics
- **Service Size**: All domain services ≤ 200 LOC
- **Test Coverage**: >90% coverage for all services and orchestrators
- **Dependency Clarity**: No circular dependencies between services

### Migration Success
- **Backward Compatibility**: Existing functionality unchanged during migration
- **Performance Parity**: No degradation in critical path timing
- **Error Handling**: Comprehensive error recovery and retry mechanisms

## Consequences

### Positive Outcomes
1. **Modular Testing**: Each service can be tested in isolation with mock transactions
2. **Clear Contracts**: Explicit interfaces for all data access operations
3. **Flexible Composition**: Services can be combined for different business operations
4. **Performance Control**: Transaction scope is explicit and optimizable
5. **Migration Safety**: Gradual replacement of monolithic service

### Trade-offs and Challenges
1. **Increased Complexity**: More layers and interfaces to understand
2. **Parameter Threading**: Transaction parameter needs to flow through call chains  
3. **Learning Curve**: Team needs to understand UnitOfWork pattern and service composition
4. **Debugging Complexity**: Multi-layer architecture can make debugging more complex

### Follow-up Requirements
- **CORE-005**: Agent-First Code Organization Standards (file structure, naming conventions)
- **CORE-006**: Tree-Shakeable Service Architecture (bundle optimization, lazy loading)
- **Migration Guide**: Step-by-step process for replacing monolithic service calls
- **Testing Strategy Document**: Comprehensive testing approaches for each layer

## Review Schedule

- **Month 1**: Evaluate service extraction completion and initial integration
- **Month 3**: Assess orchestration layer effectiveness and developer experience
- **Month 6**: Review overall architecture success and identify optimization opportunities