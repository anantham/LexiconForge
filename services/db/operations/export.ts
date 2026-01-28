import type {
  ChapterRecord,
  ExportSessionOptions,
  ExportedImageAsset,
  FeedbackRecord,
  NovelRecord,
  PromptTemplateRecord,
  TranslationRecord,
  UrlMappingRecord,
  AmendmentLogRecord,
} from '../types';
import { telemetryService } from '../../telemetryService';
import { AmendmentOps } from './amendments';

const DEFAULT_EXPORT_OPTIONS: Required<ExportSessionOptions> = {
  includeChapters: true,
  includeTelemetry: true,
  includeImages: true,  // Include images by default for portable exports
};

const getMimeTypeFromDataUrl = (dataUrl: string): string => {
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  return match ? match[1] : 'image/png';
};

const estimateBase64SizeBytes = (dataUrl: string): number => {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return 0;
  const base64 = dataUrl.slice(commaIndex + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max((base64.length * 3) / 4 - padding, 0);
};

type ChapterImageSource = {
  stableId?: string;
  canonicalUrl: string;
  versions: TranslationRecord[];
};

export interface ExportOpsDeps {
  getSettings: () => Promise<any | null>;
  getAllUrlMappings: () => Promise<UrlMappingRecord[]>;
  getAllNovels: () => Promise<NovelRecord[]>;
  getAllChapters: () => Promise<ChapterRecord[]>;
  getSetting: <T = any>(key: string) => Promise<T | null>;
  getAllDiffResults: () => Promise<any[]>;
  getUrlMappingForUrl: (url: string) => Promise<UrlMappingRecord | null>;
  getTranslationVersionsByStableId: (stableId: string) => Promise<TranslationRecord[]>;
  getTranslationVersions: (canonicalUrl: string) => Promise<TranslationRecord[]>;
  getFeedback: (canonicalUrl: string) => Promise<FeedbackRecord[]>;
  getPromptTemplates: () => Promise<PromptTemplateRecord[]>;
  getAmendmentLogs: () => Promise<AmendmentLogRecord[]>;
}

type ExportCollections = {
  chapters: ChapterRecord[];
  urlMappings: UrlMappingRecord[];
  novels: NovelRecord[];
  navHistory: any;
  lastActive: any;
  diffResults: any[];
  settings: any;
};

const collectImageAssets = async (
  sources: ChapterImageSource[]
): Promise<{ assets: ExportedImageAsset[]; totalBytes: number }> => {
  try {
    const [{ ImageCacheStore }, imageUtils] = await Promise.all([
      import('../../imageCacheService'),
      import('../../imageUtils'),
    ]);

    const blobToBase64DataUrl = imageUtils.blobToBase64DataUrl;
    const assets: ExportedImageAsset[] = [];
    let totalBytes = 0;
    const seen = new Set<string>();
    const cacheSupported = typeof window !== 'undefined' && ImageCacheStore.isSupported();

    for (const source of sources) {
      for (const tr of source.versions) {
        const translationVersion = tr.version ?? 1;
        const illustrations: any[] = Array.isArray((tr as any).suggestedIllustrations)
          ? (tr as any).suggestedIllustrations
          : [];

        for (const illust of illustrations) {
          const marker = illust?.placementMarker || illust?.marker;
          if (!marker) continue;

          const recordChapterId = source.stableId || null;
          let assetPushed = false;

          if (cacheSupported && illust?.generatedImage?.imageCacheKey) {
            const rawKey = illust.generatedImage.imageCacheKey;
            const cacheKey = {
              chapterId: rawKey.chapterId || recordChapterId || '',
              placementMarker: rawKey.placementMarker || marker,
              version: rawKey.version || 1,
            };
            const keyId = `${cacheKey.chapterId}:${cacheKey.placementMarker}:${cacheKey.version}`;
            if (seen.has(keyId)) {
              continue;
            }

            try {
              const blob = await ImageCacheStore.getImageBlob(cacheKey);
              if (blob) {
                const dataUrl = await blobToBase64DataUrl(blob);
                const mimeType = blob.type || getMimeTypeFromDataUrl(dataUrl);
                const sizeBytes = blob.size || estimateBase64SizeBytes(dataUrl);

                assets.push({
                  chapterId: cacheKey.chapterId || recordChapterId,
                  chapterUrl: source.canonicalUrl,
                  translationVersion,
                  marker,
                  dataUrl,
                  mimeType,
                  sizeBytes,
                  source: 'cache',
                  cacheKey,
                });
                totalBytes += sizeBytes;
                seen.add(keyId);
                assetPushed = true;
              }
            } catch (error) {
              telemetryService.captureWarning('export-images-cache-miss', 'Failed to read image from cache', {
                cacheKey,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          if (!assetPushed && illust?.generatedImage?.imageData) {
            const dataUrl = illust.generatedImage.imageData;
            const sizeBytes = estimateBase64SizeBytes(dataUrl);
            const mimeType = getMimeTypeFromDataUrl(dataUrl);

            assets.push({
              chapterId: recordChapterId,
              chapterUrl: source.canonicalUrl,
              translationVersion,
              marker,
              dataUrl,
              mimeType,
              sizeBytes,
              source: 'legacy',
            });
            totalBytes += sizeBytes;
          }
        }
      }
    }

    return { assets, totalBytes };
  } catch (error) {
    telemetryService.captureWarning('export-images', 'Failed to gather image assets', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { assets: [], totalBytes: 0 };
  }
};

const collectCollections = async (deps: ExportOpsDeps): Promise<ExportCollections> => {
  const [settings, urlMappings, novels, chapters, navHist, lastActive, diffResults] = await Promise.all([
    deps.getSettings(),
    deps.getAllUrlMappings(),
    deps.getAllNovels().catch(() => []),
    deps.getAllChapters(),
    deps.getSetting<any>('navigation-history').catch(() => null),
    deps.getSetting<any>('lastActiveChapter').catch(() => null),
    deps.getAllDiffResults().catch(() => []),
  ]);

  return {
    settings,
    urlMappings,
    novels,
    chapters,
    navHistory: navHist,
    lastActive,
    diffResults,
  };
};

export const exportFullSessionToJson = async (
  deps: ExportOpsDeps,
  options: ExportSessionOptions = {}
): Promise<any> => {
  const exportOptions = { ...DEFAULT_EXPORT_OPTIONS, ...options };
  const { settings, urlMappings, novels, chapters, navHistory, lastActive, diffResults } =
    await collectCollections(deps);

  const chaptersOut: any[] = [];
  const chapterImageSources: ChapterImageSource[] = [];

  for (const chapter of chapters) {
    const stableId = chapter.stableId || (await deps.getUrlMappingForUrl(chapter.url))?.stableId || undefined;
    const canonicalUrl = chapter.canonicalUrl || chapter.url;
    const versions = stableId
      ? await deps.getTranslationVersionsByStableId(stableId)
      : await deps.getTranslationVersions(canonicalUrl);
    const feedback = await deps.getFeedback(canonicalUrl).catch(() => []);

    chaptersOut.push({
      stableId,
      canonicalUrl,
      title: chapter.title,
      content: chapter.content,
      fanTranslation: chapter.fanTranslation || null,
      suttaStudio: chapter.suttaStudio ?? null,
      nextUrl: chapter.nextUrl || null,
      prevUrl: chapter.prevUrl || null,
      chapterNumber: chapter.chapterNumber ?? null,
      translations: versions.map(v => ({
        id: v.id,
        version: v.version,
        isActive: v.isActive,
        createdAt: v.createdAt,
        translatedTitle: v.translatedTitle,
        translation: v.translation,
        footnotes: v.footnotes,
        suggestedIllustrations: v.suggestedIllustrations,
        provider: v.provider,
        model: v.model,
        temperature: v.temperature,
        systemPrompt: v.systemPrompt,
        promptId: v.promptId,
        promptName: v.promptName,
        usageMetrics: {
          totalTokens: v.totalTokens,
          promptTokens: v.promptTokens,
          completionTokens: v.completionTokens,
          estimatedCost: v.estimatedCost,
          requestTime: v.requestTime,
          provider: v.provider,
          model: v.model,
        },
      })),
      feedback: feedback.map(f => ({
        id: f.id,
        type: f.type,
        selection: f.selection,
        comment: f.comment,
        createdAt: f.createdAt,
      })),
    });

    chapterImageSources.push({ stableId, canonicalUrl, versions });
  }

  const promptTemplates = await deps.getPromptTemplates().catch(() => []);
  const amendmentLogs = await deps.getAmendmentLogs().catch(() => []);

  let telemetrySnapshot: any = null;
  if (exportOptions.includeTelemetry) {
    try {
      telemetrySnapshot = JSON.parse(telemetryService.exportTelemetry());
    } catch {
      telemetrySnapshot = null;
    }
  }

  let imageAssets: ExportedImageAsset[] = [];
  let imageAssetsTotalBytes = 0;
  if (exportOptions.includeImages) {
    const result = await collectImageAssets(chapterImageSources);
    imageAssets = result.assets;
    imageAssetsTotalBytes = result.totalBytes;
  }

  return {
    metadata: {
      format: 'lexiconforge-full-1',
      generatedAt: new Date().toISOString(),
      diffResultsIncluded: diffResults.length > 0,
      promptTemplatesIncluded: promptTemplates.length > 0,
      telemetryIncluded: Boolean(telemetrySnapshot),
      imagesIncluded: exportOptions.includeImages && imageAssets.length > 0,
      navigationHistoryIncluded: Boolean(navHistory),
    },
    settings,
    urlMappings,
    novels,
    navigationHistory: navHistory,
    lastActiveChapter: lastActive,
    diffResults,
    promptTemplates,
    amendmentLogs,
    telemetry: telemetrySnapshot,
    chapters: chaptersOut,
    images: exportOptions.includeImages
      ? {
          images: imageAssets,
          totalSizeBytes: imageAssetsTotalBytes,
        }
      : undefined,
  };
};
