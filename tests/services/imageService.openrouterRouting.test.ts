import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { recordMetricMock, modelProfileMock } = vi.hoisted(() => ({
  recordMetricMock: vi.fn(),
  modelProfileMock: vi.fn(),
}));

vi.mock('../../services/apiMetricsService', () => ({
  apiMetricsService: { recordMetric: recordMetricMock },
}));

vi.mock('../../services/openrouterImageModelAdapter', () => ({
  getVerifiedOpenRouterImageModel: (...args: unknown[]) => modelProfileMock(...args),
  buildOpenRouterImageRequestConfig: vi.fn(() => undefined),
}));

vi.mock('../../utils/debug', () => ({
  debugPipelineEnabled: () => false,
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}));

import { generateImage } from '../../services/imageService';
import { createMockAppSettings } from '../utils/test-data';

describe('imageService OpenRouter routing', () => {
  beforeEach(() => {
    recordMetricMock.mockReset().mockResolvedValue(undefined);
    modelProfileMock.mockReset().mockResolvedValue({
      id: 'black-forest-labs/flux.1-schnell',
      name: 'Flux Schnell',
      inputModalities: ['text'],
      outputModalities: ['image'],
      requestModalities: ['image'],
      priceEstimate: 0.01,
      pricingLabel: '$0.01/image',
      sortKey: 0.01,
      supportsImageConfig: false,
      supportsExtendedAspectRatios: false,
      supportsHalfKImageSize: false,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        choices: [{ message: { images: [{ image_url: { url: 'data:image/png;base64,QUFB' } }] } }],
        usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
      })),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the image endpoint and not the independent text endpoint', async () => {
    const settings = createMockAppSettings({
      imageModel: 'openrouter/black-forest-labs/flux.1-schnell',
      apiKeyOpenRouter: 'test-key',
      openRouterTextEndpoint: 'deepinfra',
      openRouterImageEndpoint: 'venice',
    });

    const result = await generateImage('A tower under lightning.', settings);

    const request = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(String((request[1] as RequestInit).body));
    expect(body.provider).toEqual({
      only: ['venice'],
      allow_fallbacks: false,
      data_collection: 'deny',
      zdr: true,
    });
    expect(body.provider.only).not.toContain('deepinfra');
    expect(result.imageData).toBe('data:image/png;base64,QUFB');
  });
});
