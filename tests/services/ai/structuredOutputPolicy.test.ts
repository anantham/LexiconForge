import { describe, expect, it } from 'vitest';

import { shouldRequestStructuredOutputs } from '../../../services/ai/structuredOutputPolicy';

describe('shouldRequestStructuredOutputs', () => {
  it.each([
    ['OpenAI', true],
    ['OpenRouter', true],
    ['Gemini', true],
    ['DeepSeek', false],
    ['Claude', false],
  ] as const)('uses the local %s transport policy without remote metadata', (provider, expected) => {
    expect(shouldRequestStructuredOutputs(provider)).toBe(expected);
  });

  it('honors an explicit caller opt-out', () => {
    expect(shouldRequestStructuredOutputs('OpenAI', false)).toBe(false);
    expect(shouldRequestStructuredOutputs('OpenRouter', false)).toBe(false);
  });
});
