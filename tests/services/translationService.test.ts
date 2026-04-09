import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AmendmentProposal, AppSettings, TranslationResult } from '../../types';
import { createMockAppSettings, createMockTranslationResult } from '../utils/test-data';

const aiMocks = vi.hoisted(() => ({
  translateChapter: vi.fn<(...args: any[]) => Promise<TranslationResult>>(),
  validateApiKey: vi.fn(() => ({ isValid: true })),
}));

const providerMocks = vi.hoisted(() => ({
  initializeProviders: vi.fn(async () => undefined),
  getProvider: vi.fn(),
  chatJSON: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  storeByStableId: vi.fn(async () => ({ id: 'tx-1', version: 1 })),
}));

vi.mock('../../services/aiService', () => ({
  translateChapter: aiMocks.translateChapter,
  validateApiKey: aiMocks.validateApiKey,
}));

vi.mock('../../services/db/operations', () => ({
  ChapterOps: {},
  FeedbackOps: {},
  TranslationOps: {
    storeByStableId: dbMocks.storeByStableId,
  },
}));

vi.mock('../../services/translate/HtmlRepairService', () => ({
  HtmlRepairService: {
    repair: (html: string) => ({ html, stats: { applied: [] } }),
  },
}));

vi.mock('../../adapters/providers', () => ({
  initializeProviders: providerMocks.initializeProviders,
}));

vi.mock('../../adapters/providers/registry', () => ({
  getProvider: providerMocks.getProvider,
}));

vi.mock('../../utils/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}));

const createSettings = (overrides: Partial<AppSettings> = {}): AppSettings =>
  createMockAppSettings({
    provider: 'OpenRouter',
    model: 'google/gemini-2.5-flash',
    temperature: 0.4,
    systemPrompt: 'System prompt for {{targetLanguage}} translation',
    targetLanguage: 'English',
    enableAmendments: true,
    includeFanTranslationInPrompt: false,
    showDiffHeatmap: false,
    ...overrides,
  });

const createChapter = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'chapter-1',
    title: 'Chapter 1',
    content: 'Raw chapter body',
    originalUrl: 'https://example.com/ch1',
    canonicalUrl: 'https://example.com/ch1',
    stableId: 'chapter-1',
    fanTranslation: 'Fan translation body',
    ...overrides,
  }) as any;

describe('TranslationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerMocks.getProvider.mockReturnValue({
      name: 'OpenRouter',
      chatJSON: providerMocks.chatJSON,
    });
    aiMocks.translateChapter.mockResolvedValue(
      createMockTranslationResult({
        translatedTitle: 'Translated Chapter 1',
        translation: 'AI translation body',
        proposal: null,
      })
    );
    providerMocks.chatJSON.mockResolvedValue({
      text: JSON.stringify({ proposal: null }),
    });
  });

  it('runs a separate amendment proposal pass and always includes the fan translation when available', async () => {
    const proposal: AmendmentProposal = {
      kind: 'prompt',
      observation: 'Recurring term drift',
      currentRule: 'Old glossary row',
      proposedChange: 'New glossary row',
      reasoning: 'Locks the term for future chapters.',
    };
    providerMocks.chatJSON.mockResolvedValueOnce({
      text: JSON.stringify({ proposal }),
    });

    const { TranslationService } = await import('../../services/translationService');
    const settings = createSettings({
      enableAmendments: true,
      includeFanTranslationInPrompt: false,
    });
    const chapter = createChapter();

    const response = await TranslationService.translateChapter(
      'chapter-1',
      {
        chapters: new Map([['chapter-1', chapter]]),
        settings,
      },
      () => []
    );

    expect(aiMocks.translateChapter).toHaveBeenCalledTimes(1);
    expect(providerMocks.initializeProviders).toHaveBeenCalledTimes(1);
    expect(providerMocks.chatJSON).toHaveBeenCalledTimes(1);

    const proposalCall = providerMocks.chatJSON.mock.calls[0][0];
    expect(proposalCall.schemaName).toBe('translation_amendment_proposal');
    expect(proposalCall.user).toContain('Fan translation body');
    expect(proposalCall.user).toContain('FAN TRANSLATION REFERENCE FOR AMENDMENT REVIEW ONLY');
    expect(response.translationResult?.proposal).toEqual(proposal);
    expect(dbMocks.storeByStableId).toHaveBeenCalledWith(
      'chapter-1',
      expect.objectContaining({ proposal }),
      expect.objectContaining({
        enableAmendments: true,
        includeFanTranslationInPrompt: false,
      })
    );
  });

  it('skips the proposal pass entirely when amendments are disabled', async () => {
    const { TranslationService } = await import('../../services/translationService');
    const settings = createSettings({
      enableAmendments: false,
      includeFanTranslationInPrompt: false,
    });
    const chapter = createChapter();

    const response = await TranslationService.translateChapter(
      'chapter-1',
      {
        chapters: new Map([['chapter-1', chapter]]),
        settings,
      },
      () => []
    );

    expect(providerMocks.initializeProviders).not.toHaveBeenCalled();
    expect(providerMocks.chatJSON).not.toHaveBeenCalled();
    expect(response.translationResult?.proposal).toBeNull();
    expect(dbMocks.storeByStableId).toHaveBeenCalledWith(
      'chapter-1',
      expect.objectContaining({ proposal: null }),
      expect.objectContaining({
        enableAmendments: false,
        includeFanTranslationInPrompt: false,
      })
    );
  });

  it('treats amendment and fan-reference toggle changes as meaningful retranslation differences', async () => {
    const { TranslationService } = await import('../../services/translationService');
    const settings = createSettings({
      enableAmendments: false,
      includeFanTranslationInPrompt: false,
    });
    const translationResult = createMockTranslationResult();

    const fanToggleChanged = TranslationService.shouldEnableRetranslation(
      'chapter-1',
      new Map([
        [
          'chapter-1',
          createChapter({
            translationResult,
            translationSettingsSnapshot: {
              provider: settings.provider,
              model: settings.model,
              temperature: settings.temperature,
              systemPrompt: settings.systemPrompt,
              enableAmendments: false,
              includeFanTranslationInPrompt: true,
            },
          }),
        ],
      ]),
      settings
    );

    const amendmentsToggleChanged = TranslationService.shouldEnableRetranslation(
      'chapter-1',
      new Map([
        [
          'chapter-1',
          createChapter({
            translationResult,
            translationSettingsSnapshot: {
              provider: settings.provider,
              model: settings.model,
              temperature: settings.temperature,
              systemPrompt: settings.systemPrompt,
              enableAmendments: true,
              includeFanTranslationInPrompt: false,
            },
          }),
        ],
      ]),
      settings
    );

    expect(fanToggleChanged).toBe(true);
    expect(amendmentsToggleChanged).toBe(true);
  });
});
