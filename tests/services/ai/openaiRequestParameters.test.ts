import { describe, expect, it, vi } from 'vitest';

const supportsParametersMock = vi.hoisted(() => vi.fn(() => {
  throw new Error('request construction must not query remote capability metadata');
}));

vi.mock('../../../services/capabilityService', () => ({
  supportsParameters: supportsParametersMock,
}));

import {
  getChatCompletionOptionalParameters,
  getChatCompletionRequestParameters,
  getChatCompletionTokenLimit,
} from '../../../services/ai/openaiRequestParameters';

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
  it('omits unsupported optional parameters fail-closed for direct OpenAI GPT-5 models', () => {
    const result = getChatCompletionRequestParameters('OpenAI', 'gpt-5-mini', 2048, {
      temperature: 0.5,
      top_p: 0.8,
      frequency_penalty: 0.2,
      presence_penalty: 0.3,
      seed: 42,
    });

    expect(result).toEqual({ max_completion_tokens: 2048, seed: 42 });
  });

  it('omits unsupported optional parameters for GPT-5 models routed through OpenRouter', () => {
    const result = getChatCompletionRequestParameters(
      'OpenRouter',
      'openai/gpt-5.4-mini',
      2048,
      { temperature: 0.5, top_p: 0.8 }
    );

    expect(result).toEqual({ max_tokens: 2048 });
  });

  it('retains optional parameters for other models without awaiting remote metadata', () => {
    const result = getChatCompletionRequestParameters(
      'OpenRouter',
      'google/gemini-flash',
      2048,
      { temperature: 0.25, top_p: 0.9 }
    );

    expect(result).toEqual({ max_tokens: 2048, temperature: 0.25, top_p: 0.9 });
    expect(result).not.toBeInstanceOf(Promise);
    expect(supportsParametersMock).not.toHaveBeenCalled();
  });

  it('exposes the same pure optional-parameter contract without a token limit', () => {
    expect(getChatCompletionOptionalParameters(
      'OpenRouter',
      'openai/gpt-5',
      { temperature: 0.2, top_p: 0.9, seed: 7 }
    )).toEqual({ seed: 7 });
    expect(getChatCompletionOptionalParameters(
      'OpenRouter',
      'google/gemini-flash',
      { temperature: 0.2 }
    )).toEqual({ temperature: 0.2 });
  });
});
