/**
 * Derives the failed-translation surfacing state for ChapterView.
 *
 * Two failure sources feed the same inline error UI:
 *
 *  1. The GLOBAL ui error (`state.error`) — set when a translation fails while
 *     the user is looking at the chapter (CORE-012 foreground routing).
 *  2. The PER-CHAPTER record `translationProgress[chapterId]` — where
 *     background failures land (CORE-012 background routing). Nothing used to
 *     read this: a chapter whose auto_visit translation failed after the user
 *     navigated away showed no error on return, and because
 *     hasFailedTranslation keyed only on the global error, the manual
 *     retranslate button stayed disabled while the auto-translate mediator
 *     refused to re-fire — a permanent dead-end (the "surfacing on return"
 *     the slice comments promised).
 *
 * Pure so it can be tested at the state level without mounting ChapterView.
 */

export interface PerChapterTranslationProgress {
  status: 'pending' | 'translating' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

export interface TranslationFailureUi {
  /** Enables manual retranslation from the failed state (Issue #14). */
  hasFailedTranslation: boolean;
  /** Message for the inline error UI; null when there is nothing to show. */
  translationError: string | null;
}

export const BACKGROUND_TRANSLATION_FAILED_FALLBACK =
  'Translation failed in the background. Use Retranslate to try again.';

export const deriveTranslationFailureUi = (args: {
  viewMode: string;
  hasTranslationResult: boolean;
  globalError: string | null | undefined;
  perChapterProgress: PerChapterTranslationProgress | null | undefined;
}): TranslationFailureUi => {
  const { viewMode, hasTranslationResult, globalError, perChapterProgress } = args;

  // A rendered translation, or a non-English view, has nothing to surface.
  if (viewMode !== 'english' || hasTranslationResult) {
    return { hasFailedTranslation: false, translationError: null };
  }

  // Foreground failure: the global error is authoritative (it may carry
  // telemetry context the per-chapter record does not).
  if (globalError) {
    return { hasFailedTranslation: true, translationError: globalError };
  }

  // Background failure: surface the per-chapter record on return.
  if (perChapterProgress?.status === 'failed') {
    return {
      hasFailedTranslation: true,
      translationError: perChapterProgress.error ?? BACKGROUND_TRANSLATION_FAILED_FALLBACK,
    };
  }

  return { hasFailedTranslation: false, translationError: null };
};
