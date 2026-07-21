import type { ExportSessionOptions, FeedbackRecord, UrlMappingRecord } from '../types';
import { exportFullSessionToJson as exportSessionOperation } from './export';
// Import each Op from its concrete module, NOT './index': the barrel re-exports
// this file (operations/index.ts), so a round-trip through it is a real
// import cycle with TDZ/undefined-at-init risk in the persistence layer.
import { ChapterOps } from './chapters';
import { FeedbackOps } from './feedback';
import { SettingsOps } from './settings';
import { TemplatesOps } from './templates';
import { TranslationOps } from './translations';
import { MappingsOps } from './mappings';
import { DiffOps } from './diffResults';
import { AmendmentOps } from './amendments';

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
        getAllDiffResults: () => DiffOps.getAll(),
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
