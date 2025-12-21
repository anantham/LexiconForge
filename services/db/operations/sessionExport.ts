import type { ExportSessionOptions, FeedbackRecord, UrlMappingRecord } from '../types';
import { exportFullSessionToJson as exportSessionOperation } from './export';
import {
  ChapterOps,
  FeedbackOps,
  SettingsOps,
  TemplatesOps,
  TranslationOps,
  MappingsOps,
  DiffOps,
} from './index';
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
