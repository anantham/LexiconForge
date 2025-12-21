import { describe, it, expect, vi } from 'vitest';
import { ClaudeAdapter } from '../../../adapters/providers/ClaudeAdapter';
import type { AppSettings, HistoricalChapter, TranslationResult } from '../../../types';
import type { TranslationRequest } from '../../../services/translate/Translator';
import { createMockAppSettings } from '../../utils/test-data';

const { translateWithClaudeMock } = vi.hoisted(() => ({
  translateWithClaudeMock: vi.fn<
    (
      title: string,
      content: string,
      settings: AppSettings,
      history: HistoricalChapter[],
      fanTranslation?: string | null
    ) => Promise<TranslationResult>
  >(),
}));

vi.mock('../../../services/claudeService', () => ({
  translateWithClaude: translateWithClaudeMock,
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
    const settings = createMockAppSettings({ provider: 'Claude', model: 'claude-3' });

    const request: TranslationRequest = {
      title: 'T',
      content: 'C',
      settings,
      history: [],
    };

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
