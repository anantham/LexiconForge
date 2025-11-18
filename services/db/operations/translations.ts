import type { AppSettings, TranslationResult } from '../../../types';
import type { TranslationRecord } from '../types';
import { StableIdManager } from '../core/stable-ids';
import type { TranslationSettingsSnapshot } from '../repositories/interfaces/ITranslationRepository';
import { translationFacade } from '../repositories/translationFacade';

export interface ChapterRef {
  stableId?: string;
  url?: string;
}

type TranslationStoreRecord = TranslationRecord;

const toSnapshot = (
  settings: Pick<AppSettings, 'provider' | 'model' | 'temperature' | 'systemPrompt'> & {
    promptId?: string;
    promptName?: string;
  }
): TranslationSettingsSnapshot => ({
  provider: settings.provider,
  model: settings.model,
  temperature: settings.temperature,
  systemPrompt: settings.systemPrompt,
  promptId: settings.promptId,
  promptName: settings.promptName,
});

const resolveUrl = async (ref: ChapterRef): Promise<string> => {
  if (ref.url) return ref.url;
  if (!ref.stableId) throw new Error('ChapterRef requires stableId or url');
  return StableIdManager.getUrlForStableId(ref.stableId);
};

const getVersionsByUrlModern = (chapterUrl: string): Promise<TranslationRecord[]> => {
  return translationFacade.getVersionsByUrl(chapterUrl);
};

const getVersionsByStableIdModern = (stableId: string): Promise<TranslationRecord[]> => {
  return translationFacade.getVersionsByStableId(stableId);
};

const storeTranslationModern = (
  chapterUrl: string,
  result: TranslationResult,
  settings: TranslationSettingsSnapshot
): Promise<TranslationRecord> => {
  return translationFacade.storeByUrl(chapterUrl, result, settings);
};

const setActiveByUrlModern = (chapterUrl: string, version: number): Promise<void> => {
  return translationFacade.setActiveByUrl(chapterUrl, version);
};

const setActiveByStableIdModern = (stableId: string, version: number): Promise<void> => {
  return translationFacade.setActiveByStableId(stableId, version);
};

const getActiveByUrlModern = (chapterUrl: string): Promise<TranslationRecord | null> => {
  return translationFacade.getActiveByUrl(chapterUrl);
};

const getActiveByStableIdModern = (stableId: string): Promise<TranslationRecord | null> => {
  return translationFacade.getActiveByStableId(stableId);
};

const deleteVersionModern = (translationId: string): Promise<void> => {
  return translationFacade.deleteVersion(translationId);
};
const ensureActiveByStableIdModern = (stableId: string): Promise<TranslationRecord | null> => {
  return translationFacade.ensureActiveByStableId(stableId);
};
const updateTranslationModern = (record: TranslationRecord): Promise<void> => {
  return translationFacade.update(record);
};
const getAllTranslationsModern = (): Promise<TranslationRecord[]> => {
  return translationFacade.getAll();
};

export class TranslationOps {
  static async store({
    ref,
    result,
    settings,
  }: {
    ref: ChapterRef;
    result: TranslationResult;
    settings: Pick<AppSettings, 'provider' | 'model' | 'temperature' | 'systemPrompt'> & {
      promptId?: string;
      promptName?: string;
    };
  }): Promise<TranslationRecord> {
    const url = await resolveUrl(ref);
    return storeTranslationModern(url, result, toSnapshot(settings));
  }

  static async setActiveByStableId(stableId: string, version: number): Promise<void> {
    await setActiveByStableIdModern(stableId, version);
  }

  static async setActiveByUrl(chapterUrl: string, version: number): Promise<void> {
    await setActiveByUrlModern(chapterUrl, version);
  }

  static async getVersionsByUrl(chapterUrl: string): Promise<TranslationRecord[]> {
    return getVersionsByUrlModern(chapterUrl);
  }

  static async getVersionsByStableId(stableId: string): Promise<TranslationRecord[]> {
    return getVersionsByStableIdModern(stableId);
  }

  static async getActiveByUrl(chapterUrl: string): Promise<TranslationRecord | null> {
    return getActiveByUrlModern(chapterUrl);
  }

  static async getActiveByStableId(stableId: string): Promise<TranslationRecord | null> {
    return getActiveByStableIdModern(stableId);
  }

  static async storeByStableId(
    stableId: string,
    result: TranslationResult,
    settings: Pick<AppSettings, 'provider' | 'model' | 'temperature' | 'systemPrompt'> & {
      promptId?: string;
      promptName?: string;
    }
  ): Promise<TranslationRecord> {
    const url = await StableIdManager.getUrlForStableId(stableId);
    return translationFacade.storeByStableId(stableId, result, toSnapshot(settings));
  }

  static async deleteVersion(translationId: string): Promise<void> {
    await deleteVersionModern(translationId);
  }

  static async ensureActiveByStableId(stableId: string): Promise<TranslationRecord | null> {
    return ensureActiveByStableIdModern(stableId);
  }

  static async update(record: TranslationRecord): Promise<void> {
    await updateTranslationModern(record);
  }

  static async getAll(): Promise<TranslationRecord[]> {
    return getAllTranslationsModern();
  }
}
