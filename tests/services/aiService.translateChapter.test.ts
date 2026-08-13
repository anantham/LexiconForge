import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AppSettings, TranslationResult } from '../../types';
import { createMockAppSettings, createMockTranslationResult } from '../utils/test-data';

const initializeProvidersMock = vi.fn().mockResolvedValue(undefined);
const translateMock = vi.fn<(...args: any[]) => Promise<TranslationResult>>();

vi.mock('../../adapters/providers', () => ({
  initializeProviders: initializeProvidersMock,
}));

vi.mock('../../services/translate/Translator', () => ({
  translator: {
    translate: (...args: any[]) => translateMock(...args),
  },
}));

const baseSettings: AppSettings = createMockAppSettings({
  provider: 'OpenRouter',
  model: 'openai/gpt-4o',
  temperature: 0.5,
  systemPrompt: 'System prompt',
  imageModel: 'openrouter-image-model',
  apiKeyOpenRouter: 'user-key',
  includeFanTranslationInPrompt: true,
  showDiffHeatmap: false,
});

const baseResult: TranslationResult = createMockTranslationResult({
  translatedTitle: 'T',
  translation: 'Translation body',
  usageMetrics: {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
    requestTime: 0,
    provider: 'OpenRouter',
    model: 'openai/gpt-4o',
  },
});

describe('translateChapter', () => {
  beforeEach(() => {
    translateMock.mockReset();
    initializeProvidersMock.mockClear();
  });

  it('delegates a successful translation', async () => {
    translateMock.mockResolvedValue(baseResult);
    const { translateChapter } = await import('../../services/ai/translatorRouter');

    const result = await translateChapter(
      'Chapter',
      'Content',
      { ...baseSettings },
      [],
    );

    expect(result.translation).toBe('Translation body');
    expect(initializeProvidersMock).toHaveBeenCalled();
    expect(translateMock).toHaveBeenCalled();
  });

  it('preserves translation failures', async () => {
    const error = new Error('network failure');
    translateMock.mockRejectedValue(error);
    const { translateChapter } = await import('../../services/ai/translatorRouter');

    await expect(translateChapter(
      'Chapter',
      'Content',
      { ...baseSettings },
      [],
    )).rejects.toThrow('network failure');

  });
});
