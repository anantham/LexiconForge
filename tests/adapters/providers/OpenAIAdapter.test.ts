import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AppSettings } from '../../../types';
import type { TranslationRequest } from '../../../services/translate/Translator';
import { OpenAIAdapter } from '../../../adapters/providers/OpenAIAdapter';
import { createMockAppSettings } from '../../utils/test-data';

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

const supportsStructuredOutputsMock = vi.fn().mockResolvedValue(true);
const supportsParametersMock = vi.fn().mockResolvedValue(true);

vi.mock('../../../services/capabilityService', () => ({
  supportsStructuredOutputs: (...args: any[]) => supportsStructuredOutputsMock(...args),
  supportsParameters: (...args: any[]) => supportsParametersMock(...args),
}));

const rateLimitMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../services/rateLimitService', () => ({
  rateLimitService: {
    canMakeRequest: (...args: any[]) => rateLimitMock(...args),
  },
}));

const calculateCostMock = vi.fn().mockResolvedValue(0.42);
vi.mock('../../../services/aiService', () => ({
  calculateCost: (...args: any[]) => calculateCostMock(...args),
}));

const recordMetricMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../services/apiMetricsService', () => ({
  apiMetricsService: {
    recordMetric: (...args: any[]) => recordMetricMock(...args),
  },
}));

vi.mock('../../../services/env', () => ({
  getEnvVar: (key: string) => key === 'OPENAI_API_KEY' ? 'env-openai-key' : undefined,
}));

vi.mock('../../../services/defaultApiKeyService', () => ({
  getDefaultApiKey: vi.fn(() => 'trial-key'),
}));

const baseSettings: AppSettings = createMockAppSettings({
  provider: 'OpenAI',
  model: 'gpt-4o',
  systemPrompt: 'Translate text.',
  temperature: 0.7,
  apiKeyOpenAI: '',
  apiKeyGemini: '',
  apiKeyDeepSeek: '',
});

const successResponse = {
  choices: [{
    finish_reason: 'stop',
    message: { content: JSON.stringify({ translatedTitle: 'T', translation: 'Body' }) },
  }],
  usage: { prompt_tokens: 12, completion_tokens: 5 },
};

describe('OpenAIAdapter processResponse', () => {
  beforeEach(() => {
    calculateCostMock.mockClear();
    recordMetricMock.mockClear();
  });

  it('parses JSON payloads and records metrics', async () => {
    const adapter = new OpenAIAdapter() as any;
    const result = await adapter.processResponse(successResponse, baseSettings, 0, 1000, 'chapter-1');

    expect(result.translation).toBe('Body');
    expect(result.translatedTitle).toBe('T');
    expect(result.usageMetrics.totalTokens).toBe(17);
    expect(calculateCostMock).toHaveBeenCalledWith('gpt-4o', 12, 5);
    expect(recordMetricMock).toHaveBeenCalledWith(expect.objectContaining({ success: true, chapterId: 'chapter-1' }));
  });

  it('strips markdown fences via helper', () => {
    const adapter = new OpenAIAdapter() as any;
    const cleaned = adapter.stripMarkdownCodeFences('```json\n{"translatedTitle":"T"}\n```');
    expect(cleaned).toBe('{"translatedTitle":"T"}');
  });

  it('throws when finish reason indicates truncation', async () => {
    const adapter = new OpenAIAdapter() as any;
    const truncatedResponse = {
      choices: [{
        finish_reason: 'length',
        message: { content: '{"partial": true' },
      }],
    };

    await expect(adapter.processResponse(truncatedResponse, baseSettings, 0, 0)).rejects.toThrow(/length_cap/);
  });

  it('throws when JSON cannot be recovered', async () => {
    const adapter = new OpenAIAdapter() as any;
    const malformed = {
      choices: [{
        finish_reason: 'stop',
        message: { content: '{"number": NaN}' }, // invalid JSON but passes truncation heuristics
      }],
    };

    await expect(adapter.processResponse(malformed, baseSettings, 0, 0)).rejects.toThrow(/Failed to parse JSON response/);
  });
});

describe('OpenAIAdapter translate() parameter handling', () => {
  beforeEach(() => {
    openAiMocks.create.mockReset();
    openAiMocks.ctor.mockClear();
    recordMetricMock.mockClear();
    supportsStructuredOutputsMock.mockResolvedValue(false);
  });

  it('retries without advanced params when parameter error occurs', async () => {
    const adapter = new OpenAIAdapter();
    openAiMocks.create
      .mockRejectedValueOnce(new Error('temperature not supported'))
      .mockResolvedValueOnce(successResponse);

    const settings: AppSettings = {
      ...baseSettings,
      temperature: 0.9,
      topP: 0.5,
      frequencyPenalty: 1,
      presencePenalty: 0.2,
      seed: 123,
    };

    const request: TranslationRequest = {
      title: 'T',
      content: 'Body',
      settings,
      history: [],
    };

    await adapter.translate(request);

    expect(openAiMocks.create).toHaveBeenCalledTimes(2);
    const firstCallArgs = openAiMocks.create.mock.calls[0][0];
    expect(firstCallArgs.temperature).toBeDefined();

    const retryArgs = openAiMocks.create.mock.calls[1][0];
    expect(retryArgs.temperature).toBeUndefined();
    expect(retryArgs.top_p).toBeUndefined();
    expect(recordMetricMock).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
