import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  recordMetric: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class OpenAI {
    chat = { completions: { create: mocks.create } };
  },
}));

vi.mock('../../../services/ai/cost', () => ({
  calculateCost: vi.fn(async () => 0),
}));

vi.mock('../../../services/apiMetricsService', () => ({
  apiMetricsService: { recordMetric: mocks.recordMetric },
}));

import { createSimpleLLMAdapter } from '../../../services/diff/SimpleLLMAdapter';

describe('SimpleLLMAdapter request parameters', () => {
  beforeEach(() => {
    mocks.create.mockReset().mockResolvedValue({
      choices: [{ message: { content: '{"translatedText":"ok"}' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
      model: 'openai/gpt-5',
    });
    mocks.recordMetric.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('omits temperature for OpenAI GPT-5 routed through OpenRouter', async () => {
    const adapter = createSimpleLLMAdapter('settings-openrouter-key');

    await adapter.translate({
      text: 'Compare these translations.',
      systemPrompt: 'Return JSON.',
      provider: 'OpenRouter',
      model: 'openai/gpt-5',
      temperature: 0.2,
    });

    const request = mocks.create.mock.calls[0][0];
    expect(request).not.toHaveProperty('temperature');
    expect(request.response_format).toEqual({ type: 'json_object' });
  });
});
