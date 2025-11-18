import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppSettings } from '../../../types';
import { GeminiAdapter } from '../../../adapters/providers/GeminiAdapter';
import { createMockAppSettings } from '../../utils/test-data';

const calculateCostMock = vi.fn().mockResolvedValue(0.25);

vi.mock('../../../services/aiService', () => ({
  calculateCost: (...args: any[]) => calculateCostMock(...args),
}));

vi.mock('../../../services/prompts', () => ({
  buildFanTranslationContext: vi.fn(() => 'Fan translation context'),
  formatHistory: vi.fn(() => 'History context'),
}));

vi.mock('../../../utils/promptUtils', () => ({
  getEffectiveSystemPrompt: vi.fn((prompt: string) => prompt),
}));

const usageMetadata = {
  promptTokenCount: 10,
  candidatesTokenCount: 6,
};

const makeResponse = (payload: object) => ({
  response: {
    text: () => JSON.stringify(payload),
    usageMetadata,
  },
});

const settings: AppSettings = createMockAppSettings({
  provider: 'Gemini',
  model: 'gemini-2.0-flash',
  systemPrompt: 'Translate to English.',
  temperature: 0.8,
  apiKeyGemini: 'key',
});

describe('GeminiAdapter internals', () => {
  beforeEach(() => {
    calculateCostMock.mockClear();
  });

  it('processResponse returns normalized TranslationResult', async () => {
    const adapter = new GeminiAdapter() as any;
    const response = makeResponse({
      translatedTitle: 'T',
      translation: 'Body',
      footnotes: [{ marker: '[1]', text: 'Note' }],
      suggestedIllustrations: [{ placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'Prompt' }],
    });

    const result = await adapter.processResponse(response, settings, 0, 1000);

    expect(result.translation).toBe('Body');
    expect(result.footnotes).toHaveLength(1);
    expect(result.suggestedIllustrations).toHaveLength(1);
    expect(result.usageMetrics.totalTokens).toBe(16);
    expect(calculateCostMock).toHaveBeenCalledWith('gemini-2.0-flash', 10, 6);
  });

  it('processResponse throws when response text is empty', async () => {
    const adapter = new GeminiAdapter() as any;
    const response = {
      response: {
        text: () => '',
        usageMetadata,
      },
    };

    await expect(adapter.processResponse(response, settings, 0, 0)).rejects.toThrow(/Empty response/);
  });

  it('processResponse throws when JSON parsing fails', async () => {
    const adapter = new GeminiAdapter() as any;
    const response = {
      response: {
        text: () => 'not json',
        usageMetadata,
      },
    };

    await expect(adapter.processResponse(response, settings, 0, 0)).rejects.toThrow(/Failed to parse JSON response/);
  });

  it('buildPrompt injects JSON requirement and fan translation context', () => {
    const adapter = new GeminiAdapter() as any;
    const prompt = adapter.buildPrompt(
      { ...settings, includeFanTranslationInPrompt: true },
      'Title',
      'Body',
      [],
      'Fan text',
    );

    expect(prompt).toContain('Translate to English.');
    expect(prompt).toContain('Fan translation context');
    expect(prompt).toContain('Your response must be a single, valid JSON object.');
  });
});
