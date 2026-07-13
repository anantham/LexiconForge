import { describe, it, expect, vi, beforeEach } from 'vitest';
import { create } from 'zustand';
import type { AmendmentProposal } from '../../types';

// A deferred logAction lets us hold accept/reject open across the await, which is exactly the
// window the race lived in.
const logAction = vi.hoisted(() => vi.fn());

vi.mock('../../services/db/operations', () => ({
  TranslationOps: {},
  FeedbackOps: {},
  AmendmentOps: { logAction: (...args: any[]) => logAction(...args) },
}));

vi.mock('../../services/translationService', () => ({ TranslationService: {} }));
vi.mock('../../services/translationPersistenceService', () => ({ TranslationPersistenceService: {} }));
vi.mock('../../services/explanationService', () => ({ ExplanationService: {} }));
vi.mock('../../services/navigation/converters', () => ({ adaptTranslationRecordToResult: vi.fn() }));
vi.mock('../../services/ai/apiKeyValidation', () => ({ validateApiKey: vi.fn(() => ({ isValid: true })) }));
vi.mock('../../services/clientTelemetry', () => ({ clientTelemetry: { record: vi.fn() } }));
vi.mock('../../utils/debug', () => ({ debugLog: vi.fn(), debugWarn: vi.fn() }));

import { createTranslationsSlice } from '../../store/slices/translationsSlice';

const proposal = (rule: string): AmendmentProposal => ({
  kind: 'prompt',
  observation: `observed ${rule}`,
  currentRule: rule,
  proposedChange: `changed ${rule}`,
  reasoning: 'because',
});

/** The slice alone — no persist middleware, so this needs no localStorage. */
const makeStore = (proposals: AmendmentProposal[]) => {
  const store = create<any>((set, get, api) => ({
    ...createTranslationsSlice(set as any, get as any, api as any),
    amendmentProposals: proposals,
    currentChapterId: 'ch-1',
    settings: { systemPrompt: 'RULE_A and RULE_B' },
    updateSettings: vi.fn(),
  }));
  return store;
};

describe('amendment proposal queue races', () => {
  // Block body on purpose: mockReset() returns the mock, and a function returned from beforeEach
  // is taken by vitest as a teardown callback — it would then CALL our deferred mock and hang.
  beforeEach(() => { logAction.mockReset(); });

  it('a double-click on Accept does not silently discard the NEXT queued proposal', async () => {
    // Both calls read index 0, both await the log, then both removed by POSITIONAL INDEX against
    // the post-await state — so the second removal deleted whatever had shifted into slot 0: P1,
    // dropped without ever being applied or logged.
    const p0 = proposal('RULE_A');
    const p1 = proposal('RULE_B');
    const store = makeStore([p0, p1]);

    let releaseLog: () => void = () => {};
    logAction.mockImplementation(() => new Promise<void>(resolve => { releaseLog = () => resolve(); }));

    const first = store.getState().acceptProposal(0);
    const second = store.getState().acceptProposal(0); // the double-click, while `first` is still awaiting

    releaseLog();
    await Promise.all([first, second]);

    // P0 accepted and removed; P1 must survive, untouched, still awaiting the user.
    expect(store.getState().amendmentProposals).toEqual([p1]);
    // And it must have been accepted exactly once, not logged twice.
    expect(logAction).toHaveBeenCalledTimes(1);
  });

  it('removes the proposal it acted on when the queue shifts under it mid-flight', async () => {
    // Removal by POSITIONAL INDEX also broke the other way. Accept p1 (index 1), and while the
    // log is in flight let p0 leave the queue by some other path. The array is now [p1], so the
    // post-await `filter((_, i) => i !== 1)` matched nothing — the proposal the user just
    // ACCEPTED was never removed, and sat in the queue asking to be accepted again.
    const p0 = proposal('RULE_A');
    const p1 = proposal('RULE_B');
    const store = makeStore([p0, p1]);

    let releaseLog: () => void = () => {};
    logAction.mockImplementation(() => new Promise<void>(resolve => { releaseLog = () => resolve(); }));

    const accepting = store.getState().acceptProposal(1);

    // p0 leaves the queue while the accept above is still awaiting its log write.
    store.setState({ amendmentProposals: [p1] });

    releaseLog();
    await accepting;

    expect(store.getState().amendmentProposals).toEqual([]);
  });

  it('a double-click on Reject does not discard the next proposal either', async () => {
    const p0 = proposal('RULE_A');
    const p1 = proposal('RULE_B');
    const store = makeStore([p0, p1]);

    let releaseLog: () => void = () => {};
    logAction.mockImplementation(() => new Promise<void>(resolve => { releaseLog = () => resolve(); }));

    const first = store.getState().rejectProposal(0);
    const second = store.getState().rejectProposal(0);

    releaseLog();
    await Promise.all([first, second]);

    expect(store.getState().amendmentProposals).toEqual([p1]);
    expect(logAction).toHaveBeenCalledTimes(1);
  });
});
