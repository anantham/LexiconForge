import type { TranslationRecord } from '../db/types';
import type { HydratedTranslationResult } from './types';
import { debugWarn } from '../../utils/debug';

export const adaptTranslationRecordToResult = (
  chapterId: string,
  record: TranslationRecord | null | undefined
): HydratedTranslationResult | null => {
  if (!record) return null;

  // Trace missing metadata for diagnostics
  const hasValidProvider = record.provider && record.provider !== 'unknown';
  const hasValidModel = record.model && record.model !== 'unknown';

  if (!hasValidProvider || !hasValidModel) {
    debugWarn('navigation', 'summary', '[Navigation] Translation has missing/unknown metadata', {
      chapterId,
      translationId: record.id,
      version: record.version,
      provider: record.provider || '(missing)',
      model: record.model || '(missing)',
      hasSettingsSnapshot: !!record.settingsSnapshot,
      snapshotProvider: record.settingsSnapshot?.provider || '(missing)',
      snapshotModel: record.settingsSnapshot?.model || '(missing)',
      createdAt: record.createdAt,
      legacyCheck: {
        totalTokens: record.totalTokens,
        requestTime: record.requestTime,
        estimatedCost: record.estimatedCost,
      },
    });
  }

  const usageMetrics = {
    totalTokens: record.totalTokens || 0,
    promptTokens: record.promptTokens || 0,
    completionTokens: record.completionTokens || 0,
    estimatedCost: record.estimatedCost || 0,
    requestTime: record.requestTime || 0,
    provider: record.provider || 'unknown',
    model: record.model || 'unknown',
  };

  const fallbackId =
    (record.version ? `${chapterId}-v${record.version}` : `${chapterId}-legacy-${record.createdAt || 'missing-id'}`) as string;
  const translationId = record.id || fallbackId;

  if (!record.id) {
    debugWarn('navigation', 'summary', '[Navigation] Hydrated translation is missing a persistent id. Using fallback key.', {
      chapterId,
      fallbackId: translationId,
    });
  }

  return {
    translatedTitle: record.translatedTitle,
    translation: record.translation,
    proposal: record.proposal || null,
    footnotes: record.footnotes || [],
    suggestedIllustrations: record.suggestedIllustrations || [],
    usageMetrics,
    id: translationId,
    version: record.version,
    customVersionLabel: record.customVersionLabel,
    createdAt: record.createdAt,
    isActive: record.isActive,
    stableId: record.stableId,
    chapterUrl: record.chapterUrl,
  } as HydratedTranslationResult;
};
