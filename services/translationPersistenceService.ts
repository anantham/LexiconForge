import type { AppSettings, TranslationResult } from '../types';
import type { TranslationRecord } from './db/types';
import { TranslationOps } from './db/operations';

const log = (message: string, details?: Record<string, unknown>) => {
  console.log('[TranslationPersistence]', message, details ?? '');
};

const warn = (message: string, error: unknown) => {
  console.warn('[TranslationPersistence]', message, error);
};

type PersistableTranslation = (TranslationResult & { id?: string }) | TranslationRecord;

const validMetadata = (value: unknown): value is string => (
  typeof value === 'string' && value.length > 0 && value !== 'unknown'
);

const numberOr = (value: unknown, fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

/**
 * Hydrated translations intentionally carry only the fields needed by the
 * reader. Reconcile their mutable content onto the complete stored record so
 * an illustration/footnote edit cannot erase translation provenance.
 */
const mergeOntoStoredRecord = (
  stored: TranslationRecord,
  update: PersistableTranslation
): TranslationRecord => {
  const partialRecord = update as Partial<TranslationRecord>;
  const usageMetrics = 'usageMetrics' in update ? update.usageMetrics : undefined;

  return {
    ...stored,
    translatedTitle: update.translatedTitle,
    translation: update.translation,
    footnotes: update.footnotes,
    suggestedIllustrations: update.suggestedIllustrations,
    proposal: update.proposal === null ? undefined : update.proposal ?? stored.proposal,
    customVersionLabel: update.customVersionLabel ?? stored.customVersionLabel,
    imageVersionState: update.imageVersionState ?? stored.imageVersionState,
    provider: validMetadata(update.provider)
      ? update.provider
      : validMetadata(usageMetrics?.provider)
        ? usageMetrics.provider
        : stored.provider,
    model: validMetadata(update.model)
      ? update.model
      : validMetadata(usageMetrics?.model)
        ? usageMetrics.model
        : stored.model,
    temperature: numberOr(update.temperature, stored.temperature),
    systemPrompt: validMetadata(partialRecord.systemPrompt)
      ? partialRecord.systemPrompt
      : stored.systemPrompt,
    promptId: update.promptId ?? stored.promptId,
    promptName: update.promptName ?? stored.promptName,
    totalTokens: numberOr(
      partialRecord.totalTokens,
      numberOr(usageMetrics?.totalTokens, stored.totalTokens)
    ),
    promptTokens: numberOr(
      partialRecord.promptTokens,
      numberOr(usageMetrics?.promptTokens, stored.promptTokens)
    ),
    completionTokens: numberOr(
      partialRecord.completionTokens,
      numberOr(usageMetrics?.completionTokens, stored.completionTokens)
    ),
    estimatedCost: numberOr(
      partialRecord.estimatedCost,
      numberOr(usageMetrics?.estimatedCost, stored.estimatedCost)
    ),
    requestTime: numberOr(
      partialRecord.requestTime,
      numberOr(usageMetrics?.requestTime, stored.requestTime)
    ),
  };
};

export type TranslationSettingsSnapshot = Pick<
  AppSettings,
  | 'provider'
  | 'model'
  | 'temperature'
  | 'systemPrompt'
  | 'enableAmendments'
  | 'includeFanTranslationInPrompt'
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
    translationResult: PersistableTranslation,
    settings: TranslationSettingsSnapshot
  ): Promise<TranslationRecord | null> {
    try {
      console.log(`💾 [TranslationSave] Starting save for chapter: ${chapterId}`);
      console.log(`💾 [TranslationSave] Settings:`, { provider: settings.provider, model: settings.model });

      if (translationResult.id) {
        const storedRecord = await TranslationOps.getById(translationResult.id);
        if (storedRecord) {
          const reconciledRecord = mergeOntoStoredRecord(storedRecord, translationResult);
          console.log(`🔄 [TranslationSave] Updating EXISTING translation record:`, {
            chapterId,
            translationId: translationResult.id,
            version: translationResult.version
          });
          await TranslationOps.update(reconciledRecord);
          log('Updated existing translation record', { chapterId, translationId: translationResult.id });
          console.log(`✅ [TranslationSave] Successfully updated existing translation`);
          return reconciledRecord;
        }

        console.warn(`⚠️ [TranslationSave] Persistent ID was not found; storing a new version`, {
          chapterId,
          translationId: translationResult.id,
        });
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
        // No re-activation pass here: storeByStableId already persisted the
        // record with isActive:true and deactivated its siblings, and the
        // label was persisted via the payload. The previous code re-assigned
        // the already-stored label (a no-op on persistence) and ran a full
        // second URL-resolve + cursor walk to set flags already set.
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
