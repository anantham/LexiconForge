/**
 * Regression tests for P0.6 (TECH-DEBT-FIX-PRIORITY-2026-07-07).
 *
 * Pre-fix bug: updateFeedbackComment mutated the matching item inside the
 * legacy feedbackHistory map in place and did nothing else. For feedback
 * from a prior session (which lives in chapter.feedback, not in the
 * session-local history) the edit was a TOTAL no-op; even for same-session
 * feedback it never persisted, so the typed comment vanished on reload.
 * The repository method to persist it existed the whole time, uncalled.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../utils/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}));

vi.mock('../../../services/translationService', () => ({
  TranslationService: { translateChapterSequential: vi.fn() },
}));

vi.mock('../../../services/translationPersistenceService', () => ({
  TranslationPersistenceService: { saveTranslation: vi.fn(), loadTranslation: vi.fn() },
}));

vi.mock('../../../services/db/operations', () => ({
  TranslationOps: { getVersionsByStableId: vi.fn(), getVersionsByUrl: vi.fn(), save: vi.fn() },
  AmendmentOps: { getByChapter: vi.fn(), save: vi.fn() },
  FeedbackOps: { store: vi.fn(), updateComment: vi.fn(async () => {}) },
}));

vi.mock('../../../services/ai/apiKeyValidation', () => ({
  validateApiKey: vi.fn(() => ({ isValid: true })),
}));

vi.mock('../../../services/clientTelemetry', () => ({
  clientTelemetry: { emit: vi.fn() },
}));

vi.mock('../../../services/explanationService', () => ({
  ExplanationService: { explain: vi.fn() },
}));

import { FeedbackOps } from '../../../services/db/operations';
import { createTranslationsSlice } from '../../../store/slices/translationsSlice';

const FEEDBACK = {
  id: 'fb-1',
  text: 'selection',
  category: 'style',
  timestamp: 1,
  chapterId: 'ch-1',
  selection: 'selection',
  type: '🔧',
  comment: 'original comment',
};

const createTestSlice = (opts: { inHistory?: boolean; inChapter?: boolean } = {}) => {
  const { inHistory = true, inChapter = true } = opts;
  const state: Record<string, any> = {};
  const updateChapter = vi.fn();

  const set = (partial: any) => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    if (next) Object.assign(state, next);
  };
  const get = () => state as any;
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} };

  const slice = createTranslationsSlice(set as any, get as any, api as any);

  const chapter = {
    id: 'ch-1',
    chapterNumber: 1,
    feedback: inChapter ? [{ ...FEEDBACK }] : [],
  };

  Object.assign(state, slice, {
    chapters: new Map([['ch-1', chapter]]),
    feedbackHistory: inHistory ? { 'ch-1': [{ ...FEEDBACK }] } : {},
    updateChapter,
  });

  return { state, updateChapter, chapter };
};

describe('updateFeedbackComment (P0.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(FeedbackOps.updateComment).mockResolvedValue(undefined as never);
  });

  it('updates chapter.feedback with new array/item objects via updateChapter', () => {
    const { state, updateChapter, chapter } = createTestSlice();

    state.updateFeedbackComment('fb-1', 'edited comment');

    expect(updateChapter).toHaveBeenCalledTimes(1);
    const [chapterId, patch] = updateChapter.mock.calls[0];
    expect(chapterId).toBe('ch-1');
    expect(patch.feedback[0].comment).toBe('edited comment');
    // NEW objects, not in-place mutation of the chapter's items
    expect(patch.feedback).not.toBe(chapter.feedback);
    expect(patch.feedback[0]).not.toBe(chapter.feedback[0]);
    expect(chapter.feedback[0].comment).toBe('original comment');
  });

  it('updates the legacy feedbackHistory mirror immutably', () => {
    const { state } = createTestSlice();
    const originalItem = state.feedbackHistory['ch-1'][0];

    state.updateFeedbackComment('fb-1', 'edited comment');

    expect(state.feedbackHistory['ch-1'][0].comment).toBe('edited comment');
    expect(state.feedbackHistory['ch-1'][0]).not.toBe(originalItem);
    expect(originalItem.comment).toBe('original comment');
  });

  it('persists the edit through FeedbackOps.updateComment', () => {
    const { state } = createTestSlice();

    state.updateFeedbackComment('fb-1', 'edited comment');

    expect(FeedbackOps.updateComment).toHaveBeenCalledWith('fb-1', 'edited comment');
  });

  it('prior-session feedback (in chapter.feedback but NOT in session history) still updates and persists', () => {
    // Pre-fix this exact case was a total no-op: the old code only scanned
    // feedbackHistory, which is empty for feedback loaded from a prior session.
    const { state, updateChapter } = createTestSlice({ inHistory: false });

    state.updateFeedbackComment('fb-1', 'edited comment');

    expect(updateChapter).toHaveBeenCalledTimes(1);
    expect(updateChapter.mock.calls[0][1].feedback[0].comment).toBe('edited comment');
    expect(FeedbackOps.updateComment).toHaveBeenCalledWith('fb-1', 'edited comment');
  });
});
