import type { ChapterRecord, TranslationRecord } from '../types';
import type { ImageGenerationMetadata } from '../../../types';
import { chapterRepository } from '../repositories/instances';
import { translationFacade } from '../repositories/translationFacade';

const missingChapterError = (chapterId: string) =>
  new Error(`Chapter not found: ${chapterId}`);
const missingTranslationError = (chapterId: string) =>
  new Error(`No active translation found for chapter: ${chapterId}`);
const missingMarkerError = (marker: string) =>
  new Error(`No image version state found for marker: ${marker}`);

const resolveChapter = async (chapterId: string): Promise<ChapterRecord | null> => {
  return (
    (await chapterRepository.getChapterByStableId(chapterId)) ||
    (await chapterRepository.getChapter(chapterId))
  );
};

const resolveActiveTranslation = async (
  chapter: ChapterRecord
): Promise<TranslationRecord | null> => {
  if (chapter.stableId) {
    const byStable = await translationFacade.getActiveByStableId(chapter.stableId);
    if (byStable) return byStable;
  }

  return translationFacade.getActiveByUrl(chapter.url);
};

const normalizeVersionEntries = (
  versions: unknown
): Array<[number, ImageGenerationMetadata]> => {
  if (!versions) {
    return [];
  }

  if (Array.isArray(versions)) {
    return versions
      .filter((entry): entry is ImageGenerationMetadata & { version: number } => {
        return entry && typeof entry.version === 'number';
      })
      .map(entry => [entry.version, entry]);
  }

  if (typeof versions === 'object') {
    return Object.entries(versions as Record<string, ImageGenerationMetadata>).map(
      ([key, value]) => [Number(key), value]
    );
  }

  return [];
};

export class ImageOps {
  static async deleteImageVersion(
    chapterId: string,
    placementMarker: string,
    version: number
  ): Promise<void> {
    const chapter = await resolveChapter(chapterId);
    if (!chapter) throw missingChapterError(chapterId);

    const translation = await resolveActiveTranslation(chapter);
    if (!translation) throw missingTranslationError(chapterId);

    const translationRecord = translation as TranslationRecord & {
      imageVersionState?: Record<string, any>;
    };

    const versionState = translationRecord.imageVersionState
      ? { ...translationRecord.imageVersionState }
      : {};
    const markerState = versionState[placementMarker];
    if (!markerState) throw missingMarkerError(placementMarker);

    const normalizedEntries = normalizeVersionEntries(markerState.versions);
    // If there are no version entries left, treat this as a marker cleanup request.
    if (normalizedEntries.length === 0) {
      delete versionState[placementMarker];
      if (Array.isArray(translationRecord.suggestedIllustrations)) {
        translationRecord.suggestedIllustrations = translationRecord.suggestedIllustrations.filter(
          ill => ill?.placementMarker !== placementMarker
        );
      }
      translationRecord.imageVersionState =
        Object.keys(versionState).length > 0 ? versionState : undefined;
      await translationFacade.update(translationRecord);
      return;
    }

    const filteredEntries = normalizedEntries.filter(([entryVersion]) => entryVersion !== version);

    if (filteredEntries.length === 0) {
      versionState[placementMarker] = {
        ...markerState,
        versions: {},
        activeVersion: null,
        latestVersion: 0,
      };
    } else {
      const updatedVersions = filteredEntries.reduce<Record<number, ImageGenerationMetadata>>(
        (acc, [entryVersion, metadata]) => {
          acc[entryVersion] = metadata;
          return acc;
        },
        {}
      );
      const versionNumbers = filteredEntries.map(([entryVersion]) => entryVersion);
      const newLatestVersion = Math.max(...versionNumbers);
      const newActiveVersion =
        markerState.activeVersion === version || markerState.activeVersion == null
          ? newLatestVersion
          : markerState.activeVersion;

      versionState[placementMarker] = {
        ...markerState,
        versions: updatedVersions,
        activeVersion: newActiveVersion,
        latestVersion: newLatestVersion,
      };
    }

    translationRecord.imageVersionState =
      Object.keys(versionState).length > 0 ? versionState : undefined;

    await translationFacade.update(translationRecord);
  }

  static async getStorageDiagnostics(): Promise<{
    disk: {
      totalChapters: number;
      totalTranslations: number;
      totalImages: number;
      imagesInCache: number;
      imagesLegacy: number;
    };
    quota: {
      usedMB: number;
      quotaMB: number;
      percentUsed: number;
    } | null;
  }> {
    const [chapters, translations] = await Promise.all([
      chapterRepository.getAllChapters(),
      translationFacade.getAll(),
    ]);

    let imagesInCache = 0;
    let imagesLegacy = 0;

    for (const translation of translations) {
      const illustrations = translation.suggestedIllustrations || [];
      for (const illustration of illustrations) {
        const generated = (illustration as any).generatedImage;
        if (!generated) continue;
        if (generated.imageCacheKey) imagesInCache++;
        else if (generated.imageData) imagesLegacy++;
      }
    }

    let quota: { usedMB: number; quotaMB: number; percentUsed: number } | null =
      null;

    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.estimate === 'function'
    ) {
      try {
        const estimate = await navigator.storage.estimate();
        const usedMB = (estimate.usage || 0) / 1024 / 1024;
        const quotaMB = (estimate.quota || 0) / 1024 / 1024;
        const percentUsed = quotaMB > 0 ? (usedMB / quotaMB) * 100 : 0;
        quota = {
          usedMB: parseFloat(usedMB.toFixed(2)),
          quotaMB: parseFloat(quotaMB.toFixed(2)),
          percentUsed: parseFloat(percentUsed.toFixed(1)),
        };
      } catch (error) {
        console.warn('[ImageOps] Failed to estimate storage quota:', error);
      }
    }

    return {
      disk: {
        totalChapters: chapters.length,
        totalTranslations: translations.length,
        totalImages: imagesInCache + imagesLegacy,
        imagesInCache,
        imagesLegacy,
      },
      quota,
    };
  }
}
