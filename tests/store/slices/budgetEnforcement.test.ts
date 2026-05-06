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
import { createTranslationsSlice } from '../../../store/slices/translationsSlice';

const createTestSlice = (settingsOverrides: Partial<AppSettings> = {}) => {
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
  });

  return { state, get, notifications };
};

describe('budget enforcement in handleTranslate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
