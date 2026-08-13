import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAppSettings } from '../utils/test-data';

const openAiMocks = vi.hoisted(() => {
  const create = vi.fn();
  class OpenAI {
    chat = {
      completions: {
        create: (...args: unknown[]) => create(...args),
      },
    };
  }
  return { create, OpenAI };
});

const supportsParametersMock = vi.hoisted(() => vi.fn());

vi.mock('openai', () => ({ OpenAI: openAiMocks.OpenAI }));
vi.mock('../../services/capabilityService', () => ({
  supportsParameters: supportsParametersMock,
}));

import { ExplanationService } from '../../services/explanationService';

describe('ExplanationService request parameters', () => {
  beforeEach(() => {
    openAiMocks.create.mockReset().mockResolvedValue({
      choices: [{ message: { content: 'A concise explanation.' } }],
    });
    supportsParametersMock.mockReset().mockResolvedValue(true);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the direct OpenAI GPT-5 completion-token field', async () => {
    const result = await ExplanationService.generateExplanationFootnote(
      'source',
      'translation',
      'selected phrase',
      createMockAppSettings({
        provider: 'OpenAI',
        model: 'gpt-5-mini',
        apiKeyOpenAI: 'settings-openai-key',
        maxOutputTokens: 6000,
      })
    );

    expect(result).toBe('A concise explanation.');
    const request = openAiMocks.create.mock.calls[0][0];
    expect(request.max_completion_tokens).toBe(6000);
    expect(request).not.toHaveProperty('max_tokens');
    expect(request).not.toHaveProperty('temperature');
  });
});
