/**
 * Google-branch hang guard (integrity item 8).
 *
 * The timeout comment claimed the hang class was closed, but the Imagen and Gemini branches had
 * no timeout/signal at all: a stalled SDK call hung the image's isLoading flag forever. Both
 * calls are now raced against a timer (plus an AbortSignal where the SDK accepts one — the
 * signal is NOT what these tests exercise, because a hung SDK that ignores its signal is exactly
 * the case the Promise.race backstop must unwedge).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sdkMocks = vi.hoisted(() => ({
  generateImages: vi.fn(),
  generateContent: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateImages: (...args: any[]) => sdkMocks.generateImages(...args) };
    constructor(_opts: any) {}
  },
}));
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    constructor(_key: any) {}
    getGenerativeModel(_cfg: any) {
      return { generateContent: (...args: any[]) => sdkMocks.generateContent(...args) };
    }
  },
}));
vi.mock('../../services/apiMetricsService', () => ({
  apiMetricsService: { recordMetric: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../services/openrouterImageModelAdapter', () => ({
  getVerifiedOpenRouterImageModel: vi.fn(),
  buildOpenRouterImageRequestConfig: vi.fn(),
}));
vi.mock('../../utils/debug', () => ({
  debugPipelineEnabled: () => false,
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}));

import { generateImage } from '../../services/imageService';

const IMAGE_GENERATION_TIMEOUT_MS = 180_000; // mirrors the service constant

const neverSettles = () => new Promise(() => {});

describe('generateImage — Google branch timeouts (integrity item 8)', () => {
  beforeEach(() => {
    sdkMocks.generateImages.mockReset();
    sdkMocks.generateContent.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Imagen: a hung generateImages call rejects at the timeout instead of hanging forever', async () => {
    // RED pre-fix: this await never settled — the test itself would time out.
    sdkMocks.generateImages.mockReturnValue(neverSettles());

    const promise = generateImage('a scene', { imageModel: 'imagen-3.0-generate-002', apiKeyGemini: 'k' } as any);
    const assertion = expect(promise).rejects.toThrow(/timed out after 180s/);

    await vi.advanceTimersByTimeAsync(IMAGE_GENERATION_TIMEOUT_MS + 1);
    await assertion;
  });

  it('Gemini: a hung generateContent call rejects at the timeout instead of hanging forever', async () => {
    sdkMocks.generateContent.mockReturnValue(neverSettles());

    const promise = generateImage('a scene', { imageModel: 'gemini-2.5-flash-image-preview', apiKeyGemini: 'k' } as any);
    const assertion = expect(promise).rejects.toThrow(/timed out after 180s/);

    await vi.advanceTimersByTimeAsync(IMAGE_GENERATION_TIMEOUT_MS + 1);
    await assertion;
  });

  it('a completed call is NOT disturbed by the guard (timer cleaned up)', async () => {
    sdkMocks.generateImages.mockResolvedValue({
      generatedImages: [{ image: { imageBytes: 'QUFB' } }],
    });

    const result = await generateImage('a scene', { imageModel: 'imagen-3.0-generate-002', apiKeyGemini: 'k' } as any);

    expect(result.imageData).toContain('base64,QUFB');
    // No stray timers left armed by withTimeout.
    expect(vi.getTimerCount()).toBe(0);
  });
});
