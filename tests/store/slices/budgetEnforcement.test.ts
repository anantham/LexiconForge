import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppSettings } from '../../../types';

// Mock debug utils
vi.mock('../../../utils/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}));

// Mock budgetOps (dynamic import target)
vi.mock('../../../services/db/operations/budgetOps', () => ({
  getNovelTranslationCost: vi.fn(),
}));

// Mock pricing check (dynamic import target). Defaults to "priced" so the
// spend-cap tests exercise the budget branch; the unpriced-model tests flip it.
vi.mock('../../../services/ai/cost', () => ({
  hasKnownPricing: vi.fn(async () => true),
}));

// Mock translation service to prevent real API calls
vi.mock('../../../services/translationService', () => ({
  TranslationService: {
    translateChapterSequential: vi.fn(),
  },
}));

// Mock translation persistence service
vi.mock('../../../services/translationPersistenceService', () => ({
  TranslationPersistenceService: {
    saveTranslation: vi.fn(),
    loadTranslation: vi.fn(),
  },
}));

// Mock DB operations
vi.mock('../../../services/db/operations', () => ({
  TranslationOps: {
    getVersionsByStableId: vi.fn(),
    getVersionsByUrl: vi.fn(),
    save: vi.fn(),
  },
  AmendmentOps: {
    getByChapter: vi.fn(),
    save: vi.fn(),
  },
}));

// Mock validateApiKey to return valid by default
vi.mock('../../../services/ai/apiKeyValidation', () => ({
  validateApiKey: vi.fn(() => ({ isValid: true })),
}));

// Mock client telemetry
vi.mock('../../../services/clientTelemetry', () => ({
  clientTelemetry: {
    emit: vi.fn(),
  },
}));

// Mock explanation service
vi.mock('../../../services/explanationService', () => ({
  ExplanationService: {
    explain: vi.fn(),
  },
}));

import { getNovelTranslationCost } from '../../../services/db/operations/budgetOps';
import { hasKnownPricing } from '../../../services/ai/cost';
import { createTranslationsSlice } from '../../../store/slices/translationsSlice';

const createTestSlice = (
  settingsOverrides: Partial<AppSettings> = {},
  stateOverrides: Record<string, any> = {}
) => {
  const baseSettings: Partial<AppSettings> = {
    provider: 'Gemini',
    model: 'gemini-2.5-flash',
    temperature: 0.7,
    systemPrompt: '',
    preloadMode: 'budget',
    preloadBudget: 4.00,
  };
  const settings = { ...baseSettings, ...settingsOverrides } as AppSettings;
  const state: Record<string, any> = {};
  const notifications: Array<{ message: string; type: string }> = [];

  const set = (partial: any) => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    if (next) Object.assign(state, next);
  };
  const get = () => state as any;
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} };

  const slice = createTranslationsSlice(set as any, get as any, api as any);

  // Merge in cross-slice state that handleTranslate reads via (state as any)
  Object.assign(state, slice, {
    settings,
    chapters: new Map([['ch-1', { id: 'ch-1', chapterNumber: 1, content: '<p>text</p>' }]]),
    activeNovelId: 'novel-1',
    activeVersionId: 'v1',
    showNotification: (message: string, type: string) => {
      notifications.push({ message, type });
    },
    setError: vi.fn(),
    activePromptTemplate: null,
  }, stateOverrides);

  return { state, get, notifications };
};

describe('budget enforcement in handleTranslate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks wipes implementations; restore the "priced" default.
    vi.mocked(hasKnownPricing).mockResolvedValue(true);
  });

  it('refuses to translate an unpriced model in budget mode (P0.4: the gate must not fail open)', async () => {
    vi.mocked(hasKnownPricing).mockResolvedValue(false);
    vi.mocked(getNovelTranslationCost).mockResolvedValue(0);
    const { state, notifications } = createTestSlice({ preloadBudget: 4.00, model: 'mystery/unpriced-model' });

    await state.handleTranslate('ch-1', 'manual_translate');

    expect(hasKnownPricing).toHaveBeenCalledWith('mystery/unpriced-model');
    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toContain("can't verify pricing");
    expect(notifications[0].type).toBe('warning');
    // The spend sum is meaningless for an unpriced model; the gate must not
    // have proceeded to it and then waved the translation through.
    expect(state.pendingTranslations?.size ?? 0).toBe(0);
  });

  it('blocks translation when budget mode is active and budget is exhausted', async () => {
    vi.mocked(getNovelTranslationCost).mockResolvedValue(4.50);
    const { state, notifications } = createTestSlice({ preloadBudget: 4.00 });

    await state.handleTranslate('ch-1', 'manual_translate');

    expect(getNovelTranslationCost).toHaveBeenCalledWith('novel-1', 'v1');
    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toContain('budget of $4.00 reached');
    expect(notifications[0].type).toBe('warning');
  });

  it('blocks translation when spend exactly equals budget', async () => {
    vi.mocked(getNovelTranslationCost).mockResolvedValue(4.00);
    const { state, notifications } = createTestSlice({ preloadBudget: 4.00 });

    await state.handleTranslate('ch-1', 'manual_translate');

    expect(getNovelTranslationCost).toHaveBeenCalledWith('novel-1', 'v1');
    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toContain('budget of $4.00 reached');
    expect(notifications[0].type).toBe('warning');
  });

  it('allows translation when budget has room (does not show budget warning)', async () => {
    vi.mocked(getNovelTranslationCost).mockResolvedValue(1.50);
    const { state, notifications } = createTestSlice({ preloadBudget: 4.00 });

    // handleTranslate will proceed past budget check
    // It may fail later since the translation service is mocked, but no budget warning should fire
    await state.handleTranslate('ch-1', 'manual_translate').catch(() => {});

    expect(getNovelTranslationCost).toHaveBeenCalled();
    expect(notifications.filter((n: any) => n.message.includes('budget'))).toHaveLength(0);
  });

  it('skips budget check entirely in chapters mode', async () => {
    const { state } = createTestSlice({
      preloadMode: 'chapters' as any,
      preloadCount: 5,
    });

    await state.handleTranslate('ch-1', 'manual_translate').catch(() => {});

    expect(getNovelTranslationCost).not.toHaveBeenCalled();
  });

  it('skips budget check when preloadBudget is 0', async () => {
    const { state } = createTestSlice({
      preloadMode: 'budget',
      preloadBudget: 0,
    });

    await state.handleTranslate('ch-1', 'manual_translate').catch(() => {});

    expect(getNovelTranslationCost).not.toHaveBeenCalled();
  });

  it('skips budget check when preloadBudget is undefined', async () => {
    const { state } = createTestSlice({
      preloadMode: 'budget',
      preloadBudget: undefined,
    });

    await state.handleTranslate('ch-1', 'manual_translate').catch(() => {});

    expect(getNovelTranslationCost).not.toHaveBeenCalled();
  });

  describe('budget mode with NO active novel (unscoped — the gate must not fail open)', () => {
    // Pre-fix, the entire budget check sat inside `if (activeNovelId)`, so
    // raw-URL reading (novel never set) silently skipped enforcement: preload
    // could bill up to 999 chapters against a cap that could never trip, and
    // the cost query itself ran index.getAll(null) — an unbounded sum over
    // every novel in the DB.

    it('BLOCKS an auto_preload translation (fail-closed) without querying cost', async () => {
      vi.mocked(getNovelTranslationCost).mockResolvedValue(0);
      const { state } = createTestSlice({}, { activeNovelId: null, activeVersionId: null });

      await state.handleTranslate('ch-1', 'auto_preload');

      const { TranslationService } = await import('../../../services/translationService');
      expect(TranslationService.translateChapterSequential).not.toHaveBeenCalled();
      // Never issue the (previously unbounded) cost query with a null scope.
      expect(getNovelTranslationCost).not.toHaveBeenCalled();
      // The pending claim must be released so a later manual attempt isn't blocked.
      expect(state.pendingTranslations?.size ?? 0).toBe(0);
    });

    it('BLOCKS an auto_visit translation (fail-closed)', async () => {
      const { state } = createTestSlice({}, { activeNovelId: null, activeVersionId: null });

      await state.handleTranslate('ch-1', 'auto_visit');

      const { TranslationService } = await import('../../../services/translationService');
      expect(TranslationService.translateChapterSequential).not.toHaveBeenCalled();
      expect(getNovelTranslationCost).not.toHaveBeenCalled();
      expect(state.pendingTranslations?.size ?? 0).toBe(0);
    });

    it('lets a MANUAL translation proceed (explicit user intent) with unscoped-spend logging, no cost query', async () => {
      const { TranslationService } = await import('../../../services/translationService');
      const { TranslationOps } = await import('../../../services/db/operations');
      vi.mocked(TranslationOps.getVersionsByStableId).mockResolvedValue([] as any);
      vi.mocked(TranslationService.translateChapterSequential).mockResolvedValue({
        translationResult: undefined,
      } as any);
      const { state } = createTestSlice({}, { activeNovelId: null, activeVersionId: null });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await state.handleTranslate('ch-1', 'manual_translate').catch(() => {});

      // Manual user intent wins: the translation was attempted…
      expect(TranslationService.translateChapterSequential).toHaveBeenCalled();
      // …but never against an unscoped cost query, and never silently: the
      // unscoped accounting is logged.
      expect(getNovelTranslationCost).not.toHaveBeenCalled();
      expect(
        warnSpy.mock.calls.some(call =>
          String(call[0]).includes('NOT be counted against any novel budget')
        )
      ).toBe(true);
      warnSpy.mockRestore();
    });
  });
});
