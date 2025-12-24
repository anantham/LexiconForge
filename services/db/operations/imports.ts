import type {
  ChapterRecord,
  FeedbackRecord,
  NovelRecord,
  PromptTemplateRecord,
  TranslationRecord,
  UrlMappingRecord,
  AmendmentLogRecord,
  ExportedImageAsset,
} from '../types';
import type { StableSessionData } from '../../stableIdService';
import type { DiffResult } from '../../diff/types';
import { getConnection } from '../core/connection';
import { STORE_NAMES } from '../core/schema';
import { ImageCacheStore } from '../../imageCacheService';

export type ImportProgressStage = 'settings' | 'chapters' | 'complete';
export type ImportProgressHandler = (
  stage: ImportProgressStage,
  current: number,
  total: number,
  message: string
) => void;

const BATCH_SIZE = 50;

const nowIso = () => new Date().toISOString();

type StoredDiffResult = DiffResult & { fanVersionId: string };

const prepareDiffResultForStorage = (record: DiffResult): StoredDiffResult => ({
  ...record,
  fanVersionId: record.fanVersionId ?? '',
  aiHash: record.aiHash ?? null,
  fanHash: record.fanHash ?? null,
  rawHash: record.rawHash ?? record.rawVersionId,
});

const putSettingsRecord = (
  store: IDBObjectStore,
  key: string,
  value: unknown,
  timestamp: string = nowIso()
) => {
  store.put({ key, value, updatedAt: timestamp });
};

type StableImportPayload = Pick<StableSessionData, 'chapters' | 'urlIndex' | 'rawUrlIndex'> &
  Partial<Pick<StableSessionData, 'novels' | 'currentChapterId' | 'navigationHistory'>>;

export class ImportOps {
  static async importFullSessionData(payload: any, onProgress?: ImportProgressHandler): Promise<void> {
    const db = await getConnection();
    const hasDiffResultsStore = db.objectStoreNames.contains(STORE_NAMES.DIFF_RESULTS);
    const {
      settings,
      urlMappings,
      novels,
      chapters,
      promptTemplates,
      diffResults,
      navigation,
      amendmentLogs,
      images: imagesPayload,
    } = payload ?? {};

    onProgress?.('settings', 0, 1, 'Importing settings and metadata…');

    await new Promise<void>((resolve, reject) => {
      const storeNames = [
        STORE_NAMES.SETTINGS,
        STORE_NAMES.URL_MAPPINGS,
        STORE_NAMES.NOVELS,
        STORE_NAMES.PROMPT_TEMPLATES,
        STORE_NAMES.AMENDMENT_LOGS,
      ];
      const tx = db.transaction(storeNames, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      const settingsStore = tx.objectStore(STORE_NAMES.SETTINGS);
      const urlStore = tx.objectStore(STORE_NAMES.URL_MAPPINGS);
      const novelsStore = tx.objectStore(STORE_NAMES.NOVELS);
      const promptStore = tx.objectStore(STORE_NAMES.PROMPT_TEMPLATES);
      const amendmentStore = tx.objectStore(STORE_NAMES.AMENDMENT_LOGS);

      if (settings) {
        putSettingsRecord(settingsStore, 'app-settings', settings);
      }

      if (navigation) {
        putSettingsRecord(settingsStore, 'navigation-history', {
          stableIds: navigation.history || [],
        });
        if (navigation.lastActive) {
          putSettingsRecord(settingsStore, 'lastActiveChapter', navigation.lastActive);
        }
      }

      if (Array.isArray(urlMappings)) {
        for (const mapping of urlMappings as UrlMappingRecord[]) {
          urlStore.put({
            url: mapping.url,
            stableId: mapping.stableId,
            isCanonical: Boolean(mapping.isCanonical),
            dateAdded: mapping.dateAdded || nowIso(),
          } as UrlMappingRecord);
        }
      }

      if (Array.isArray(novels)) {
        for (const novel of novels as NovelRecord[]) {
          novelsStore.put({
            id: novel.id,
            title: novel.title,
            source: novel.source,
            chapterCount: novel.chapterCount || 0,
            dateAdded: novel.dateAdded || nowIso(),
            lastAccessed: novel.lastAccessed || nowIso(),
          } as NovelRecord);
        }
      }

      if (Array.isArray(promptTemplates)) {
        for (const template of promptTemplates as PromptTemplateRecord[]) {
          promptStore.put({
            id: template.id,
            name: template.name,
            description: template.description,
            content: template.content,
            isDefault: Boolean(template.isDefault),
            createdAt: template.createdAt || nowIso(),
            lastUsed: template.lastUsed || undefined,
          } as PromptTemplateRecord);
        }
      }

      if (Array.isArray(amendmentLogs)) {
        for (const log of amendmentLogs as AmendmentLogRecord[]) {
          amendmentStore.put(log);
        }
      }
    });

    const chapterList = Array.isArray(chapters) ? (chapters as any[]) : [];
    const totalChapters = chapterList.length;

    if (totalChapters > 0) {
      for (let i = 0; i < totalChapters; i += BATCH_SIZE) {
        const batch = chapterList.slice(i, i + BATCH_SIZE);
        const current = Math.min(i + BATCH_SIZE, totalChapters);
        onProgress?.('chapters', current, totalChapters, `Importing chapters ${current}/${totalChapters}…`);

        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(
            [STORE_NAMES.CHAPTERS, STORE_NAMES.TRANSLATIONS, STORE_NAMES.FEEDBACK],
            'readwrite'
          );
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);

          const chaptersStore = tx.objectStore(STORE_NAMES.CHAPTERS);
          const translationsStore = tx.objectStore(STORE_NAMES.TRANSLATIONS);
          const feedbackStore = tx.objectStore(STORE_NAMES.FEEDBACK);

          for (const chapter of batch) {
            const canonicalUrl = chapter.canonicalUrl || chapter.url;
            if (!canonicalUrl) continue;
            const chapterRecord: ChapterRecord = {
              url: canonicalUrl,
              stableId: chapter.stableId,
              title: chapter.title,
              content: chapter.content,
              fanTranslation: chapter.fanTranslation || undefined,
              originalUrl: canonicalUrl,
              nextUrl: chapter.nextUrl || undefined,
              prevUrl: chapter.prevUrl || undefined,
              dateAdded: nowIso(),
              lastAccessed: nowIso(),
              chapterNumber: chapter.chapterNumber || undefined,
              canonicalUrl,
            };
            chaptersStore.put(chapterRecord);

            const translations = Array.isArray(chapter.translations) ? chapter.translations : [];
            for (const translation of translations) {
              translationsStore.put({
                id: translation.id || crypto.randomUUID(),
                chapterUrl: canonicalUrl,
                stableId: chapter.stableId,
                version: translation.version || 1,
                translatedTitle: translation.translatedTitle,
                translation: translation.translation,
                footnotes: translation.footnotes || [],
                suggestedIllustrations: translation.suggestedIllustrations || [],
                provider: translation.provider,
                model: translation.model,
                temperature: translation.temperature,
                systemPrompt: translation.systemPrompt,
                promptId: translation.promptId,
                promptName: translation.promptName,
                totalTokens: translation.usageMetrics?.totalTokens || 0,
                promptTokens: translation.usageMetrics?.promptTokens || 0,
                completionTokens: translation.usageMetrics?.completionTokens || 0,
                estimatedCost: translation.usageMetrics?.estimatedCost || 0,
                requestTime: translation.usageMetrics?.requestTime || 0,
                createdAt: translation.createdAt || nowIso(),
                isActive: Boolean(translation.isActive),
              } as TranslationRecord);
            }

            const feedbackItems = Array.isArray(chapter.feedback) ? chapter.feedback : [];
            for (const fb of feedbackItems) {
              feedbackStore.put({
                id: fb.id || crypto.randomUUID(),
                chapterUrl: canonicalUrl,
                translationId: fb.translationId,
                type: fb.type,
                selection: fb.selection,
                comment: fb.comment || '',
                createdAt: fb.createdAt || nowIso(),
              } as FeedbackRecord);
            }
          }
        });

        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    if (hasDiffResultsStore && Array.isArray(diffResults)) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_NAMES.DIFF_RESULTS], 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        const store = tx.objectStore(STORE_NAMES.DIFF_RESULTS);
        for (const record of diffResults as DiffResult[]) {
          store.put(prepareDiffResultForStorage(record) as StoredDiffResult);
        }
      });
    }

    const imageAssets: ExportedImageAsset[] = Array.isArray(imagesPayload?.images)
      ? (imagesPayload.images as ExportedImageAsset[])
      : [];
    if (imageAssets.length > 0) {
      await this.restoreImageAssets(imageAssets);
    }

    onProgress?.('complete', totalChapters, totalChapters, 'Import complete');
  }

  static async importStableSessionData(stableData: StableImportPayload): Promise<void> {
    const db = await getConnection();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_NAMES.CHAPTERS, STORE_NAMES.URL_MAPPINGS], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      const chaptersStore = tx.objectStore(STORE_NAMES.CHAPTERS);
      const mappingsStore = tx.objectStore(STORE_NAMES.URL_MAPPINGS);
      const timestamp = nowIso();

      for (const [, chapter] of stableData.chapters || []) {
        const canonicalUrl = chapter.canonicalUrl || chapter.originalUrl;
        if (!canonicalUrl) continue;
        const record: ChapterRecord = {
          url: canonicalUrl,
          stableId: chapter.stableId || chapter.id || undefined,
          title: chapter.title || '',
          content: chapter.content || '',
          originalUrl: canonicalUrl,
          nextUrl: chapter.nextUrl || undefined,
          prevUrl: chapter.prevUrl || undefined,
          fanTranslation: chapter.fanTranslation || undefined,
          dateAdded: timestamp,
          lastAccessed: timestamp,
          chapterNumber: chapter.chapterNumber || undefined,
          canonicalUrl,
        };
        chaptersStore.put(record);
      }

      const writeMapping = (url: string, stableId: string, isCanonical: boolean) => {
        mappingsStore.put({
          url,
          stableId,
          isCanonical,
          dateAdded: timestamp,
        } as UrlMappingRecord);
      };

      for (const [url, stableId] of stableData.urlIndex || []) {
        writeMapping(url, stableId, true);
      }
      for (const [url, stableId] of stableData.rawUrlIndex || []) {
        writeMapping(url, stableId, false);
      }
    });
  }

  private static async restoreImageAssets(assets: ExportedImageAsset[]): Promise<void> {
    if (typeof window === 'undefined') {
      console.warn('[Import] Skipping image restoration (window undefined)');
      return;
    }

    if (!ImageCacheStore.isSupported()) {
      console.warn('[Import] Cache API not supported; cannot restore images');
      return;
    }

    for (const asset of assets) {
      const chapterId = asset.cacheKey?.chapterId || asset.chapterId;
      const marker = asset.cacheKey?.placementMarker || asset.marker;
      const dataUrl = asset.dataUrl;
      if (!chapterId || !marker || !dataUrl) {
        console.warn('[Import] Skipping image asset with missing data', {
          chapterId,
          marker,
        });
        continue;
      }

      const version = asset.cacheKey?.version || asset.translationVersion || 1;
      try {
        await ImageCacheStore.migrateBase64Image(chapterId, marker, dataUrl, version);
      } catch (error) {
        console.warn('[Import] Failed to restore image asset', {
          chapterId,
          marker,
          version,
          error,
        });
      }
    }
  }
}
