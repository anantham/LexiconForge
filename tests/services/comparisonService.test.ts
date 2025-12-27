import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AppSettings } from '../../types';

// Create mock using hoisted pattern with proper class structure
const openAiMocks = vi.hoisted(() => {
  const createMock = vi.fn();
  const ctorMock = vi.fn();

  // Must be a real class for `new OpenAI()` to work
  class MockOpenAI {
    chat = {
      completions: {
        create: (...args: any[]) => createMock(...args),
      },
    };
    constructor(...args: any[]) {
      ctorMock(...args);
    }
  }

  return { createMock, ctorMock, MockOpenAI };
});

vi.mock('openai', () => ({
  __esModule: true,
  OpenAI: openAiMocks.MockOpenAI,
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
  openAiMocks.createMock.mockReset();
  openAiMocks.ctorMock.mockClear();
});

describe('ComparisonService.requestFocusedComparison', () => {
  describe('validation', () => {
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

  describe('happy path', () => {
    it('returns parsed comparison result from LLM response', async () => {
      const mockResponse = {
        fanExcerpt: 'The hero stood tall.',
        fanContextBefore: 'Before the battle...',
        fanContextAfter: 'After the dust settled...',
        rawExcerpt: '영웅이 우뚝 섰다.',
        rawContextBefore: '전투 전에...',
        rawContextAfter: '먼지가 가라앉은 후...',
        confidence: 0.85,
      };

      openAiMocks.createMock.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify(mockResponse),
          },
        }],
      });

      const result = await ComparisonService.requestFocusedComparison({
        ...baseArgs,
        settings: buildSettings(),
      });

      expect(result).toEqual({
        fanExcerpt: 'The hero stood tall.',
        fanContextBefore: 'Before the battle...',
        fanContextAfter: 'After the dust settled...',
        rawExcerpt: '영웅이 우뚝 섰다.',
        rawContextBefore: '전투 전에...',
        rawContextAfter: '먼지가 가라앉은 후...',
        confidence: 0.85,
      });

      // Verify OpenAI was called correctly
      expect(openAiMocks.createMock).toHaveBeenCalledTimes(1);
      expect(openAiMocks.createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          temperature: 0,
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user' }),
          ]),
        }),
      );
    });

    it('handles response wrapped in markdown code fences', async () => {
      const mockResponse = {
        fanExcerpt: 'Extracted from fenced block.',
        fanContextBefore: null,
        fanContextAfter: null,
        rawExcerpt: null,
        rawContextBefore: null,
        rawContextAfter: null,
      };

      openAiMocks.createMock.mockResolvedValueOnce({
        choices: [{
          message: {
            content: '```json\n' + JSON.stringify(mockResponse) + '\n```',
          },
        }],
      });

      const result = await ComparisonService.requestFocusedComparison({
        ...baseArgs,
        settings: buildSettings(),
      });

      expect(result.fanExcerpt).toBe('Extracted from fenced block.');
    });

    it('handles response with extra text around JSON', async () => {
      const mockResponse = {
        fanExcerpt: 'Parsed from noisy response.',
        fanContextBefore: null,
        fanContextAfter: null,
        rawExcerpt: null,
        rawContextBefore: null,
        rawContextAfter: null,
      };

      openAiMocks.createMock.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Here is the comparison:\n' + JSON.stringify(mockResponse) + '\nHope that helps!',
          },
        }],
      });

      const result = await ComparisonService.requestFocusedComparison({
        ...baseArgs,
        settings: buildSettings(),
      });

      expect(result.fanExcerpt).toBe('Parsed from noisy response.');
    });

    it('throws when response contains no valid JSON', async () => {
      openAiMocks.createMock.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'I cannot perform this comparison because...',
          },
        }],
      });

      await expect(
        ComparisonService.requestFocusedComparison({
          ...baseArgs,
          settings: buildSettings(),
        }),
      ).rejects.toThrow('Comparison response did not contain valid JSON.');
    });

    it('handles partial/optional fields gracefully', async () => {
      // LLM returns only some fields
      openAiMocks.createMock.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              fanExcerpt: 'Just the excerpt.',
              // All other fields missing
            }),
          },
        }],
      });

      const result = await ComparisonService.requestFocusedComparison({
        ...baseArgs,
        settings: buildSettings(),
      });

      expect(result.fanExcerpt).toBe('Just the excerpt.');
      expect(result.fanContextBefore).toBeNull();
      expect(result.fanContextAfter).toBeNull();
      expect(result.rawExcerpt).toBeNull();
      expect(result.confidence).toBeUndefined();
    });
  });

  describe('provider routing', () => {
    it('configures OpenAI client correctly for OpenAI provider', async () => {
      openAiMocks.createMock.mockResolvedValueOnce({
        choices: [{ message: { content: '{"fanExcerpt": "test"}' } }],
      });

      await ComparisonService.requestFocusedComparison({
        ...baseArgs,
        settings: buildSettings({
          provider: 'OpenAI',
          apiKeyOpenAI: 'sk-test-key-12345',
          model: 'gpt-4o-mini'
        }),
      });

      // Verify full client configuration
      expect(openAiMocks.ctorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'sk-test-key-12345',
          baseURL: 'https://api.openai.com/v1',
          dangerouslyAllowBrowser: true
        }),
      );

      // Verify request parameters
      expect(openAiMocks.createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          temperature: 0, // Comparison should use 0 for determinism
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining(baseArgs.selectedTranslation)
            })
          ])
        })
      );
    });

    it('configures OpenAI client correctly for DeepSeek provider', async () => {
      openAiMocks.createMock.mockResolvedValueOnce({
        choices: [{ message: { content: '{"fanExcerpt": "test"}' } }],
      });

      await ComparisonService.requestFocusedComparison({
        ...baseArgs,
        settings: buildSettings({
          provider: 'DeepSeek',
          model: 'deepseek-chat',
          apiKeyDeepSeek: 'ds-test-key'
        }),
      });

      // Verify full client configuration for DeepSeek
      expect(openAiMocks.ctorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'ds-test-key',
          baseURL: 'https://api.deepseek.com/v1',
          dangerouslyAllowBrowser: true
        }),
      );

      // Verify the model is passed correctly
      expect(openAiMocks.createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'deepseek-chat'
        })
      );
    });
  });

  describe('malformed response handling', () => {
    it('throws on empty choices array', async () => {
      openAiMocks.createMock.mockResolvedValueOnce({
        choices: []
      });

      await expect(
        ComparisonService.requestFocusedComparison({
          ...baseArgs,
          settings: buildSettings(),
        })
      ).rejects.toThrow();
    });

    it('throws on null message content', async () => {
      openAiMocks.createMock.mockResolvedValueOnce({
        choices: [{ message: { content: null } }]
      });

      await expect(
        ComparisonService.requestFocusedComparison({
          ...baseArgs,
          settings: buildSettings(),
        })
      ).rejects.toThrow();
    });

    it('throws on undefined message', async () => {
      openAiMocks.createMock.mockResolvedValueOnce({
        choices: [{ message: undefined }]
      });

      await expect(
        ComparisonService.requestFocusedComparison({
          ...baseArgs,
          settings: buildSettings(),
        })
      ).rejects.toThrow();
    });

    it('throws on truncated JSON response', async () => {
      openAiMocks.createMock.mockResolvedValueOnce({
        choices: [{ message: { content: '{"fanExcerpt": "test", "confidence":' } }] // Truncated
      });

      await expect(
        ComparisonService.requestFocusedComparison({
          ...baseArgs,
          settings: buildSettings(),
        })
      ).rejects.toThrow('Comparison response did not contain valid JSON');
    });

    it('propagates API error responses', async () => {
      openAiMocks.createMock.mockRejectedValueOnce(new Error('Rate limit exceeded'));

      await expect(
        ComparisonService.requestFocusedComparison({
          ...baseArgs,
          settings: buildSettings(),
        })
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('propagates network errors', async () => {
      openAiMocks.createMock.mockRejectedValueOnce(new Error('Network request failed'));

      await expect(
        ComparisonService.requestFocusedComparison({
          ...baseArgs,
          settings: buildSettings(),
        })
      ).rejects.toThrow('Network request failed');
    });

    it('returns default values for JSON string instead of object', async () => {
      // Response is valid JSON but not an object - service normalizes to default
      openAiMocks.createMock.mockResolvedValueOnce({
        choices: [{ message: { content: '"just a string"' } }]
      });

      const result = await ComparisonService.requestFocusedComparison({
        ...baseArgs,
        settings: buildSettings(),
      });

      // Service gracefully handles non-object JSON by returning defaults
      expect(result.fanExcerpt).toBe('');
      expect(result.fanContextBefore).toBeNull();
      expect(result.rawExcerpt).toBeNull();
    });

    it('returns default values for array instead of object', async () => {
      // Array is valid JSON but not an object - service normalizes to default
      openAiMocks.createMock.mockResolvedValueOnce({
        choices: [{ message: { content: '[1, 2, 3]' } }]
      });

      const result = await ComparisonService.requestFocusedComparison({
        ...baseArgs,
        settings: buildSettings(),
      });

      // Service gracefully handles array JSON by returning defaults
      expect(result.fanExcerpt).toBe('');
      expect(result.fanContextBefore).toBeNull();
      expect(result.rawExcerpt).toBeNull();
    });
  });
});
