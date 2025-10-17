/**
 * DiffTriggerService - Listens for translation completion events and triggers diff analysis
 *
 * This service automatically triggers semantic diff analysis when a translation is completed.
 * It listens for 'translation:complete' events and saves the diff results to IndexedDB.
 */

import { DiffAnalysisService } from './DiffAnalysisService';
import { DiffResultsRepo } from '../../adapters/repo/DiffResultsRepo';
import { debugLog } from '../../utils/debug';

const diffService = new DiffAnalysisService();
const diffRepo = new DiffResultsRepo();

interface TranslationCompleteEvent extends CustomEvent {
  detail: {
    chapterId: string;
    aiTranslation: string;
    fanTranslation: string | null;
    rawText: string;
    previousVersionFeedback?: string;
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
  const { chapterId, aiTranslation, fanTranslation, rawText, previousVersionFeedback } = customEvent.detail;

  try {
    debugLog('diff', 'summary', '[DiffTrigger] Starting diff analysis for chapter:', chapterId);

    const result = await diffService.analyzeDiff({
      chapterId,
      aiTranslation,
      fanTranslation: fanTranslation || null,
      rawText,
      previousVersionFeedback
    });

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
  }
}

// Auto-initialize when module is imported
if (typeof window !== 'undefined') {
  initializeDiffTriggerService();
}
