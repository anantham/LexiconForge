import type { AppSettings, TranslationResult } from '../../../../types';
import type { TranslationRecord } from '../../types';

export interface TranslationSettingsSnapshot
  extends Pick<AppSettings, 'provider' | 'model' | 'temperature' | 'systemPrompt'> {
  promptId?: string;
  promptName?: string;
}

export interface ChapterRef {
  url?: string;
  stableId?: string;
}

export interface ITranslationRepository {
  storeTranslation(
    chapterUrl: string,
    translation: TranslationResult,
    settings: TranslationSettingsSnapshot
  ): Promise<TranslationRecord>;
  storeTranslationByStableId(
    stableId: string,
    translation: TranslationResult,
    settings: TranslationSettingsSnapshot
  ): Promise<TranslationRecord>;

  getTranslation(chapterUrl: string, version?: number): Promise<TranslationRecord | null>;
  getTranslationById(translationId: string): Promise<TranslationRecord | null>;
  getTranslationVersions(chapterUrl: string): Promise<TranslationRecord[]>;
  getTranslationVersionsByStableId(stableId: string): Promise<TranslationRecord[]>;

  getActiveTranslation(chapterUrl: string): Promise<TranslationRecord | null>;
  getActiveTranslationByStableId(stableId: string): Promise<TranslationRecord | null>;
  ensureActiveTranslationByStableId(stableId: string): Promise<TranslationRecord | null>;

  setActiveTranslation(chapterUrl: string, version: number): Promise<void>;
  setActiveTranslationByStableId(stableId: string, version: number): Promise<void>;

  deleteTranslationVersion(translationId: string): Promise<void>;
  deleteTranslationVersionByChapter(chapterUrl: string, version: number): Promise<boolean>;

  updateTranslation(record: TranslationRecord): Promise<void>;
  getAllTranslations(): Promise<TranslationRecord[]>;
}
