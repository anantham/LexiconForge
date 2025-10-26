import { describe, it, expect, vi } from 'vitest';
import { ClaudeAdapter } from '../../../adapters/providers/ClaudeAdapter';
import type { TranslationResult } from '../../../types';

const translateWithClaudeMock = vi.fn<[], Promise<TranslationResult>>();

vi.mock('../../../services/claudeService', () => ({
  translateWithClaude: (...args: any[]) => translateWithClaudeMock(...args),
}));

const mockResult: TranslationResult = {
  translatedTitle: 'Title',
  translation: 'Body',
  footnotes: [],
  proposal: null,
  suggestedIllustrations: [],
  usageMetrics: {
    promptTokens: 1,
    completionTokens: 1,
    totalTokens: 2,
    estimatedCost: 0.01,
    requestTime: 0.5,
    provider: 'Claude',
    model: 'claude-3',
  },
};

describe('ClaudeAdapter', () => {
  it('delegates to translateWithClaude', async () => {
    translateWithClaudeMock.mockResolvedValueOnce(mockResult);
    const adapter = new ClaudeAdapter();

    const request = {
      title: 'T',
      content: 'C',
      settings: { provider: 'Claude', model: 'claude-3', systemPrompt: '', temperature: 0.7 },
      history: [],
    } as any;

    const result = await adapter.translate(request);

    expect(result).toBe(mockResult);
    expect(translateWithClaudeMock).toHaveBeenCalledWith(
      'T',
      'C',
      request.settings,
      [],
      undefined,
    );
  });
});
