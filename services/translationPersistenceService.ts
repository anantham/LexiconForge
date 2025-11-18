import type { AppSettings, TranslationResult } from '../types';
import type { TranslationRecord } from './db/types';
import { TranslationOps } from './db/operations';

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
    const isTranslationRecord = (value: TranslationResult | TranslationRecord): value is TranslationRecord => {
      return typeof (value as TranslationRecord)?.chapterUrl === 'string';
    };

    try {
      console.log(`💾 [TranslationSave] Starting save for chapter: ${chapterId}`);
      console.log(`💾 [TranslationSave] Settings:`, { provider: settings.provider, model: settings.model });

      if (isTranslationRecord(translationResult) && translationResult.id) {
        console.log(`🔄 [TranslationSave] Updating EXISTING translation record:`, {
          chapterId,
          translationId: translationResult.id,
          version: translationResult.version
        });
        await TranslationOps.update(translationResult);
        log('Updated existing translation record', { chapterId, translationId: translationResult.id });
        console.log(`✅ [TranslationSave] Successfully updated existing translation`);
        return translationResult;
      }

      console.log(`➕ [TranslationSave] Creating NEW translation for chapter: ${chapterId}`);
      const payload = translationResult as TranslationResult;
      const stored = await TranslationOps.storeByStableId(chapterId, payload, settings);

      if (stored) {
        console.log(`✅ [TranslationSave] Successfully stored NEW translation:`, {
          chapterId,
          translationId: stored.id,
          version: stored.version,
          isActive: stored.isActive,
          chapterUrl: stored.chapterUrl,
          stableId: stored.stableId
        });
      } else {
        console.warn(`⚠️ [TranslationSave] Store operation returned null for ${chapterId}`);
      }

      log('Stored translation result to obtain persistent ID', {
        chapterId,
        translationId: stored?.id,
        version: stored?.version,
      });
      return stored;
    } catch (error) {
      console.error(`🚨 [TranslationSave] FAILED to persist translation:`, {
        chapterId,
        error: (error as Error)?.message || error,
        stack: (error as Error)?.stack
      });
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
      const payload: TranslationResult = {
        ...translationResult,
        customVersionLabel: options?.versionLabel,
      };
      const stored = await TranslationOps.storeByStableId(chapterId, payload, settings);
      if (stored) {
        stored.customVersionLabel = options?.versionLabel;
        await TranslationOps.setActiveByStableId(chapterId, stored.version);
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
