import type { ChapterRecord, TranslationRecord, SettingsRecord, UrlMappingRecord, PromptTemplateRecord, NovelRecord } from '../../services/indexeddb';
import type { Chapter, TranslationResult, AppSettings, FeedbackItem } from '../../types';

export interface Repo {
  // Chapters
  getChapter(url: string): Promise<ChapterRecord | null>;
  getChapterByStableId(stableId: string): Promise<ChapterRecord | null>;
  storeChapter(chapter: Chapter): Promise<void>;
  storeEnhancedChapter(enhanced: any): Promise<void>;
  getAllChapters(): Promise<ChapterRecord[]>;
  findChapterByUrl(url: string): Promise<{ stableId: string; canonicalUrl: string; data: any } | null>;

  // Translations (by URL and by stableId)
  storeTranslation(chapterUrl: string, translation: TranslationResult, settings: { provider: string; model: string; temperature: number; systemPrompt: string; promptId?: string; promptName?: string; }): Promise<TranslationRecord>;
  storeTranslationByStableId(stableId: string, translation: TranslationResult, settings: { provider: string; model: string; temperature: number; systemPrompt: string; promptId?: string; promptName?: string; }): Promise<TranslationRecord>;
  getTranslationVersions(chapterUrl: string): Promise<TranslationRecord[]>;
  getTranslationVersionsByStableId(stableId: string): Promise<TranslationRecord[]>;
  getActiveTranslation(chapterUrl: string): Promise<TranslationRecord | null>;
  getActiveTranslationByStableId(stableId: string): Promise<TranslationRecord | null>;
  setActiveTranslation(chapterUrl: string, version: number): Promise<void>;
  setActiveTranslationByStableId(stableId: string, version: number): Promise<void>;

  // Feedback
  storeFeedback(chapterUrl: string, feedback: FeedbackItem, translationId?: string): Promise<void>;
  getFeedback(chapterUrl: string): Promise<any[]>;
  getAllFeedback(): Promise<any[]>;

  // Settings & templates
  storeSettings(settings: AppSettings): Promise<void>;
  getSettings(): Promise<AppSettings | null>;
  setSetting<T = any>(key: string, value: T): Promise<void>;
  getSetting<T = any>(key: string): Promise<T | null>;
  storePromptTemplate(t: any): Promise<void>;
  getPromptTemplates(): Promise<PromptTemplateRecord[]>;
  getDefaultPromptTemplate(): Promise<PromptTemplateRecord | null>;
  getPromptTemplate(id: string): Promise<PromptTemplateRecord | null>;
  setDefaultPromptTemplate(id: string): Promise<void>;

  // URL mappings / novels
  getStableIdByUrl(url: string): Promise<string | null>;
  getUrlMappingForUrl(url: string): Promise<UrlMappingRecord | null>;
  getAllUrlMappings(): Promise<Array<{ url: string; stableId: string; isCanonical: boolean }>>;
  getAllNovels(): Promise<NovelRecord[]>;

  // Export helpers
  exportFullSessionToJson(): Promise<any>;
}

