/**
 * Regression test for issue #18 — `submitFeedback` must persist to IDB.
 *
 * Pre-fix: submitFeedback only updated in-memory state (feedbackHistory + chapter.feedback);
 * the FeedbackOps.store call was lost during the useAppStore→slices refactor. Comments
 * disappeared on every reload.
 *
 * Post-fix: submitFeedback fires FeedbackOps.store(chapterUrl, item, translationId)
 * after the in-memory updates.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const feedbackOpsMock = vi.hoisted(() => ({
  store: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue([]),
  getAll: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/db/operations', async () => {
  const actual = await vi.importActual<any>('../../services/db/operations');
  return {
    ...actual,
    FeedbackOps: feedbackOpsMock,
  };
});

import { useAppStore } from '../../store';
import type { EnhancedChapter } from '../../services/stableIdService';
import type { TranslationResult } from '../../types';

const makeChapter = (
  id: string,
  url: string,
  translationId: string | null = 'tr-active-1',
): EnhancedChapter => ({
  id,
  novelId: null,
  libraryVersionId: null,
  title: `Chapter ${id}`,
  content: 'Original chapter content',
  originalUrl: url,
  canonicalUrl: url,
  nextUrl: null,
  prevUrl: null,
  sourceUrls: [url],
  translationResult: {
    id: translationId,
    translatedTitle: 'Translated title',
    translation: 'Translated content',
    proposal: null,
    footnotes: [],
    suggestedIllustrations: [],
    usageMetrics: {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      estimatedCost: 0,
      requestTime: 0,
      provider: 'Gemini',
      model: 'gemini-2.5-flash',
    },
  } as TranslationResult,
  feedback: [],
} as unknown as EnhancedChapter);

const resetStore = () => {
  useAppStore.setState({
    chapters: new Map(),
    feedbackHistory: {},
  });
};

describe('submitFeedback persistence (issue #18)', () => {
  const chapterId = 'stable-18';
  const chapterUrl = 'https://example.com/ch18';

  beforeEach(() => {
    resetStore();
    feedbackOpsMock.store.mockClear();
    useAppStore.setState(() => ({
      chapters: new Map([[chapterId, makeChapter(chapterId, chapterUrl, 'tr-active-1')]]),
      feedbackHistory: {},
    }));
  });

  it('persists submitted feedback to IndexedDB via FeedbackOps.store', async () => {
    useAppStore.getState().submitFeedback(chapterId, {
      selection: 'Great line',
      type: '👍',
      comment: 'Love this turn of phrase',
      text: 'Love this turn of phrase',
      category: 'positive',
    });

    // Persistence is fire-and-forget; let the microtask queue drain
    await Promise.resolve();
    await Promise.resolve();

    expect(feedbackOpsMock.store).toHaveBeenCalledTimes(1);
    const [persistedUrl, persistedItem, persistedTranslationId] =
      feedbackOpsMock.store.mock.calls[0];
    expect(persistedUrl).toBe(chapterUrl);
    expect(persistedItem.selection).toBe('Great line');
    expect(persistedItem.comment).toBe('Love this turn of phrase');
    expect(persistedItem.type).toBe('👍');
    expect(persistedTranslationId).toBe('tr-active-1');
  });

  it('passes translationId from chapter.translationResult.id when present', async () => {
    useAppStore.setState(() => ({
      chapters: new Map([[chapterId, makeChapter(chapterId, chapterUrl, 'tr-specific-id')]]),
      feedbackHistory: {},
    }));

    useAppStore.getState().submitFeedback(chapterId, {
      selection: 's',
      type: '👎',
      comment: 'c',
      text: 'c',
      category: 'negative',
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(feedbackOpsMock.store).toHaveBeenCalledTimes(1);
    expect(feedbackOpsMock.store.mock.calls[0][2]).toBe('tr-specific-id');
  });

  it('omits translationId when no active translation has an id', async () => {
    useAppStore.setState(() => ({
      chapters: new Map([[chapterId, makeChapter(chapterId, chapterUrl, null)]]),
      feedbackHistory: {},
    }));

    useAppStore.getState().submitFeedback(chapterId, {
      selection: 's',
      type: '?',
      comment: 'c',
      text: 'c',
      category: 'suggestion',
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(feedbackOpsMock.store).toHaveBeenCalledTimes(1);
    expect(feedbackOpsMock.store.mock.calls[0][2]).toBeUndefined();
  });

  it('does not throw if FeedbackOps.store rejects', async () => {
    feedbackOpsMock.store.mockRejectedValueOnce(new Error('IDB write failed'));

    expect(() => {
      useAppStore.getState().submitFeedback(chapterId, {
        selection: 's',
        type: '👍',
        comment: 'c',
        text: 'c',
        category: 'positive',
      });
    }).not.toThrow();

    await Promise.resolve();
    await Promise.resolve();

    // In-memory state should still have the feedback even though IDB failed.
    const chapter = useAppStore.getState().chapters.get(chapterId);
    expect(chapter?.feedback).toHaveLength(1);
  });
});
