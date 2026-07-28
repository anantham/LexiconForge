/**
 * OpenRouter models-cache TTL (integrity item 4).
 *
 * getOpenRouterImagePrice's comment claimed a ">24h stale" refresh that did not exist — the
 * code only fetched when the cache was EMPTY, so a populated cache served year-old prices
 * forever. Honest implementation: empty → blocking fetch; stale (>24h by fetchedAt) → serve the
 * stale price NOW and trigger ONE non-blocking background refresh.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const settingsStore = vi.hoisted(() => ({ map: new Map<string, any>() }));

vi.mock('../../services/db/operations', () => ({
  SettingsOps: {
    set: vi.fn(async (k: string, v: any) => { settingsStore.map.set(k, v); }),
    getKey: vi.fn(async (k: string) => settingsStore.map.get(k) ?? null),
  },
}));
vi.mock('../../utils/debug', () => ({ debugLog: vi.fn(), debugWarn: vi.fn() }));

import {
  getOpenRouterImagePrice,
  isModelsCacheStale,
  MODELS_CACHE_TTL_MS,
} from '../../services/openrouterService';

const MODELS_KEY = 'openrouter-models';
const MODEL_ID = 'bytedance-seed/seedream-4.5';

const modelRec = (imagePrice: string) => ({
  id: MODEL_ID,
  name: 'Seedream 4.5',
  architecture: { output_modalities: ['image'] },
  pricing: { image: imagePrice },
});

const hoursAgoIso = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

const fetchMock = vi.fn();

describe('getOpenRouterImagePrice — models-cache TTL', () => {
  beforeEach(() => {
    settingsStore.map.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('serves a STALE (>24h) cached price immediately and refreshes in the background', async () => {
    // RED pre-fix: a populated-but-stale cache triggered NO fetch at all — the claimed TTL
    // did not exist.
    settingsStore.map.set(MODELS_KEY, { data: [modelRec('0.05')], fetchedAt: hoursAgoIso(25) });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [modelRec('0.07')] }),
    });

    const price = await getOpenRouterImagePrice(`openrouter/${MODEL_ID}`);

    // Stale price served without blocking on the network…
    expect(price).toBe(0.05);
    // …and the background refresh fired.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Once the refresh lands, the next read sees the fresh price with no further fetch.
    await vi.waitFor(() => {
      expect(isModelsCacheStale(settingsStore.map.get(MODELS_KEY))).toBe(false);
    });
    const refreshed = await getOpenRouterImagePrice(`openrouter/${MODEL_ID}`);
    expect(refreshed).toBe(0.07);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT refresh when the cache is fresh (<24h)', async () => {
    settingsStore.map.set(MODELS_KEY, { data: [modelRec('0.05')], fetchedAt: hoursAgoIso(1) });

    const price = await getOpenRouterImagePrice(`openrouter/${MODEL_ID}`);

    expect(price).toBe(0.05);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still fetches synchronously when the cache is EMPTY (nothing to serve)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [modelRec('0.07')] }),
    });

    const price = await getOpenRouterImagePrice(`openrouter/${MODEL_ID}`);

    expect(price).toBe(0.07);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('isModelsCacheStale', () => {
  it('treats missing/garbled caches as stale and applies the 24h boundary', () => {
    expect(isModelsCacheStale(null)).toBe(true);
    expect(isModelsCacheStale(undefined)).toBe(true);
    expect(isModelsCacheStale({ data: [], fetchedAt: '' } as any)).toBe(true);
    expect(isModelsCacheStale({ data: [], fetchedAt: 'not-a-date' } as any)).toBe(true);
    expect(isModelsCacheStale({ data: [], fetchedAt: hoursAgoIso(1) } as any)).toBe(false);
    expect(isModelsCacheStale({ data: [], fetchedAt: hoursAgoIso(25) } as any)).toBe(true);
    // The boundary constant itself: just inside the TTL is fresh.
    expect(MODELS_CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});
