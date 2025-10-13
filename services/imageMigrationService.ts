/**
 * Image Migration Service
 *
 * Migrates legacy base64 images from IndexedDB to Cache API.
 * This frees up RAM and uses browser disk storage instead.
 *
 * IMPORTANT: This operates at the IndexedDB level, not just in-memory chapters!
 */

import { ImageCacheStore } from './imageCacheService';
import { indexedDBService } from './indexeddb';
import type { EnhancedChapter } from './stableIdService';
import type { GeneratedImageResult, ImageCacheKey } from '../types';

export interface MigrationOptions {
  dryRun?: boolean;
}

export interface MigrationResult {
  success: boolean;
  migratedImages: number;
  skippedImages?: number;
  wouldMigrate?: number;
  errors: Array<{ chapterId: string; error: string }>;
  translationsProcessed?: number;
}

/**
 * Migrate images from IndexedDB (base64) to Cache API on disk
 *
 * This is the main migration function that operates on ALL translations in IndexedDB,
 * not just chapters currently loaded in RAM.
 */
export async function migrateImagesToCacheFromDB(
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const { dryRun = false } = options;

  const result: MigrationResult = {
    success: true,
    migratedImages: 0,
    skippedImages: 0,
    translationsProcessed: 0,
    errors: []
  };

  if (dryRun) {
    result.wouldMigrate = 0;
  }

  console.log('[ImageMigration] Starting database-level migration...', { dryRun });

  try {
    // Get ALL translations from IndexedDB
    const translations = await indexedDBService.getAllTranslations();
    console.log(`[ImageMigration] Found ${translations.length} translations in IndexedDB`);

    // Process each translation
    for (const translation of translations) {
      result.translationsProcessed!++;

      const illustrations = (translation.suggestedIllustrations as any[]) || [];
      let translationModified = false;

      for (const illustration of illustrations) {
        const genImage = illustration.generatedImage as GeneratedImageResult | undefined;
        if (!genImage) continue;

        // Skip if already using cache key
        if (genImage.imageCacheKey) {
          result.skippedImages!++;
          continue;
        }

        // Skip if no base64 data to migrate
        if (!genImage.imageData || genImage.imageData === '') {
          continue;
        }

        // Found legacy base64 image
        if (dryRun) {
          // Dry run: just count
          result.wouldMigrate!++;
        } else {
          // Actual migration: store in cache
          try {
            // Need to determine chapterId from translation
            const chapterId = translation.stableId || translation.chapterUrl;

            const cacheKey: ImageCacheKey = await ImageCacheStore.storeImage(
              chapterId,
              illustration.placementMarker,
              genImage.imageData
            );

            // Update illustration to use cache key
            genImage.imageCacheKey = cacheKey;
            genImage.imageData = ''; // Clear base64 data
            translationModified = true;

            result.migratedImages++;

            console.log(`[ImageMigration] Migrated image: ${chapterId}:${illustration.placementMarker}`);
          } catch (error: any) {
            const chapterId = translation.stableId || translation.chapterUrl;
            result.errors.push({
              chapterId,
              error: error?.message || String(error)
            });
            console.error(`[ImageMigration] Failed to migrate image for ${chapterId}:`, error);
          }
        }
      }

      // Write back to IndexedDB if we modified this translation
      if (translationModified && !dryRun) {
        try {
          await indexedDBService.updateTranslationRecord(translation);
          console.log(`[ImageMigration] Updated translation record: ${translation.id}`);
        } catch (error: any) {
          const chapterId = translation.stableId || translation.chapterUrl;
          result.errors.push({
            chapterId,
            error: `Failed to update IndexedDB: ${error?.message || String(error)}`
          });
        }
      }
    }

    console.log('[ImageMigration] Migration complete', {
      translationsProcessed: result.translationsProcessed,
      migratedImages: result.migratedImages,
      skippedImages: result.skippedImages,
      errors: result.errors.length
    });

  } catch (error: any) {
    console.error('[ImageMigration] Migration failed:', error);
    result.success = false;
    result.errors.push({
      chapterId: 'MIGRATION',
      error: `Migration failed: ${error?.message || String(error)}`
    });
  }

  // If there were errors, mark as partial failure
  if (result.errors.length > 0) {
    result.success = false;
  }

  return result;
}

/**
 * LEGACY: Migrate images from in-memory chapters only
 *
 * @deprecated Use migrateImagesToCacheFromDB instead for complete migration
 */
export async function migrateImagesToCache(
  chapters: Map<string, EnhancedChapter>,
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  console.warn('[ImageMigration] Using deprecated in-memory migration. Use migrateImagesToCacheFromDB for complete migration.');

  const { dryRun = false } = options;

  const result: MigrationResult = {
    success: true,
    migratedImages: 0,
    skippedImages: 0,
    errors: []
  };

  if (dryRun) {
    result.wouldMigrate = 0;
  }

  // Iterate through all chapters
  for (const [chapterId, chapter] of chapters.entries()) {
    // Skip chapters without translations
    if (!chapter.translationResult) {
      continue;
    }

    // Check each illustration
    const illustrations = chapter.translationResult.suggestedIllustrations || [];
    for (const illustration of illustrations) {
      const genImage = illustration.generatedImage;
      if (!genImage) continue;

      // Skip if already using cache key
      if (genImage.imageCacheKey) {
        result.skippedImages!++;
        continue;
      }

      // Skip if no base64 data to migrate
      if (!genImage.imageData || genImage.imageData === '') {
        continue;
      }

      // Found legacy base64 image
      if (dryRun) {
        // Dry run: just count
        result.wouldMigrate!++;
      } else {
        // Actual migration: store in cache
        try {
          const cacheKey = await ImageCacheStore.storeImage(
            chapter.id,
            illustration.placementMarker,
            genImage.imageData
          );

          // Update chapter to use cache key
          genImage.imageCacheKey = cacheKey;
          genImage.imageData = ''; // Clear base64 data

          result.migratedImages++;
        } catch (error: any) {
          result.errors.push({
            chapterId: chapter.id,
            error: error?.message || String(error)
          });
        }
      }
    }
  }

  // If there were errors, mark as partial failure
  if (result.errors.length > 0) {
    result.success = false;
  }

  return result;
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).migrateImagesToCacheFromDB = migrateImagesToCacheFromDB;
  (window as any).migrateImagesToCache = migrateImagesToCache; // Legacy
}
