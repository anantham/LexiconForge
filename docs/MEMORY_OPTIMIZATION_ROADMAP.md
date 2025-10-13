# Memory Optimization Roadmap

## Executive Summary

**Problem**: Reading 600 chapters with 3 images each (1800 images × 1.5MB avg) = **2.7GB RAM**, causing browser crashes.

**Solution**: Adopt Cache API architecture (like audio) where images live on disk, only Blob URLs in RAM.

**Expected Result**: 600 chapters = **~90KB RAM for images** (Blob URLs only) + **~50MB for chapter text** = **~50MB total**

---

## Architecture Change

### Current (Broken)
```
Generate Image → base64 string → IndexedDB → Load to RAM (1.5MB/image)
                                              ↓
                                    600 chapters = 2.7GB RAM 💥
```

### Proposed (Scalable)
```
Generate Image → Blob → Cache API (browser disk)
                      ↓
              blob:// URL (50 bytes in RAM)
                      ↓
              600 chapters = 90KB RAM ✅

Export EPUB → Fetch from Cache API → Embed
View Chapter → <img src="blob://..."> → Browser loads from disk
```

---

## Implementation Checklist

### **Phase 1: Foundation (Week 1)**

#### ✅ Task 1: Create Telemetry Service
**File**: `services/telemetryService.ts`

**Requirements**:
- Capture `window.onerror` and `unhandledrejection`
- Monitor `performance.memory` every 30s, warn if >90% used
- Store last 100 events in memory
- Export via `window.exportTelemetry()` for debugging

**Acceptance Criteria**:
- [ ] Console shows `[Telemetry]` errors when unhandled exceptions occur
- [ ] Memory warnings appear when heap usage >90%
- [ ] `window.exportTelemetry()` returns JSON with session ID and events
- [ ] Events include timestamp, category, stack traces

**Testing**:
```javascript
// Trigger test error
throw new Error('Test telemetry capture');

// Check it was logged
window.exportTelemetry(); // Should include test error

// Simulate memory pressure (if Chrome DevTools)
// Check console for warning after 30s
```

---

#### ✅ Task 2: Create ImageCacheStore Service
**File**: `services/imageCacheService.ts`

**Requirements**:
- Mirror `services/audio/storage/cache.ts` structure
- Methods:
  - `storeImage(chapterId, marker, base64) → blobUrl`
  - `getImageBlobUrl(chapterId, marker) → blobUrl | null`
  - `getImageBlob(chapterId, marker) → Blob | null` (for EPUB)
  - `has(chapterId, marker) → boolean`
  - `listChapterImages(chapterId) → string[]`
  - `getUsage() → {images: number, totalSizeMB: number}`
  - `clear() → void`
- Cache name: `'lexicon-images-v1'`
- Cache key format: `image://{chapterId}/{encodeURIComponent(marker)}`

**Acceptance Criteria**:
- [ ] `ImageCacheStore.isSupported()` returns `true` in modern browsers
- [ ] `storeImage()` converts base64 to Blob, stores in cache, returns blob URL
- [ ] `getImageBlobUrl()` retrieves cached image as blob URL
- [ ] `getImageBlob()` returns raw Blob for EPUB export
- [ ] `getUsage()` correctly reports cache size in MB

**Testing**:
```javascript
// Test storage
const testBase64 = 'data:image/png;base64,iVBORw0KG...'; // Small test image
const blobUrl = await ImageCacheStore.storeImage('test-ch', 'test-marker', testBase64);
console.assert(blobUrl.startsWith('blob://'), 'Should return blob URL');

// Test retrieval
const retrieved = await ImageCacheStore.getImageBlobUrl('test-ch', 'test-marker');
console.assert(retrieved === blobUrl, 'Should retrieve same URL');

// Test usage stats
const usage = await ImageCacheStore.getUsage();
console.log('Cache usage:', usage); // Should show 1 image

// Cleanup
await ImageCacheStore.clear();
```

---

#### ✅ Task 3: Update Types for Blob URLs
**File**: `types.ts`

**Requirements**:
- Modify `GeneratedImageResult.imageData` to accept blob URLs OR base64
- Add `isBlobUrl?: boolean` flag
- Add JSDoc comments explaining new behavior
- Keep backwards compatibility

**Changes**:
```typescript
export interface GeneratedImageResult {
  /**
   * Image data - either:
   * - Blob URL (blob://...) for images in Cache API (preferred, ~50 bytes RAM)
   * - Base64 data URL (data:image/png;base64,...) for legacy/fallback (~1.5MB RAM)
   */
  imageData: string;

  /**
   * True if imageData is a Blob URL, false/undefined if base64
   */
  isBlobUrl?: boolean;

  requestTime: number; // in seconds
  cost: number;
}
```

**Acceptance Criteria**:
- [ ] TypeScript compiles without errors
- [ ] Existing code doesn't break (backwards compatible)
- [ ] JSDoc appears in IDE autocomplete

---

#### ✅ Task 4: Update Image Generation to Use Cache API
**File**: `services/imageGenerationService.ts`

**Requirements**:
- After generating image, store in Cache API via `ImageCacheStore.storeImage()`
- Return Blob URL instead of base64 in `GeneratedImageResult`
- Set `isBlobUrl: true` flag
- Add telemetry snapshot: original size vs blob URL size
- Fallback to base64 if caching fails

**Modifications**:
```typescript
// After image generation (around line 470)
const base64Data = `data:${mimeType};base64,${response.imageData}`;

// NEW: Store in Cache API
let finalImageData = base64Data; // Fallback
let isBlobUrl = false;

try {
  if (ImageCacheStore.isSupported()) {
    const blobUrl = await ImageCacheStore.storeImage(
      chapterId, // Need to pass this as parameter
      placementMarker, // Need to pass this as parameter
      base64Data
    );

    finalImageData = blobUrl;
    isBlobUrl = true;

    telemetryService.captureMemorySnapshot('image-cached', {
      chapterId,
      placementMarker,
      originalSizeKB: (base64Data.length / 1024).toFixed(2),
      blobUrlBytes: blobUrl.length
    });
  }
} catch (error) {
  telemetryService.captureError('image-cache', error, { chapterId, placementMarker });
  // Continue with base64 fallback
}

return {
  imageData: finalImageData,
  isBlobUrl,
  requestTime: (performance.now() - startTime) / 1000,
  cost: calculateImageCost(imageModel)
};
```

**NOTE**: `generateImage()` needs new parameters: `chapterId` and `placementMarker`. Update all call sites.

**Acceptance Criteria**:
- [ ] New images stored in Cache API, not IndexedDB
- [ ] `GeneratedImageResult.imageData` contains blob URL
- [ ] `GeneratedImageResult.isBlobUrl === true`
- [ ] Telemetry shows `image-cached` events
- [ ] If caching fails, falls back to base64

**Testing**:
```javascript
// Generate test image
const result = await generateImage(
  'test prompt',
  settings,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  'test-chapter-id',
  'TEST-1'
);

console.assert(result.imageData.startsWith('blob://'), 'Should be blob URL');
console.assert(result.isBlobUrl === true, 'Flag should be set');

// Verify in cache
const cached = await ImageCacheStore.has('test-chapter-id', 'TEST-1');
console.assert(cached === true, 'Should be in cache');
```

---

#### ✅ Task 5: Update EPUB Export to Fetch from Cache
**File**: `services/epubService.ts`

**Requirements**:
- In `buildEpub()`, before processing images, detect blob URLs
- If `imageData.startsWith('blob://')`, fetch from Cache API via `ImageCacheStore.getImageBlob()`
- Convert Blob to base64 for EPUB embedding
- Add error handling if image not found in cache
- Log warnings for missing images

**New Helper Function**:
```typescript
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function collectChapterImages(
  chapter: any,
  chapterId: string
): Promise<Array<{marker: string, imageData: string}>> {
  const images: Array<{marker: string, imageData: string}> = [];

  for (const ill of chapter.translationResult?.suggestedIllustrations || []) {
    if (!ill.generatedImage?.imageData) continue;

    const imageData = ill.generatedImage.imageData;

    if (imageData.startsWith('blob://')) {
      // Fetch from Cache API
      try {
        const blob = await ImageCacheStore.getImageBlob(chapterId, ill.placementMarker);
        if (blob) {
          const base64 = await blobToBase64(blob);
          images.push({ marker: ill.placementMarker, imageData: base64 });
        } else {
          console.warn(`[EPUB] Image not found in cache: ${ill.placementMarker}`);
          telemetryService.captureWarning('epub-missing-image',
            `Image ${ill.placementMarker} not found in cache`,
            { chapterId }
          );
        }
      } catch (error) {
        console.error(`[EPUB] Failed to fetch image from cache`, { chapterId, error });
        telemetryService.captureError('epub-image-fetch', error, { chapterId });
      }
    } else {
      // Already base64, use directly
      images.push({ marker: ill.placementMarker, imageData });
    }
  }

  return images;
}
```

**Acceptance Criteria**:
- [ ] EPUB export works with blob URL images
- [ ] Images embedded correctly in EPUB
- [ ] Missing images logged as warnings
- [ ] Export doesn't fail if one image missing

**Testing**:
```javascript
// 1. Generate image in Cache API
const result = await generateImage(..., 'ch1', 'IMG-1');

// 2. Export EPUB with that chapter
const chapters = [{ chapter: testChapter, translationResult: {...} }];
const blob = await buildEpub(chapters, settings);

// 3. Verify EPUB contains image
// Open in EPUB reader or unzip and inspect XHTML
```

---

#### ✅ Task 6: Fix Active Translation Flag Setting
**File**: `services/translationService.ts:143-158`

**Requirements**:
- After `storeTranslationByStableId()` succeeds, immediately call `setActiveTranslationByStableId()`
- Wrap in try-catch with detailed error logging
- Log success with chapterId and version
- Don't fail translation if setActive fails (translation already stored)

**Changes**:
```typescript
try {
  const storedRecord = await indexedDBService.storeTranslationByStableId(chapterId, result, {...});
  slog('[Translate] Persisted translation to IndexedDB', {
    chapterId,
    translationId: storedRecord?.id,
    version: storedRecord?.version
  });

  if (storedRecord?.id) {
    // CRITICAL: Set as active immediately
    try {
      await indexedDBService.setActiveTranslationByStableId(chapterId, storedRecord.version);
      slog('[Translate] ✅ Set active translation version', {
        chapterId,
        version: storedRecord.version
      });
    } catch (activeError: any) {
      console.error('[Translate] ⚠️ FAILED to set active translation', {
        chapterId,
        version: storedRecord.version,
        error: activeError?.message || activeError,
        stack: activeError?.stack
      });

      telemetryService.captureError('set-active-translation', activeError, {
        chapterId,
        version: storedRecord.version
      });

      // Don't throw - translation is stored, just not active
      // User can manually select version in UI
    }

    (result as any).id = storedRecord.id;
    (result as any).customVersionLabel = storedRecord.customVersionLabel;
    (result as any).fanAlignment = storedRecord.fanAlignment;
  }
} catch (e) {
  console.warn('[TranslationService] Failed to persist translation version', { chapterId, error: e });
}
```

**Acceptance Criteria**:
- [ ] After translation, `isActive` flag set in IndexedDB
- [ ] Historical context finds translations (no more "no ACTIVE translation" logs)
- [ ] Errors logged with full stack trace
- [ ] Translation doesn't fail if setActive fails

**Testing**:
```javascript
// 1. Translate a chapter
await handleTranslate('test-chapter-id');

// 2. Check active flag is set
const versions = await indexedDBService.getTranslationVersionsByStableId('test-chapter-id');
const hasActive = versions.some(v => v.isActive);
console.assert(hasActive, 'Should have active version');

// 3. Translate next chapter with contextDepth=1
// Should find previous chapter in history (not log warning)
```

---

### **Phase 2: Migration & Memory Management (Week 2)**

#### ✅ Task 7: Create Image Migration Script
**File**: `scripts/migrate-images-to-cache.ts`

**Requirements**:
- Scan all chapters in IndexedDB
- For each `suggestedIllustration` with `generatedImage.imageData` (base64):
  - Store in Cache API via `ImageCacheStore.storeImage()`
  - Get blob URL
  - Update chapter in IndexedDB with blob URL + `isBlobUrl: true`
- Support dry-run mode (default: true)
- Log progress: X/Y chapters processed
- Report: total images migrated, total MB freed, errors

**Implementation**:
```typescript
export async function migrateImagesToCache(dryRun: boolean = true): Promise<void> {
  const { indexedDBService } = await import('../services/indexeddb');
  const { ImageCacheStore } = await import('../services/imageCacheService');

  console.log(`[ImageMigration] Starting migration (dryRun: ${dryRun})`);

  const stats = {
    totalChapters: 0,
    chaptersWithImages: 0,
    imagesMigrated: 0,
    totalSizeMB: 0,
    errors: 0
  };

  try {
    const allChapters = await indexedDBService.getAllChapterSummaries();
    stats.totalChapters = allChapters.length;

    for (const chapterSummary of allChapters) {
      if (!chapterSummary.hasImages) continue;
      if (!chapterSummary.stableId) continue;

      try {
        const activeTranslation = await indexedDBService.getActiveTranslationByStableId(
          chapterSummary.stableId
        );

        if (!activeTranslation?.suggestedIllustrations) continue;

        let modified = false;

        for (const ill of activeTranslation.suggestedIllustrations) {
          const imageData = ill.generatedImage?.imageData;

          // Skip if already blob URL or no image
          if (!imageData || imageData.startsWith('blob://')) continue;

          // Count size before migration
          stats.totalSizeMB += imageData.length / 1024 / 1024;

          if (!dryRun) {
            // Migrate to Cache API
            const blobUrl = await ImageCacheStore.storeImage(
              chapterSummary.stableId,
              ill.placementMarker,
              imageData
            );

            // Update in-place
            ill.generatedImage.imageData = blobUrl;
            ill.generatedImage.isBlobUrl = true;
          }

          stats.imagesMigrated++;
          modified = true;
        }

        if (modified) {
          stats.chaptersWithImages++;

          if (!dryRun) {
            // Update translation in IndexedDB
            await indexedDBService.updateTranslation(activeTranslation);
          }

          console.log(`[ImageMigration] ${dryRun ? '[DRY-RUN]' : '[MIGRATED]'} ${chapterSummary.title} - ${stats.imagesMigrated} images`);
        }

      } catch (error: any) {
        stats.errors++;
        console.error(`[ImageMigration] Error processing ${chapterSummary.title}:`, error?.message);
      }
    }

    console.log('[ImageMigration] ==================== SUMMARY ====================');
    console.log(`[ImageMigration] Total chapters:        ${stats.totalChapters}`);
    console.log(`[ImageMigration] Chapters with images:  ${stats.chaptersWithImages}`);
    console.log(`[ImageMigration] Images ${dryRun ? 'to migrate' : 'migrated'}: ${stats.imagesMigrated}`);
    console.log(`[ImageMigration] Est. RAM freed:        ${stats.totalSizeMB.toFixed(2)} MB`);
    console.log(`[ImageMigration] Errors:                ${stats.errors}`);

    if (dryRun) {
      console.log('[ImageMigration] 🔍 DRY RUN - No changes made');
      console.log('[ImageMigration] Run migrateImagesToCache(false) to apply');
    } else {
      console.log('[ImageMigration] ✅ Migration complete!');
    }

  } catch (error) {
    console.error('[ImageMigration] Fatal error:', error);
    throw error;
  }
}

// Expose to window
if (typeof window !== 'undefined') {
  (window as any).migrateImagesToCache = migrateImagesToCache;
}
```

**Acceptance Criteria**:
- [ ] Dry-run reports migration stats without changing data
- [ ] Full migration converts all base64 images to blob URLs
- [ ] Images accessible after migration
- [ ] IndexedDB updated with blob URLs
- [ ] Cache API contains all images

**Testing**:
```javascript
// 1. Dry run
await window.migrateImagesToCache(true);
// Should show what would be migrated

// 2. Full migration
await window.migrateImagesToCache(false);

// 3. Verify images still render
// Navigate to chapter with images, should display correctly

// 4. Export EPUB
// Should work with migrated blob URLs
```

---

#### ✅ Task 8: Add Memory Diagnostics to Store
**File**: `store/slices/chaptersSlice.ts`

**Requirements**:
- Add `getMemoryDiagnostics()` method
- Calculate:
  - Total chapters in RAM
  - Total text memory (content + translation)
  - Total image memory (only base64, not blob URLs)
  - Top 10 largest chapters
  - Average chapter size
- Return structured data for UI display

**Implementation** (see earlier message for full code)

**Acceptance Criteria**:
- [ ] `useAppStore.getState().getMemoryDiagnostics()` returns stats
- [ ] Text vs image memory separated
- [ ] Blob URLs counted as minimal memory (~50 bytes)
- [ ] Base64 images counted as full size

---

#### ✅ Task 9: Add Memory Diagnostics UI
**File**: `components/SettingsModal.tsx`

**Requirements**:
- Add "Memory Usage" section to Advanced tab
- Button to refresh stats
- Display:
  - Chapters in RAM
  - Text memory (MB)
  - Image memory (MB)
  - Total RAM usage
  - Cache API usage (images + audio)
  - Top 10 memory consumers (table)
- Button to clear old chapters (manual eviction)
- Button to clear image cache

**Acceptance Criteria**:
- [ ] UI shows accurate memory stats
- [ ] Stats update on refresh button click
- [ ] Clear buttons work and free memory
- [ ] Cache API usage shown separately from RAM

---

#### ✅ Task 10: Implement LRU Eviction
**File**: `store/slices/chaptersSlice.ts`

**Requirements**:
- Add `maxChaptersInRAM` setting (default: 50)
- In `importChapter()`, check if over limit
- If over, find least recently used chapter (not in recent navigationHistory)
- Remove from `chapters` Map
- Log eviction with reason
- Never evict current chapter or chapters in navigationHistory tail

**Acceptance Criteria**:
- [ ] Chapter count stays under `maxChaptersInRAM`
- [ ] LRU chapters evicted first
- [ ] Current chapter never evicted
- [ ] Re-navigating to evicted chapter reloads from IndexedDB

---

### **Phase 3: Testing & Validation (Week 3)**

#### ✅ Task 16: Full Workflow Test
**Scenario**: Generate images, export EPUB, verify RAM usage

**Steps**:
1. Clear all caches: `ImageCacheStore.clear()`
2. Generate 3 images for a chapter
3. Verify all in Cache API: `ImageCacheStore.getUsage()`
4. Check RAM: `useAppStore.getState().getMemoryDiagnostics()`
5. Export EPUB with that chapter
6. Open EPUB, verify all 3 images present
7. Check telemetry: `window.exportTelemetry()`

**Pass Criteria**:
- RAM usage < 5MB for 3 images
- EPUB contains all images
- No errors in telemetry

---

#### ✅ Task 17: 100+ Chapter Load Test
**Scenario**: Binge-read 100 chapters to test LRU eviction

**Steps**:
1. Enable memory management: `settings.enableMemoryManagement = true`
2. Set aggressive limit: `maxChaptersInRAM = 20`
3. Read 100 chapters sequentially (next → next → next)
4. Monitor console for `[Eviction]` logs
5. Check memory every 20 chapters: `getMemoryDiagnostics()`
6. Verify navigation still smooth

**Pass Criteria**:
- Chapters evicted when over 20
- Memory stays under 100MB total
- No crashes or freezes
- Navigation latency < 500ms

---

## Success Metrics

### Quantitative
- **RAM usage**: < 100MB for 100 chapters with images
- **Cache API**: Stores all images (500MB-2GB total, on disk)
- **Navigation speed**: < 500ms to switch chapters
- **EPUB export**: Works with 100+ chapters with images

### Qualitative
- No browser crashes during 600-chapter binge
- Images load within 1s when viewing
- Export feels responsive (< 30s for 100 chapters)
- No visible performance degradation over time

---

## Rollback Plan

If Cache API causes issues:

1. **Immediate**: Disable in settings (feature flag off)
2. **Short-term**: Keep base64 fallback functional
3. **Long-term**: Investigate browser compatibility issues

---

## Future Enhancements (Week 4+)

1. **Video Support**: Same Cache API pattern for future video feature
2. **Quota Management**: Monitor `navigator.storage.estimate()`, warn user when quota low
3. **Selective Sync**: Option to "pin" chapters (keep in RAM)
4. **Background Cleanup**: Service worker to clean old cached images
5. **Export Optimization**: Stream EPUB generation to avoid loading all chapters

---

## Notes

- **Browser Compatibility**: Cache API supported in all modern browsers (Chrome 40+, Firefox 41+, Safari 11.1+)
- **Storage Quota**: Varies by browser, typically 50% of available disk or 20GB, whichever is smaller
- **Blob URL Lifecycle**: Created URLs must be revoked via `URL.revokeObjectURL()` when component unmounts
- **IndexedDB vs Cache API**: IndexedDB for structured data (translations), Cache API for binary blobs (images/audio)
