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

    expect(createMock).not.toHaveBeenCalled();
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

    expect(createMock).not.toHaveBeenCalled();
  });

  it('parses JSON payload contained inside Markdown fences', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: [
              'Here is the match you requested:',
              '```json',
              '{',
              '  "fanExcerpt": "  Matched line  ",',
              '  "fanContextBefore": "Before context",',
              '  "fanContextAfter": "After context",',
              '  "rawExcerpt": "원문 문장",',
              '  "rawContextBefore": null,',
              '  "rawContextAfter": null,',
              '  "confidence": "0.82"',
              '}',
              '```',
            ].join('\n'),
          },
        },
      ],
    });

    const result = await ComparisonService.requestFocusedComparison({
      ...baseArgs,
      settings: buildSettings({ maxOutputTokens: 1024 }),
    });

    expect(openAiCtor).toHaveBeenCalledWith({
      apiKey: 'test-key',
      baseURL: 'https://api.openai.com/v1',
      dangerouslyAllowBrowser: true,
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 1024,
        messages: [
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining(baseArgs.selectedTranslation),
          }),
        ],
      }),
    );

    expect(result).toEqual({
      fanExcerpt: 'Matched line',
      fanContextBefore: 'Before context',
      fanContextAfter: 'After context',
      rawExcerpt: '원문 문장',
      rawContextBefore: null,
      rawContextAfter: null,
      confidence: 0.82,
    });
  });

  it('throws when the model response does not contain JSON', async () => {
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Unable to comply',
          },
        },
      ],
    });

    await expect(
      ComparisonService.requestFocusedComparison({
        ...baseArgs,
        settings: buildSettings(),
      }),
    ).rejects.toThrow('Comparison response did not contain valid JSON.');
  });
});
