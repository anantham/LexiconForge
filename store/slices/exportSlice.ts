import { StateCreator } from 'zustand';
import type { ExportSessionOptions } from '../../services/db/types';
import type { TelemetryInsights } from '../../services/epubService';
import { blobToBase64DataUrl } from '../../services/imageUtils';
import { ImageCacheStore } from '../../services/imageCacheService';
import { telemetryService } from '../../services/telemetryService';
import type { ImageGenerationMetadata } from '../../types';
import { SessionExportOps, SettingsOps, TranslationOps } from '../../services/db/operations';
import { fetchChaptersForReactRendering } from '../../services/db/operations/rendering';
import type { CoverImageRef } from '../../components/settings/types';

// Export slice state
export interface ExportSlice {
  // Export actions
  exportSessionData: (options?: ExportSessionOptions) => Promise<string>;
  exportEpub: () => Promise<void>;
}

// Debug logging utilities (copied from old store)
const storeDebugEnabled = (): boolean => {
  try {
    const lvl = localStorage.getItem('LF_AI_DEBUG_LEVEL');
    return lvl === 'full' || localStorage.getItem('LF_AI_DEBUG') === '1';
  } catch {
    return false;
  }
};

const swarn = (...args: any[]) => {
  if (storeDebugEnabled()) console.warn(...args);
};

const normalizeDuration = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const numeric = parseFloat(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  return 0;
};

const collectTelemetryInsights = (): TelemetryInsights | null => {
  try {
    const summary = telemetryService.getSummary?.();
    const events = telemetryService.getEvents?.('performance') || [];
    if (!summary) return null;

    const collect = (label: string) => {
      const filtered = events.filter(event => event.message === label);
      const total = filtered.reduce((sum, event) => sum + normalizeDuration(event.data?.durationMs), 0);
      const count = filtered.length;
      return { count, totalMs: total, averageMs: count > 0 ? total / count : 0 };
    };

    return {
      totalEvents: summary.totalEvents ?? events.length,
      sessionDurationMs: normalizeDuration(summary.sessionDurationMs),
      navigation: collect('ux:navigation:handleNavigate'),
      hydration: collect('ux:navigation:hydrateChapter'),
      chapterReady: collect('ux:component:ChapterView:ready'),
      exports: {
        json: collect('ux:export:json'),
        epub: collect('ux:export:epub')
      }
    };
  } catch {
    return null;
  }
};

export const buildImageCaption = (version: number, metadata: ImageGenerationMetadata | undefined, fallbackPrompt: string): string => {
  if (!metadata) {
    return `Version ${version}: ${fallbackPrompt}`;
  }

  const details: string[] = [];

  if (metadata.negativePrompt) {
    details.push(`Negative: ${metadata.negativePrompt}`);
  }
  if (typeof metadata.guidanceScale === 'number') {
    details.push(`Guidance ${metadata.guidanceScale}`);
  }
  if (metadata.loraModel) {
    const strength = typeof metadata.loraStrength === 'number' ? ` (${metadata.loraStrength})` : '';
    details.push(`LoRA ${metadata.loraModel}${strength}`);
  }
  if (metadata.steeringImage) {
    details.push(`Steering ${metadata.steeringImage}`);
  }
  const modelParts = [metadata.provider, metadata.model].filter(Boolean).join(' ');
  if (modelParts) {
    details.push(`Model ${modelParts}`);
  }
  if (metadata.generatedAt) {
    details.push(`Generated ${new Date(metadata.generatedAt).toLocaleString()}`);
  }

  const suffix = details.length > 0 ? ` • ${details.join(' • ')}` : '';
  return `Version ${version}: ${metadata.prompt}${suffix}`;
};

export const createExportSlice: StateCreator<
  any, // We need to accept the full store type here
  [],
  [],
  ExportSlice
> = (set, get) => ({
  exportSessionData: async (options?: ExportSessionOptions) => {
    const storeState = get();
    const start = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();

    try {
      const jsonObj = await SessionExportOps.exportFullSession(options);
      const finalOptions: Required<ExportSessionOptions> = {
        includeChapters: true,
        includeTelemetry: true,
        includeImages: true,  // Include images by default for portable exports
        ...(jsonObj?.metadata?.exportOptions ?? {})
      } as Required<ExportSessionOptions>;

      const ensureChaptersFromMemory = () => {
        if (!finalOptions.includeChapters) return;
        if (Array.isArray(jsonObj.chapters) && jsonObj.chapters.length > 0) return;

        const memoryChapters = Array.from(storeState.chapters.values() || []);
        if (!memoryChapters.length) return;

        jsonObj.chapters = memoryChapters.map((chapter: any) => {
          const translation = chapter.translationResult;
          const usage = translation?.usageMetrics || {};
          const provider = usage.provider || storeState.settings?.provider || 'unknown';
          const model = usage.model || storeState.settings?.model || 'unknown';

          return {
            stableId: chapter.id || chapter.canonicalUrl || chapter.originalUrl,
            canonicalUrl: chapter.canonicalUrl || chapter.originalUrl,
            title: chapter.title,
            content: chapter.content,
            fanTranslation: chapter.fanTranslation || null,
            nextUrl: chapter.nextUrl || null,
            prevUrl: chapter.prevUrl || null,
            chapterNumber: chapter.chapterNumber ?? null,
            translations: translation ? [{
              id: translation.id || `${chapter.id || 'memory'}-v1`,
              version: translation.version || 1,
              isActive: true,
              createdAt: translation.createdAt || null,
              translatedTitle: translation.translatedTitle,
              translation: translation.translation,
              footnotes: translation.footnotes || [],
              suggestedIllustrations: translation.suggestedIllustrations || [],
              provider,
              model,
              temperature: translation.usageMetrics?.temperature,
              systemPrompt: (chapter as any).translationSettingsSnapshot?.systemPrompt,
              promptId: (chapter as any).translationSettingsSnapshot?.promptId,
              promptName: (chapter as any).translationSettingsSnapshot?.promptName,
              usageMetrics: {
                totalTokens: usage.totalTokens || 0,
                promptTokens: usage.promptTokens || 0,
                completionTokens: usage.completionTokens || 0,
                estimatedCost: usage.estimatedCost || 0,
                requestTime: usage.requestTime || 0,
                provider,
                model
              }
            }] : [],
            feedback: chapter.feedback || []
          };
        });
      };

      ensureChaptersFromMemory();

      const json = JSON.stringify(jsonObj, null, 2);
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
      const filename = `lexicon-forge-session-${timestamp}.json`;

      try {
        const isJsdom = typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string' && navigator.userAgent.includes('jsdom');
        if (!isJsdom) {
          const link = document.createElement('a');
          link.download = filename;
          link.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(json);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch (error) {
        swarn('[Export] Failed to trigger JSON download', error);
      }

      const end = typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

      let fileSizeBytes: number;
      try {
        fileSizeBytes = new TextEncoder().encode(json).length;
      } catch {
        fileSizeBytes = json.length;
      }

      telemetryService.capturePerformance('ux:export:json', end - start, {
        includeChapters: finalOptions.includeChapters,
        includeTelemetry: finalOptions.includeTelemetry,
        includeImages: finalOptions.includeImages,
        chapterCount: Array.isArray(jsonObj?.chapters) ? jsonObj.chapters.length : 0,
        imageAssetCount: jsonObj?.assetMetadata?.images?.count ?? 0,
        imageAssetSizeBytes: jsonObj?.assetMetadata?.images?.totalSizeBytes ?? 0,
        telemetryEvents: jsonObj?.telemetry?.events ? jsonObj.telemetry.events.length : undefined,
        fileSizeBytes
      });

      return json;
    } catch (error) {
      telemetryService.captureError('export-json', error, {
        options
      });
      throw error;
    }
  },

  exportEpub: async () => {
    const start = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
    const settings = get().settings;
    const { imageVersions, activeImageVersion } = get();
    const chaptersForEpub: import('../../services/epubService').ChapterForEpub[] = [];

    try {
      // Gather chapters in order using IndexedDB as ground truth
      const [rendering, navHistSetting] = await Promise.all([
        fetchChaptersForReactRendering(),
        SettingsOps.getKey<any>('navigation-history').catch(() => null),
      ]);

      const navOrder: string[] = Array.isArray(navHistSetting?.stableIds) ? navHistSetting.stableIds : [];
      const byStableId = new Map(rendering.map(r => [r.stableId, r] as const));

      // Build candidate orders
      // A) Navigation-first (current default behavior)
      const remaining = rendering
        .map(r => r.stableId)
        .filter(id => !navOrder.includes(id));
      const sortedRemaining = remaining.sort((a, b) => {
        const ca = byStableId.get(a)?.chapterNumber ?? 0;
        const cb = byStableId.get(b)?.chapterNumber ?? 0;
        return ca - cb;
      });
      const navOrdered = [...navOrder.filter(id => byStableId.has(id)), ...sortedRemaining];

      // B) Numeric chapterNumber order (preferred when most chapters have numbers)
      const extractNumFromTitle = (t?: string): number => {
        if (!t) return 0;
        const m = t.match(/(?:chapter|episode)\s*(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
      };
      const withNumbers = rendering.map(r => ({
        id: r.stableId,
        num: (r.chapterNumber && r.chapterNumber > 0) ? r.chapterNumber : extractNumFromTitle(r.title)
      }));
      const haveNums = withNumbers.filter(x => x.num && x.num > 0).length;
      const numericOrdered = withNumbers
        .slice()
        .sort((a, b) => (a.num || 0) - (b.num || 0))
        .map(x => x.id);

      // Choose ordering based on settings or heuristic
      const prefOrder = settings.exportOrder;
      let ordered: string[];
      if (prefOrder === 'number') ordered = numericOrdered;
      else if (prefOrder === 'navigation') ordered = navOrdered;
      else {
        const threshold = Math.ceil(rendering.length * 0.6);
        ordered = haveNums >= threshold ? numericOrdered : navOrdered;
      }

      // Build ChapterForEpub list using active translation versions
      for (const sid of ordered) {
        const ch = byStableId.get(sid);
        if (!ch) continue;
        const active = await TranslationOps.getActiveByStableId(sid);
        if (!active) continue;

        const suggestedIllustrations = active.suggestedIllustrations || [];
        const hasModernImages = suggestedIllustrations.some((illust: any) => illust.generatedImage?.imageCacheKey || illust.imageCacheKey);
        const imageCacheModule = hasModernImages
          ? await import('../../services/imageCacheService')
          : null;

        // Compose chapter for EPUB - process images with version awareness
        const images = await Promise.all(
          suggestedIllustrations.map(async (illust: any) => {
            // Check if this illustration has a cache key (modern versioned images)
            const imageCacheKey = illust.generatedImage?.imageCacheKey || illust.imageCacheKey;
            const versionKey = ch.id && illust.placementMarker
              ? `${ch.id}:${illust.placementMarker}`
              : null;
            const version = versionKey
              ? activeImageVersion[versionKey] || imageVersions[versionKey] || 1
              : 1;
            const versionStateEntry = (active as any).imageVersionState?.[illust.placementMarker];
            try {
              if (imageCacheKey && ch.id && imageCacheModule) {
                // Modern path: Retrieve from Cache API using active version
                const { ImageCacheStore } = imageCacheModule;

                const versionedKey = {
                  chapterId: ch.id,
                  placementMarker: illust.placementMarker,
                  version: version
                };

                const blob = await ImageCacheStore.getImageBlob(versionedKey);

                if (blob) {
                  const base64DataUrl = await blobToBase64DataUrl(blob);
                  const metadata: ImageGenerationMetadata | undefined = versionStateEntry?.versions?.[version];
                  const caption = buildImageCaption(version, metadata, illust.imagePrompt);
                  return {
                    marker: illust.placementMarker,
                    imageData: base64DataUrl,
                    prompt: caption
                  };
                }
              }

              // Legacy fallback: use .url field (base64 data URL)
              const legacyUrl = (illust as any).url;
              if (legacyUrl) {
                const metadata: ImageGenerationMetadata | undefined = versionStateEntry?.versions?.[version];
                const caption = buildImageCaption(version, metadata, illust.imagePrompt);
                return {
                  marker: illust.placementMarker,
                  imageData: legacyUrl,
                  prompt: caption
                };
              }

              // No image available
              return null;
            } catch (error) {
              console.error(`[Export] Failed to retrieve image for marker ${illust.placementMarker}:`, error);
              // Try legacy fallback on error
              const legacyUrl = (illust as any).url;
              if (legacyUrl) {
                const metadata: ImageGenerationMetadata | undefined = versionStateEntry?.versions?.[version];
                const caption = buildImageCaption(version, metadata, illust.imagePrompt);
                return {
                  marker: illust.placementMarker,
                  imageData: legacyUrl,
                  prompt: caption
                };
              }
              return null;
            }
          })
        );

        // Filter out null entries (illustrations without images)
        const validImages = images.filter((img): img is NonNullable<typeof img> => img !== null);

        const footnotes = (active.footnotes || []).map((f: any) => ({ marker: f.marker, text: f.text }));
        chaptersForEpub.push({
          title: ch.title,
          content: active.translation || ch.data?.chapter?.content || '',
          originalUrl: ch.url,
          translatedTitle: active.translatedTitle || ch.title,
          usageMetrics: {
            totalTokens: active.totalTokens || 0,
            promptTokens: active.promptTokens || 0,
            completionTokens: active.completionTokens || 0,
            estimatedCost: active.estimatedCost || 0,
            requestTime: active.requestTime || 0,
            provider: (active.provider as any) || settings.provider,
            model: active.model || settings.model,
          },
          images: validImages,  // Use validImages (filtered, version-aware)
          footnotes,
        });
      }

      if (chaptersForEpub.length === 0) {
        throw new Error('No chapters with active translations found to export.');
      }

      // Generate EPUB via service
      const telemetryInsights = collectTelemetryInsights();
      const { generateEpub, getDefaultTemplate } = await import('../../services/epubService');
      // Enable EPUB debug artifacts only when diagnostics logging level is FULL
      let epubDebug = false;
      try {
        const level = localStorage.getItem('LF_AI_DEBUG_LEVEL');
        const full = localStorage.getItem('LF_AI_DEBUG_FULL');
        epubDebug = (level && level.toLowerCase() === 'full') || (full === '1' || (full ?? '').toLowerCase() === 'true');
      } catch {}

      const tpl = getDefaultTemplate();
      const s = settings as any;
      if (s.epubGratitudeMessage) tpl.gratitudeMessage = s.epubGratitudeMessage;
      if (s.epubProjectDescription) tpl.projectDescription = s.epubProjectDescription;
      if (s.epubFooter !== undefined) tpl.customFooter = s.epubFooter || '';

      // Fetch novel metadata and cover image from storage
      let coverImageData: string | undefined;
      let novelTitle: string | undefined;
      let novelAuthor: string | undefined;
      let novelDescription: string | undefined;
      try {
        const novelMetaJson = localStorage.getItem('novelMetadata');
        if (novelMetaJson) {
          const novelMeta = JSON.parse(novelMetaJson) as {
            title?: string;
            author?: string;
            description?: string;
            coverImage?: CoverImageRef;
          };
          // Extract title/author from metadata
          novelTitle = novelMeta?.title;
          novelAuthor = novelMeta?.author;
          novelDescription = novelMeta?.description;
          console.log('[ExportSlice] Novel metadata loaded:', { title: novelTitle, author: novelAuthor });

          // Fetch cover image if selected
          if (novelMeta?.coverImage?.cacheKey) {
            const blob = await ImageCacheStore.getImageBlob(novelMeta.coverImage.cacheKey);
            if (blob) {
              coverImageData = await blobToBase64DataUrl(blob);
              console.log('[ExportSlice] Cover image loaded from cache');
            }
          }
        }
      } catch (err) {
        console.warn('[ExportSlice] Failed to load novel metadata:', err);
      }

      await generateEpub({
        title: novelTitle,
        author: novelAuthor,
        description: novelDescription,
        chapters: chaptersForEpub,
        settings,
        template: tpl,
        novelConfig: undefined,
        includeTitlePage: settings.includeTitlePage !== false,
        includeStatsPage: settings.includeStatsPage !== false,
        telemetryInsights: telemetryInsights || undefined,
        customTemplate: undefined,
        manualConfig: undefined,
        chapterUrls: undefined,
        coverImage: coverImageData,
      });

      const end = typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
      const totalImages = chaptersForEpub.reduce((sum, chapter) => sum + (chapter.images?.length ?? 0), 0);
      telemetryService.capturePerformance('ux:export:epub', end - start, {
        chapterCount: chaptersForEpub.length,
        imageCount: totalImages,
        includeTitlePage: !!settings.includeTitlePage,
        includeStatsPage: !!settings.includeStatsPage
      });
    } catch (e: any) {
      console.error('[Export] EPUB generation failed', e);
      telemetryService.captureError('export-epub', e, {
        chapterCount: chaptersForEpub.length
      });
      throw e;
    }
  }
});
