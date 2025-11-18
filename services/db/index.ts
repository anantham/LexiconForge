/**
 * Database Service Factory
 *
 * Single entry point for the repository-backed persistence layer with a
 * simple backend toggle (modern ops by default, or memory fallback when IndexedDB is unavailable).
 */
import type {
  ChapterLookupResult,
  ChapterRecord,
  ExportSessionOptions,
  FeedbackRecord,
  NovelRecord,
  PromptTemplateRecord,
  TranslationRecord,
  UrlMappingRecord,
} from './types';
import type {
  AppSettings,
  Chapter,
  FeedbackItem,
  GeneratedImageResult,
  PromptTemplate,
  TranslationResult,
} from '../../types';
import { getEnvVar } from '../env';
import { isIndexedDBAvailable } from './core/connection';
import {
  TranslationOps,
  ChapterOps,
  FeedbackOps,
  SettingsOps,
  TemplatesOps,
  MappingsOps,
  SessionExportOps,
} from './operations';
import { generateStableChapterId, normalizeUrlAggressively } from '../stableIdService';

type TranslationSettingsInput = Pick<AppSettings, 'provider' | 'model' | 'temperature' | 'systemPrompt'> & {
  promptId?: string;
  promptName?: string;
};

interface Repo {
  // Chapters
  getChapter(url: string): Promise<ChapterRecord | null>;
  getChapterByStableId(stableId: string): Promise<ChapterRecord | null>;
  storeChapter(chapter: Chapter): Promise<void>;
  storeEnhancedChapter(enhanced: any): Promise<void>;
  getAllChapters(): Promise<ChapterRecord[]>;
  findChapterByUrl(url: string): Promise<ChapterLookupResult | null>;

  // Translations
  storeTranslation(
    chapterUrl: string,
    translation: TranslationResult,
    settings: TranslationSettingsInput
  ): Promise<TranslationRecord>;
  storeTranslationByStableId(
    stableId: string,
    translation: TranslationResult,
    settings: TranslationSettingsInput
  ): Promise<TranslationRecord>;
  getTranslationVersions(chapterUrl: string): Promise<TranslationRecord[]>;
  getTranslationVersionsByStableId(stableId: string): Promise<TranslationRecord[]>;
  getActiveTranslation(chapterUrl: string): Promise<TranslationRecord | null>;
  getActiveTranslationByStableId(stableId: string): Promise<TranslationRecord | null>;
  setActiveTranslation(chapterUrl: string, version: number): Promise<void>;
  setActiveTranslationByStableId(stableId: string, version: number): Promise<void>;

  // Feedback
  storeFeedback(chapterUrl: string, feedback: FeedbackItem, translationId?: string): Promise<void>;
  getFeedback(chapterUrl: string): Promise<FeedbackRecord[]>;
  getAllFeedback(): Promise<FeedbackRecord[]>;

  // Settings / templates
  storeSettings(settings: AppSettings): Promise<void>;
  getSettings(): Promise<AppSettings | null>;
  setSetting<T = unknown>(key: string, value: T): Promise<void>;
  getSetting<T = unknown>(key: string): Promise<T | null>;
  storePromptTemplate(template: PromptTemplate): Promise<void>;
  getPromptTemplates(): Promise<PromptTemplateRecord[]>;
  getDefaultPromptTemplate(): Promise<PromptTemplateRecord | null>;
  getPromptTemplate(id: string): Promise<PromptTemplateRecord | null>;
  setDefaultPromptTemplate(id: string): Promise<void>;

  // URL mappings / novels
  getStableIdByUrl(url: string): Promise<string | null>;
  getUrlMappingForUrl(url: string): Promise<UrlMappingRecord | null>;
  getAllUrlMappings(): Promise<UrlMappingRecord[]>;
  getAllNovels(): Promise<NovelRecord[]>;

  // Export helpers
  exportFullSessionToJson(options?: ExportSessionOptions): Promise<any>;
}

export type Backend = 'modern' | 'memory';
type BackendInput = Backend | 'idb';

const SERVICE_NAMES = [
  'translationService',
  'navigationService',
  'translationsSlice',
  'chaptersSlice',
  'exportSlice',
  'imageGenerationService',
  'sessionManagementService',
  'importTransformationService',
  'openrouterService',
] as const;

export type ServiceName = typeof SERVICE_NAMES[number];

const BACKEND_STORAGE_KEY = 'lf:db-backend';
const LEGACY_BACKEND_VALUE = 'legacy';
let legacyBackendWarningLogged = false;

const rawEnvBackend = getEnvVar('DB_BACKEND');
if (rawEnvBackend && rawEnvBackend.toLowerCase() === LEGACY_BACKEND_VALUE) {
  warnLegacyPreference('env');
}
const DEFAULT_BACKEND: Backend = normalizeBackend(rawEnvBackend);
let preferredBackend: Backend = resolveBackendPreference();
const repoCache = new Map<Backend, Repo>();

function warnLegacyPreference(source: 'env' | 'storage' | 'runtime'): void {
  if (legacyBackendWarningLogged) {
    return;
  }
  console.warn(
    `[DB] Legacy backend support has been removed (${source}); defaulting to the modern repository.`
  );
  legacyBackendWarningLogged = true;
}

/**
 * Memory-based repository for fallback scenarios
 */
function makeMemoryRepo(): Repo {
  const chapters = new Map<string, ChapterRecord>();
  const translations = new Map<string, TranslationRecord>();
  const feedback = new Map<string, FeedbackRecord>();
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

  const mapLegacyFeedbackType = (item: FeedbackItem): FeedbackRecord['type'] => {
    const normalizedCategory = (item.category || '').toLowerCase();
    if (normalizedCategory === 'positive' || normalizedCategory === 'negative' || normalizedCategory === 'suggestion') {
      return normalizedCategory as FeedbackRecord['type'];
    }
    switch (item.type) {
      case '👍':
        return 'positive';
      case '👎':
        return 'negative';
      default:
        return 'suggestion';
    }
  };

  const createFeedbackRecord = (
    chapterUrl: string,
    item: FeedbackItem,
    translationId?: string
  ): FeedbackRecord => {
    const createdAt =
      typeof item.timestamp === 'number'
        ? new Date(item.timestamp).toISOString()
        : new Date().toISOString();

    return {
      id: item.id || `feedback-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      chapterUrl,
      translationId,
      type: mapLegacyFeedbackType(item),
      selection: item.selection ?? item.text ?? '',
      comment: item.comment ?? item.text ?? '',
      createdAt,
    };
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
      const record = createFeedbackRecord(chapterUrl, item, translationId);
      feedback.set(record.id, record);
    },
    getFeedback: async (chapterUrl) => {
      return Array.from(feedback.values())
        .filter(record => record.chapterUrl === chapterUrl)
        .map(record => ({ ...record }));
    },
    getAllFeedback: async () => Array.from(feedback.values()).map(record => ({ ...record })),

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
      feedback: Array.from(feedback.values()).map(record => ({
        ...record,
        chapterId: record.chapterUrl,
      })),
      promptTemplates: Array.from(promptTemplates.values()).map(t => ({ ...t })),
      urlMappings: Array.from(urlMappings.values()).map(mapping => ({ ...mapping })),
      novels: Array.from(novels.values()).map(novel => ({ ...novel })),
    }),
  };
}

function normalizeBackend(value?: BackendInput | string | null): Backend {
  switch ((value ?? '').toString().toLowerCase()) {
    case 'memory':
      return 'memory';
    case 'modern':
    case 'idb':
    case LEGACY_BACKEND_VALUE:
    default:
      return 'modern';
  }
}

function resolveBackendPreference(): Backend {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(BACKEND_STORAGE_KEY);
      if (stored) {
        const normalized = stored.toLowerCase();
        if (normalized === LEGACY_BACKEND_VALUE) {
          warnLegacyPreference('storage');
          persistBackendPreference('modern');
          return 'modern';
        }
        return normalizeBackend(stored);
      }
    } catch {
      // Ignore storage access failures (private mode, quota exceeded, etc.)
    }
  }
  return DEFAULT_BACKEND;
}

function persistBackendPreference(backend: Backend): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(BACKEND_STORAGE_KEY, backend);
  } catch {
    // Ignore storage errors
  }
}

function clearStoredBackendPreference(): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(BACKEND_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

function updatePreferredBackend(next: Backend): void {
  preferredBackend = next;
  persistBackendPreference(next);
  repoCache.clear();
}

function getEffectiveBackend(): Backend {
  const normalized = preferredBackend;
  if (normalized !== 'memory' && !isIndexedDBAvailable()) {
    return 'memory';
  }
  return normalized;
}

function getRepoForBackend(backendInput?: BackendInput): Repo {
  const normalized = normalizeBackend(backendInput ?? getEffectiveBackend());
  const needsFallback = normalized !== 'memory' && !isIndexedDBAvailable();
  const safeBackend = needsFallback ? 'memory' : normalized;

  if (needsFallback) {
    console.warn(`[DB] IndexedDB not available, using memory backend instead of ${normalized}`);
  }

  if (!repoCache.has(safeBackend)) {
    repoCache.set(safeBackend, instantiateRepo(safeBackend));
  }
  return repoCache.get(safeBackend)!;
}

function instantiateRepo(backend: Backend): Repo {
  switch (backend) {
    case 'memory':
      return makeMemoryRepo();
    case 'modern':
    default:
      return makeIdbRepo();
  }
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

    // Export helpers
    exportFullSessionToJson: (options?: ExportSessionOptions) =>
      SessionExportOps.exportFullSession(options),
  };
}

/**
 * Factory function to create appropriate repository based on backend preference.
 */
export function makeRepo(backend?: BackendInput): Repo {
  return getRepoForBackend(backend);
}

/**
 * Utility to get repo for specific service (compatibility shim).
 * Services all share the same backend preference now, but the signature
 * remains for future per-service overrides.
 */
export function getRepoForService(_service: ServiceName): Repo {
  return makeRepo();
}

/**
 * Development/testing utilities
 */
export const dbUtils = {
  switchBackend: (backend: BackendInput) => {
    if (`${backend}`.toLowerCase() === LEGACY_BACKEND_VALUE) {
      warnLegacyPreference('runtime');
    }
    updatePreferredBackend(normalizeBackend(backend));
    return makeRepo();
  },

  resetMigrationState: () => {
    clearStoredBackendPreference();
    preferredBackend = DEFAULT_BACKEND;
    repoCache.clear();
  },

  getMigrationStatus: () => {
    return {
      preferredBackend,
      effectiveBackend: getEffectiveBackend(),
    };
  },

  emergencyRollback: () => {
    warnLegacyPreference('runtime');
    updatePreferredBackend('modern');
    return makeRepo();
  },
};

// Export core modules for advanced usage
export * from './core/errors';
export * from './core/connection';
export * from './core/schema';
