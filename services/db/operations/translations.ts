import type { AppSettings, TranslationResult } from '../../../types';
import { indexedDBService } from '../../indexeddb';
import { StableIdManager } from '../core/stable-ids';
import { STORE_NAMES } from '../core/schema';
import { withReadTxn, withWriteTxn, promisifyRequest } from '../core/txn';
import { isModernDbEnabled } from '../utils/featureFlags';
import {
  ensureChapterUrlMappings,
  recomputeChapterSummary,
  ChapterStoreRecord,
} from './chapters';
import { generateStableChapterId } from '../../stableIdService';

export interface ChapterRef {
  stableId?: string;
  url?: string;
}

type TranslationStoreRecord = {
  id: string;
  chapterUrl: string;
  stableId?: string;
  version: number;
  translatedTitle: string;
  translation: string;
  footnotes: Array<{ marker: string; text: string }>;
  suggestedIllustrations: Array<{ placementMarker: string; imagePrompt: string; url?: string; generatedImage?: string }>;
  provider: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  promptId?: string;
  promptName?: string;
  customVersionLabel?: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
  requestTime: number;
  createdAt: string;
  isActive: boolean;
  proposal?: {
    observation: string;
    currentRule: string;
    proposedChange: string;
    reasoning: string;
  };
};

const TRANSLATION_DOMAIN = 'translations';
const shouldUseLegacy = () => !isModernDbEnabled(TRANSLATION_DOMAIN);

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const resolveUrl = async (ref: ChapterRef): Promise<string> => {
  if (ref.url) return ref.url;
  if (!ref.stableId) throw new Error('ChapterRef requires stableId or url');
  return StableIdManager.getUrlForStableId(ref.stableId);
};

const loadChapterRecord = async (chapterUrl: string): Promise<ChapterStoreRecord | null> => {
  return withReadTxn(
    STORE_NAMES.CHAPTERS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.CHAPTERS];
      const result = (await promisifyRequest(store.get(chapterUrl))) as ChapterStoreRecord | undefined;
      return result || null;
    },
    TRANSLATION_DOMAIN,
    'operations',
    'loadChapter'
  );
};

const recomputeSummaryForUrl = async (chapterUrl: string) => {
  const chapter = await loadChapterRecord(chapterUrl);
  if (chapter) {
    await recomputeChapterSummary(chapter);
  }
};

const getVersionsByUrlModern = async (chapterUrl: string): Promise<TranslationStoreRecord[]> => {
  return withReadTxn(
    STORE_NAMES.TRANSLATIONS,
    async (_txn, stores) => {
      const store = stores[STORE_NAMES.TRANSLATIONS];
      const index = store.index('chapterUrl');
      const results = (await promisifyRequest(
        index.getAll(IDBKeyRange.only(chapterUrl))
      )) as TranslationStoreRecord[];
      return results.sort((a, b) => b.version - a.version);
    },
    TRANSLATION_DOMAIN,
    'operations',
    'getVersionsByUrl'
  );
};

const getVersionsByStableIdModern = async (stableId: string): Promise<TranslationStoreRecord[]> => {
  return withReadTxn(
    [STORE_NAMES.URL_MAPPINGS, STORE_NAMES.TRANSLATIONS],
    async (_txn, stores) => {
      const mappingStore = stores[STORE_NAMES.URL_MAPPINGS];
      const index = mappingStore.index('stableId');
      const mapping = (await promisifyRequest(
        index.get(stableId)
      )) as { url: string } | undefined;
      if (!mapping) return [];
      return getVersionsByUrlModern(mapping.url);
    },
    TRANSLATION_DOMAIN,
    'operations',
    'getVersionsByStableId'
  );
};

const storeTranslationModern = async (
  chapterUrl: string,
  result: TranslationResult,
  settings: Pick<AppSettings, 'provider' | 'model' | 'temperature' | 'systemPrompt'> & {
    promptId?: string;
    promptName?: string;
  }
): Promise<TranslationStoreRecord> => {
  const chapterRecord = await loadChapterRecord(chapterUrl);
  const stableId =
    chapterRecord?.stableId ||
    (chapterRecord
      ? generateStableChapterId(chapterRecord.content || '', chapterRecord.chapterNumber || 0, chapterRecord.title || '')
      : undefined);

  const newRecord = await withWriteTxn(
    STORE_NAMES.TRANSLATIONS,
    async (txn, stores) => {
      const store = stores[STORE_NAMES.TRANSLATIONS];
      const index = store.index('chapterUrl');
      const existing = (await promisifyRequest(
        index.getAll(IDBKeyRange.only(chapterUrl))
      )) as TranslationStoreRecord[];

      const maxVersion = existing.reduce((max, record) => Math.max(max, record.version || 0), 0);

      for (const record of existing) {
        if (record.isActive) {
          record.isActive = false;
          await promisifyRequest(store.put(record));
        }
      }

      const usageMetrics = result.usageMetrics || {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        estimatedCost: 0,
        requestTime: 0,
        provider: settings.provider,
        model: settings.model,
      };

      const newTranslation: TranslationStoreRecord = {
        id: generateId(),
        chapterUrl,
        stableId,
        version: maxVersion + 1,
        translatedTitle: result.translatedTitle,
        translation: result.translation,
        footnotes: result.footnotes || [],
        suggestedIllustrations: result.suggestedIllustrations || [],
        provider: settings.provider,
        model: settings.model,
        temperature: settings.temperature,
        systemPrompt: settings.systemPrompt,
        promptId: settings.promptId,
        promptName: settings.promptName,
        customVersionLabel: result.customVersionLabel,
        totalTokens: usageMetrics.totalTokens,
        promptTokens: usageMetrics.promptTokens,
        completionTokens: usageMetrics.completionTokens,
        estimatedCost: usageMetrics.estimatedCost,
        requestTime: usageMetrics.requestTime,
        createdAt: new Date().toISOString(),
        isActive: true,
        proposal: result.proposal || undefined,
      };

      await promisifyRequest(store.add(newTranslation));
      await new Promise<void>(resolve =>
        txn.addEventListener('complete', () => resolve(), { once: true })
      );

      return newTranslation;
    },
    TRANSLATION_DOMAIN,
    'operations',
    'store'
  );

  if (stableId) {
    await ensureChapterUrlMappings(chapterUrl, stableId);
  }

  await recomputeSummaryForUrl(chapterUrl);
  return newRecord;
};

const setActiveByUrlModern = async (chapterUrl: string, version: number): Promise<void> => {
  const updated = await withWriteTxn(
    STORE_NAMES.TRANSLATIONS,
    async (txn, stores) => {
      const store = stores[STORE_NAMES.TRANSLATIONS];
      const index = store.index('chapterUrl');
      const records = (await promisifyRequest(
        index.getAll(IDBKeyRange.only(chapterUrl))
      )) as TranslationStoreRecord[];

      if (!records.length) {
        return false;
      }

      let found = false;
      for (const record of records) {
        const shouldBeActive = record.version === version;
        if (record.isActive !== shouldBeActive) {
          record.isActive = shouldBeActive;
          await promisifyRequest(store.put(record));
        }
        if (shouldBeActive) {
          found = true;
        }
      }

      await new Promise<void>(resolve =>
        txn.addEventListener('complete', () => resolve(), { once: true })
      );

      return found;
    },
    TRANSLATION_DOMAIN,
    'operations',
    'setActiveByUrl'
  );

  if (!updated) {
    throw new Error(`No translation version ${version} found for ${chapterUrl}`);
  }

  await recomputeSummaryForUrl(chapterUrl);
};

const setActiveByStableIdModern = async (stableId: string, version: number): Promise<void> => {
  const url = await StableIdManager.getUrlForStableId(stableId);
  await setActiveByUrlModern(url, version);
};

const getActiveByUrlModern = async (chapterUrl: string): Promise<TranslationStoreRecord | null> => {
  const versions = await getVersionsByUrlModern(chapterUrl);
  return versions.find(record => record.isActive) || null;
};

const getActiveByStableIdModern = async (stableId: string): Promise<TranslationStoreRecord | null> => {
  const versions = await getVersionsByStableIdModern(stableId);
  return versions.find(record => record.isActive) || null;
};

export class TranslationOps {
  static async store({
    ref,
    result,
    settings,
  }: {
    ref: ChapterRef;
    result: TranslationResult;
    settings: Pick<AppSettings, 'provider' | 'model' | 'temperature' | 'systemPrompt'> & {
      promptId?: string;
      promptName?: string;
    };
  }) {
    const url = await resolveUrl(ref);
    if (shouldUseLegacy()) {
      return indexedDBService.storeTranslationAtomic(url, result, settings);
    }
    return storeTranslationModern(url, result, settings);
  }

  static async setActiveByStableId(stableId: string, version: number): Promise<void> {
    if (shouldUseLegacy()) {
      try {
        await indexedDBService.setActiveTranslationByStableId(stableId, version);
      } catch (e: any) {
        if ((e?.message || '').includes('No URL mapping')) {
          const url = await StableIdManager.getUrlForStableId(stableId);
          await indexedDBService.setActiveTranslation(url, version);
          await StableIdManager.ensureUrlMappings(url, stableId);
          return;
        }
        throw e;
      }
      return;
    }

    await setActiveByStableIdModern(stableId, version);
  }

  static async setActiveByUrl(chapterUrl: string, version: number): Promise<void> {
    if (shouldUseLegacy()) {
      await indexedDBService.setActiveTranslation(chapterUrl, version);
      return;
    }

    await setActiveByUrlModern(chapterUrl, version);
  }

  static async getVersionsByUrl(chapterUrl: string) {
    if (shouldUseLegacy()) {
      return indexedDBService.getTranslationVersions(chapterUrl);
    }
    return getVersionsByUrlModern(chapterUrl);
  }

  static async getVersionsByStableId(stableId: string) {
    if (shouldUseLegacy()) {
      return indexedDBService.getTranslationVersionsByStableId(stableId);
    }
    return getVersionsByStableIdModern(stableId);
  }

  static async getActiveByUrl(chapterUrl: string) {
    if (shouldUseLegacy()) {
      return indexedDBService.getActiveTranslation(chapterUrl);
    }
    return getActiveByUrlModern(chapterUrl);
  }

  static async getActiveByStableId(stableId: string) {
    if (shouldUseLegacy()) {
      return indexedDBService.getActiveTranslationByStableId(stableId);
    }
    return getActiveByStableIdModern(stableId);
  }

  static async storeByStableId(
    stableId: string,
    result: TranslationResult,
    settings: Pick<AppSettings, 'provider' | 'model' | 'temperature' | 'systemPrompt'> & {
      promptId?: string;
      promptName?: string;
    }
  ) {
    const url = await StableIdManager.getUrlForStableId(stableId);
    if (shouldUseLegacy()) {
      return indexedDBService.storeTranslationAtomic(url, result, settings);
    }
    return storeTranslationModern(url, result, settings);
  }
}
