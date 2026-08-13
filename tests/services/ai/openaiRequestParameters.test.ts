import { beforeEach, describe, expect, it, vi } from 'vitest';

const supportsParametersMock = vi.hoisted(() => vi.fn());

vi.mock('../../../services/capabilityService', () => ({
  supportsParameters: supportsParametersMock,
}));

import {
  getChatCompletionRequestParameters,
  getChatCompletionTemperature,
  getChatCompletionTokenLimit,
} from '../../../services/ai/openaiRequestParameters';

beforeEach(() => {
  supportsParametersMock.mockReset().mockResolvedValue(true);
});

describe('getChatCompletionTokenLimit', () => {
  it.each([
    ['gpt-5.2', { max_completion_tokens: 1234 }],
    ['claude-3.7-sonnet', { max_completion_tokens: 1234 }],
    ['openai/gpt-5.4-mini', { max_tokens: 1234 }],
    ['gpt-4o-mini', { max_tokens: 1234 }],
  ])('maps %s to exactly one supported token field', (model, expected) => {
    const result = getChatCompletionTokenLimit(model, 1234);

    expect(result).toEqual(expected);
    expect(Object.keys(result)).toHaveLength(1);
  });
});

describe('getChatCompletionRequestParameters', () => {
  it('omits temperature fail-closed for direct OpenAI GPT-5 models', async () => {
    const result = await getChatCompletionRequestParameters('OpenAI', 'gpt-5-mini', 2048, 0.5);

    expect(result).toEqual({ max_completion_tokens: 2048 });
    expect(supportsParametersMock).not.toHaveBeenCalled();
  });

  it('omits temperature fail-closed for GPT-5 models routed through OpenRouter', async () => {
    const result = await getChatCompletionRequestParameters(
      'OpenRouter',
      'openai/gpt-5.4-mini',
      2048,
      0.5
    );

    expect(result).toEqual({ max_tokens: 2048 });
    expect(supportsParametersMock).not.toHaveBeenCalled();
  });

  it('omits temperature when provider metadata reports it unsupported', async () => {
    supportsParametersMock.mockResolvedValueOnce(false);

    const result = await getChatCompletionRequestParameters(
      'OpenRouter',
      'vendor/reasoning-model',
      2048,
      0.5
    );

    expect(result).toEqual({ max_tokens: 2048 });
    expect(supportsParametersMock).toHaveBeenCalledWith(
      'OpenRouter',
      'vendor/reasoning-model',
      ['temperature']
    );
  });

  it('retains temperature for a model that reports support', async () => {
    const result = await getChatCompletionRequestParameters('OpenAI', 'gpt-4o-mini', 2048, 0.25);

    expect(result).toEqual({ max_tokens: 2048, temperature: 0.25 });
  });

  it('exposes the same temperature-only contract for callers without a token limit', async () => {
    expect(
      await getChatCompletionTemperature('OpenRouter', 'openai/gpt-5', 0.2)
    ).toEqual({});
    expect(
      await getChatCompletionTemperature('OpenRouter', 'google/gemini-flash', 0.2)
    ).toEqual({ temperature: 0.2 });
  });
});
