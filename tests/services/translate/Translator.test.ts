import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Translator, type TranslationProvider, type TranslationRequest } from '../../../services/translate/Translator';
import type { TranslationResult, AppSettings } from '../../../types';
import { createMockAppSettings, createMockTranslationResult, createMockUsageMetrics } from '../../utils/test-data';

const baseUsageMetrics = createMockUsageMetrics({
  promptTokens: 100,
  completionTokens: 50,
  totalTokens: 150,
  estimatedCost: 0.01,
  requestTime: 1.2,
  provider: 'Claude',
  model: 'claude-3-opus',
});

const baseTranslationResult = (): TranslationResult =>
  createMockTranslationResult({
    translatedTitle: 'Mock Title',
    translation: 'Mock translation content',
    // Self-consistent by construction: this translation carries no markers, so it declares no
    // footnotes or illustrations either. Translator.sanitizeResult reconciles markers against
    // metadata, so a fixture whose metadata cites markers absent from the text would (correctly)
    // have them appended, which would obscure what these tests actually assert.
    footnotes: [],
    suggestedIllustrations: [],
    usageMetrics: { ...baseUsageMetrics },
    model: 'claude-3-opus',
    provider: 'Claude',
    translationSettings: {
      provider: 'Claude',
      model: 'claude-3-opus',
      temperature: 0.7,
      systemPrompt: 'Mock prompt',
    },
  });

// Mock provider for testing
class MockTranslationProvider implements TranslationProvider {
  public translateCalls: TranslationRequest[] = [];
  public mockResult: TranslationResult | Error = baseTranslationResult();

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    this.translateCalls.push(request);
    
    if (this.mockResult instanceof Error) {
      throw this.mockResult;
    }
    
    return { ...this.mockResult };
  }

  reset() {
    this.translateCalls = [];
    this.mockResult = baseTranslationResult();
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
    
    translator.registerProvider('Claude', mockProvider);

    mockSettings = createMockAppSettings({
      provider: 'Claude',
      model: 'claude-3-opus',
      temperature: 0.7,
      systemPrompt: 'Test system prompt',
      apiKeyClaude: 'mock-key',
      imageModel: 'mock-image-model',
      retryMax: 3,
      retryInitialDelayMs: 1000,
      showDiffHeatmap: false,
    });

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
      expect(result.provider).toBe('Claude');
      expect(mockProvider.translateCalls).toHaveLength(1);
      expect(mockProvider.translateCalls[0]).toMatchObject(mockRequest);
    });

    it('throws error for unregistered provider', async () => {
      const request: TranslationRequest = {
        ...mockRequest,
        settings: createMockAppSettings({
          provider: 'OpenAI',
          model: 'gpt-4o-mini',
          systemPrompt: mockSettings.systemPrompt,
        }),
      };

      await expect(translator.translate(request)).rejects.toThrow('Provider not registered: OpenAI');
    });

    it('sanitizes translation results', async () => {
      mockProvider.mockResult = {
        ...mockProvider.mockResult as TranslationResult,
        translation: 'Raw translation content'
      };

      const result = await translator.translate(mockRequest);

      expect(result.translation).toBe('Raw translation content [sanitized]');
    });

    it('trims a whitespace-only title', async () => {
      mockProvider.mockResult = {
        ...mockProvider.mockResult as TranslationResult,
        translatedTitle: '  ',
        translation: 'Real content'
      };

      const result = await translator.translate(mockRequest);

      expect(result.translatedTitle).toBe('');
      expect(result.translation).toBe('Real content [sanitized]');
    });

    it('rejects an empty translation instead of persisting a blank chapter', async () => {
      // This previously succeeded, and the empty string was stored as a completed translation:
      // the reader got a blank chapter, and because the app then believed the chapter WAS
      // translated, nothing ever retried it. GeminiAdapter reaches this by coercing a missing
      // `translation` field to '' and returning success.
      mockProvider.mockResult = {
        ...mockProvider.mockResult as TranslationResult,
        translatedTitle: 'Title',
        translation: '   '
      };

      await expect(translator.translate(mockRequest)).rejects.toThrow(/empty translation/i);
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
        mockProvider.mockResult = {
          ...baseTranslationResult(),
          translatedTitle: 'Retry Success',
          translation: 'Succeeded after retry',
        };
        return mockProvider.mockResult;
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

      await expect(translator.translate(request)).rejects.toThrow('Translation was aborted by user');
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
        ...baseTranslationResult(),
        translatedTitle: 'Complex Title',
        translation: 'Complex translation',
        suggestedIllustrations: [{ placementMarker: 'marker', imagePrompt: 'prompt' }],
        usageMetrics: {
          ...baseUsageMetrics,
          totalTokens: 300,
          promptTokens: 200,
          completionTokens: 100,
        },
        illustrations: [{ placement: 'top', description: 'Test illustration' }],
        amendments: [{ issue: 'Test issue', currentTranslation: 'Current', suggestedImprovement: 'Improved', reasoning: 'Better' }],
        costUsd: 0.05,
        tokensUsed: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
        model: 'advanced-model',
        provider: 'Claude',
        translationSettings: {
          provider: 'Claude',
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
      expect(result.tokensUsed).toBeDefined();
      expect(result.tokensUsed!.totalTokens).toBe(300);
      expect(result.translationSettings?.promptId).toBe('test-id');
    });

    it('handles missing optional fields gracefully', async () => {
      const minimalResult: TranslationResult = {
        ...baseTranslationResult(),
        translatedTitle: 'Minimal Title',
        translation: 'Minimal translation',
        suggestedIllustrations: [],
        illustrations: [],
        amendments: [],
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

  // Marker reconciliation used to live inside each provider: Claude had its own (buggy) copy,
  // while OpenAI and Gemini did none at all. It now happens once, here, for every provider.
  describe('marker reconciliation (all providers)', () => {
    it('leaves a well-formed result untouched', async () => {
      mockProvider.mockResult = {
        ...baseTranslationResult(),
        translation: 'Scene one. [ILLUSTRATION-1] A claim.[1]',
        suggestedIllustrations: [{ placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'a scene' }],
        footnotes: [{ marker: '[1]', text: 'a note' }],
      };

      const result = await translator.translate(mockRequest);

      expect(result.translation).toBe('Scene one. [ILLUSTRATION-1] A claim.[1] [sanitized]');
      expect(result.suggestedIllustrations).toHaveLength(1);
      expect(result.footnotes).toHaveLength(1);
    });

    it('appends markers the model declared in metadata but omitted from the text', async () => {
      mockProvider.mockResult = {
        ...baseTranslationResult(),
        translation: 'A scene with no markers.',
        suggestedIllustrations: [{ placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'a scene' }],
        footnotes: [],
      };

      const result = await translator.translate(mockRequest);

      // Recovered rather than dropped: an illustration whose marker is absent from the text
      // would otherwise never render.
      expect(result.translation).toContain('[ILLUSTRATION-1]');
    });

    it('does NOT duplicate a marker that is already in the text', async () => {
      // Regression guard: claudeService's forked validator used an over-escaped regex, so it
      // never matched a marker, concluded the text had none, and appended every marker the model
      // had already placed inline — duplicating all of them on every Claude translation.
      mockProvider.mockResult = {
        ...baseTranslationResult(),
        translation: 'Scene one. [ILLUSTRATION-1] Scene two. [ILLUSTRATION-2]',
        suggestedIllustrations: [
          { placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'one' },
          { placementMarker: '[ILLUSTRATION-2]', imagePrompt: 'two' },
        ],
        footnotes: [],
      };

      const result = await translator.translate(mockRequest);

      expect(result.translation.match(/\[ILLUSTRATION-1\]/g)).toHaveLength(1);
      expect(result.translation.match(/\[ILLUSTRATION-2\]/g)).toHaveLength(1);
    });

    it('rejects a text marker that has no matching illustration prompt', async () => {
      // A dangling marker renders to the reader as literal "[ILLUSTRATION-2]" with no image.
      // Failing sends it back to the model instead of shipping it.
      mockProvider.mockResult = {
        ...baseTranslationResult(),
        translation: 'Scene one. [ILLUSTRATION-1] Scene two. [ILLUSTRATION-2]',
        suggestedIllustrations: [{ placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'one' }],
        footnotes: [],
      };

      await expect(translator.translate(mockRequest)).rejects.toThrow(/missing illustration prompts/i);
    });

    it('honors footnoteStrictMode: fail — previously a no-op for every live provider', async () => {
      mockProvider.mockResult = {
        ...baseTranslationResult(),
        translation: 'A claim with no footnote marker.',
        suggestedIllustrations: [],
        footnotes: [{ marker: '[1]', text: 'an orphaned note' }],
      };

      const strictRequest: TranslationRequest = {
        ...mockRequest,
        settings: { ...mockRequest.settings, footnoteStrictMode: 'fail' },
      };

      await expect(translator.translate(strictRequest)).rejects.toThrow(/Extra footnotes/i);
    });
  });

  describe('per-attempt timeout', () => {
    it('ABORTS the timed-out call instead of leaving it running and billing', async () => {
      // The timeout used to be a bare Promise.race, which only abandons the loser. The original
      // request kept running — and kept billing — while the retry fired a second paid call for
      // the same chapter. The provider must see its signal aborted.
      let seenSignal: AbortSignal | undefined;

      mockProvider.translate = vi.fn((request: TranslationRequest) => {
        seenSignal = request.abortSignal;
        return new Promise<TranslationResult>(() => {}); // never settles, like a stalled connection
      });

      await expect(
        translator.translate(mockRequest, { maxRetries: 1, timeoutMs: 20 }),
      ).rejects.toThrow(/timed out/i);

      expect(seenSignal).toBeDefined();
      expect(seenSignal!.aborted).toBe(true);
    });

    it("rejects on the caller's abort even if the provider ignores its signal", async () => {
      // The abort handler used to just clear the timeout timer — disarming the only thing that
      // could still settle the race. A provider that does not honour its signal (claudeService
      // never reads one) therefore left the user's Cancel hanging forever: the request neither
      // finished nor timed out. This mock is deliberately non-cooperative, like Claude's.
      let seenSignal: AbortSignal | undefined;
      mockProvider.translate = vi.fn((request: TranslationRequest) => {
        seenSignal = request.abortSignal;
        return new Promise<TranslationResult>(() => {}); // never settles, ignores the signal
      });

      const controller = new AbortController();
      const pending = translator.translate(
        { ...mockRequest, abortSignal: controller.signal },
        { maxRetries: 1, timeoutMs: 5_000 },
      );

      await Promise.resolve(); // let translate() reach the provider call
      controller.abort();

      await expect(pending).rejects.toThrow(/aborted/i);
      expect(seenSignal!.aborted).toBe(true);
    });
  });

  describe('chunked translation', () => {
    it('renumbers markers in the merged TEXT, not just the metadata', async () => {
      // Each chunk is translated independently, so both chunks come back numbered from 1.
      // The merge renumbers metadata onto a global sequence; it used to leave the text alone,
      // so the text held two [ILLUSTRATION-1] while the metadata claimed -1 and -2 — and the
      // second image, keyed to a marker absent from the text, could never render.
      let call = 0;
      mockProvider.translate = vi.fn(async () => {
        call += 1;
        if (call === 1) throw new Error('length_cap: model hit token limit');
        return {
          ...baseTranslationResult(),
          translation: `Chunk ${call - 1}. [ILLUSTRATION-1] A claim.[1]`,
          suggestedIllustrations: [{ placementMarker: '[ILLUSTRATION-1]', imagePrompt: `scene ${call - 1}` }],
          footnotes: [{ marker: '[1]', text: `note ${call - 1}` }],
        };
      });

      const longRequest: TranslationRequest = {
        ...mockRequest,
        content: ['Para one.', 'Para two.', 'Para three.', 'Para four.'].join('\n\n'),
      };

      const result = await translator.translate(longRequest, { maxRetries: 1 });

      expect(result.suggestedIllustrations.map(i => i.placementMarker))
        .toEqual(['[ILLUSTRATION-1]', '[ILLUSTRATION-2]']);
      expect(result.footnotes.map(f => f.marker)).toEqual(['[1]', '[2]']);

      // The invariant that was broken: every marker in the metadata appears in the text exactly once.
      for (const marker of ['[ILLUSTRATION-1]', '[ILLUSTRATION-2]', '[1]', '[2]']) {
        const escaped = marker.replace(/[[\]]/g, '\\$&');
        expect(result.translation.match(new RegExp(escaped, 'g')) ?? []).toHaveLength(1);
      }
    });
  });
});
