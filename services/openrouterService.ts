import { SettingsOps } from './db/operations';
import { debugLog } from '../utils/debug';

type ORPricing = {
  prompt?: string | number | null;
  completion?: string | number | null;
  image?: string | number | null;
  request?: string | number | null;
  [k: string]: any;
};

export interface OpenRouterModelRec {
  id: string; // slug
  name: string;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
    [k: string]: any;
  };
  pricing?: ORPricing | null;
}

export interface OpenRouterModelsCache {
  data: OpenRouterModelRec[];
  fetchedAt: string; // ISO
}

export interface OpenRouterKeyUsageCache {
  totalCredits: number | null; // USD purchased
  totalUsage: number | null; // USD spent
  remainingCredits: number | null; // USD remaining
  /**
   * Legacy fields kept for backwards-compatibility with cached data reads.
   * They mirror the new properties so older consumers keep working.
   */
  usage?: number | null;
  limit?: number | null;
  remaining?: number | null;
  fetchedAt: string; // ISO
}

const MODELS_KEY = 'openrouter-models';
const KEY_USAGE_KEY = 'openrouter-key-usage';
const LAST_USED_KEY = 'openrouter-model-last-used';

/**
 * Models-cache TTL. `fetchedAt` is stored with the cache; reads that find it older than this
 * serve the stale data immediately (pricing drift for one read is tolerable; blocking image
 * generation on a models fetch is not) and trigger ONE non-blocking background refresh.
 */
export const MODELS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const isModelsCacheStale = (cache: OpenRouterModelsCache | null | undefined): boolean => {
  if (!cache?.fetchedAt) return true;
  const ageMs = Date.now() - new Date(cache.fetchedAt).getTime();
  return !Number.isFinite(ageMs) || ageMs > MODELS_CACHE_TTL_MS;
};

let modelsRefreshInFlight: Promise<unknown> | null = null;

/** Fire-and-forget models refresh, deduped so concurrent stale reads trigger a single fetch. */
const triggerBackgroundModelsRefresh = (): void => {
  if (modelsRefreshInFlight) return;
  modelsRefreshInFlight = openrouterService
    .fetchModels()
    .catch((err) =>
      debugLog('api', 'summary', '[OpenRouter] Background models refresh failed (stale cache still served):', err)
    )
    .finally(() => {
      modelsRefreshInFlight = null;
    });
};

const nowIso = () => new Date().toISOString();

// Removed legacy maybeDebug - now using debugLog with 'api' pipeline

const toCachePayload = (
  totalCredits: number | null,
  totalUsage: number | null,
  fetchedAt: string,
): OpenRouterKeyUsageCache => {
  const remainingCredits =
    typeof totalCredits === 'number' && typeof totalUsage === 'number'
      ? totalCredits - totalUsage
      : null;

  return {
    totalCredits,
    totalUsage,
    remainingCredits,
    // mirror values for legacy readers
    usage: totalUsage,
    limit: totalCredits,
    remaining: remainingCredits,
    fetchedAt,
  };
};

export const openrouterService = {
  // Network fetchers
  async fetchModels(apiKey?: string): Promise<OpenRouterModelsCache> {
    debugLog('api', 'summary', '[OpenRouter] fetchModels called, apiKey present:', !!apiKey);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const res = await fetch('https://openrouter.ai/api/v1/models', { headers });
    debugLog('api', 'summary', '[OpenRouter] fetchModels response status:', res.status);
    if (!res.ok) throw new Error(`OpenRouter models fetch failed: ${res.status}`);
    const json = await res.json();
    const data = (json?.data || []) as any[];
    debugLog('api', 'summary', '[OpenRouter] fetchModels raw data count:', data.length);
    const mapped: OpenRouterModelRec[] = data.map((m: any) => ({
      id: m.id || m.slug || m.name,
      name: m.name || m.id,
      architecture: m.architecture || {},
      pricing: m.pricing || null,
    }));
    debugLog('api', 'summary', '[OpenRouter] fetchModels mapped count:', mapped.length);
    const cache = { data: mapped, fetchedAt: nowIso() };
    await SettingsOps.set(MODELS_KEY, cache);
    return cache;
  },

  async fetchKeyUsage(apiKey: string): Promise<OpenRouterKeyUsageCache> {
    debugLog('api', 'summary', '[OpenRouter] Fetching credit balance…');
    const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };

    const fetchCredits = async () => {
      const res = await fetch('https://openrouter.ai/api/v1/credits', { headers });
      if (!res.ok) throw new Error(`OpenRouter credits fetch failed: ${res.status}`);
      const json = await res.json();
      const preview = {
        hasData: json?.data != null,
        totalCredits:
          typeof json?.data?.total_credits === 'number'
            ? Number(json.data.total_credits.toFixed(4))
            : json?.data?.total_credits,
        totalUsage:
          typeof json?.data?.total_usage === 'number'
            ? Number(json.data.total_usage.toFixed(4))
            : json?.data?.total_usage,
        rawKeys: Object.keys(json || {}),
      };
      debugLog('api', 'full', '[OpenRouter] Credits response (summary):', preview);

      const totalCredits =
        typeof json?.data?.total_credits === 'number' ? json.data.total_credits : null;
      const totalUsage =
        typeof json?.data?.total_usage === 'number' ? json.data.total_usage : null;
      return toCachePayload(totalCredits, totalUsage, nowIso());
    };

    const fetchLegacyUsage = async () => {
      const res = await fetch('https://openrouter.ai/api/v1/key', { headers });
      if (!res.ok) throw new Error(`OpenRouter key usage fetch failed: ${res.status}`);
      const json = await res.json();
      const preview = {
        hasUsage: json?.usage != null,
        usage:
          typeof json?.usage === 'number' ? Number(json.usage.toFixed(4)) : json?.usage,
        hasLimit: json?.limit != null,
        limit:
          typeof json?.limit === 'number' ? Number(json.limit.toFixed(4)) : json?.limit,
        rawKeys: Object.keys(json || {}),
      };
      debugLog('api', 'full', '[OpenRouter] Legacy key usage response (summary):', preview);
      const usage = typeof json?.usage === 'number' ? json.usage : null;
      const limit = typeof json?.limit === 'number' ? json.limit : null;
      return toCachePayload(limit, usage, nowIso());
    };

    let cache: OpenRouterKeyUsageCache;
    try {
      cache = await fetchCredits();
    } catch (err) {
      debugLog('api', 'summary', '[OpenRouter] Credits endpoint failed, falling back to /key', err);
      cache = await fetchLegacyUsage();
    }

    await SettingsOps.set(KEY_USAGE_KEY, cache);
    debugLog('api', 'full', '[OpenRouter] Credit data cached:', cache);
    return cache;
  },

  // Cache accessors
  async getCachedModels(): Promise<OpenRouterModelsCache | null> {
    return SettingsOps.getKey<OpenRouterModelsCache>(MODELS_KEY);
  },
  async getCachedKeyUsage(): Promise<OpenRouterKeyUsageCache | null> {
    return SettingsOps.getKey<OpenRouterKeyUsageCache>(KEY_USAGE_KEY);
  },

  // Last used helpers
  async setLastUsed(modelId: string): Promise<void> {
    try {
      const map = (await SettingsOps.getKey<Record<string, string>>(LAST_USED_KEY)) || {};
      map[modelId] = nowIso();
      await SettingsOps.set(LAST_USED_KEY, map);
    } catch {}
  },
  async getLastUsedMap(): Promise<Record<string, string>> {
    return (await SettingsOps.getKey<Record<string, string>>(LAST_USED_KEY)) || {};
  },

  async getPricingForModel(modelId: string): Promise<ORPricing | null> {
    const cache = await this.getCachedModels();
    if (!cache || !cache.data) return null;
    const model = cache.data.find(m => m.id === modelId);
    return model?.pricing || null;
  },
};

/**
 * Get dynamic image pricing for a model from OpenRouter cache.
 * Will auto-fetch the models catalog if cache is empty.
 */
export const getOpenRouterImagePrice = async (modelId: string): Promise<number | null> => {
  // Strip 'openrouter/' prefix if present
  const cleanId = modelId.startsWith('openrouter/') ? modelId.slice(11) : modelId;

  let cache = await openrouterService.getCachedModels();

  // Empty cache: fetch synchronously — there is nothing to serve. Stale cache (fetchedAt older
  // than MODELS_CACHE_TTL_MS): serve the stale price NOW and refresh in the background so the
  // next read sees current pricing.
  if (!cache?.data || cache.data.length === 0) {
    debugLog('api', 'summary', '[OpenRouter] Models cache empty, fetching...');
    try {
      cache = await openrouterService.fetchModels();
    } catch (err) {
      debugLog('api', 'summary', '[OpenRouter] Failed to fetch models for pricing:', err);
    }
  } else if (isModelsCacheStale(cache)) {
    debugLog('api', 'summary', '[OpenRouter] Models cache older than 24h — serving stale price, refreshing in background');
    triggerBackgroundModelsRefresh();
  }

  debugLog('api', 'full', '[OpenRouter] getOpenRouterImagePrice lookup:', {
    modelId,
    cleanId,
    cacheExists: !!cache,
    cacheSize: cache?.data?.length ?? 0,
  });

  if (!cache?.data) return null;

  // Find the model in cache
  const model = cache.data.find(m => m.id === cleanId);
  const pricing = model?.pricing;

  debugLog('api', 'full', '[OpenRouter] Pricing for model:', {
    cleanId,
    modelFound: !!model,
    pricing,
    hasImagePrice: !!pricing?.image,
  });

  if (!pricing?.image) return null;

  const price = typeof pricing.image === 'string' ? parseFloat(pricing.image) : pricing.image;
  debugLog('api', 'summary', `[OpenRouter] Image price for ${cleanId}: $${price}`);
  return isFinite(price) && price >= 0 ? price : null;
};

