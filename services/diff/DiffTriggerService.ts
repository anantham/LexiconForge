/**
 * DiffTriggerService - Listens for translation completion events and triggers diff analysis
 *
 * This service automatically triggers semantic diff analysis when a translation is completed.
 * It listens for 'translation:complete' events and saves the diff results to IndexedDB.
 */

import { DiffAnalysisService, DiffAnalysisJsonParseError } from './DiffAnalysisService';
import { DiffResultsRepo } from '../../adapters/repo/DiffResultsRepo';
import { debugLog } from '../../utils/debug';
import { createSimpleLLMAdapter } from './SimpleLLMAdapter';
import { getEnvVar } from '../env';
import { computeDiffHash } from './hash';
import { DIFF_ALGO_VERSION, DIFF_DEFAULT_PROVIDER } from './constants';
import { useAppStore } from '../../store';

const diffService = new DiffAnalysisService();
const diffRepo = new DiffResultsRepo();

// Initialize translator adapter with OpenRouter API key
try {
  const apiKey = getEnvVar('OPENROUTER_API_KEY');
  if (apiKey) {
    const adapter = createSimpleLLMAdapter(apiKey);
    diffService.setTranslator(adapter);
  } else {
    console.warn('[DiffTriggerService] OPENROUTER_API_KEY not found - diff analysis will not generate markers');
  }
} catch (e) {
  console.warn('[DiffTriggerService] Failed to initialize LLM adapter:', e);
}

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
async function handleTranslationComplete(event: Event): Promise<void> {
  const customEvent = event as TranslationCompleteEvent;
  const {
    chapterId,
    aiTranslation,
    aiTranslationId,
    fanTranslation,
    fanTranslationId,
    rawText,
    previousVersionFeedback,
    preferredProvider,
    preferredModel,
    preferredTemperature
  } = customEvent.detail;

  // Defense-in-depth: Check if diff heatmap is enabled in settings
  const isDiffHeatmapEnabled = useAppStore.getState().settings.showDiffHeatmap ?? true; // Default to true for backward compatibility
  if (!isDiffHeatmapEnabled) {
    debugLog('diff', 'summary', '[DiffTrigger] Diff analysis skipped (showDiffHeatmap is disabled in settings)');
    return;
  }

  const diffPrompt = useAppStore.getState().settings.diffAnalysisPrompt ?? null;

  try {
    debugLog('diff', 'summary', '[DiffTrigger] Starting diff analysis for chapter:', chapterId);

    const aiHash = computeDiffHash(aiTranslation);
    const fanHash = fanTranslation ? computeDiffHash(fanTranslation) : null;
    const rawHash = computeDiffHash(rawText);
    const normalizedFanId = fanTranslationId ?? '';

    let cachedResult = null;
    if (aiTranslationId) {
      cachedResult = await diffRepo.get(
        chapterId,
        aiTranslationId,
        normalizedFanId,
        rawHash,
        DIFF_ALGO_VERSION
      );
    }

    if (!cachedResult) {
      cachedResult = await diffRepo.findByHashes(
        chapterId,
        aiHash,
        fanHash,
        rawHash,
        DIFF_ALGO_VERSION
      );
    }

    if (cachedResult) {
      debugLog('diff', 'summary', '[DiffTrigger] Cache hit for chapter:', {
        chapterId,
        provider: DIFF_DEFAULT_PROVIDER,
        aiTranslationId,
        aiHash,
      });
      window.dispatchEvent(new CustomEvent('diff:updated', { detail: { chapterId, cacheHit: true } }));
      return;
    }

    const normalizedProvider = preferredProvider?.toLowerCase() ?? null;
    const supportsRequestedProvider = normalizedProvider === 'openrouter';

    const runAnalysis = async (forceDefault: boolean) => {
      return diffService.analyzeDiff({
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
        llmProvider: !forceDefault && supportsRequestedProvider ? preferredProvider : undefined,
        llmModel: !forceDefault && supportsRequestedProvider ? preferredModel : undefined,
        llmTemperature: !forceDefault && typeof preferredTemperature === 'number' ? preferredTemperature : undefined,
        promptOverride: diffPrompt,
      });
    };

    let result;
    let attemptedFallback = false;

    if (!supportsRequestedProvider) {
      debugLog('diff', 'summary', '[DiffTrigger] Using default diff model (unsupported provider)', {
        chapterId,
        preferredProvider,
      });
      result = await runAnalysis(true);
    } else {
      try {
        result = await runAnalysis(false);
      } catch (error) {
        if (error instanceof DiffAnalysisJsonParseError && !attemptedFallback) {
          attemptedFallback = true;
          console.warn('[DiffTrigger] Preferred model failed strict JSON parse, falling back to default', {
            chapterId,
            preferredModel,
          });
          result = await runAnalysis(true);
        } else {
          throw error;
        }
      }
    }

    await diffRepo.save(result);

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
