import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildOpenRouterImageRequestConfig,
  fetchVerifiedOpenRouterImageModels,
} from '../../services/openrouterImageModelAdapter';

const mockFetch = vi.fn();

describe('openrouterImageModelAdapter', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches verified image models from the filtered OpenRouter catalog and derives request modes', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'sourceful/riverflow-v2-fast',
              name: 'Sourceful: Riverflow V2 Fast',
              architecture: {
                input_modalities: ['text', 'image'],
                output_modalities: ['image'],
              },
              pricing: {
                prompt: '0',
                completion: '0',
              },
            },
            {
              id: 'google/gemini-3.1-flash-image-preview',
              name: 'Google: Gemini 3.1 Flash Image Preview',
              architecture: {
                input_modalities: ['image', 'text'],
                output_modalities: ['image', 'text'],
              },
              pricing: {
                prompt: '0.0000005',
                completion: '0.000003',
              },
            },
            {
              id: 'openrouter/auto',
              name: 'OpenRouter Auto',
              architecture: {
                input_modalities: ['text', 'image'],
                output_modalities: ['image', 'text'],
              },
              pricing: {
                prompt: '0',
                completion: '0',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const cache = await fetchVerifiedOpenRouterImageModels();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/models?output_modalities=image',
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(cache.data.map((entry) => entry.id)).toEqual([
      'sourceful/riverflow-v2-fast',
      'google/gemini-3.1-flash-image-preview',
    ]);

    const [sourceful, google] = cache.data;
    expect(sourceful.requestModalities).toEqual(['image']);
    expect(sourceful.pricingLabel).toBe('from $0.0200/image');

    expect(google.requestModalities).toEqual(['image', 'text']);
    expect(google.pricingLabel).toBe('USD 0.50/3.00 per 1M');
  });

  it('builds OpenRouter image_config only for verified models that support it', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'google/gemini-3.1-flash-image-preview',
              name: 'Google: Gemini 3.1 Flash Image Preview',
              architecture: {
                input_modalities: ['image', 'text'],
                output_modalities: ['image', 'text'],
              },
              pricing: {
                prompt: '0.0000005',
                completion: '0.000003',
              },
            },
            {
              id: 'sourceful/riverflow-v2-fast',
              name: 'Sourceful: Riverflow V2 Fast',
              architecture: {
                input_modalities: ['text', 'image'],
                output_modalities: ['image'],
              },
              pricing: {
                prompt: '0',
                completion: '0',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const cache = await fetchVerifiedOpenRouterImageModels();
    const google = cache.data.find((entry) => entry.id === 'google/gemini-3.1-flash-image-preview');
    const sourceful = cache.data.find((entry) => entry.id === 'sourceful/riverflow-v2-fast');

    expect(google).toBeTruthy();
    expect(sourceful).toBeTruthy();

    expect(buildOpenRouterImageRequestConfig(google!, 512, 2048)).toEqual({
      aspect_ratio: '1:4',
      image_size: '4K',
    });
    expect(buildOpenRouterImageRequestConfig(sourceful!, 1024, 1024)).toBeUndefined();
  });
});
