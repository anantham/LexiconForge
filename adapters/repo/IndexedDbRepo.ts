import { indexedDBService } from '../../services/indexeddb';
import type { Repo } from './Repo';

export const IndexedDbRepo: Repo = {
  // Chapters
  getChapter: (url) => indexedDBService.getChapter(url),
  getChapterByStableId: (stableId) => indexedDBService.getChapterByStableId(stableId),
  storeChapter: (chapter) => indexedDBService.storeChapter(chapter),
  storeEnhancedChapter: (enhanced) => indexedDBService.storeEnhancedChapter(enhanced),
  getAllChapters: () => indexedDBService.getAllChapters(),
  findChapterByUrl: (url) => indexedDBService.findChapterByUrl(url),

  // Translations
  storeTranslation: (chapterUrl, translation, settings) => indexedDBService.storeTranslation(chapterUrl, translation, settings),
  storeTranslationByStableId: (stableId, translation, settings) => indexedDBService.storeTranslationByStableId(stableId, translation, settings),
  getTranslationVersions: (chapterUrl) => indexedDBService.getTranslationVersions(chapterUrl),
  getTranslationVersionsByStableId: (stableId) => indexedDBService.getTranslationVersionsByStableId(stableId),
  getActiveTranslation: (chapterUrl) => indexedDBService.getActiveTranslation(chapterUrl),
  getActiveTranslationByStableId: (stableId) => indexedDBService.getActiveTranslationByStableId(stableId),
  setActiveTranslation: (chapterUrl, version) => indexedDBService.setActiveTranslation(chapterUrl, version),
  setActiveTranslationByStableId: (stableId, version) => indexedDBService.setActiveTranslationByStableId(stableId, version),

  // Feedback
  storeFeedback: (chapterUrl, feedback, translationId) => indexedDBService.storeFeedback(chapterUrl, feedback, translationId),
  getFeedback: (chapterUrl) => indexedDBService.getFeedback(chapterUrl),
  getAllFeedback: () => indexedDBService.getAllFeedback(),

  // Settings & templates
  storeSettings: (settings) => indexedDBService.storeSettings(settings),
  getSettings: () => indexedDBService.getSettings(),
  setSetting: (key, value) => indexedDBService.setSetting(key, value),
  getSetting: (key) => indexedDBService.getSetting(key),
  storePromptTemplate: (t) => indexedDBService.storePromptTemplate(t),
  getPromptTemplates: () => indexedDBService.getPromptTemplates(),
  getDefaultPromptTemplate: () => indexedDBService.getDefaultPromptTemplate(),
  getPromptTemplate: (id) => indexedDBService.getPromptTemplate(id),
  setDefaultPromptTemplate: (id) => indexedDBService.setDefaultPromptTemplate(id),

  // URL mappings / novels
  getStableIdByUrl: (url) => indexedDBService.getStableIdByUrl(url),
  getUrlMappingForUrl: (url) => indexedDBService.getUrlMappingForUrl(url),
  getAllUrlMappings: () => indexedDBService.getAllUrlMappings(),
  getAllNovels: () => indexedDBService.getAllNovels(),

  // Export helpers
  exportFullSessionToJson: () => indexedDBService.exportFullSessionToJson(),
};

export default IndexedDbRepo;

