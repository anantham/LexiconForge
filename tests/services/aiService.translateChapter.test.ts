import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AppSettings, TranslationResult } from '../../types';

const initializeProvidersMock = vi.fn().mockResolvedValue(undefined);
const translateMock = vi.fn<[], Promise<TranslationResult>>();
const incrementUsageMock = vi.fn();
const getDefaultKeyStatusMock = vi.fn(() => ({ usageCount: 0, remainingUses: 10, hasExceeded: false }));

vi.mock('../../adapters/providers', () => ({
  initializeProviders: initializeProvidersMock,
}));

vi.mock('../../services/translate/Translator', () => ({
  translator: {
    translate: (...args: any[]) => translateMock(...args),
  },
}));

vi.mock('../../services/defaultApiKeyService', () => ({
  getDefaultApiKey: vi.fn(() => 'trial-key'),
  incrementDefaultKeyUsage: (...args: any[]) => incrementUsageMock(...args),
  canUseDefaultKey: vi.fn(() => true),
  getDefaultKeyStatus: (...args: any[]) => getDefaultKeyStatusMock(...args),
}));

vi.mock('../../services/env', () => ({
  getEnvVar: vi.fn(() => undefined),
  hasEnvVar: vi.fn(() => false),
}));

const baseSettings: AppSettings = {
  provider: 'OpenRouter',
  apiKeyGemini: '',
  apiKeyOpenAI: '',
  apiKeyDeepSeek: '',
  systemPrompt: 'System prompt',
  model: 'openai/gpt-4o',
  temperature: 0.5,
  contextDepth: 2,
  preloadCount: 0,
  fontSize: 16,
  fontStyle: 'serif',
  lineHeight: 1.6,
  imageModel: 'openrouter-image-model',
  includeFanTranslationInPrompt: true,
  showDiffHeatmap: false,
};

const baseResult: TranslationResult = {
  translatedTitle: 'T',
  translation: 'Translation body',
  footnotes: [],
  proposal: null,
  suggestedIllustrations: [],
  usageMetrics: {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
    requestTime: 0,
    provider: 'OpenRouter',
    model: 'openai/gpt-4o',
  },
};

describe('translateChapter', () => {
  beforeEach(() => {
    translateMock.mockReset();
    incrementUsageMock.mockReset();
    initializeProvidersMock.mockClear();
  });

  it('increments default key usage on successful translation', async () => {
    translateMock.mockResolvedValue(baseResult);
    const { translateChapter } = await import('../../services/aiService');

    const result = await translateChapter(
      'Chapter',
      'Content',
      { ...baseSettings },
      [],
    );

    expect(result.translation).toBe('Translation body');
    expect(initializeProvidersMock).toHaveBeenCalled();
    expect(translateMock).toHaveBeenCalled();
    expect(incrementUsageMock).toHaveBeenCalledTimes(1);
  });

  it('does not increment default key usage when translation fails', async () => {
    const error = new Error('network failure');
    translateMock.mockRejectedValue(error);
    const { translateChapter } = await import('../../services/aiService');

    await expect(translateChapter(
      'Chapter',
      'Content',
      { ...baseSettings },
      [],
    )).rejects.toThrow('network failure');

    expect(incrementUsageMock).not.toHaveBeenCalled();
  });

  it('skips trial counter when user supplies OpenRouter key', async () => {
    translateMock.mockResolvedValue(baseResult);
    const { translateChapter } = await import('../../services/aiService');

    await translateChapter(
      'Chapter',
      'Content',
      { ...baseSettings, apiKeyOpenRouter: 'user-key' } as AppSettings,
      [],
    );

    expect(incrementUsageMock).not.toHaveBeenCalled();
  });
});
