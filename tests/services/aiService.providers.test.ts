import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppSettings, HistoricalChapter } from '../../types';
import { createMockAppSettings } from '../utils/test-data';

const envMocks = vi.hoisted(() => ({
  getEnvVar: vi.fn(() => undefined),
  hasEnvVar: vi.fn(() => false),
}));

vi.mock('../../services/env', () => envMocks);

const capabilityMocks = vi.hoisted(() => ({
  supportsStructuredOutputs: vi.fn(async () => false),
  supportsParameters: vi.fn(async () => true),
}));

vi.mock('../../services/capabilityService', () => capabilityMocks);

const rateLimitMock = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../../services/rateLimitService', () => ({
  rateLimitService: {
    canMakeRequest: rateLimitMock,
  },
}));

const openrouterMocks = vi.hoisted(() => ({
  getPricingForModel: vi.fn(async () => null),
  fetchModels: vi.fn(async () => ({ data: [], fetchedAt: new Date().toISOString() })),
  getCachedModels: vi.fn(async () => null),
  setLastUsed: vi.fn(async () => undefined),
}));

vi.mock('../../services/openrouterService', () => ({
  openrouterService: openrouterMocks,
}));

const fanContextMock = vi.hoisted(() => vi.fn((..._args: unknown[]) => 'Fan translation context'));
vi.mock('../../services/prompts', () => ({
  buildFanTranslationContext: fanContextMock,
  formatHistory: vi.fn(() => 'Formatted history'),
}));

const createSettings = (overrides: Partial<AppSettings> = {}): AppSettings =>
  createMockAppSettings({
    provider: 'Gemini',
    model: 'gemini-2.0-flash',
    temperature: 0.7,
    apiKeyGemini: '',
    apiKeyOpenAI: '',
    apiKeyDeepSeek: '',
    apiKeyClaude: '',
    apiKeyOpenRouter: '',
    includeFanTranslationInPrompt: true,
    showDiffHeatmap: false,
    ...overrides,
  });

const createHistoricalChapter = (overrides: Partial<HistoricalChapter> = {}): HistoricalChapter => ({
  originalTitle: 'Prev',
  originalContent: 'Original body',
  translatedTitle: 'Translated',
  translatedContent: 'Translated body',
  footnotes: [],
  feedback: [],
  ...overrides,
});

const openAiMocks = vi.hoisted(() => {
  const create = vi.fn();
  const ctor = vi.fn();
  class OpenAI {
    chat = {
      completions: {
        create: (...args: any[]) => create(...args),
      },
    };
    constructor(...args: any[]) {
      ctor(...args);
    }
  }
  return { OpenAI, create, ctor };
});

vi.mock('openai', () => ({ __esModule: true, default: openAiMocks.OpenAI }));

describe('legacy provider helpers in aiService', () => {
  it('translateWithGemini rejects when API key missing', async () => {
    envMocks.getEnvVar.mockReturnValueOnce(undefined);
    const { __testUtils } = await import('../../services/aiService');

    const settings = createSettings({
      provider: 'Gemini',
      apiKeyGemini: '',
      model: 'gemini-2.0-flash',
      temperature: 0.8,
    });

    await expect(__testUtils.translateWithGemini('T', 'Body', settings, [])).rejects.toThrow(/Gemini API key is missing/);
  });

  describe('translateWithOpenAI', () => {
    beforeEach(() => {
      envMocks.getEnvVar.mockReset().mockReturnValue(undefined);
      envMocks.hasEnvVar.mockReset().mockReturnValue(false);
      capabilityMocks.supportsStructuredOutputs.mockReset().mockResolvedValue(false);
      capabilityMocks.supportsParameters.mockReset().mockImplementation(async () => true);
      rateLimitMock.mockReset().mockResolvedValue(undefined);
      openrouterMocks.getPricingForModel.mockReset().mockResolvedValue(null);
      openrouterMocks.fetchModels.mockReset().mockResolvedValue({ data: [], fetchedAt: new Date().toISOString() });
      openrouterMocks.getCachedModels.mockReset().mockResolvedValue(null);
      openrouterMocks.setLastUsed.mockReset().mockResolvedValue(undefined);
      fanContextMock.mockReset().mockReturnValue('Fan translation context');
      openAiMocks.create.mockReset();
      openAiMocks.ctor.mockReset();
    });

    it('throws when API key missing', async () => {
      const { __testUtils } = await import('../../services/aiService');
      const settings = createSettings({
        provider: 'OpenAI',
        apiKeyOpenAI: '',
        model: 'gpt-4o',
        systemPrompt: 'Translate to English.',
        temperature: 0.7,
      });

      await expect(__testUtils.translateWithOpenAI('T', 'Body', settings, [], null)).rejects.toThrow(/API key is missing/);
    });

    it('returns normalized result with parameter support', async () => {
      const usage = { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 };
      const payload = {
        translatedTitle: 'Output Title',
        translation: '<p>Rendered body</p>',
        footnotes: [{ marker: '[1]', text: 'Note' }],
        suggestedIllustrations: [{ placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'Prompt' }],
      };

      openAiMocks.create.mockResolvedValue({
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(payload) } }],
        usage,
      });

      const { __testUtils } = await import('../../services/aiService');
      const settings = createSettings({
        provider: 'OpenAI',
        apiKeyOpenAI: 'user-key',
        model: 'gpt-4o',
        systemPrompt: 'Translate {{targetLanguage}} text.',
        temperature: 0.8,
        topP: 0.9,
        frequencyPenalty: 0.4,
        presencePenalty: 0.1,
        seed: 42,
        maxOutputTokens: 256,
        targetLanguage: 'English',
      });

      const history: HistoricalChapter[] = [createHistoricalChapter()];

      const result = await __testUtils.translateWithOpenAI('Chapter', 'Current content', settings, history, 'fan text');

      expect(openAiMocks.create).toHaveBeenCalledTimes(1);
      const requestOptions = openAiMocks.create.mock.calls[0][0];
      expect(requestOptions.model).toBe('gpt-4o');
      expect(requestOptions.messages).toHaveLength(4);
      expect(requestOptions.temperature).toBeDefined();
      expect(requestOptions.top_p).toBeDefined();
      expect(requestOptions.frequency_penalty).toBeDefined();
      expect(requestOptions.presence_penalty).toBeDefined();
      expect(requestOptions.seed).toBeDefined();
      expect(requestOptions.max_tokens ?? requestOptions.max_completion_tokens).toBe(256);

      expect(result.translatedTitle).toBe('Output Title');
      expect(result.translation).toContain('Rendered body');
      expect(result.footnotes).toHaveLength(1);
      expect(result.suggestedIllustrations).toHaveLength(1);
      expect(result.usageMetrics.totalTokens).toBe(18);
      expect(result.usageMetrics.actualParams?.temperature).toBeDefined();
    });
  });
});
