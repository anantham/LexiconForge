import type { ExportSessionOptions, FeedbackRecord, UrlMappingRecord } from '../types';
import { exportFullSessionToJson as exportSessionOperation } from './export';
import {
  ChapterOps,
  FeedbackOps,
  SettingsOps,
  TemplatesOps,
  TranslationOps,
  MappingsOps,
} from './index';
import { AmendmentOps } from './amendments';
import { STORE_NAMES } from '../core/schema';
import { withReadTxn, promisifyRequest } from '../core/txn';

const DOMAIN = 'sessionExport';

const getAllDiffResults = async (): Promise<any[]> => {
  try {
    return await withReadTxn(
      STORE_NAMES.DIFF_RESULTS,
      async (_txn, stores) => {
        const store = stores[STORE_NAMES.DIFF_RESULTS];
        return (await promisifyRequest(store.getAll())) as any[];
      },
      DOMAIN,
      'operations',
      'getAllDiffResults'
    );
  } catch {
    return [];
  }
};

const getUrlMappingOrNull = (url: string): Promise<UrlMappingRecord | null> => {
  return MappingsOps.getUrlMappingForUrl(url);
};

const getFeedbackForChapter = (url: string): Promise<FeedbackRecord[]> => {
  return FeedbackOps.get(url);
};

export class SessionExportOps {
  static exportFullSession(options?: ExportSessionOptions) {
    return exportSessionOperation(
      {
        getSettings: () => SettingsOps.get(),
        getAllUrlMappings: () => MappingsOps.getAllUrlMappings(),
        getAllNovels: () => MappingsOps.getAllNovels(),
        getAllChapters: () => ChapterOps.getAll(),
        getSetting: <T>(key: string) => SettingsOps.getKey<T>(key),
        getAllDiffResults,
        getUrlMappingForUrl: getUrlMappingOrNull,
        getTranslationVersionsByStableId: (stableId: string) =>
          TranslationOps.getVersionsByStableId(stableId),
        getTranslationVersions: (url: string) =>
          TranslationOps.getVersionsByUrl(url),
        getFeedback: getFeedbackForChapter,
        getPromptTemplates: () => TemplatesOps.getAll(),
        getAmendmentLogs: () => AmendmentOps.getLogs(),
      },
      options
    );
  }
}
