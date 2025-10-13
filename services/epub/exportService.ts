/**
 * EPUB Export Service (Orchestrator)
 *
 * Phase 5 of EPUB export pipeline: coordinates the entire export process.
 * Calls each module in sequence and reports progress to the UI.
 */

import { collectExportData } from './dataCollector';
import { resolveAssets } from './assetResolver';
import { buildEpubContent } from './contentBuilder';
import { packageEpub } from './packageBuilder';
import type {
  EpubExportOptions,
  ExportResult,
  ExportProgress,
  ProgressCallback
} from './types';
import type { EnhancedChapter } from '../stableIdService';

interface StoreSnapshot {
  chapters: Map<string, EnhancedChapter>;
  currentNovelTitle?: string;
}

/**
 * Export EPUB - Full pipeline orchestration
 *
 * Coordinates all phases:
 * 1. Collect data from store/IndexedDB (25%)
 * 2. Resolve assets from Cache API (50%)
 * 3. Build XHTML content (75%)
 * 4. Package into ZIP (95%)
 * 5. Return result (100%)
 *
 * @param options Export configuration
 * @param storeSnapshot Current application state
 * @param progressCallback Optional callback for progress updates
 * @returns Final EPUB blob with statistics
 */
export async function exportEpub(
  options: EpubExportOptions,
  storeSnapshot?: StoreSnapshot,
  progressCallback?: ProgressCallback
): Promise<ExportResult> {
  const startTime = performance.now();

  try {
    // Phase 1: Collect data (0% → 25%)
    reportProgress(progressCallback, {
      phase: 'collecting',
      percent: 0,
      message: 'Collecting chapter data...',
      detail: 'Reading chapters from store and IndexedDB'
    });

    // Get store snapshot if not provided (for testing)
    if (!storeSnapshot) {
      // In production, this would come from the store
      // For now, return error if not provided
      return {
        success: false,
        error: 'Store snapshot required for export',
        stats: {
          totalChapters: 0,
          assetsResolved: 0,
          assetsMissing: 0,
          warnings: 0,
          durationMs: 0
        }
      };
    }

    const collectedData = await collectExportData(options, storeSnapshot);

    if (collectedData.chapters.length === 0) {
      return {
        success: false,
        error: 'No chapters to export',
        stats: {
          totalChapters: 0,
          assetsResolved: 0,
          assetsMissing: 0,
          warnings: collectedData.warnings.length,
          durationMs: performance.now() - startTime
        }
      };
    }

    reportProgress(progressCallback, {
      phase: 'collecting',
      percent: 25,
      message: `Collected ${collectedData.chapters.length} chapters`,
      detail: `${collectedData.metadata.translatedChapters} translated`
    });

    // Phase 2: Resolve assets (25% → 50%)
    reportProgress(progressCallback, {
      phase: 'resolving',
      percent: 30,
      message: 'Resolving image assets...',
      detail: 'Fetching from Cache API and base64 fallbacks'
    });

    const resolvedAssets = await resolveAssets(collectedData);

    reportProgress(progressCallback, {
      phase: 'resolving',
      percent: 50,
      message: `Resolved ${resolvedAssets.assets.length} assets`,
      detail: `${resolvedAssets.warnings.length} cache misses`
    });

    // Phase 3: Build content (50% → 75%)
    reportProgress(progressCallback, {
      phase: 'building',
      percent: 55,
      message: 'Building XHTML content...',
      detail: 'Generating chapters, manifest, and navigation'
    });

    const builtContent = buildEpubContent(resolvedAssets, options);

    reportProgress(progressCallback, {
      phase: 'building',
      percent: 75,
      message: `Built ${builtContent.chapterFiles.length} XHTML files`,
      detail: `${builtContent.manifestItems.length} manifest items`
    });

    // Phase 4: Package EPUB (75% → 95%)
    reportProgress(progressCallback, {
      phase: 'packaging',
      percent: 80,
      message: 'Packaging EPUB...',
      detail: 'Creating ZIP structure'
    });

    const epubPackage = await packageEpub(builtContent, resolvedAssets.assets);

    if (!epubPackage.validation.valid) {
      // Count truly missing assets
      let missingCount = 0;
      for (const chapter of resolvedAssets.chapters) {
        for (const imgRef of chapter.imageReferences) {
          if (imgRef.missing) {
            missingCount++;
          }
        }
      }

      return {
        success: false,
        error: `EPUB validation failed: ${epubPackage.validation.errors.join(', ')}`,
        stats: {
          totalChapters: collectedData.chapters.length,
          assetsResolved: resolvedAssets.assets.length,
          assetsMissing: missingCount,
          warnings: resolvedAssets.warnings.length + epubPackage.validation.warnings.length,
          durationMs: performance.now() - startTime
        }
      };
    }

    reportProgress(progressCallback, {
      phase: 'packaging',
      percent: 95,
      message: 'EPUB package created',
      detail: `${(epubPackage.sizeBytes / 1024 / 1024).toFixed(2)} MB`
    });

    // Phase 5: Complete (95% → 100%)
    const durationMs = performance.now() - startTime;

    reportProgress(progressCallback, {
      phase: 'complete',
      percent: 100,
      message: 'Export complete!',
      detail: `Exported in ${(durationMs / 1000).toFixed(1)}s`
    });

    // Count truly missing assets (not just cache misses with fallbacks)
    let missingCount = 0;
    for (const chapter of resolvedAssets.chapters) {
      for (const imgRef of chapter.imageReferences) {
        if (imgRef.missing) {
          missingCount++;
        }
      }
    }

    return {
      success: true,
      blob: epubPackage.blob,
      stats: {
        totalChapters: collectedData.chapters.length,
        assetsResolved: resolvedAssets.assets.length,
        assetsMissing: missingCount,
        warnings: collectedData.warnings.length + resolvedAssets.warnings.length + epubPackage.validation.warnings.length,
        durationMs
      }
    };

  } catch (error: any) {
    const durationMs = performance.now() - startTime;

    reportProgress(progressCallback, {
      phase: 'error',
      percent: 0,
      message: 'Export failed',
      detail: error.message
    });

    return {
      success: false,
      error: error.message || 'Unknown error during export',
      stats: {
        totalChapters: 0,
        assetsResolved: 0,
        assetsMissing: 0,
        warnings: 0,
        durationMs
      }
    };
  }
}

/**
 * Report progress to callback if provided
 */
function reportProgress(callback: ProgressCallback | undefined, progress: ExportProgress): void {
  if (callback) {
    callback(progress);
  }
}
