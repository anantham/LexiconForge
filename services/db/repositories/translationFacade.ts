import type { TranslationRecord } from '../types';
import type { TranslationResult } from '../../../types';
import type { TranslationSettingsSnapshot } from './interfaces/ITranslationRepository';
import { chapterRepository, translationRepository } from './instances';
import { ensureChapterUrlMappings, recomputeChapterSummary } from '../operations/chapters';

const ensureSummaryByUrl = async (chapterUrl: string): Promise<void> => {
  const chapter = await chapterRepository.getChapter(chapterUrl);
  if (chapter) {
    await recomputeChapterSummary(chapter);
  }
};

const ensureSummaryByStableId = async (stableId: string): Promise<void> => {
  const chapter = await chapterRepository.getChapterByStableId(stableId);
  if (chapter) {
    await recomputeChapterSummary(chapter);
  }
};

export const translationFacade = {
  async storeByUrl(
    chapterUrl: string,
    translation: TranslationResult,
    settings: TranslationSettingsSnapshot
  ): Promise<TranslationRecord> {
    const record = await translationRepository.storeTranslation(chapterUrl, translation, settings);
    if (record.stableId) {
      await ensureChapterUrlMappings(chapterUrl, record.stableId);
    }
    await ensureSummaryByUrl(chapterUrl);
    return record;
  },

  async storeByStableId(
    stableId: string,
    translation: TranslationResult,
    settings: TranslationSettingsSnapshot
  ): Promise<TranslationRecord> {
    const record = await translationRepository.storeTranslationByStableId(stableId, translation, settings);
    const chapterUrl = record.chapterUrl;
    if (record.stableId) {
      await ensureChapterUrlMappings(chapterUrl, record.stableId);
    }
    await ensureSummaryByStableId(stableId);
    return record;
  },

  getVersionsByUrl(chapterUrl: string): Promise<TranslationRecord[]> {
    return translationRepository.getTranslationVersions(chapterUrl);
  },

  getVersionsByStableId(stableId: string): Promise<TranslationRecord[]> {
    return translationRepository.getTranslationVersionsByStableId(stableId);
  },

  getActiveByUrl(chapterUrl: string): Promise<TranslationRecord | null> {
    return translationRepository.getActiveTranslation(chapterUrl);
  },

  getActiveByStableId(stableId: string): Promise<TranslationRecord | null> {
    return translationRepository.getActiveTranslationByStableId(stableId);
  },

  async setActiveByUrl(chapterUrl: string, version: number): Promise<void> {
    await translationRepository.setActiveTranslation(chapterUrl, version);
    await ensureSummaryByUrl(chapterUrl);
  },

  async setActiveByStableId(stableId: string, version: number): Promise<void> {
    await translationRepository.setActiveTranslationByStableId(stableId, version);
    await ensureSummaryByStableId(stableId);
  },

  async deleteVersion(translationId: string): Promise<void> {
    const translation = await translationRepository.getTranslationById(translationId);
    if (!translation) return;
    await translationRepository.deleteTranslationVersion(translationId);
    await ensureSummaryByUrl(translation.chapterUrl);
  },

  async update(record: TranslationRecord): Promise<void> {
    await translationRepository.updateTranslation(record);
    await ensureSummaryByUrl(record.chapterUrl);
  },

  getById(translationId: string): Promise<TranslationRecord | null> {
    return translationRepository.getTranslationById(translationId);
  },

  async ensureActiveByStableId(stableId: string): Promise<TranslationRecord | null> {
    const record = await translationRepository.ensureActiveTranslationByStableId(stableId);
    if (record) {
      await ensureSummaryByStableId(stableId);
    }
    return record;
  },

  getAll(): Promise<TranslationRecord[]> {
    return translationRepository.getAllTranslations();
  },
};
