# ADR-002: Atomic Transaction Boundaries for Critical User Actions

**Date:** 2025-01-13  
**Status:** Proposed  
**Authors:** Development Team  
**Depends on:** ADR-001 (Service Decomposition)

## Context

### User Action Analysis (January 2025)
Based on business requirements, we identified 8 critical user actions that require specific atomicity guarantees:

1. **Next Chapter Navigation** - Either cache hit (read-only) or scrape & persist new content
2. **Translation Toggle** - Generate translation, update metadata, display results  
3. **Image Generation** - Create image from prompt, store blob, associate with translation
4. **Emoji Feedback** - Record user feedback on text selection, potentially trigger downstream actions
5. **Export JSON** - Snapshot all session data across stores
6. **Import Session** - Restore all data from JSON backup
7. **Delete Version** - Remove translation version and all dependent data (images, feedback)
8. **Export EPUB** - Generate book format from active translations and images

### Current Problems (January 2025)
- **Unclear Atomicity**: No explicit transaction boundaries defined
- **Inconsistent State**: Partial failures can leave data in inconsistent states
- **Performance Impact**: Overly broad transactions block concurrent access
- **Concurrency Issues**: 2-4 browser tabs accessing same data without coordination

### IndexedDB Constraints
- **Transaction Scope**: Must declare all object stores upfront
- **Read-Write Limits**: Only one read-write transaction per store at a time
- **Auto-Commit**: Transactions auto-commit when microtask queue empties
- **No Nested Transactions**: Cannot start transaction within another transaction

## Decision

**Define explicit atomic transaction boundaries for each critical user action, optimizing for critical path performance while ensuring data consistency.**

### Transaction Boundaries by Action

#### 1. Next Chapter Navigation
```typescript
// Cache Hit: No transaction needed
async nextChapterCacheHit(chapterId: string): Promise<void> {
  // Read-only operations: chapters, translations
  // No atomicity required - display cached data
}

// Cache Miss: Atomic write of scraped content
async nextChapterScrape(url: string): Promise<void> {
  await tx(['chapters', 'translations', 'url_mappings'], 'readwrite', async (tx) => {
    const chapterData = await scrapeChapter(url);
    await chaptersService.put(chapterData.chapter, tx);
    await translationsService.put(chapterData.rawTranslation, tx);
    await urlMappingsService.put({ source_url: url, chapter_id: chapterData.chapter.chapter_id }, tx);
  });
  // Background: metrics, indexing (separate async operations)
}
```

#### 2. Translation Toggle (Critical Path)
```typescript
async generateTranslation(chapterId: string, settings: TranslationSettings): Promise<void> {
  const translationResult = await translateChapter(chapterId, settings); // API call outside tx
  
  await tx(['chapters', 'translations'], 'readwrite', async (tx) => {
    // Write new translation
    await translationsService.put(translationResult.translation, tx);
    
    // Update chapter metadata  
    const chapter = await chaptersService.get(chapterId, tx);
    chapter.latest_version = Math.max(chapter.latest_version ?? 0, translationResult.translation.version_no);
    chapter.active_language_map = { 
      ...chapter.active_language_map, 
      [translationResult.translation.language]: translationResult.translation.version_no 
    };
    await chaptersService.put(chapter, tx);
  });
  
  // Background: cost tracking, metrics (separate)
  await metricsService.recordTranslation(translationResult.meta);
}
```

#### 3. Image Generation (Non-Blocking)
```typescript
async generateImage(prompt: ImagePrompt): Promise<void> {
  const imageBlob = await generateImageFromPrompt(prompt); // API call outside tx
  
  // Single-store transaction - no coordination needed
  await tx(['images'], 'readwrite', async (tx) => {
    await imagesService.put({
      image_id: generateId(),
      chapter_id: prompt.chapter_id,
      translation_id: prompt.translation_id,
      kind: prompt.kind,
      prompt: prompt.text,
      negative: prompt.negative,
      steering_ref: prompt.steering_ref,
      blob: imageBlob,
      createdAt: new Date().toISOString()
    }, tx);
  });
  
  // Optional: Update translation reference (separate tx)
  if (prompt.updateTranslationRef) {
    await updateTranslationImageRef(prompt.translation_id, imageId);
  }
}
```

#### 4. Emoji Feedback (Simple + Chained Actions)
```typescript
// Simple feedback: Single store, always atomic
async recordFeedback(feedback: FeedbackInput): Promise<void> {
  await tx(['feedback'], 'readwrite', async (tx) => {
    await feedbackService.put({
      feedback_id: generateId(),
      translation_id: feedback.translation_id,
      span: feedback.span,
      type: feedback.type,
      payload: feedback.payload,
      createdAt: new Date().toISOString()
    }, tx);
  });
}

// Chained actions: Separate transactions for downstream effects
async handlePaintEmoji(feedback: FeedbackInput): Promise<void> {
  // 1. Record feedback (atomic)
  await recordFeedback(feedback);
  
  // 2. Generate illustration prompt (separate operation)
  const prompt = await generateIllustrationPrompt(feedback.selection);
  
  // 3. Create image (separate atomic operation)
  await generateImage(prompt);
}

async handleQuestionEmoji(feedback: FeedbackInput): Promise<void> {
  // 1. Record feedback (atomic)  
  await recordFeedback(feedback);
  
  // 2. Generate explanation (separate operation)
  const explanation = await requestExplanation(feedback.selection);
  
  // 3. Add footnote to translation (separate atomic operation)
  await addFootnoteToTranslation(feedback.translation_id, explanation);
}
```

#### 5. Export JSON (Read-Only Snapshot)
```typescript
async exportSession(): Promise<SessionExport> {
  // No transaction needed - eventual consistency acceptable
  // Read each store independently for point-in-time snapshot
  const [novels, chapters, translations, images, feedback, prompts, settings] = await Promise.all([
    novelsService.getAll(),
    chaptersService.getAll(),
    translationsService.getAll(),
    imagesService.getAll(),
    feedbackService.getAll(),
    promptsService.getAll(),
    settingsService.getAll()
  ]);
  
  return {
    exported_at: new Date().toISOString(),
    novels, chapters, translations, images, feedback, prompts, settings
  };
}
```

#### 6. Import Session (Chunked Atomic Batches)
```typescript
async importSession(sessionData: SessionExport): Promise<void> {
  // Validate data first (outside transaction)
  const validation = validateSessionData(sessionData);
  if (!validation.valid) throw new Error('Invalid session data');
  
  // Clear existing data (atomic)
  await clearAllStores();
  
  // Import in chunks to avoid long-running transactions
  const CHUNK_SIZE = 500;
  const allStores = ['novels', 'chapters', 'translations', 'images', 'feedback', 'prompts', 'settings'];
  
  for (const [storeName, records] of Object.entries(sessionData)) {
    if (storeName === 'exported_at') continue;
    
    const chunks = chunkArray(records, CHUNK_SIZE);
    for (const chunk of chunks) {
      await tx([storeName], 'readwrite', async (tx) => {
        for (const record of chunk) {
          await getServiceForStore(storeName).put(record, tx);
        }
      });
    }
  }
  
  // Rebuild indexes and validate integrity
  await rebuildIndexes();
  await validateDataIntegrity();
}
```

#### 7. Delete Version (Cascade Delete)
```typescript
async deleteVersion(translationId: string): Promise<void> {
  await tx(['translations', 'images', 'feedback', 'chapters'], 'readwrite', async (tx) => {
    // 1. Get translation details before deletion
    const translation = await translationsService.get(translationId, tx);
    if (!translation) throw new Error('Translation not found');
    
    // 2. Cascade delete dependents
    await imagesService.deleteByTranslationId(translationId, tx);
    await feedbackService.deleteByTranslationId(translationId, tx);
    
    // 3. Delete the translation
    await translationsService.delete(translationId, tx);
    
    // 4. Update chapter metadata if this was the active version
    const chapter = await chaptersService.get(translation.chapter_id, tx);
    const remainingVersions = await translationsService.listByChapter(translation.chapter_id, tx);
    
    if (remainingVersions.length === 0) {
      // No versions left
      chapter.latest_version = null;
      chapter.active_language_map = {};
    } else {
      // Recompute latest version
      const maxVersion = Math.max(...remainingVersions.map(t => t.version_no));
      chapter.latest_version = maxVersion;
      
      // Remove from active map if this was active
      if (chapter.active_language_map?.[translation.language] === translation.version_no) {
        delete chapter.active_language_map[translation.language];
      }
    }
    
    await chaptersService.put(chapter, tx);
  });
}
```

#### 8. Export EPUB (Read-Only)
```typescript
async exportEpub(options: EpubOptions): Promise<Blob> {
  // Read-only operations - no transaction needed
  const activeChapters = await getActiveChapters(options.novelId);
  const epubData = await generateEpubFromChapters(activeChapters);
  return epubData;
}
```

## Rationale

### Transaction Design Principles

1. **Minimize Critical Path Latency**
   - Keep API calls (translation, image generation) outside transactions
   - Only include database writes in atomic blocks
   - Background operations (metrics, indexing) run separately

2. **Clear Atomicity Boundaries**
   - Each user action has explicit success/failure semantics
   - Partial failures leave system in consistent state
   - Cascade operations are explicit and predictable

3. **Concurrency Optimization**
   - Single-store operations when possible (images, feedback)
   - Multi-store transactions only when atomicity required
   - Read-only operations avoid blocking writes

4. **IndexedDB Best Practices**
   - Declare all required stores upfront
   - Keep transactions short to avoid auto-commit issues
   - Use appropriate transaction modes (readonly vs readwrite)

### Performance Considerations

#### Critical Path Optimization
- **Next Chapter (cache hit)**: 0 database writes - pure read performance
- **Translation Toggle**: Single atomic write after API response
- **Image Generation**: Non-blocking - UI can show placeholder while storing

#### Concurrency Management
- **BroadcastChannel**: Notify other tabs of data changes
- **Optimistic UI**: Show updates immediately, handle conflicts on refresh
- **Lock-Free Reads**: Export and read operations don't block writes

#### Transaction Sizing
- **Small Atomic Units**: Each transaction focused on single business operation  
- **Chunked Imports**: Large datasets processed in manageable batches
- **Background Processing**: Non-critical operations moved off critical path

## Implementation Strategy

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

### Orchestration Services
```typescript
// High-level business operations that coordinate multiple services
export class ChapterNavigationService {
  async navigateToNext(currentChapterId: string): Promise<NavigationResult> {
    const nextChapter = await this.findNextChapter(currentChapterId);
    
    if (nextChapter.cached) {
      return await this.nextChapterCacheHit(nextChapter.id);
    } else {
      return await this.nextChapterScrape(nextChapter.url);
    }
  }
}

export class VersionManagementService {
  async createNewTranslation(request: TranslationRequest): Promise<Translation> {
    return await this.generateTranslation(request.chapterId, request.settings);
  }
  
  async deleteTranslationVersion(translationId: string): Promise<void> {
    return await this.deleteVersion(translationId);
  }
}
```

### Error Handling Strategy
```typescript
export class TransactionError extends Error {
  constructor(
    message: string,
    public readonly stores: string[],
    public readonly operation: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}

// Automatic retry for recoverable errors
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }
      await delay(attempt * 100); // Exponential backoff
    }
  }
  throw new Error('Unreachable');
}
```

## Success Metrics

### Performance Targets
- **Critical Path Operations**: <200ms P95 (translation toggle, chapter navigation)
- **Non-Critical Operations**: <2s P95 (image generation, export)
- **Concurrent Access**: No data corruption with 4 simultaneous tabs

### Data Consistency
- **Zero Partial States**: No operations leave data in inconsistent state
- **Referential Integrity**: All foreign key relationships maintained
- **Version Coherence**: Chapter metadata always reflects actual translation versions

### Developer Experience  
- **Clear Contracts**: Each atomic operation has explicit pre/post conditions
- **Testable Units**: Each transaction boundary can be tested independently
- **Error Transparency**: Transaction failures provide actionable error messages

## Consequences

### Positive Outcomes
1. **Predictable Behavior**: Clear success/failure semantics for all user actions
2. **Performance Optimization**: Critical path operations minimize database overhead
3. **Concurrent Safety**: Multiple tabs can operate without data corruption
4. **Testing Simplicity**: Atomic boundaries create natural test boundaries

### Trade-offs
1. **Complexity**: More granular transaction management increases implementation complexity
2. **Coordination**: Multi-store operations require careful orchestration
3. **Error Handling**: More failure modes need explicit handling strategies

### Follow-up Requirements
- **Invariant Testing**: Validate data consistency after each atomic operation
- **Performance Monitoring**: Track actual transaction latency vs. targets  
- **Concurrency Testing**: Verify behavior with simultaneous operations across tabs

## Review Schedule

- **Month 1**: Measure actual performance vs. target latencies
- **Month 3**: Evaluate error rates and recovery patterns  
- **Month 6**: Assess impact on concurrent user experience and data consistency