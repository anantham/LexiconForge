/**
 * EPUB Data Collector
 *
 * Phase 1 of EPUB export pipeline: walks session state/IndexedDB and hydrates
 * the raw chapter data needed for export.
 *
 * Pure function - no side effects, only reads from provided state.
 */

import type {
  EpubExportOptions,
  CollectedData,
  CollectedChapter
} from './types';
import type { EnhancedChapter } from '../stableIdService';
import { HtmlRepairService } from '../translate/HtmlRepairService';
import type { GeneratedImageResult, TranslationResult } from '../../types';

interface StoreSnapshot {
  chapters: Map<string, EnhancedChapter>;
  currentNovelTitle?: string;
}

/**
 * Collect all chapter data needed for EPUB export
 *
 * Walks through chapters in the specified order and normalizes data into
 * the CollectedChapter format. Flags warnings for missing translations,
 * missing content, or ordering gaps.
 *
 * @param options Export configuration
 * @param storeSnapshot Current application state
 * @returns Normalized chapter data with metadata and warnings
 */
export async function collectExportData(
  options: EpubExportOptions,
  storeSnapshot: StoreSnapshot
): Promise<CollectedData> {
  const collectedChapters: CollectedChapter[] = [];
  const warnings: CollectedData['warnings'] = [];

  // Get all chapters from the store
  const chaptersArray = Array.from(storeSnapshot.chapters.values());

  // Sort based on ordering strategy
  const sortedChapters = options.order === 'number'
    ? chaptersArray.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0))
    : chaptersArray; // TODO: Implement navigation-based ordering

  let translatedCount = 0;

  // Normalize each chapter
  for (const chapter of sortedChapters) {
    const hasTranslation = Boolean(chapter.translationResult);
    if (hasTranslation) {
      translatedCount++;
    }

    // Extract image references from suggested illustrations
    const imageReferences = chapter.translationResult?.suggestedIllustrations?.map(illust => {
      const generatedImage = illust.generatedImage as GeneratedImageResult | string | undefined;
      const cacheKeySource =
        illust.imageCacheKey ||
        (typeof generatedImage === 'object' && generatedImage?.imageCacheKey);

      const normalizedCacheKey = cacheKeySource
        ? {
            chapterId: cacheKeySource.chapterId,
            placementMarker: cacheKeySource.placementMarker,
            version: typeof cacheKeySource.version === 'number' ? cacheKeySource.version : 1,
          }
        : undefined;

      const base64Fallback =
        typeof generatedImage === 'string'
          ? generatedImage
          : generatedImage?.imageData || (illust as any).url;

      return {
        placementMarker: illust.placementMarker,
        prompt: illust.imagePrompt,
        cacheKey: normalizedCacheKey,
        base64Fallback,
      };
    }) || [];

    // Extract footnotes
    const footnotes = chapter.translationResult?.footnotes?.map(fn => ({
      marker: fn.marker,
      text: fn.text
    })) || [];

    // Apply HTML repair to translation content for export (Option 3: belt and suspenders)
    const originalTranslatedContent =
      chapter.translationResult?.translatedContent ?? chapter.translationResult?.translation;

    let repairedTranslation: string | undefined = undefined;
    if (originalTranslatedContent && options.enableHtmlRepair !== false) {
      const { html } = HtmlRepairService.repair(originalTranslatedContent, { enabled: true, verbose: false });
      repairedTranslation = html;
    }

    const exportedTranslatedContent = repairedTranslation ?? originalTranslatedContent;

    // Build normalized chapter
    const collectedChapter: CollectedChapter = {
      id: chapter.id,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title || '',
      content: chapter.content || '',
      translatedTitle: chapter.translationResult?.translatedTitle,
      translatedContent: exportedTranslatedContent,
      footnotes,
      imageReferences,
      translationMeta: chapter.translationResult
        ? {
            provider: resolveProvider(chapter.translationResult),
            model: resolveModel(chapter.translationResult),
            cost: resolveCost(chapter.translationResult),
            tokens: chapter.translationResult.usageMetrics?.totalTokens ?? 0,
            requestTime: chapter.translationResult.usageMetrics?.requestTime ?? 0,
          }
        : undefined,
      prevUrl: chapter.prevUrl,
      nextUrl: chapter.nextUrl
    };

    collectedChapters.push(collectedChapter);

    // Flag warnings
    if (!hasTranslation) {
      warnings.push({
        type: 'missing-translation',
        chapterId: chapter.id,
        message: `Chapter ${chapter.chapterNumber || 'unknown'} has no translation`
      });
    }

    if (!chapter.content || chapter.content.trim().length === 0) {
      warnings.push({
        type: 'missing-content',
        chapterId: chapter.id,
        message: `Chapter ${chapter.chapterNumber || 'unknown'} has no content`
      });
    }
  }

  // Build metadata
  const metadata = {
    novelTitle: storeSnapshot.currentNovelTitle || 'Untitled Novel',
    totalChapters: collectedChapters.length,
    translatedChapters: translatedCount,
    exportDate: new Date().toISOString()
  };

  return {
    chapters: collectedChapters,
    metadata,
    warnings
  };
}

function resolveProvider(result: TranslationResult): string {
  if (typeof result.provider === 'string') {
    return result.provider;
  }
  return result.translationSettings?.provider ?? 'unknown';
}

function resolveModel(result: TranslationResult): string {
  if (result.model) {
    return result.model;
  }
  return result.translationSettings?.model ?? 'unknown';
}

function resolveCost(result: TranslationResult): number {
  if (typeof result.costUsd === 'number') return result.costUsd;
  return result.usageMetrics?.estimatedCost ?? 0;
}
