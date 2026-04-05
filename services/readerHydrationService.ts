import {
  fetchChaptersForNovel,
  fetchChaptersForReactRendering,
  type ChapterRenderingRecord,
} from './db/operations/rendering';
import { normalizeUrlAggressively, buildEnhancedChapter, type EnhancedChapter } from './stableIdService';
import type { StoreState } from '../store/storeTypes';
import type { TranslationResult } from '../types';

export interface ReaderHydrationOptions {
  limit?: number;
  versionId?: string | null;
}

type ReaderHydrationPatch = Pick<StoreState, 'chapters' | 'urlIndex' | 'rawUrlIndex'>;
type ReaderHydrationSetter = (patch: ReaderHydrationPatch) => void;

const sortByChapterNumber = (a: ChapterRenderingRecord, b: ChapterRenderingRecord): number => {
  return (a.chapterNumber || 0) - (b.chapterNumber || 0);
};

const adaptTranslationFromRenderingRecord = (chapter: ChapterRenderingRecord): TranslationResult | null => {
  if (!chapter.translationResult) return null;
  const suggestedIllustrations = chapter.translationResult.suggestedIllustrations.map((illustration) => {
    const generatedImage =
      illustration.generatedImage && typeof illustration.generatedImage !== 'string'
        ? illustration.generatedImage
        : undefined;
    const url =
      illustration.url ??
      (typeof illustration.generatedImage === 'string' ? illustration.generatedImage : undefined);
    return {
      placementMarker: illustration.placementMarker,
      imagePrompt: illustration.imagePrompt,
      ...(illustration.imagePlan ? { imagePlan: illustration.imagePlan } : {}),
      ...(illustration.imagePlanMode ? { imagePlanMode: illustration.imagePlanMode } : {}),
      ...(illustration.imagePlanSourceCaption ? { imagePlanSourceCaption: illustration.imagePlanSourceCaption } : {}),
      ...(generatedImage ? { generatedImage } : {}),
      ...(illustration.imageCacheKey ? { imageCacheKey: illustration.imageCacheKey } : {}),
      ...(url ? { url } : {}),
    };
  });
  return {
    translatedTitle: chapter.translationResult.translatedTitle,
    translation: chapter.translationResult.translation,
    proposal: chapter.translationResult.proposal ?? null,
    footnotes: chapter.translationResult.footnotes,
    suggestedIllustrations,
    usageMetrics: {
      totalTokens: chapter.translationResult.totalTokens,
      promptTokens: chapter.translationResult.promptTokens,
      completionTokens: chapter.translationResult.completionTokens,
      estimatedCost: chapter.translationResult.estimatedCost,
      requestTime: chapter.translationResult.requestTime,
      provider: chapter.translationResult.provider as TranslationResult['usageMetrics']['provider'],
      model: chapter.translationResult.model,
    },
    customVersionLabel: chapter.translationResult.customVersionLabel,
    id: chapter.translationResult.id,
    version: chapter.translationResult.version,
    provider: chapter.translationResult.provider,
    model: chapter.translationResult.model,
    temperature: chapter.translationResult.temperature,
    requestTime: chapter.translationResult.requestTime,
    promptId: chapter.translationResult.promptId,
    promptName: chapter.translationResult.promptName,
  };
};

const toEnhancedChapter = (chapter: ChapterRenderingRecord): EnhancedChapter => {
  const enhanced = buildEnhancedChapter(chapter.stableId, {
    ...chapter,
    stableId: chapter.stableId,
    sourceUrls: chapter.sourceUrls ?? [chapter.url],
  });
  enhanced.translationResult = adaptTranslationFromRenderingRecord(chapter);
  return enhanced;
};

const buildHydratedState = (
  renderingRecords: ChapterRenderingRecord[],
  options: ReaderHydrationOptions = {}
): {
  chapters: Map<string, EnhancedChapter>;
  urlIndex: Map<string, string>;
  rawUrlIndex: Map<string, string>;
  firstChapterId: string | null;
} => {
  const sortedRecords = [...renderingRecords].sort(sortByChapterNumber);
  const limitedRecords =
    typeof options.limit === 'number' ? sortedRecords.slice(0, options.limit) : sortedRecords;

  const chapters = new Map<string, EnhancedChapter>();
  const urlIndex = new Map<string, string>();
  const rawUrlIndex = new Map<string, string>();

  for (const record of limitedRecords) {
    const chapter = toEnhancedChapter(record);
    chapters.set(chapter.id, chapter);

    for (const rawUrl of chapter.sourceUrls) {
      if (!rawUrl) continue;
      rawUrlIndex.set(rawUrl, chapter.id);
      const normalized = normalizeUrlAggressively(rawUrl);
      if (normalized) {
        urlIndex.set(normalized, chapter.id);
      }
    }
  }

  return {
    chapters,
    urlIndex,
    rawUrlIndex,
    firstChapterId: limitedRecords[0]?.stableId ?? null,
  };
};

const hydrateIntoStore = (
  renderingRecords: ChapterRenderingRecord[],
  setState: ReaderHydrationSetter,
  options: ReaderHydrationOptions = {}
): string | null => {
  const hydratedState = buildHydratedState(renderingRecords, options);

  setState({
    chapters: hydratedState.chapters,
    urlIndex: hydratedState.urlIndex,
    rawUrlIndex: hydratedState.rawUrlIndex,
  });

  return hydratedState.firstChapterId;
};

export async function loadNovelIntoStore(
  novelId: string,
  setState: ReaderHydrationSetter,
  options: ReaderHydrationOptions = {}
): Promise<string | null> {
  const chapters = await fetchChaptersForNovel(novelId, options.versionId ?? null);
  if (chapters.length === 0) {
    return null;
  }

  return hydrateIntoStore(chapters, setState, options);
}

export async function loadAllIntoStore(
  setState: ReaderHydrationSetter,
  options: ReaderHydrationOptions = {}
): Promise<string | null> {
  const chapters = await fetchChaptersForReactRendering();
  if (chapters.length === 0) {
    return null;
  }

  return hydrateIntoStore(chapters, setState, options);
}
