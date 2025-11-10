/**
 * Database Service Factory - Hybrid Approach
 * 
 * Single entry point combining GPT-5's backend abstraction 
 * with Claude's service-aware migration control.
 */

import type { Repo } from '../../adapters/repo/Repo';
import type {
  ChapterLookupResult,
  ChapterRecord,
  NovelRecord,
  PromptTemplateRecord,
  TranslationRecord,
  UrlMappingRecord,
} from '../indexeddb';
import type {
  AppSettings,
  Chapter,
  FeedbackItem,
  GeneratedImageResult,
  PromptTemplate,
  TranslationResult,
} from '../../types';
import { makeLegacyRepo } from '../../legacy/indexeddb-compat';
import { migrationController, type Backend, type ServiceName } from './migration/phase-controller';
import { getEnvVar } from '../env';
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
import { generateStableChapterId, normalizeUrlAggressively } from '../stableIdService';

// Environment-based backend selection
const DEFAULT_BACKEND: Backend = (getEnvVar('DB_BACKEND') as Backend) ?? 'legacy';

/**
 * Memory-based repository for fallback scenarios
 */
function makeMemoryRepo(): Repo {
  const chapters = new Map<string, ChapterRecord>();
  const translations = new Map<string, TranslationRecord>();
  const feedback = new Map<string, { id: string; chapterUrl: string; translationId?: string; item: FeedbackItem; createdAt: string }>();
  let settings: AppSettings | null = null;
  const promptTemplates = new Map<string, PromptTemplateRecord>();
  const urlMappings = new Map<string, UrlMappingRecord>();
  const novels = new Map<string, NovelRecord>();

  const cloneChapterRecord = (record: ChapterRecord): ChapterRecord => ({ ...record });
  const cloneTranslationRecord = (record: TranslationRecord): TranslationRecord => ({
    ...record,
    footnotes: record.footnotes.map(footnote => ({ ...footnote })),
    suggestedIllustrations: record.suggestedIllustrations.map(illustration => ({ ...illustration })),
  });

  const resolveStableId = (record: ChapterRecord): string => {
    if (!record.stableId) {
      record.stableId = generateStableChapterId(
        record.content || '',
        record.chapterNumber || 0,
        record.title || ''
      );
    }
    return record.stableId;
  };

  const upsertUrlMapping = (url: string, stableId: string, isCanonical: boolean) => {
    const existing = urlMappings.get(url);
    const nowIso = new Date().toISOString();
    urlMappings.set(url, {
      url,
      stableId,
      isCanonical,
      dateAdded: existing?.dateAdded ?? nowIso,
    });
  };

  const registerChapterMappings = (record: ChapterRecord) => {
    const stableId = resolveStableId(record);
    const canonical = record.canonicalUrl || normalizeUrlAggressively(record.url) || record.url;
    upsertUrlMapping(canonical, stableId, true);
    if (canonical !== record.url) {
      upsertUrlMapping(record.url, stableId, false);
    }
  };

  const findChapterByStableIdInternal = (stableId: string): ChapterRecord | null => {
    for (const record of chapters.values()) {
      if (record.stableId === stableId) {
        return record;
      }
    }
    return null;
  };

  const resolveChapterUrlByStableId = (stableId: string): string => {
    const chapterRecord = findChapterByStableIdInternal(stableId);
    if (chapterRecord) {
      return chapterRecord.url;
    }
    for (const mapping of urlMappings.values()) {
      if (mapping.stableId === stableId) {
        return mapping.url;
      }
    }
    throw new Error(`No chapter found for stableId ${stableId}`);
  };

  const getTranslationsForUrl = (chapterUrl: string): TranslationRecord[] => {
    return Array.from(translations.values())
      .filter(record => record.chapterUrl === chapterUrl)
      .sort((a, b) => b.version - a.version);
  };

  const getTranslationsForStableId = (stableId: string): TranslationRecord[] => {
    return Array.from(translations.values())
      .filter(record => record.stableId === stableId)
      .sort((a, b) => b.version - a.version);
  };

  const getActiveTranslationForUrl = (chapterUrl: string): TranslationRecord | null => {
    return getTranslationsForUrl(chapterUrl).find(record => record.isActive) || null;
  };

  const toChapterRecord = (chapter: Chapter): ChapterRecord => {
    const originalUrl = chapter.originalUrl || chapter.url;
    if (!originalUrl) {
      throw new Error('[memory repo] Chapter must include originalUrl');
    }

    const existing = chapters.get(originalUrl);
    const nowIso = new Date().toISOString();
    const canonical = chapter.canonicalUrl || existing?.canonicalUrl || normalizeUrlAggressively(originalUrl) || originalUrl;

    const record: ChapterRecord = {
      url: originalUrl,
      title: chapter.title ?? existing?.title ?? '',
      content: chapter.content ?? existing?.content ?? '',
      originalUrl,
      nextUrl: chapter.nextUrl ?? existing?.nextUrl,
      prevUrl: chapter.prevUrl ?? existing?.prevUrl,
      fanTranslation: chapter.fanTranslation ?? existing?.fanTranslation,
      chapterNumber: chapter.chapterNumber ?? existing?.chapterNumber,
      canonicalUrl: canonical,
      stableId: chapter.stableId ?? existing?.stableId,
      dateAdded: existing?.dateAdded ?? nowIso,
      lastAccessed: nowIso,
    };

    resolveStableId(record);
    return record;
  };

  const toSuggestedIllustrationRecord = (
    illustration: TranslationResult['suggestedIllustrations'][number]
  ): TranslationRecord['suggestedIllustrations'][number] => {
    const legacy = illustration as unknown as { url?: string; generatedImage?: string };
    const record: TranslationRecord['suggestedIllustrations'][number] = {
      placementMarker: illustration.placementMarker,
      imagePrompt: illustration.imagePrompt,
    };

    if (legacy.url) {
      record.url = legacy.url;
    }

    if (illustration.generatedImage) {
      record.generatedImage = illustration.generatedImage as unknown as string | GeneratedImageResult;
      if (illustration.generatedImage && 'imageCacheKey' in illustration.generatedImage && illustration.generatedImage.imageCacheKey) {
        record.imageCacheKey = illustration.generatedImage.imageCacheKey;
      }
    } else if ((legacy as any).generatedImage) {
      record.generatedImage = (legacy as any).generatedImage;
    }

    if (illustration.imageCacheKey) {
      record.imageCacheKey = illustration.imageCacheKey;
    }

    return record;
  };

  const toTranslationRecord = (
    chapterUrl: string,
    stableId: string | undefined,
    result: TranslationResult,
    settingsInput: Pick<AppSettings, 'provider' | 'model' | 'temperature' | 'systemPrompt'> & {
      promptId?: string;
      promptName?: string;
    }
  ): TranslationRecord => {
    const usage = result.usageMetrics ?? {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      estimatedCost: result.costUsd ?? 0,
      requestTime: result.requestTime ?? 0,
      provider: settingsInput.provider,
      model: settingsInput.model,
    };

    const existing = getTranslationsForUrl(chapterUrl);
    const maxVersion = existing.reduce((max, record) => Math.max(max, record.version || 0), 0);

    for (const record of existing) {
      if (record.isActive) {
        record.isActive = false;
        translations.set(record.id, record);
      }
    }

    const id =
      result.id ||
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    const createdAt = new Date().toISOString();

    return {
      id,
      chapterUrl,
      stableId,
      version: maxVersion + 1,
      translatedTitle: result.translatedTitle,
      translation: result.translation,
      footnotes: (result.footnotes || []).map(footnote => ({ ...footnote })),
      suggestedIllustrations: (result.suggestedIllustrations || []).map(toSuggestedIllustrationRecord),
      provider: result.provider || settingsInput.provider,
      model: result.model || settingsInput.model,
      temperature: result.temperature ?? settingsInput.temperature,
      systemPrompt: settingsInput.systemPrompt,
      promptId: result.promptId ?? settingsInput.promptId,
      promptName: result.promptName ?? settingsInput.promptName,
      customVersionLabel: result.customVersionLabel,
      totalTokens: usage.totalTokens ?? 0,
      promptTokens: usage.promptTokens ?? 0,
      completionTokens: usage.completionTokens ?? 0,
      estimatedCost: result.costUsd ?? usage.estimatedCost ?? 0,
      requestTime: result.requestTime ?? usage.requestTime ?? 0,
      createdAt,
      isActive: true,
      proposal: result.proposal ?? undefined,
    };
  };

  const toChapterLookup = (record: ChapterRecord): ChapterLookupResult => {
    const stableId = resolveStableId(record);
    const canonical = record.canonicalUrl || normalizeUrlAggressively(record.url) || record.url;
    const activeTranslation = getActiveTranslationForUrl(record.url);

    return {
      stableId,
      canonicalUrl: canonical,
      title: record.title,
      content: record.content,
      nextUrl: record.nextUrl,
      prevUrl: record.prevUrl,
      chapterNumber: record.chapterNumber,
      fanTranslation: record.fanTranslation,
      data: {
        chapter: {
          title: record.title,
          content: record.content,
          originalUrl: record.url,
          nextUrl: record.nextUrl,
          prevUrl: record.prevUrl,
          chapterNumber: record.chapterNumber,
        },
        translationResult: activeTranslation ? cloneTranslationRecord(activeTranslation) : null,
      },
    };
  };

  const toPromptTemplateRecord = (template: PromptTemplate): PromptTemplateRecord => ({
    id: template.id,
    name: template.name,
    description: template.description,
    content: template.content,
    isDefault: template.isDefault,
    createdAt: template.createdAt ?? new Date().toISOString(),
    lastUsed: template.lastUsed,
  });

  return {
    // Chapters
    getChapter: async (url) => {
      const record = chapters.get(url);
      return record ? cloneChapterRecord(record) : null;
    },
    getChapterByStableId: async (stableId) => {
      const record = findChapterByStableIdInternal(stableId);
      return record ? cloneChapterRecord(record) : null;
    },
    storeChapter: async (chapter: Chapter) => {
      const record = toChapterRecord(chapter);
      chapters.set(record.url, record);
      registerChapterMappings(record);
    },
    storeEnhancedChapter: async (enhanced) => {
      const chapter: Chapter = {
        title: enhanced.title,
        content: enhanced.content,
        originalUrl: enhanced.originalUrl ?? enhanced.canonicalUrl ?? enhanced.url,
        canonicalUrl: enhanced.canonicalUrl,
        nextUrl: enhanced.nextUrl,
        prevUrl: enhanced.prevUrl,
        chapterNumber: enhanced.chapterNumber,
        fanTranslation: enhanced.fanTranslation ?? null,
        stableId: enhanced.id ?? enhanced.stableId,
      };
      const record = toChapterRecord(chapter);
      chapters.set(record.url, record);
      registerChapterMappings(record);
    },
    getAllChapters: async () => Array.from(chapters.values()).map(cloneChapterRecord),
    findChapterByUrl: async (urlPattern) => {
      const normalized = normalizeUrlAggressively(urlPattern) || urlPattern;
      const direct =
        chapters.get(urlPattern) ||
        chapters.get(normalized) ||
        Array.from(chapters.values()).find(
          record =>
            record.url === urlPattern ||
            record.canonicalUrl === urlPattern ||
            record.url.includes(urlPattern) ||
            (record.canonicalUrl && normalized.includes(record.canonicalUrl))
        );
      if (!direct) {
        return null;
      }
      return toChapterLookup(direct);
    },

    // Translations
    storeTranslation: async (chapterUrl, translation, settingsInput) => {
      const chapter = chapters.get(chapterUrl);
      const stableId = chapter ? resolveStableId(chapter) : undefined;
      const record = toTranslationRecord(chapterUrl, stableId, translation, settingsInput);
      translations.set(record.id, record);
      return cloneTranslationRecord(record);
    },
    storeTranslationByStableId: async (stableId, translation, settingsInput) => {
      const chapterUrl = resolveChapterUrlByStableId(stableId);
      const record = toTranslationRecord(chapterUrl, stableId, translation, settingsInput);
      translations.set(record.id, record);
      return cloneTranslationRecord(record);
    },
    getTranslationVersions: async (chapterUrl) =>
      getTranslationsForUrl(chapterUrl).map(cloneTranslationRecord),
    getTranslationVersionsByStableId: async (stableId) =>
      getTranslationsForStableId(stableId).map(cloneTranslationRecord),
    getActiveTranslation: async (chapterUrl) => {
      const record = getActiveTranslationForUrl(chapterUrl);
      return record ? cloneTranslationRecord(record) : null;
    },
    getActiveTranslationByStableId: async (stableId) => {
      const record = getTranslationsForStableId(stableId).find(r => r.isActive) || null;
      return record ? cloneTranslationRecord(record) : null;
    },
    setActiveTranslation: async (chapterUrl, version) => {
      let found = false;
      for (const record of translations.values()) {
        if (record.chapterUrl === chapterUrl) {
          record.isActive = record.version === version;
          if (record.isActive) {
            found = true;
          }
        }
      }
      if (!found) {
        throw new Error(`No translation version ${version} found for ${chapterUrl}`);
      }
    },
    setActiveTranslationByStableId: async (stableId, version) => {
      let found = false;
      for (const record of translations.values()) {
        if (record.stableId === stableId) {
          record.isActive = record.version === version;
          if (record.isActive) {
            found = true;
          }
        }
      }
      if (!found) {
        throw new Error(`No translation version ${version} found for stableId ${stableId}`);
      }
    },

    // Feedback
    storeFeedback: async (chapterUrl, item, translationId) => {
      const id = item.id || `feedback-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const stored: FeedbackItem = {
        ...item,
        id,
        chapterId: item.chapterId ?? chapterUrl,
      };
      feedback.set(id, {
        id,
        chapterUrl,
        translationId,
        item: stored,
        createdAt: new Date().toISOString(),
      });
    },
    getFeedback: async (chapterUrl) => {
      return Array.from(feedback.values())
        .filter(entry => entry.chapterUrl === chapterUrl)
        .map(entry => ({ ...entry.item }));
    },
    getAllFeedback: async () => Array.from(feedback.values()).map(entry => ({ ...entry.item })),

    // Settings & templates
    storeSettings: async (nextSettings) => {
      settings = { ...(nextSettings as AppSettings) };
    },
    getSettings: async () => (settings ? { ...settings } : null),
    setSetting: async (key, value) => {
      settings = { ...(settings ?? ({} as AppSettings)), [key]: value } as AppSettings;
    },
    getSetting: async (key) => {
      if (!settings) {
        return null;
      }
      const record = settings as unknown as Record<string, unknown>;
      return (record[key] ?? null) as any;
    },
    storePromptTemplate: async (template) => {
      const record = toPromptTemplateRecord(template);
      promptTemplates.set(record.id, record);
    },
    getPromptTemplates: async () => Array.from(promptTemplates.values()).map(t => ({ ...t })),
    getDefaultPromptTemplate: async () => {
      for (const template of promptTemplates.values()) {
        if (template.isDefault) {
          return { ...template };
        }
      }
      return null;
    },
    getPromptTemplate: async (id) => {
      const template = promptTemplates.get(id);
      return template ? { ...template } : null;
    },
    setDefaultPromptTemplate: async (id) => {
      for (const template of promptTemplates.values()) {
        template.isDefault = template.id === id;
      }
    },

    // URL mappings / novels
    getStableIdByUrl: async (url) => {
      const mapping = urlMappings.get(url);
      if (mapping) {
        return mapping.stableId;
      }
      const chapter = chapters.get(url);
      return chapter ? resolveStableId(chapter) : null;
    },
    getUrlMappingForUrl: async (url) => {
      const mapping = urlMappings.get(url);
      return mapping ? { ...mapping } : null;
    },
    getAllUrlMappings: async () => Array.from(urlMappings.values()).map(mapping => ({ ...mapping })),
    getAllNovels: async () => Array.from(novels.values()).map(novel => ({ ...novel })),

    // Export
    exportFullSessionToJson: async () => ({
      chapters: Array.from(chapters.values()).map(cloneChapterRecord),
      translations: Array.from(translations.values()).map(cloneTranslationRecord),
      settings: settings ? { ...settings } : null,
      feedback: Array.from(feedback.values()).map(entry => ({
        ...entry.item,
        chapterId: entry.chapterUrl,
      })),
      promptTemplates: Array.from(promptTemplates.values()).map(t => ({ ...t })),
      urlMappings: Array.from(urlMappings.values()).map(mapping => ({ ...mapping })),
      novels: Array.from(novels.values()).map(novel => ({ ...novel })),
    }),
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
    storeChapter: (chapter) => ChapterOps.store(chapter),
    storeEnhancedChapter: (enhanced) => ChapterOps.storeEnhanced(enhanced),
    getAllChapters: () => ChapterOps.getAll(),
    findChapterByUrl: (url) => ChapterOps.findByUrl(url),

    // Translations
    storeTranslation: (chapterUrl, translation, settings) =>
      TranslationOps.store({ ref: { url: chapterUrl }, result: translation, settings }),
    storeTranslationByStableId: (stableId, translation, settings) =>
      TranslationOps.storeByStableId(stableId, translation, settings),
    getTranslationVersions: (chapterUrl) => TranslationOps.getVersionsByUrl(chapterUrl),
    getTranslationVersionsByStableId: (stableId) => TranslationOps.getVersionsByStableId(stableId),
    getActiveTranslation: (chapterUrl) => TranslationOps.getActiveByUrl(chapterUrl),
    getActiveTranslationByStableId: (stableId) => TranslationOps.getActiveByStableId(stableId),
    setActiveTranslation: (chapterUrl, version) => TranslationOps.setActiveByUrl(chapterUrl, version),
    setActiveTranslationByStableId: (stableId, version) => TranslationOps.setActiveByStableId(stableId, version),

    // Feedback
    storeFeedback: (chapterUrl, feedback, translationId) =>
      FeedbackOps.store(chapterUrl, feedback, translationId),
    getFeedback: (chapterUrl) => FeedbackOps.get(chapterUrl),
    getAllFeedback: () => FeedbackOps.getAll(),

    // Settings & templates
    storeSettings: (settings) => SettingsOps.store(settings),
    getSettings: () => SettingsOps.get(),
    setSetting: (key, value) => SettingsOps.set(key, value),
    getSetting: (key) => SettingsOps.getKey(key),
    storePromptTemplate: (template) => TemplatesOps.store(template),
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
  };
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
