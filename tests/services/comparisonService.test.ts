import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AppSettings } from '../../types';

const { createMock, openAiCtor } = vi.hoisted(() => {
  const createMock = vi.fn();
  const openAiCtor = vi.fn();
  return { createMock, openAiCtor };
});

vi.mock('openai', () => ({
  __esModule: true,
  OpenAI: openAiCtor,
}));

import { ComparisonService } from '../../services/comparisonService';

const buildSettings = (overrides: Partial<AppSettings> = {}): AppSettings => ({
  contextDepth: 2,
  preloadCount: 1,
  fontSize: 16,
  fontStyle: 'sans',
  lineHeight: 1.5,
  systemPrompt: 'default system prompt',
  provider: 'OpenAI',
  model: 'gpt-4o-mini',
  imageModel: 'dall-e-test',
  temperature: 0.2,
  apiKeyOpenAI: 'test-key',
  ...overrides,
});

const baseArgs = {
  chapterId: 'chapter-1',
  selectedTranslation: 'Selected translation sentence.',
  fullTranslation: 'Full translation for the chapter.',
  fullFanTranslation: 'Fan translation covering the chapter content.',
  fullRawText: '원문 본문',
};

beforeEach(() => {
  createMock.mockReset();
  openAiCtor.mockReset();
  openAiCtor.mockImplementation(() => ({
    chat: {
      completions: {
        create: createMock,
      },
    },
  }));
});

describe('ComparisonService.requestFocusedComparison', () => {
  it('throws when fan translation is missing', async () => {
    await expect(
      ComparisonService.requestFocusedComparison({
        ...baseArgs,
        fullFanTranslation: '   ',
        settings: buildSettings(),
      }),
    ).rejects.toThrow('Fan translation is required for comparison.');
  });

  it('throws when API key is missing', async () => {
    delete (process.env as Record<string, string | undefined>).VITE_OPENAI_API_KEY;
    delete (process.env as Record<string, string | undefined>).OPENAI_API_KEY;

    await expect(
      ComparisonService.requestFocusedComparison({
        ...baseArgs,
        settings: buildSettings({ apiKeyOpenAI: undefined }),
      }),
    ).rejects.toThrow('API key for OpenAI is missing.');
  });
});
