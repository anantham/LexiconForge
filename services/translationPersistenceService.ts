import type { AppSettings, TranslationResult } from '../types';
import type { TranslationRecord } from './indexeddb';
import type { TranslationsRepo } from '../adapters/repo/TranslationsRepo';
import type { Repo } from '../adapters/repo/Repo';

const log = (message: string, details?: Record<string, unknown>) => {
  console.log('[TranslationPersistence]', message, details ?? '');
};

const warn = (message: string, error: unknown) => {
  console.warn('[TranslationPersistence]', message, error);
};

export type TranslationSettingsSnapshot = Pick<
  AppSettings,
  'provider' | 'model' | 'temperature' | 'systemPrompt'
> & {
  promptId?: string;
  promptName?: string;
};

/**
 * Centralized helper for persisting translation results. Abstracts away
 * repository loading so UI slices can call a single method without worrying
 * about CommonJS vs ESM boundaries or migration state.
 */
export class TranslationPersistenceService {
  private static translationsRepoPromise: Promise<TranslationsRepo> | null = null;
  private static serviceAwareRepoPromise: Promise<Repo> | null = null;

  private static async getTranslationsRepo(): Promise<TranslationsRepo> {
    if (!this.translationsRepoPromise) {
      this.translationsRepoPromise = import('../adapters/repo').then(({ translationsRepo }) => translationsRepo);
    }
    return this.translationsRepoPromise;
  }

  private static async getServiceAwareRepo(): Promise<Repo> {
    if (!this.serviceAwareRepoPromise) {
      this.serviceAwareRepoPromise = import('./db/index').then(({ getRepoForService }) =>
        getRepoForService('translationsSlice')
      );
    }
    return this.serviceAwareRepoPromise;
  }

  /**
   * Persist an updated translation. If the translation already has an ID we
   * update that specific record; otherwise we store a new version keyed by the
   * chapter's stable ID so future updates have a record to mutate.
   */
  static async persistUpdatedTranslation(
    chapterId: string,
    translationResult: (TranslationResult & { id?: string }) | TranslationRecord,
    settings: TranslationSettingsSnapshot
  ): Promise<TranslationRecord | null> {
    try {
      const candidate = translationResult as TranslationRecord;

      if (candidate?.id) {
        const repo = await this.getTranslationsRepo();
        await repo.updateTranslation(candidate);
        log('Updated existing translation record', { chapterId, translationId: candidate.id });
        return candidate;
      }

      const repo = await this.getServiceAwareRepo();
      const stored = await repo.storeTranslationByStableId(chapterId, translationResult, settings);
      log('Stored translation result to obtain persistent ID', {
        chapterId,
        translationId: stored?.id,
        version: stored?.version,
      });
      return stored;
    } catch (error) {
      warn('Failed to persist translation result', { chapterId, error });
      throw error;
    }
  }

  static async createNewVersion(
    chapterId: string,
    translationResult: TranslationResult,
    settings: TranslationSettingsSnapshot,
    options?: { versionLabel?: string }
  ): Promise<TranslationRecord | null> {
    try {
      const repo = await this.getServiceAwareRepo();
      const payload: TranslationResult = {
        ...translationResult,
        customVersionLabel: options?.versionLabel,
      };
      const stored = await repo.storeTranslationByStableId(chapterId, payload, settings);
      if (stored) {
        stored.customVersionLabel = options?.versionLabel;
        await repo.setActiveTranslationByStableId(chapterId, stored.version);
        log('Created new translation version', {
          chapterId,
          translationId: stored.id,
          version: stored.version,
          label: options?.versionLabel,
        });
      }
      return stored;
    } catch (error) {
      warn('Failed to create new translation version', { chapterId, error });
      throw error;
    }
  }
}
