/**
 * DiffTriggerService - Listens for translation completion events and triggers diff analysis
 *
 * This service automatically triggers semantic diff analysis when a translation is completed.
 * It listens for 'translation:complete' events and saves the diff results to IndexedDB.
 */

import { DiffAnalysisService } from './DiffAnalysisService';
import type { DiffResult } from './types';
import { debugLog } from '../../utils/debug';
import { createSimpleLLMAdapter } from './SimpleLLMAdapter';
import { computeDiffHash } from './hash';
import { DIFF_ALGO_VERSION } from './constants';
import { useAppStore } from '../../store';
import { DiffOps } from '../db/operations';
import { getConfiguredApiKey } from '../ai/providerCredentials';

interface TranslationCompleteEvent extends CustomEvent {
  detail: {
    chapterId: string;
    aiTranslation: string;
    aiTranslationId?: string | null;
    fanTranslation: string | null;
    fanTranslationId?: string | null;
    rawText: string;
    previousVersionFeedback?: string;
    preferredProvider?: string;
    preferredModel?: string;
    preferredTemperature?: number;
  };
}

/**
 * Initialize the diff trigger service
 * This should be called once when the app starts
 */
export function initializeDiffTriggerService(): void {
  if (typeof window === 'undefined') {
    return; // Skip in SSR environments
  }

  // Listen for translation completion events
  window.addEventListener('translation:complete', handleTranslationComplete as EventListener);

  debugLog('diff', 'summary', '[DiffTriggerService] Initialized and listening for translation:complete events');
}

/**
 * Clean up event listeners (useful for testing)
 */
export function cleanupDiffTriggerService(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.removeEventListener('translation:complete', handleTranslationComplete as EventListener);
  debugLog('diff', 'summary', '[DiffTriggerService] Cleaned up event listeners');
}

/**
 * Handle translation completion events
 */
export async function handleTranslationComplete(event: Event): Promise<void> {
  const customEvent = event as TranslationCompleteEvent;
  const {
    chapterId,
    aiTranslation,
    aiTranslationId,
    fanTranslation,
    fanTranslationId,
    rawText,
    previousVersionFeedback
  } = customEvent.detail;

  // Defense-in-depth: Check if diff heatmap is enabled in settings
  const isDiffHeatmapEnabled = useAppStore.getState().settings.showDiffHeatmap ?? true; // Default to true for backward compatibility
  if (!isDiffHeatmapEnabled) {
    debugLog('diff', 'summary', '[DiffTrigger] Diff analysis skipped (showDiffHeatmap is disabled in settings)');
    return;
  }

  try {
    debugLog('diff', 'summary', '[DiffTrigger] Starting diff analysis for chapter:', chapterId);

    const aiHash = computeDiffHash(aiTranslation);
    const fanHash = fanTranslation ? computeDiffHash(fanTranslation) : null;
    const rawHash = computeDiffHash(rawText);

    let cachedResult: DiffResult | null = null;
    if (aiTranslationId) {
      cachedResult = await DiffOps.get({
        chapterId,
        aiVersionId: aiTranslationId,
        fanVersionId: fanTranslationId ?? null,
        rawVersionId: rawHash,
        algoVersion: DIFF_ALGO_VERSION,
      });
    }

    if (!cachedResult) {
      cachedResult = await DiffOps.findByHashes(
        chapterId,
        aiHash,
        fanHash,
        rawHash,
        DIFF_ALGO_VERSION
      );
    }

    // Invalidate stale cache: if cached result had no fan translation but we now have one,
    // the cached grey markers are wrong and need recomputation
    if (cachedResult && fanHash && !cachedResult.fanHash) {
      debugLog('diff', 'summary', '[DiffTrigger] Cache invalidated — fan translation now available but cached result had none', {
        chapterId,
        cachedFanHash: cachedResult.fanHash,
        currentFanHash: fanHash,
      });
      cachedResult = null;
    }

    if (cachedResult) {
      debugLog('diff', 'summary', '[DiffTrigger] Cache hit for chapter:', {
        chapterId,
        aiTranslationId,
        aiHash,
        hasFanInCache: !!cachedResult.fanHash,
      });
      window.dispatchEvent(new CustomEvent('diff:updated', { detail: { chapterId, cacheHit: true } }));
      return;
    }

    // Cache lookup is async. Re-read Settings afterwards so a key removal or heatmap
    // disable that happened while awaiting IndexedDB takes effect before any paid request.
    const currentSettings = useAppStore.getState().settings;
    if (!(currentSettings.showDiffHeatmap ?? true)) {
      debugLog('diff', 'summary', '[DiffTrigger] Diff analysis skipped after cache lookup (showDiffHeatmap is disabled)');
      return;
    }

    if (!getConfiguredApiKey(currentSettings, currentSettings.provider)) {
      console.warn(
        `[DiffTriggerService] No ${currentSettings.provider} key in Settings; uncached diff analysis was skipped and no placeholder was saved`
      );
      return;
    }

    const diffService = new DiffAnalysisService();
    diffService.setTranslator(createSimpleLLMAdapter(currentSettings));

    // Event metadata describes the old translation, not permission to select a recipient.
    // A failed request or malformed response must not trigger another provider/model.
    const result = await diffService.analyzeDiff({
      chapterId,
      aiTranslation,
      aiTranslationId: aiTranslationId ?? null,
      aiHash,
      fanTranslation: fanTranslation || null,
      fanTranslationId: fanTranslationId ?? null,
      fanHash,
      rawText,
      rawHash,
      previousVersionFeedback,
      llmProvider: currentSettings.provider,
      llmModel: currentSettings.model,
      llmTemperature: currentSettings.temperature,
      promptOverride: currentSettings.diffAnalysisPrompt ?? null,
    });

    await DiffOps.save(result);

    debugLog('diff', 'summary', '[DiffTrigger] Diff analysis complete:', {
      chapterId,
      markerCount: result.markers.length,
      costUsd: result.costUsd
    });

    // Notify UI to refresh markers
    window.dispatchEvent(new CustomEvent('diff:updated', { detail: { chapterId } }));
  } catch (error) {
    console.error('[DiffTrigger] Diff analysis failed:', error);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('diff:error', {
        detail: { chapterId, error: (error as Error)?.message || String(error) }
      }));
    }
  }
}

// Auto-initialize when module is imported
if (typeof window !== 'undefined') {
  initializeDiffTriggerService();
}
