import type { AppSettings, TranslationResult } from '../../../types';
import type { TranslationRecord } from '../types';
import type { TranslationSettingsSnapshot } from '../repositories/interfaces/ITranslationRepository';
import { translationFacade } from '../repositories/translationFacade';

export interface ChapterRef {
  stableId?: string;
  url?: string;
}

const toSnapshot = (
  settings: Pick<
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
  }
): TranslationSettingsSnapshot => ({
  provider: settings.provider,
  model: settings.model,
  temperature: settings.temperature,
  systemPrompt: settings.systemPrompt,
  enableAmendments: settings.enableAmendments,
  includeFanTranslationInPrompt: settings.includeFanTranslationInPrompt,
  promptId: settings.promptId,
  promptName: settings.promptName,
});

/**
 * Thin static API over translationFacade. Each method is a single delegation —
 * the `*Modern` module-locals that used to sit between these methods and the
 * facade were vestiges of the removed legacy/modern backend fork (nothing left
 * to arbitrate) and were inlined by the 2026-07-26 integrity pass.
 */
export class TranslationOps {
  static async store({
    ref,
    result,
    settings,
  }: {
    ref: ChapterRef;
    result: TranslationResult;
    settings: Pick<
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
  }): Promise<TranslationRecord> {
    if (ref.url) {
      return translationFacade.storeByUrl(ref.url, result, toSnapshot(settings));
    }
    if (!ref.stableId) throw new Error('ChapterRef requires stableId or url');
    // stableId-only refs go through the repository's own resolution (P0.2
    // chapters-record-first precedence + stableId:// fallback). A duplicate
    // MAPPINGS-first resolver used to live here; its precedence was exactly
    // the one the P0.2 fix retired, waiting to resurrect the keyspace split
    // for the first stableId-only caller.
    return translationFacade.storeByStableId(ref.stableId, result, toSnapshot(settings));
  }

  static async setActiveByStableId(stableId: string, version: number): Promise<void> {
    await translationFacade.setActiveByStableId(stableId, version);
  }

  static async setActiveByUrl(chapterUrl: string, version: number): Promise<void> {
    await translationFacade.setActiveByUrl(chapterUrl, version);
  }

  static async getVersionsByUrl(chapterUrl: string): Promise<TranslationRecord[]> {
    return translationFacade.getVersionsByUrl(chapterUrl);
  }

  static async getVersionsByStableId(stableId: string): Promise<TranslationRecord[]> {
    return translationFacade.getVersionsByStableId(stableId);
  }

  static async getActiveByUrl(chapterUrl: string): Promise<TranslationRecord | null> {
    return translationFacade.getActiveByUrl(chapterUrl);
  }

  static async getActiveByStableId(stableId: string): Promise<TranslationRecord | null> {
    return translationFacade.getActiveByStableId(stableId);
  }

  static async storeByStableId(
    stableId: string,
    result: TranslationResult,
    settings: Pick<
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
    }
  ): Promise<TranslationRecord> {
    // No pre-resolution here: the repository resolves the URL itself and has a
    // stableId:// fallback "so the translation is not lost". A getUrlForStableId
    // call at this layer used to throw one level ABOVE that safety net —
    // losing the paid translation the net was built to save — and its result
    // was never even used.
    return translationFacade.storeByStableId(stableId, result, toSnapshot(settings));
  }

  static async deleteVersion(translationId: string): Promise<void> {
    await translationFacade.deleteVersion(translationId);
  }

  static async ensureActiveByStableId(stableId: string): Promise<TranslationRecord | null> {
    return translationFacade.ensureActiveByStableId(stableId);
  }

  static async update(record: TranslationRecord): Promise<void> {
    await translationFacade.update(record);
  }

  static async getAll(): Promise<TranslationRecord[]> {
    return translationFacade.getAll();
  }
}
