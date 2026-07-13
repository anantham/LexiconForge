import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppSettings, AmendmentProposal } from '../../../types';

vi.mock('../../../utils/debug', () => ({ debugLog: vi.fn(), debugWarn: vi.fn() }));

const { translateMock } = vi.hoisted(() => ({ translateMock: vi.fn() }));
vi.mock('../../../services/translationService', () => ({
  TranslationService: {
    translateChapterSequential: translateMock,
    // handleTranslate calls this BEFORE the service call; leaving it out made
    // the slice throw early and never reach the mock.
    extractSettingsSnapshot: vi.fn((s: unknown) => s),
    getActiveTranslationIds: vi.fn(() => []),
    cancelTranslation: vi.fn(() => true),
  },
}));
vi.mock('../../../services/translationPersistenceService', () => ({
  TranslationPersistenceService: { saveTranslation: vi.fn(), loadTranslation: vi.fn() },
}));
vi.mock('../../../services/db/operations', () => ({
  // These are awaited with .catch(); returning undefined makes the slice throw
  // before it ever reaches the translation service.
  TranslationOps: {
    getVersionsByStableId: vi.fn(async () => []),
    getVersionsByUrl: vi.fn(async () => []),
    save: vi.fn(async () => {}),
  },
  AmendmentOps: { getByChapter: vi.fn(async () => []), save: vi.fn(), logAction: vi.fn(async () => {}) },
  FeedbackOps: { store: vi.fn(), updateComment: vi.fn(async () => {}) },
}));
vi.mock('../../../services/ai/apiKeyValidation', () => ({
  validateApiKey: vi.fn(() => ({ isValid: true })),
}));
vi.mock('../../../services/clientTelemetry', () => ({ clientTelemetry: { emit: vi.fn() } }));
vi.mock('../../../services/explanationService', () => ({ ExplanationService: { explain: vi.fn() } }));
vi.mock('../../../services/db/operations/budgetOps', () => ({
  getNovelTranslationCost: vi.fn(async () => 0),
}));
vi.mock('../../../services/ai/cost', () => ({ hasKnownPricing: vi.fn(async () => true) }));

import { createTranslationsSlice } from '../../../store/slices/translationsSlice';
import { AmendmentOps } from '../../../services/db/operations';

const createSlice = (settingsOverrides: Partial<AppSettings> = {}) => {
  const state: Record<string, any> = {};
  const set = (partial: any) => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    if (next) Object.assign(state, next);
  };
  const get = () => state as any;
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} };
  const slice = createTranslationsSlice(set as any, get as any, api as any);

  Object.assign(state, slice, {
    settings: { provider: 'Gemini', model: 'gemini-2.5-flash', temperature: 0.7, systemPrompt: '', ...settingsOverrides } as AppSettings,
    chapters: new Map([['ch-1', { id: 'ch-1', chapterNumber: 1, content: '<p>text</p>' }]]),
    activeNovelId: 'novel-1',
    activeVersionId: 'v1',
    updateSettings: vi.fn(),
    showNotification: vi.fn(),
    setError: vi.fn(),
    activePromptTemplate: null,
    currentChapterId: 'ch-1',
  });
  return { state, get };
};

/**
 * P1.6 (TECH-DEBT-FIX-PRIORITY-2026-07-07) — the P0.5 snapshot-before-await
 * pattern, two more instances.
 */
describe('handleTranslate double-fire (P1.6)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('two concurrent calls for the same chapter translate it ONCE (no double spend)', async () => {
    let release!: (v: unknown) => void;
    // Build the deferred EAGERLY: handleTranslate awaits before it reaches the
    // service, so a lazily-created resolver would still be undefined here.
    const deferred = new Promise((r) => { release = r; });
    translateMock.mockImplementation(() => deferred);
    const { state } = createSlice();

    // The guard used to READ pendingTranslations while the chapter was not
    // ADDED until after the API-key check and the budget awaits, so both
    // calls sailed through and both paid.
    const first = state.handleTranslate('ch-1', 'manual_translate');
    const second = state.handleTranslate('ch-1', 'auto_preload');

    release({ translation: '<p>done</p>', translatedTitle: 'T', usageMetrics: {}, footnotes: [], suggestedIllustrations: [] });
    await Promise.all([first, second]).catch(() => {});

    expect(translateMock).toHaveBeenCalledTimes(1);
  });

  it('releases the claim when the budget gate blocks, so the chapter stays translatable', async () => {
    const { getNovelTranslationCost } = await import('../../../services/db/operations/budgetOps');
    vi.mocked(getNovelTranslationCost).mockResolvedValue(99);
    const { state } = createSlice({ preloadMode: 'budget', preloadBudget: 5 } as Partial<AppSettings>);

    await state.handleTranslate('ch-1', 'manual_translate');

    expect(translateMock).not.toHaveBeenCalled();
    // A permanently-held claim would make the chapter un-translatable forever.
    expect(state.pendingTranslations.has('ch-1')).toBe(false);
  });
});

describe('amendment proposal queue (P1.6)', () => {
  const proposalA: AmendmentProposal = {
    observation: 'A', currentRule: 'ruleA', proposedChange: 'changeA', reasoning: 'rA',
  };
  const proposalB: AmendmentProposal = {
    observation: 'B', currentRule: 'ruleB', proposedChange: 'changeB', reasoning: 'rB',
  };

  beforeEach(() => vi.clearAllMocks());

  it('double-clicking accept decides ONE proposal and leaves the next one queued', async () => {
    const { state } = createSlice();
    state.amendmentProposals = [proposalA, proposalB];

    // ONE click = ONE decision. Pre-fix, both calls captured index 0: the
    // first removed A, and the second removed whatever had SHIFTED into
    // index 0 (B) without applying or logging it — silently discarded. An
    // identity-only claim would instead have APPLIED B, a proposal the user
    // never saw. Both are wrong; the second click must be a no-op.
    await Promise.all([state.acceptProposal(0), state.acceptProposal(0)]);

    expect(state.amendmentProposals).toEqual([proposalB]); // B survives, still queued for its own decision
    expect(AmendmentOps.logAction).toHaveBeenCalledTimes(1); // exactly one decision logged
    expect(vi.mocked(AmendmentOps.logAction).mock.calls[0][0].proposal).toBe(proposalA);
  });

  it('double-clicking reject decides ONE proposal and leaves the next one queued', async () => {
    const { state } = createSlice();
    state.amendmentProposals = [proposalA, proposalB];

    await Promise.all([state.rejectProposal(0), state.rejectProposal(0)]);

    expect(state.amendmentProposals).toEqual([proposalB]);
    expect(AmendmentOps.logAction).toHaveBeenCalledTimes(1);
    expect(vi.mocked(AmendmentOps.logAction).mock.calls[0][0].proposal).toBe(proposalA);
  });

  it('a SEQUENTIAL second decision still works (the latch releases)', async () => {
    const { state } = createSlice();
    state.amendmentProposals = [proposalA, proposalB];

    await state.acceptProposal(0);
    await state.rejectProposal(0);

    expect(state.amendmentProposals).toEqual([]);
    expect(AmendmentOps.logAction).toHaveBeenCalledTimes(2);
  });

  it('accepting the second proposal by index removes THAT one, not a positional neighbour', async () => {
    const { state } = createSlice();
    state.amendmentProposals = [proposalA, proposalB];

    await state.acceptProposal(1);

    expect(state.amendmentProposals).toEqual([proposalA]);
  });
});
