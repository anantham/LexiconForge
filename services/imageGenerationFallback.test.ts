import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../types';

const { mockGenerateImage } = vi.hoisted(() => ({ mockGenerateImage: vi.fn() }));

vi.mock('./imageService', () => ({
  generateImage: mockGenerateImage,
  imageProviderForModel: (model: string) => model.startsWith('indrasnet/') ? 'Asus / IndrasNet' : 'Gemini',
}));

import { generateImageWithConfiguredFallback, ImageFallbackError } from './imageGenerationFallback';

const settings = {
  imageModel: 'indrasnet/gen_anime',
  imageFallbackModel: 'imagen-3.0-generate-002',
} as AppSettings;

describe('configured image fallback', () => {
  beforeEach(() => mockGenerateImage.mockReset());

  it('uses the explicitly selected cloud model for a retryable local failure and records provenance', async () => {
    const now = vi.spyOn(performance, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(11_000);
    mockGenerateImage
      .mockRejectedValueOnce(Object.assign(new Error('GPU is busy'), { errorType: 'GPU_BUSY', canRetry: true }))
      .mockResolvedValueOnce({
        imageData: 'data:image/png;base64,ok',
        requestTime: 2,
        cost: 0.04,
        execution: { provider: 'Imagen', model: 'imagen-3.0-generate-002' },
      });

    const result = await generateImageWithConfiguredFallback({ prompt: 'castle', settings });

    expect(mockGenerateImage).toHaveBeenCalledTimes(2);
    expect(mockGenerateImage.mock.calls[1][1]).toMatchObject({ imageModel: 'imagen-3.0-generate-002' });
    expect(result.execution?.fallback).toEqual({
      attemptedProvider: 'Asus / IndrasNet',
      attemptedModel: 'indrasnet/gen_anime',
      reasonCode: 'GPU_BUSY',
      reason: 'GPU is busy',
    });
    expect(result.requestTime).toBe(12);
    now.mockRestore();
  });

  it('does not fallback for a manifest or input error', async () => {
    const failure = Object.assign(new Error('manifest missing'), {
      errorType: 'WORKFLOW_MANIFEST_REQUIRED',
      canRetry: false,
    });
    mockGenerateImage.mockRejectedValueOnce(failure);

    await expect(generateImageWithConfiguredFallback({ prompt: 'castle', settings })).rejects.toBe(failure);
    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
  });

  it('does not silently fallback when the setting is disabled', async () => {
    const failure = Object.assign(new Error('offline'), { errorType: 'COMFYUI_OFFLINE', canRetry: true });
    mockGenerateImage.mockRejectedValueOnce(failure);

    await expect(generateImageWithConfiguredFallback({
      prompt: 'castle',
      settings: { ...settings, imageFallbackModel: 'none' },
    })).rejects.toBe(failure);
    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
  });

  it('preserves both provider errors when the configured fallback also fails', async () => {
    const primaryFailure = Object.assign(new Error('GPU lease is busy'), {
      errorType: 'GPU_BUSY',
      canRetry: true,
    });
    const fallbackFailure = Object.assign(new Error('cloud quota exhausted'), {
      errorType: 'RATE_LIMIT',
      canRetry: true,
    });
    mockGenerateImage
      .mockRejectedValueOnce(primaryFailure)
      .mockRejectedValueOnce(fallbackFailure);

    const error = await generateImageWithConfiguredFallback({ prompt: 'castle', settings })
      .catch(cause => cause);

    expect(error).toBeInstanceOf(ImageFallbackError);
    expect(error).toMatchObject({
      errorType: 'IMAGE_FALLBACK_FAILED',
      canRetry: false,
      primaryError: primaryFailure,
      fallbackError: fallbackFailure,
      attemptedModel: 'indrasnet/gen_anime',
      fallbackModel: 'imagen-3.0-generate-002',
    });
    expect(error.message).toContain('[GPU_BUSY]: GPU lease is busy');
    expect(error.message).toContain('[RATE_LIMIT]: cloud quota exhausted');
    expect(mockGenerateImage).toHaveBeenCalledTimes(2);
  });
});
