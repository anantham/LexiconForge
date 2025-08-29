import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Translator, type TranslationProvider, type TranslationRequest } from '../../../services/translate/Translator';
import type { TranslationResult, AppSettings } from '../../../types';

// Mock provider for testing
class MockTranslationProvider implements TranslationProvider {
  public translateCalls: TranslationRequest[] = [];
  public mockResult: TranslationResult | Error = {
    translatedTitle: 'Mock Title',
    translation: 'Mock translation content',
    illustrations: [],
    amendments: [],
    costUsd: 0.01,
    tokensUsed: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    model: 'mock-model',
    provider: 'Mock',
    translationSettings: {
      provider: 'Mock',
      model: 'mock-model',
      temperature: 0.7,
      systemPrompt: 'Mock prompt',
    }
  };

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    this.translateCalls.push(request);
    
    if (this.mockResult instanceof Error) {
      throw this.mockResult;
    }
    
    return { ...this.mockResult };
  }

  reset() {
    this.translateCalls = [];
    this.mockResult = {
      translatedTitle: 'Mock Title',
      translation: 'Mock translation content',
      illustrations: [],
      amendments: [],
      costUsd: 0.01,
      tokensUsed: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: 'mock-model',
      provider: 'Mock',
      translationSettings: {
        provider: 'Mock',
        model: 'mock-model',
        temperature: 0.7,
        systemPrompt: 'Mock prompt',
      }
    };
  }
}

// Mock sanitizeHtml
vi.mock('../../../services/translate/HtmlSanitizer', () => ({
  sanitizeHtml: vi.fn((content: string) => content + ' [sanitized]')
}));

describe('Translator', () => {
  let translator: Translator;
  let mockProvider: MockTranslationProvider;
  let mockSettings: AppSettings;
  let mockRequest: TranslationRequest;

  beforeEach(() => {
    translator = new Translator();
    mockProvider = new MockTranslationProvider();
    mockProvider.reset();
    
    translator.registerProvider('Mock', mockProvider);

    mockSettings = {
      provider: 'Mock',
      model: 'mock-model',
      temperature: 0.7,
      systemPrompt: 'Test system prompt',
      apiKeyOpenAI: 'mock-key',
      retryMax: 3,
      retryInitialDelayMs: 1000,
    } as AppSettings;

    mockRequest = {
      title: 'Test Title',
      content: 'Test content',
      settings: mockSettings,
      history: [],
      fanTranslation: null,
    };
  });

  describe('registerProvider', () => {
    it('registers providers successfully', () => {
      const translator = new Translator();
      const provider = new MockTranslationProvider();
      
      translator.registerProvider('Test', provider);
      
      expect(translator.getRegisteredProviders()).toContain('Test');
    });

    it('allows multiple provider registrations', () => {
      const translator = new Translator();
      const provider1 = new MockTranslationProvider();
      const provider2 = new MockTranslationProvider();
      
      translator.registerProvider('Test1', provider1);
      translator.registerProvider('Test2', provider2);
      
      const providers = translator.getRegisteredProviders();
      expect(providers).toContain('Test1');
      expect(providers).toContain('Test2');
      expect(providers).toHaveLength(2);
    });
  });

  describe('translate', () => {
    it('successfully translates with registered provider', async () => {
      const result = await translator.translate(mockRequest);

      expect(result.translatedTitle).toBe('Mock Title');
      expect(result.translation).toBe('Mock translation content [sanitized]');
      expect(result.provider).toBe('Mock');
      expect(mockProvider.translateCalls).toHaveLength(1);
      expect(mockProvider.translateCalls[0]).toMatchObject(mockRequest);
    });

    it('throws error for unregistered provider', async () => {
      const request = {
        ...mockRequest,
        settings: { ...mockSettings, provider: 'Unknown' }
      };

      await expect(translator.translate(request)).rejects.toThrow('Provider not registered: Unknown');
    });

    it('sanitizes translation results', async () => {
      mockProvider.mockResult = {
        ...mockProvider.mockResult as TranslationResult,
        translation: 'Raw translation content'
      };

      const result = await translator.translate(mockRequest);

      expect(result.translation).toBe('Raw translation content [sanitized]');
    });

    it('handles empty translations gracefully', async () => {
      mockProvider.mockResult = {
        ...mockProvider.mockResult as TranslationResult,
        translatedTitle: '  ',
        translation: ''
      };

      const result = await translator.translate(mockRequest);

      expect(result.translatedTitle).toBe('');
      expect(result.translation).toBe(' [sanitized]');
    });
  });

  describe('retry logic', () => {
    it('retries on rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;

      mockProvider.mockResult = rateLimitError;

      // Mock successful result on second attempt
      let callCount = 0;
      mockProvider.translate = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw rateLimitError;
        }
        return mockProvider.mockResult = {
          translatedTitle: 'Retry Success',
          translation: 'Succeeded after retry',
          illustrations: [],
          amendments: [],
          costUsd: 0.01,
          tokensUsed: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          model: 'mock-model',
          provider: 'Mock',
          translationSettings: {
            provider: 'Mock',
            model: 'mock-model',
            temperature: 0.7,
            systemPrompt: 'Mock prompt',
          }
        };
      });

      const result = await translator.translate(mockRequest, { 
        maxRetries: 2, 
        initialDelay: 10 // Very short delay for testing
      });

      expect(result.translatedTitle).toBe('Retry Success');
      expect(mockProvider.translate).toHaveBeenCalledTimes(2);
    }, 10000); // Increase timeout for retry logic

    it('respects maxRetries limit', async () => {
      const error = new Error('Persistent error');
      (error as any).status = 500;
      mockProvider.mockResult = error;

      await expect(translator.translate(mockRequest, { 
        maxRetries: 2, 
        initialDelay: 10 
      })).rejects.toThrow('Persistent error');

      expect(mockProvider.translateCalls).toHaveLength(2);
    });

    it('handles abort signals', async () => {
      const abortController = new AbortController();
      const request = { ...mockRequest, abortSignal: abortController.signal };

      // Abort immediately
      abortController.abort();

      await expect(translator.translate(request)).rejects.toThrow('Aborted');
    });

    it('uses settings-based retry configuration', async () => {
      const settingsWithRetry = {
        ...mockSettings,
        retryMax: 5,
        retryInitialDelayMs: 50
      };
      const request = { ...mockRequest, settings: settingsWithRetry };

      const error = new Error('Test error');
      mockProvider.mockResult = error;

      await expect(translator.translate(request)).rejects.toThrow('Test error');
      expect(mockProvider.translateCalls).toHaveLength(5);
    });
  });

  describe('error handling', () => {
    it('propagates non-retryable errors immediately', async () => {
      const fatalError = new Error('Fatal error');
      mockProvider.mockResult = fatalError;

      await expect(translator.translate(mockRequest, { maxRetries: 3 })).rejects.toThrow('Fatal error');
      expect(mockProvider.translateCalls).toHaveLength(3); // Should still retry max times
    });

    it('handles abort errors during translation', async () => {
      mockProvider.translate = vi.fn().mockImplementation(async (request) => {
        if (request.abortSignal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        throw new Error('Should not reach here');
      });

      const abortController = new AbortController();
      const request = { ...mockRequest, abortSignal: abortController.signal };
      abortController.abort();

      await expect(translator.translate(request)).rejects.toThrow('Translation was aborted by user');
    });
  });

  describe('result processing', () => {
    it('preserves all result fields', async () => {
      const complexResult: TranslationResult = {
        translatedTitle: 'Complex Title',
        translation: 'Complex translation',
        illustrations: [{ description: 'Test illustration', placement: 'top' }],
        amendments: [{ issue: 'Test issue', currentTranslation: 'Current', suggestedImprovement: 'Improved', reasoning: 'Better' }],
        costUsd: 0.05,
        tokensUsed: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
        model: 'advanced-model',
        provider: 'Mock',
        translationSettings: {
          provider: 'Mock',
          model: 'advanced-model',
          temperature: 0.8,
          systemPrompt: 'Advanced prompt',
          promptId: 'test-id',
          promptName: 'Test Prompt'
        }
      };

      mockProvider.mockResult = complexResult;

      const result = await translator.translate(mockRequest);

      expect(result.translatedTitle).toBe('Complex Title');
      expect(result.illustrations).toHaveLength(1);
      expect(result.amendments).toHaveLength(1);
      expect(result.costUsd).toBe(0.05);
      expect(result.tokensUsed.totalTokens).toBe(300);
      expect(result.translationSettings?.promptId).toBe('test-id');
    });

    it('handles missing optional fields gracefully', async () => {
      const minimalResult: TranslationResult = {
        translatedTitle: 'Minimal Title',
        translation: 'Minimal translation',
        illustrations: [],
        amendments: [],
        model: 'mock-model',
        provider: 'Mock',
        translationSettings: {
          provider: 'Mock',
          model: 'mock-model',
          temperature: 0.7,
          systemPrompt: 'Mock prompt',
        }
      };

      mockProvider.mockResult = minimalResult;

      const result = await translator.translate(mockRequest);

      expect(result.translatedTitle).toBe('Minimal Title');
      expect(result.illustrations).toEqual([]);
      expect(result.amendments).toEqual([]);
      expect(result.costUsd).toBeUndefined();
      expect(result.tokensUsed).toBeUndefined();
    });
  });
});