/**
 * Database Service Factory - Hybrid Approach
 * 
 * Single entry point combining GPT-5's backend abstraction 
 * with Claude's service-aware migration control.
 */

import type { Repo } from '../../adapters/repo/Repo';
import { makeLegacyRepo } from '../../legacy/indexeddb-compat';
import { migrationController, type Backend, type ServiceName } from './migration/phase-controller';
import { isIndexedDBAvailable } from './core/connection';
import {
  TranslationOps,
  ChapterOps,
  FeedbackOps,
  SettingsOps,
  TemplatesOps,
  MappingsOps,
  ExportOps,
} from './operations';

// Environment-based backend selection
const DEFAULT_BACKEND: Backend = 
  (import.meta?.env?.VITE_DB_BACKEND as Backend) ?? 
  (process.env?.VITE_DB_BACKEND as Backend) ?? 
  'legacy';

/**
 * Memory-based repository for fallback scenarios
 */
function makeMemoryRepo(): Repo {
  // Simple in-memory storage for when IndexedDB is unavailable
  const storage = {
    chapters: new Map<string, any>(),
    translations: new Map<string, any>(),
    settings: new Map<string, any>(),
    feedback: new Map<string, any>(),
    promptTemplates: new Map<string, any>(),
    urlMappings: new Map<string, any>(),
  };

  return {
    // Chapters
    getChapter: async (url) => storage.chapters.get(url) || null,
    getChapterByStableId: async (stableId) => {
      for (const chapter of storage.chapters.values()) {
        if (chapter.stableId === stableId) return chapter;
      }
      return null;
    },
    storeChapter: async (chapter) => {
      storage.chapters.set(chapter.url, chapter);
    },
    storeEnhancedChapter: async (enhanced) => {
      storage.chapters.set(enhanced.url, enhanced);
    },
    getAllChapters: async () => Array.from(storage.chapters.values()),
    findChapterByUrl: async (urlPattern) => {
      return Array.from(storage.chapters.values()).filter(ch => 
        ch.url.includes(urlPattern)
      );
    },

    // Translations (simplified implementations)
    storeTranslation: async (chapterUrl, translation, settings) => {
      const key = `${chapterUrl}:${translation.version}`;
      storage.translations.set(key, { chapterUrl, ...translation });
    },
    storeTranslationByStableId: async (stableId, translation, settings) => {
      const key = `${stableId}:${translation.version}`;
      storage.translations.set(key, { stableId, ...translation });
    },
    getTranslationVersions: async (chapterUrl) => {
      return Array.from(storage.translations.values()).filter(t => 
        t.chapterUrl === chapterUrl
      );
    },
    getTranslationVersionsByStableId: async (stableId) => {
      return Array.from(storage.translations.values()).filter(t => 
        t.stableId === stableId
      );
    },
    getActiveTranslation: async (chapterUrl) => {
      const versions = Array.from(storage.translations.values()).filter(t => 
        t.chapterUrl === chapterUrl && t.isActive
      );
      return versions[0] || null;
    },
    getActiveTranslationByStableId: async (stableId) => {
      const versions = Array.from(storage.translations.values()).filter(t => 
        t.stableId === stableId && t.isActive
      );
      return versions[0] || null;
    },
    setActiveTranslation: async (chapterUrl, version) => {
      for (const translation of storage.translations.values()) {
        if (translation.chapterUrl === chapterUrl) {
          translation.isActive = translation.version === version;
        }
      }
    },
    setActiveTranslationByStableId: async (stableId, version) => {
      for (const translation of storage.translations.values()) {
        if (translation.stableId === stableId) {
          translation.isActive = translation.version === version;
        }
      }
    },

    // Feedback
    storeFeedback: async (chapterUrl, feedback, translationId) => {
      const key = `${chapterUrl}:${translationId}:${Date.now()}`;
      storage.feedback.set(key, { chapterUrl, translationId, ...feedback });
    },
    getFeedback: async (chapterUrl) => {
      return Array.from(storage.feedback.values()).filter(f => 
        f.chapterUrl === chapterUrl
      );
    },
    getAllFeedback: async () => Array.from(storage.feedback.values()),

    // Settings
    storeSettings: async (settings) => {
      for (const [key, value] of Object.entries(settings)) {
        storage.settings.set(key, value);
      }
    },
    getSettings: async () => {
      const settings: any = {};
      for (const [key, value] of storage.settings.entries()) {
        settings[key] = value;
      }
      return settings;
    },
    setSetting: async (key, value) => {
      storage.settings.set(key, value);
    },
    getSetting: async (key) => storage.settings.get(key),

    // Prompt Templates
    storePromptTemplate: async (template) => {
      storage.promptTemplates.set(template.id, template);
    },
    getPromptTemplates: async () => Array.from(storage.promptTemplates.values()),
    getDefaultPromptTemplate: async () => {
      for (const template of storage.promptTemplates.values()) {
        if (template.isDefault) return template;
      }
      return null;
    },
    getPromptTemplate: async (id) => storage.promptTemplates.get(id) || null,
    setDefaultPromptTemplate: async (id) => {
      for (const template of storage.promptTemplates.values()) {
        template.isDefault = template.id === id;
      }
    },

    // URL Mappings / Novels
    getStableIdByUrl: async (url) => {
      const mapping = storage.urlMappings.get(url);
      return mapping?.stableId || null;
    },
    getUrlMappingForUrl: async (url) => storage.urlMappings.get(url) || null,
    getAllUrlMappings: async () => Array.from(storage.urlMappings.values()),
    getAllNovels: async () => {
      const novels = new Map();
      for (const mapping of storage.urlMappings.values()) {
        if (mapping.novelId && !novels.has(mapping.novelId)) {
          novels.set(mapping.novelId, mapping);
        }
      }
      return Array.from(novels.values());
    },

    // Export
    exportFullSessionToJson: async () => {
      return {
        chapters: Array.from(storage.chapters.values()),
        translations: Array.from(storage.translations.values()),
        settings: Object.fromEntries(storage.settings.entries()),
        feedback: Array.from(storage.feedback.values()),
        promptTemplates: Array.from(storage.promptTemplates.values()),
        urlMappings: Array.from(storage.urlMappings.values()),
      };
    },
  };
}

/**
 * New IndexedDB-based repository (placeholder for full implementation)
 */
function makeIdbRepo(): Repo {
  return {
    // Chapters
    getChapter: (url) => ChapterOps.getByUrl(url),
    getChapterByStableId: (stableId) => ChapterOps.getByStableId(stableId),
    storeChapter: (chapter) => ChapterOps.store(chapter as any),
    storeEnhancedChapter: (enhanced) => ChapterOps.storeEnhanced(enhanced),
    getAllChapters: () => ChapterOps.getAll(),
    findChapterByUrl: (url) => ChapterOps.findByUrl(url),

    // Translations
    async storeTranslation(chapterUrl: string, translation: any, settings: any) {
      return TranslationOps.store({ ref: { url: chapterUrl }, result: translation, settings });
    },
    async storeTranslationByStableId(stableId: string, translation: any, settings: any) {
      return TranslationOps.storeByStableId(stableId, translation, settings);
    },
    getTranslationVersions: (chapterUrl) => TranslationOps.getVersionsByUrl(chapterUrl),
    getTranslationVersionsByStableId: (stableId) => TranslationOps.getVersionsByStableId(stableId),
    getActiveTranslation: (chapterUrl) => TranslationOps.getActiveByUrl(chapterUrl),
    getActiveTranslationByStableId: (stableId) => TranslationOps.getActiveByStableId(stableId),
    setActiveTranslation: (chapterUrl, version) => TranslationOps.setActiveByUrl(chapterUrl, version),
    setActiveTranslationByStableId: (stableId, version) => TranslationOps.setActiveByStableId(stableId, version),

    // Feedback
    storeFeedback: (chapterUrl, feedback, translationId) => FeedbackOps.store(chapterUrl, feedback as any, translationId),
    getFeedback: (chapterUrl) => FeedbackOps.get(chapterUrl),
    getAllFeedback: () => FeedbackOps.getAll(),

    // Settings & templates
    storeSettings: (settings) => SettingsOps.store(settings as any),
    getSettings: () => SettingsOps.get(),
    setSetting: (key, value) => SettingsOps.set(key, value),
    getSetting: (key) => SettingsOps.getKey(key),
    storePromptTemplate: (t) => TemplatesOps.store(t),
    getPromptTemplates: () => TemplatesOps.getAll(),
    getDefaultPromptTemplate: () => TemplatesOps.getDefault(),
    getPromptTemplate: (id) => TemplatesOps.get(id),
    setDefaultPromptTemplate: (id) => TemplatesOps.setDefault(id),

    // URL mappings / novels
    getStableIdByUrl: (url) => MappingsOps.getStableIdByUrl(url),
    getUrlMappingForUrl: (url) => MappingsOps.getUrlMappingForUrl(url),
    getAllUrlMappings: () => MappingsOps.getAllUrlMappings(),
    getAllNovels: () => MappingsOps.getAllNovels(),

    // Export
    exportFullSessionToJson: () => ExportOps.exportFullSessionToJson(),
  } as unknown as Repo;
}

/**
 * Factory function to create appropriate repository based on backend and availability
 */
export function makeRepo(backend: Backend = DEFAULT_BACKEND): Repo {
  // Check IndexedDB availability first
  if (!isIndexedDBAvailable() && (backend === 'idb' || backend === 'legacy')) {
    console.warn('[DB] IndexedDB not available, using memory fallback');
    return makeMemoryRepo();
  }

  switch (backend) {
    case 'shadow':
      return makeShadowRepo();
    case 'idb':
      return makeIdbRepo();
    case 'memory':
      return makeMemoryRepo();
    case 'legacy':
    default:
      return makeLegacyRepo();
  }
}

/**
 * Service-aware repository factory (Hybrid innovation)
 */
export function makeServiceAwareRepo(service: ServiceName): Repo {
  const shouldUseNew = migrationController.shouldUseNewBackend(service);
  const backend = shouldUseNew ? migrationController.getBackend() : 'legacy';
  
  return makeRepo(backend);
}

/**
 * Global repository singleton (for backward compatibility)
 */
export const repo = makeRepo(DEFAULT_BACKEND);

/**
 * Export migration controller for manual control
 */
export { migrationController } from './migration/phase-controller';
export type { Backend, ServiceName, MigrationPhase } from './migration/phase-controller';

/**
 * Utility to get repo for specific service (Hybrid approach)
 */
export function getRepoForService(service: ServiceName): Repo {
  return makeServiceAwareRepo(service);
}

/**
 * Development/testing utilities
 */
export const dbUtils = {
  switchBackend: (backend: Backend) => {
    migrationController.setBackend(backend);
    return makeRepo(backend);
  },
  
  resetMigrationState: () => {
    migrationController.setBackend('legacy');
  },
  
  getMigrationStatus: () => {
    return migrationController.getMigrationStatus();
  },
  
  emergencyRollback: () => {
    return migrationController.emergencyRollback();
  }
};

// Export core modules for advanced usage
export * from './core/errors';
export * from './core/connection';
export * from './core/schema';

/**
 * Shadow repo: reads from legacy, writes through both legacy and new ops (best effort).
 * This allows validating the new path without impacting user-visible reads.
 */
function makeShadowRepo(): Repo {
  const legacy = makeLegacyRepo();

  return {
    // Chapters
    getChapter: (url) => legacy.getChapter(url),
    getChapterByStableId: (stableId) => legacy.getChapterByStableId(stableId),
    storeChapter: async (chapter) => {
      // Prefer new path to ensure URL mappings are written; legacy path inside ChapterOps.store
      await ChapterOps.store(chapter as any);
    },
    storeEnhancedChapter: (enhanced) => legacy.storeEnhancedChapter(enhanced),
    getAllChapters: () => legacy.getAllChapters(),
    findChapterByUrl: (url) => legacy.findChapterByUrl(url),

    // Translations: dual write (legacy + new atomic)
    storeTranslation: async (chapterUrl, translation, settings) => {
      const [legacyResult] = await Promise.all([
        legacy.storeTranslation(chapterUrl, translation, settings),
        TranslationOps.store({ ref: { url: chapterUrl }, result: translation, settings })
      ]);
      return legacyResult;
    },
    storeTranslationByStableId: async (stableId, translation, settings) => {
      const urlResolver = TranslationOps.store({ ref: { stableId }, result: translation, settings });
      const legacyResult = await legacy.storeTranslationByStableId(stableId, translation, settings);
      // Fire-and-forget new path if legacy succeeded first
      urlResolver.catch(() => {});
      return legacyResult;
    },
    getTranslationVersions: (chapterUrl) => legacy.getTranslationVersions(chapterUrl),
    getTranslationVersionsByStableId: (stableId) => legacy.getTranslationVersionsByStableId(stableId),
    getActiveTranslation: (chapterUrl) => legacy.getActiveTranslation(chapterUrl),
    getActiveTranslationByStableId: (stableId) => legacy.getActiveTranslationByStableId(stableId),
    setActiveTranslation: (chapterUrl, version) => legacy.setActiveTranslation(chapterUrl, version),
    setActiveTranslationByStableId: async (stableId, version) => {
      // Try legacy first for user-visible effect
      await legacy.setActiveTranslationByStableId(stableId, version).catch(() => {});
      // New path with auto-repair
      await TranslationOps.setActiveByStableId(stableId, version);
    },

    // Feedback
    storeFeedback: (chapterUrl, feedback, translationId) => legacy.storeFeedback(chapterUrl, feedback, translationId),
    getFeedback: (chapterUrl) => legacy.getFeedback(chapterUrl),
    getAllFeedback: () => legacy.getAllFeedback(),

    // Settings & templates
    storeSettings: (settings) => legacy.storeSettings(settings),
    getSettings: () => legacy.getSettings(),
    setSetting: (key, value) => legacy.setSetting(key, value),
    getSetting: (key) => legacy.getSetting(key),
    storePromptTemplate: (t) => legacy.storePromptTemplate(t),
    getPromptTemplates: () => legacy.getPromptTemplates(),
    getDefaultPromptTemplate: () => legacy.getDefaultPromptTemplate(),
    getPromptTemplate: (id) => legacy.getPromptTemplate(id),
    setDefaultPromptTemplate: (id) => legacy.setDefaultPromptTemplate(id),

    // URL mappings / novels (read-only in shadow)
    getStableIdByUrl: (url) => legacy.getStableIdByUrl(url),
    getUrlMappingForUrl: (url) => legacy.getUrlMappingForUrl(url),
    getAllUrlMappings: () => legacy.getAllUrlMappings(),
    getAllNovels: () => legacy.getAllNovels(),

    // Export
    exportFullSessionToJson: () => legacy.exportFullSessionToJson(),
  };
}
