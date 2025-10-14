import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store';
import type { EnhancedChapter } from '../../services/stableIdService';
import type { TranslationResult } from '../../types';

const resetStore = () => {
  useAppStore.setState({
    chapters: new Map(),
    feedbackHistory: {},
  });
};

const makeChapter = (id: string, url: string): EnhancedChapter => ({
  id,
  title: `Chapter ${id}`,
  content: 'Original chapter content',
  originalUrl: url,
  canonicalUrl: url,
  nextUrl: null,
  prevUrl: null,
  sourceUrls: [url],
  translationResult: {
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
});

describe('Feedback slice', () => {
  const chapterId = 'stable-1';
  const chapterUrl = 'https://example.com/ch1';

  beforeEach(() => {
    resetStore();
    useAppStore.setState(state => ({
      chapters: new Map([[chapterId, makeChapter(chapterId, chapterUrl)]]),
      feedbackHistory: {},
    }));
  });

  it('records submitted feedback and associates it with the chapter', () => {
    useAppStore.getState().submitFeedback(chapterId, {
      selection: 'Great line',
      type: '👍',
      comment: 'Love this turn of phrase',
    });

    const history = useAppStore.getState().feedbackHistory[chapterId];
    expect(history).toHaveLength(1);
    expect(history[0].comment).toBe('Love this turn of phrase');

    const chapter = useAppStore.getState().chapters.get(chapterId);
    expect(chapter?.feedback).toHaveLength(1);
    expect(chapter?.feedback?.[0].selection).toBe('Great line');
  });

  it('updates feedback comments in place', () => {
    useAppStore.getState().submitFeedback(chapterId, {
      selection: 'Line',
      type: '👎',
      comment: 'Needs work',
    });

    const feedbackId = useAppStore.getState().feedbackHistory[chapterId][0].id;
    useAppStore.getState().updateFeedbackComment(feedbackId, 'Clarify meaning');

    expect(useAppStore.getState().feedbackHistory[chapterId][0].comment).toBe('Clarify meaning');
  });

  it('deletes feedback entries', () => {
    useAppStore.getState().submitFeedback(chapterId, {
      selection: 'Line',
      type: '?',
      comment: 'What does this mean?',
    });
    const feedbackId = useAppStore.getState().feedbackHistory[chapterId][0].id;

    useAppStore.getState().deleteFeedback(feedbackId);

    expect(useAppStore.getState().feedbackHistory[chapterId]).toHaveLength(0);
    const chapter = useAppStore.getState().chapters.get(chapterId);
    expect(chapter?.feedback).toHaveLength(0);
  });
});
