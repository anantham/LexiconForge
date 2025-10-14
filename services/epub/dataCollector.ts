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
    const imageReferences = chapter.translationResult?.suggestedIllustrations?.map(illust => ({
      placementMarker: illust.placementMarker,
      prompt: illust.imagePrompt,
      cacheKey: illust.generatedImage?.imageCacheKey
        ? {
            chapterId: illust.generatedImage.imageCacheKey.chapterId,
            placementMarker: illust.generatedImage.imageCacheKey.placementMarker
          }
        : undefined,
      base64Fallback: illust.generatedImage?.imageData || (illust as any).url
    })) || [];

    // Extract footnotes
    const footnotes = chapter.translationResult?.footnotes?.map(fn => ({
      marker: fn.marker,
      text: fn.text
    })) || [];

    // Apply HTML repair to translation content for export (Option 3: belt and suspenders)
    const rawTranslation = chapter.translationResult?.translation;
    let repairedTranslation: string | undefined = undefined;
    if (rawTranslation && options.enableHtmlRepair !== false) {
      const { html } = HtmlRepairService.repair(rawTranslation, { enabled: true, verbose: false });
      repairedTranslation = html;
    }

    // Build normalized chapter
    const collectedChapter: CollectedChapter = {
      id: chapter.id,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title || '',
      content: chapter.content || '',
      translatedTitle: chapter.translationResult?.translatedTitle,
      translatedContent: repairedTranslation || rawTranslation, // Use repaired version if available
      footnotes,
      imageReferences,
      translationMeta: chapter.translationResult ? {
        provider: chapter.translationResult.provider,
        model: chapter.translationResult.model,
        cost: chapter.translationResult.cost,
        tokens: chapter.translationResult.tokens,
        requestTime: chapter.translationResult.requestTime
      } : undefined,
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
