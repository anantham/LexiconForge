import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppSettings } from '../../types';
import {
  buildOpenRouterRouting,
  fetchOpenRouterEndpoints,
  mergeOpenRouterRouting,
  resetOpenRouterEndpointCacheForTests,
} from '../../services/openrouterRouting';

const settings = {
  openRouterTextEndpoint: 'DeepInfra',
  openRouterImageEndpoint: 'venice',
} as AppSettings;

afterEach(() => {
  resetOpenRouterEndpointCacheForTests();
  vi.restoreAllMocks();
});

describe('OpenRouter routing', () => {
  it('keeps text and image endpoint choices independent', () => {
    expect(buildOpenRouterRouting(settings, 'text')).toEqual({
      data_collection: 'deny',
      zdr: true,
      only: ['deepinfra'],
      allow_fallbacks: false,
    });
    expect(buildOpenRouterRouting(settings, 'image')).toEqual({
      data_collection: 'deny',
      zdr: true,
      only: ['venice'],
      allow_fallbacks: false,
    });
  });

  it('uses OpenRouter automatic routing without exact-host pinning', () => {
    expect(buildOpenRouterRouting({ ...settings, openRouterTextEndpoint: 'auto' }, 'text')).toEqual({
      data_collection: 'deny',
      zdr: true,
    });
  });

  it('allows one image request to override the saved endpoint without mutating settings', () => {
    expect(buildOpenRouterRouting(settings, 'image', { endpoint: 'Groq' })).toMatchObject({
      only: ['groq'],
      allow_fallbacks: false,
    });
    expect(settings.openRouterImageEndpoint).toBe('venice');
  });

  it('does not allow request preferences to weaken an exact route or data controls', () => {
    expect(mergeOpenRouterRouting(settings, 'text', {
      only: ['venice'],
      allow_fallbacks: true,
      data_collection: 'allow',
      zdr: false,
      require_parameters: true,
    })).toEqual({
      data_collection: 'deny',
      zdr: true,
      only: ['deepinfra'],
      allow_fallbacks: false,
      require_parameters: true,
    });
  });

  it('preserves caller routing preferences when the saved route is Auto', () => {
    expect(mergeOpenRouterRouting(
      { ...settings, openRouterTextEndpoint: 'auto' },
      'text',
      { only: ['venice'], allow_fallbacks: true, require_parameters: true },
    )).toEqual({
      only: ['venice'],
      allow_fallbacks: true,
      require_parameters: true,
      data_collection: 'deny',
      zdr: true,
    });
  });
});

describe('OpenRouter endpoint discovery', () => {
  it('derives provider-routing slugs from endpoint tags and deduplicates quantizations', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        endpoints: [
          { provider_name: 'DeepInfra', tag: 'deepinfra/fp4', status: 0 },
          { provider_name: 'DeepInfra', tag: 'deepinfra/fp8', status: 0 },
          { provider_name: 'Venice', tag: 'venice/fp8', status: 0 },
          { provider_name: 'Missing tag' },
        ],
      },
    }), { status: 200 }));

    await expect(fetchOpenRouterEndpoints('openrouter/z-ai/glm-5.2', { fetchImpl })).resolves.toEqual([
      { id: 'deepinfra', label: 'DeepInfra', tags: ['deepinfra/fp4', 'deepinfra/fp8'] },
      { id: 'venice', label: 'Venice', tags: ['venice/fp8'] },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/models/z-ai/glm-5.2/endpoints',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('fails descriptively instead of returning a false empty catalogue', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(fetchOpenRouterEndpoints('z-ai/glm-5.2', { fetchImpl }))
      .rejects.toThrow('HTTP 503');
  });
});
