/**
 * Legacy IndexedDB Compatibility Wrapper
 * 
 * This is the ONLY file that imports from services/indexeddb.ts
 * Adapts the old monolith to the new Repo interface for seamless migration.
 */

import { indexedDBService } from '../services/indexeddb';
import type { Repo } from '../adapters/repo/Repo';

/**
 * Legacy repository implementation that wraps the old indexedDBService
 */
export function makeLegacyRepo(): Repo {
  return {
    // ============ Chapters Operations ============
    getChapter: async (url: string) => {
      return indexedDBService.getChapter(url);
    },

    getChapterByStableId: async (stableId: string) => {
      return indexedDBService.getChapterByStableId(stableId);
    },

    storeChapter: async (chapter) => {
      return indexedDBService.storeChapter(chapter);
    },

    storeEnhancedChapter: async (enhanced) => {
      return indexedDBService.storeEnhancedChapter(enhanced);
    },

    getAllChapters: async () => {
      return indexedDBService.getAllChapters();
    },

    findChapterByUrl: async (url: string) => {
      return indexedDBService.findChapterByUrl(url);
    },

    // ============ Translations Operations ============
    storeTranslation: async (chapterUrl, translation, settings) => {
      return indexedDBService.storeTranslation(chapterUrl, translation, settings);
    },

    storeTranslationByStableId: async (stableId, translation, settings) => {
      return indexedDBService.storeTranslationByStableId(stableId, translation, settings);
    },

    getTranslationVersions: async (chapterUrl) => {
      return indexedDBService.getTranslationVersions(chapterUrl);
    },

    getTranslationVersionsByStableId: async (stableId) => {
      return indexedDBService.getTranslationVersionsByStableId(stableId);
    },

    getActiveTranslation: async (chapterUrl) => {
      return indexedDBService.getActiveTranslation(chapterUrl);
    },

    getActiveTranslationByStableId: async (stableId) => {
      return indexedDBService.getActiveTranslationByStableId(stableId);
    },

    setActiveTranslation: async (chapterUrl, version) => {
      return indexedDBService.setActiveTranslation(chapterUrl, version);
    },

    setActiveTranslationByStableId: async (stableId, version) => {
      return indexedDBService.setActiveTranslationByStableId(stableId, version);
    },

    // ============ Feedback Operations ============
    storeFeedback: async (chapterUrl, feedback, translationId) => {
      return indexedDBService.storeFeedback(chapterUrl, feedback, translationId);
    },

    getFeedback: async (chapterUrl) => {
      return indexedDBService.getFeedback(chapterUrl);
    },

    getAllFeedback: async () => {
      return indexedDBService.getAllFeedback();
    },

    // ============ Settings Operations ============
    storeSettings: async (settings) => {
      return indexedDBService.storeSettings(settings);
    },

    getSettings: async () => {
      return indexedDBService.getSettings();
    },

    setSetting: async (key, value) => {
      return indexedDBService.setSetting(key, value);
    },

    getSetting: async (key) => {
      return indexedDBService.getSetting(key);
    },

    // ============ Prompt Templates Operations ============
    storePromptTemplate: async (template) => {
      return indexedDBService.storePromptTemplate(template);
    },

    getPromptTemplates: async () => {
      return indexedDBService.getPromptTemplates();
    },

    getDefaultPromptTemplate: async () => {
      return indexedDBService.getDefaultPromptTemplate();
    },

    getPromptTemplate: async (id) => {
      return indexedDBService.getPromptTemplate(id);
    },

    setDefaultPromptTemplate: async (id) => {
      return indexedDBService.setDefaultPromptTemplate(id);
    },

    // ============ URL Mappings / Novels Operations ============
    getStableIdByUrl: async (url) => {
      return indexedDBService.getStableIdByUrl(url);
    },

    getUrlMappingForUrl: async (url) => {
      return indexedDBService.getUrlMappingForUrl(url);
    },

    getAllUrlMappings: async () => {
      return indexedDBService.getAllUrlMappings();
    },

    getAllNovels: async () => {
      return indexedDBService.getAllNovels();
    },

    // ============ Export Operations ============
    exportFullSessionToJson: async () => {
      return indexedDBService.exportFullSessionToJson();
    },
  };
}

/**
 * Pre-configured legacy repository instance
 */
export const legacyRepo = makeLegacyRepo();