/**
 * State-level tests for the ChapterView failure-surfacing logic (P1:
 * background-translation dead-end).
 *
 * Pre-fix bug: hasFailedTranslation keyed ONLY on the global ui error, but
 * background failures (CORE-012 routing) land in translationProgress[chapterId]
 * — which nothing read. A chapter whose auto_visit translation failed after
 * the user navigated away showed no error on return, the manual retranslate
 * button stayed disabled, and the auto-translate mediator refused to re-fire:
 * a permanent dead-end.
 */

import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_TRANSLATION_FAILED_FALLBACK,
  deriveTranslationFailureUi,
} from '../../../components/chapter/translationFailureUi';

describe('deriveTranslationFailureUi', () => {
  it('a background failure recorded in translationProgress enables retry and exposes the error', () => {
    // The exact state a failed background auto_visit leaves behind
    // (translationsSlice CORE-012 routing): no translationResult, no global
    // error, per-chapter record failed.
    const result = deriveTranslationFailureUi({
      viewMode: 'english',
      hasTranslationResult: false,
      globalError: null,
      perChapterProgress: { status: 'failed', error: 'x' },
    });

    // hasFailedTranslation=true is what flips canManualRetranslate
    // (canManualRetranslate = !!translationResult || hasFailedTranslation).
    expect(result.hasFailedTranslation).toBe(true);
    expect(result.translationError).toBe('x');
  });

  it('falls back to a generic message when the failed record carries no error text', () => {
    const result = deriveTranslationFailureUi({
      viewMode: 'english',
      hasTranslationResult: false,
      globalError: null,
      perChapterProgress: { status: 'failed' },
    });
    expect(result.hasFailedTranslation).toBe(true);
    expect(result.translationError).toBe(BACKGROUND_TRANSLATION_FAILED_FALLBACK);
  });

  it('the global (foreground) error takes precedence over the per-chapter record', () => {
    const result = deriveTranslationFailureUi({
      viewMode: 'english',
      hasTranslationResult: false,
      globalError: 'Provider 500',
      perChapterProgress: { status: 'failed', error: 'older background error' },
    });
    expect(result.hasFailedTranslation).toBe(true);
    expect(result.translationError).toBe('Provider 500');
  });

  it('a rendered translation suppresses failure surfacing (version switch after a late success)', () => {
    const result = deriveTranslationFailureUi({
      viewMode: 'english',
      hasTranslationResult: true,
      globalError: null,
      perChapterProgress: { status: 'failed', error: 'stale failure' },
    });
    expect(result.hasFailedTranslation).toBe(false);
    expect(result.translationError).toBeNull();
  });

  it('non-English views never surface translation failures', () => {
    const result = deriveTranslationFailureUi({
      viewMode: 'original',
      hasTranslationResult: false,
      globalError: 'Provider 500',
      perChapterProgress: { status: 'failed', error: 'x' },
    });
    expect(result.hasFailedTranslation).toBe(false);
    expect(result.translationError).toBeNull();
  });

  it('an in-flight or completed per-chapter record is not a failure', () => {
    for (const status of ['pending', 'translating', 'completed'] as const) {
      const result = deriveTranslationFailureUi({
        viewMode: 'english',
        hasTranslationResult: false,
        globalError: null,
        perChapterProgress: { status },
      });
      expect(result.hasFailedTranslation).toBe(false);
      expect(result.translationError).toBeNull();
    }
  });

  it('no progress record and no global error: nothing to surface', () => {
    const result = deriveTranslationFailureUi({
      viewMode: 'english',
      hasTranslationResult: false,
      globalError: null,
      perChapterProgress: undefined,
    });
    expect(result.hasFailedTranslation).toBe(false);
    expect(result.translationError).toBeNull();
  });
});
