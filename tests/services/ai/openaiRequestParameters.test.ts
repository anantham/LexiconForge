import { describe, expect, it } from 'vitest';
import { getChatCompletionTokenLimit } from '../../../services/ai/openaiRequestParameters';

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
