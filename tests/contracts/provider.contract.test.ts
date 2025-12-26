/**
 * Provider Contract Tests (VCR replay-only)
 *
 * Goal: Exercise real adapter logic deterministically (no network) using
 * small cassette fixtures that represent provider SDK responses.
 *
 * This avoids placeholder tests while still providing integration-like coverage across:
 * - prompt building
 * - SDK request/response handling
 * - JSON extraction/parsing
 * - token accounting + cost call wiring
 * - metrics recording (where applicable)
 *
 * Adversarial scenarios (rate limits, timeouts, malformed responses) live in:
 * - tests/adapters/providers/OpenAIAdapter.test.ts
 * - tests/adapters/providers/GeminiAdapter.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AppSettings } from '../../types';
import type { TranslationRequest } from '../../services/translate/Translator';
import { OpenAIAdapter } from '../../adapters/providers/OpenAIAdapter';
import { GeminiAdapter } from '../../adapters/providers/GeminiAdapter';
import { createMockAppSettings } from '../utils/test-data';
import { loadCassette } from './vcr/loadCassette';
import type { GeminiCassette, OpenAICassette } from './vcr/types';

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

const geminiMocks = vi.hoisted(() => {
  const generateContent = vi.fn();
  const getGenerativeModel = vi.fn(() => ({
    generateContent: (...args: any[]) => generateContent(...args),
  }));
  const ctor = vi.fn();
  class GoogleGenerativeAI {
    constructor(...args: any[]) {
      ctor(...args);
    }
    getGenerativeModel(...args: any[]) {
      return getGenerativeModel(...args);
    }
  }
  return { GoogleGenerativeAI, generateContent, getGenerativeModel, ctor };
});

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: geminiMocks.GoogleGenerativeAI,
  GenerateContentResult: Object,
  SchemaType: {
    OBJECT: 'OBJECT',
    ARRAY: 'ARRAY',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    BOOLEAN: 'BOOLEAN',
  },
}));

const supportsStructuredOutputsMock = vi.fn().mockResolvedValue(false);
const supportsParametersMock = vi.fn().mockResolvedValue(false);

vi.mock('../../services/capabilityService', () => ({
  supportsStructuredOutputs: (...args: any[]) => supportsStructuredOutputsMock(...args),
  supportsParameters: (...args: any[]) => supportsParametersMock(...args),
}));

const rateLimitMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../services/rateLimitService', () => ({
  rateLimitService: {
    canMakeRequest: (...args: any[]) => rateLimitMock(...args),
  },
}));

const calculateCostMock = vi.fn();

vi.mock('../../services/aiService', () => ({
  calculateCost: (...args: any[]) => calculateCostMock(...args),
}));

const recordMetricMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../services/apiMetricsService', () => ({
  apiMetricsService: {
    recordMetric: (...args: any[]) => recordMetricMock(...args),
  },
}));

vi.mock('../../services/env', () => ({
  getEnvVar: (_key: string) => undefined,
}));

vi.mock('../../services/defaultApiKeyService', () => ({
  getDefaultApiKey: () => undefined,
}));

function buildSettings(provider: 'OpenAI' | 'Gemini', cassette: OpenAICassette | GeminiCassette): AppSettings {
  const base: Partial<AppSettings> = {
    provider,
    model: cassette.model,
    systemPrompt: cassette.request.systemPrompt,
    temperature: cassette.request.temperature ?? 0.3,
    maxOutputTokens: cassette.request.maxOutputTokens,
    includeFanTranslationInPrompt: cassette.request.includeFanTranslationInPrompt ?? true,
    enableAmendments: cassette.request.enableAmendments ?? false,
  };

  return createMockAppSettings({
    ...base,
    apiKeyOpenAI: provider === 'OpenAI' ? 'test-openai-key' : '',
    apiKeyGemini: provider === 'Gemini' ? 'test-gemini-key' : '',
    apiKeyDeepSeek: '',
  });
}

function buildRequest(cassette: OpenAICassette | GeminiCassette, settings: AppSettings): TranslationRequest {
  return {
    title: cassette.request.title,
    content: cassette.request.content,
    settings,
    history: [],
    chapterId: `contract:${cassette.name}`,
  };
}

describe('Provider Contract (VCR replay-only)', () => {
  beforeEach(() => {
    openAiMocks.create.mockReset();
    openAiMocks.ctor.mockClear();
    geminiMocks.generateContent.mockReset();
    geminiMocks.getGenerativeModel.mockClear();
    geminiMocks.ctor.mockClear();

    rateLimitMock.mockClear();
    calculateCostMock.mockReset();
    recordMetricMock.mockClear();

    supportsStructuredOutputsMock.mockResolvedValue(false);
    supportsParametersMock.mockResolvedValue(false);
  });

  describe('OpenAIAdapter', () => {
    it('replays happy-path cassette via adapter.translate()', async () => {
      const cassette = loadCassette<OpenAICassette>('openai-happy-path');
      const settings = buildSettings('OpenAI', cassette);

      calculateCostMock.mockResolvedValueOnce(cassette.expected.estimatedCost);
      openAiMocks.create.mockResolvedValueOnce(cassette.mock.sdkResponse);

      const adapter = new OpenAIAdapter();
      const result = await adapter.translate(buildRequest(cassette, settings));

      expect(result.translatedTitle).toBe(cassette.expected.translatedTitle);
      expect(result.translation).toBe(cassette.expected.translation);
      expect(result.usageMetrics.promptTokens).toBe(cassette.expected.promptTokens);
      expect(result.usageMetrics.completionTokens).toBe(cassette.expected.completionTokens);
      expect(result.usageMetrics.totalTokens).toBe(cassette.expected.promptTokens + cassette.expected.completionTokens);
      expect(result.usageMetrics.estimatedCost).toBe(cassette.expected.estimatedCost);

      expect(rateLimitMock).toHaveBeenCalledWith(cassette.model);
      expect(calculateCostMock).toHaveBeenCalledWith(cassette.model, cassette.expected.promptTokens, cassette.expected.completionTokens);
      expect(recordMetricMock).toHaveBeenCalledWith(expect.objectContaining({
        apiType: 'translation',
        provider: 'OpenAI',
        model: cassette.model,
        success: true,
        chapterId: `contract:${cassette.name}`,
      }));

      expect(openAiMocks.ctor).toHaveBeenCalledWith(expect.objectContaining({
        apiKey: 'test-openai-key',
        baseURL: 'https://api.openai.com/v1',
      }));

      const requestOptions = openAiMocks.create.mock.calls[0]?.[0];
      expect(requestOptions).toEqual(expect.objectContaining({ model: cassette.model }));
      expect(JSON.stringify(requestOptions)).toContain(cassette.request.title);
      expect(JSON.stringify(requestOptions)).toContain(cassette.request.content);
    });

    it('replays a larger cassette and preserves token accounting', async () => {
      const cassette = loadCassette<OpenAICassette>('openai-medium-chapter');
      const settings = buildSettings('OpenAI', cassette);

      calculateCostMock.mockResolvedValueOnce(cassette.expected.estimatedCost);
      openAiMocks.create.mockResolvedValueOnce(cassette.mock.sdkResponse);

      const adapter = new OpenAIAdapter();
      const result = await adapter.translate(buildRequest(cassette, settings));

      expect(result.translatedTitle).toBe(cassette.expected.translatedTitle);
      expect(result.translation).toBe(cassette.expected.translation);
      expect(result.translation.length).toBeGreaterThan(100);
      expect(result.usageMetrics.totalTokens).toBe(cassette.expected.promptTokens + cassette.expected.completionTokens);
    });
  });

  describe('GeminiAdapter', () => {
    it('replays happy-path cassette via adapter.translate()', async () => {
      const cassette = loadCassette<GeminiCassette>('gemini-happy-path');
      const settings = buildSettings('Gemini', cassette);

      calculateCostMock.mockResolvedValueOnce(cassette.expected.estimatedCost);
      geminiMocks.generateContent.mockResolvedValueOnce({
        response: {
          text: () => cassette.mock.responseText,
          usageMetadata: cassette.mock.usageMetadata,
        },
      });

      const adapter = new GeminiAdapter();
      const result = await adapter.translate(buildRequest(cassette, settings));

      expect(result.translatedTitle).toBe(cassette.expected.translatedTitle);
      expect(result.translation).toBe(cassette.expected.translation);
      expect(result.usageMetrics.promptTokens).toBe(cassette.expected.promptTokens);
      expect(result.usageMetrics.completionTokens).toBe(cassette.expected.completionTokens);
      expect(result.usageMetrics.totalTokens).toBe(cassette.expected.promptTokens + cassette.expected.completionTokens);
      expect(result.usageMetrics.estimatedCost).toBe(cassette.expected.estimatedCost);

      expect(rateLimitMock).toHaveBeenCalledWith(cassette.model);
      expect(calculateCostMock).toHaveBeenCalledWith(cassette.model, cassette.expected.promptTokens, cassette.expected.completionTokens);

      expect(geminiMocks.ctor).toHaveBeenCalledWith('test-gemini-key');
      expect(geminiMocks.getGenerativeModel).toHaveBeenCalledWith(expect.objectContaining({ model: cassette.model }));

      const callArg = geminiMocks.generateContent.mock.calls[0]?.[0];
      const promptText = callArg?.contents?.[0]?.parts?.[0]?.text;
      expect(typeof promptText).toBe('string');
      expect(promptText).toContain(cassette.request.title);
      expect(promptText).toContain(cassette.request.content);
      expect(callArg?.generationConfig?.responseMimeType).toBe('application/json');
    });
  });
});

