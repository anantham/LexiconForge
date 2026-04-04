/**
 * translationSettingsSnapshot.ts
 *
 * Utility for capturing and normalizing the subset of AppSettings that affects
 * how a translation is produced. Storing this alongside a TranslationResult
 * makes it possible to reproduce a translation or compare results produced
 * under different settings.
 */

import type { AppSettings } from '../types';
import { defaultSettings } from './sessionManagementService';

/**
 * The settings fields that directly influence translation output.
 * Captured at translation time and stored with the result.
 */
export type TranslationSettingsSnapshot = Pick<
  AppSettings,
  | 'provider'
  | 'model'
  | 'temperature'
  | 'systemPrompt'
  | 'contextDepth'
  | 'includeFanTranslationInPrompt'
  | 'includeHistoricalFanTranslationsInContext'
> & {
  /** ID of the active prompt template, if one was selected */
  promptId?: string;
  /** Human-readable name of the active prompt template */
  promptName?: string;
};

/**
 * Partial input accepted by normalizeTranslationSettingsSnapshot.
 * Missing fields fall back to defaultSettings.
 */
export type TranslationSettingsSnapshotInput = Partial<TranslationSettingsSnapshot>;

/**
 * Fills in any missing fields from defaultSettings, producing a complete snapshot.
 * Safe to call with a partial object (e.g., loaded from an older stored result).
 */
export const normalizeTranslationSettingsSnapshot = (
  snapshot: TranslationSettingsSnapshotInput
): TranslationSettingsSnapshot => ({
  provider: snapshot.provider ?? defaultSettings.provider,
  model: snapshot.model ?? defaultSettings.model,
  temperature: snapshot.temperature ?? defaultSettings.temperature,
  systemPrompt: snapshot.systemPrompt ?? defaultSettings.systemPrompt,
  contextDepth: snapshot.contextDepth ?? defaultSettings.contextDepth,
  includeFanTranslationInPrompt:
    snapshot.includeFanTranslationInPrompt ?? defaultSettings.includeFanTranslationInPrompt ?? false,
  includeHistoricalFanTranslationsInContext:
    snapshot.includeHistoricalFanTranslationsInContext ??
    defaultSettings.includeHistoricalFanTranslationsInContext ??
    false,
  promptId: snapshot.promptId,
  promptName: snapshot.promptName,
});
