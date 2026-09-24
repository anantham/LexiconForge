import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppSettings } from '../../../types';
import { GeminiAdapter } from '../../../adapters/providers/GeminiAdapter';
import { createMockAppSettings } from '../../utils/test-data';

const calculateCostMock = vi.fn().mockResolvedValue(0.25);
const generateContentMock = vi.hoisted(() => vi.fn());

vi.mock('@google/genai', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  GoogleGenAI: class {
    models = { generateContent: generateContentMock };
  },
}));

vi.mock('../../../services/rateLimitService', () => ({
  rateLimitService: { acquireRequestSlot: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../../services/apiMetricsService', () => ({
  apiMetricsService: { recordMetric: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../../services/ai/cost', () => ({
  calculateCost: (...args: any[]) => calculateCostMock(...args),
}));

vi.mock('../../../services/prompts', () => ({
  buildFanTranslationContext: vi.fn(() => 'Fan translation context'),
  formatHistory: vi.fn(() => 'History context'),
}));

vi.mock('../../../utils/promptUtils', () => ({
  getTranslationSystemPrompt: vi.fn((prompt: string) => prompt),
}));

const usageMetadata = {
  promptTokenCount: 10,
  candidatesTokenCount: 6,
};

const makeResponse = (payload: object) => ({
  text: JSON.stringify(payload),
  usageMetadata,
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
    generateContentMock.mockReset();
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
    const response = { text: '', usageMetadata };

    await expect(adapter.processResponse(response, settings, 0, 0)).rejects.toThrow(/Empty response/);
  });

  it('processResponse names the block reason when Gemini returns no text', async () => {
    const adapter = new GeminiAdapter() as any;
    const response = { text: undefined, usageMetadata, promptFeedback: { blockReason: 'SAFETY' } };

    await expect(adapter.processResponse(response, settings, 0, 0)).rejects.toThrow('Empty response from Gemini API (SAFETY)');
  });

  // The new SDK's `text` getter returns text even from blocked candidates; the legacy SDK
  // rejected these finish reasons, and the adapter must keep doing so.
  for (const finishReason of ['SAFETY', 'RECITATION', 'LANGUAGE']) {
    it(`processResponse rejects text from a candidate that finished with ${finishReason}`, async () => {
      const adapter = new GeminiAdapter() as any;
      const response = {
        ...makeResponse({ translatedTitle: 'T', translation: 'partial' }),
        candidates: [{ finishReason }],
      };

      await expect(adapter.processResponse(response, settings, 0, 0)).rejects.toThrow(
        `Gemini response blocked (${finishReason})`,
      );
    });
  }

  it('chatJSON rejects text from a blocked candidate', async () => {
    generateContentMock.mockResolvedValue({
      text: '{"ok":true}',
      usageMetadata,
      candidates: [{ finishReason: 'SAFETY' }],
    });

    await expect(new GeminiAdapter().chatJSON({ settings, user: 'u' })).rejects.toThrow(
      'Gemini response blocked (SAFETY)',
    );
  });

  it('chatJSON returns text from a candidate that finished normally', async () => {
    generateContentMock.mockResolvedValue({
      text: '{"ok":true}',
      usageMetadata,
      candidates: [{ finishReason: 'STOP' }],
    });

    const result = await new GeminiAdapter().chatJSON({ settings, user: 'u' });

    expect(result.text).toBe('{"ok":true}');
  });

  it('processResponse throws when JSON parsing fails', async () => {
    const adapter = new GeminiAdapter() as any;
    const response = { text: 'not json', usageMetadata };

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
