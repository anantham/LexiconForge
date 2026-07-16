/**
 * Regression test for review finding #4: a budget-preflight THROW stranding the chapter.
 *
 * The chapter is claimed in pendingTranslations before the budget checks (so two rapid triggers
 * can't both slip past the dedup guard during the awaits — P1.6). But if a budget await rejects
 * (dynamic import, a pricing fetch, or an IndexedDB cost read), the claim used to be left set, and
 * the guard at the top of handleTranslate then blocked every future attempt on that chapter until
 * a full reload.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { create } from 'zustand';

const { hasKnownPricingMock } = vi.hoisted(() => ({ hasKnownPricingMock: vi.fn() }));

vi.mock('../../../services/ai/cost', () => ({
  hasKnownPricing: (...a: any[]) => hasKnownPricingMock(...a),
}));
vi.mock('../../../services/ai/apiKeyValidation', () => ({
  validateApiKey: vi.fn(() => ({ isValid: true })),
}));
vi.mock('../../../services/db/operations', () => ({ TranslationOps: {}, FeedbackOps: {}, AmendmentOps: {} }));
vi.mock('../../../services/translationService', () => ({ TranslationService: {} }));
vi.mock('../../../services/translationPersistenceService', () => ({ TranslationPersistenceService: {} }));
vi.mock('../../../services/explanationService', () => ({ ExplanationService: {} }));
vi.mock('../../../services/navigation/converters', () => ({ adaptTranslationRecordToResult: vi.fn() }));
vi.mock('../../../services/clientTelemetry', () => ({ clientTelemetry: { record: vi.fn() } }));
vi.mock('../../../utils/debug', () => ({ debugLog: vi.fn(), debugWarn: vi.fn() }));

import { createTranslationsSlice } from '../../../store/slices/translationsSlice';

const makeStore = () => create<any>((set, get, api) => ({
  ...createTranslationsSlice(set as any, get as any, api as any),
  chapters: new Map([['ch-1', { id: 'ch-1', title: 'C', content: 'x' }]]),
  currentChapterId: 'ch-1',
  activeNovelId: 'novel-1',
  activeVersionId: 'v1',
  settings: {
    provider: 'OpenRouter',
    model: 'test-model',
    preloadMode: 'budget',
    preloadBudget: 10,
    apiKeyOpenRouter: 'k',
  },
  showNotification: vi.fn(),
  setError: vi.fn(),
  setTranslatingState: vi.fn(),
}));

describe('handleTranslate — budget preflight failure releases the pending claim', () => {
  beforeEach(() => { hasKnownPricingMock.mockReset(); });

  it('does not strand the chapter when the pricing check throws', async () => {
    hasKnownPricingMock.mockRejectedValue(new Error('IndexedDB unavailable'));
    const store = makeStore();

    await expect(store.getState().handleTranslate('ch-1')).rejects.toThrow(/IndexedDB unavailable/);

    // The claim must be gone, or every future translate of this chapter is blocked until reload.
    expect(store.getState().pendingTranslations.has('ch-1')).toBe(false);
  });

  it('a second attempt is not blocked after the first failed in preflight', async () => {
    hasKnownPricingMock.mockRejectedValue(new Error('transient'));
    const store = makeStore();

    await expect(store.getState().handleTranslate('ch-1')).rejects.toThrow();
    // The guard at the top of handleTranslate returns early (no throw) if the chapter is still
    // claimed. A second call that reaches the pricing check again proves the claim was released.
    await expect(store.getState().handleTranslate('ch-1')).rejects.toThrow();
    expect(hasKnownPricingMock).toHaveBeenCalledTimes(2);
  });
});
