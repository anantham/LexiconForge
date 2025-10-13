import { indexedDBService } from './indexeddb';
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
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const res = await fetch('https://openrouter.ai/api/v1/models', { headers });
    if (!res.ok) throw new Error(`OpenRouter models fetch failed: ${res.status}`);
    const json = await res.json();
    const data = (json?.data || []) as any[];
    const mapped: OpenRouterModelRec[] = data.map((m: any) => ({
      id: m.id || m.slug || m.name,
      name: m.name || m.id,
      architecture: m.architecture || {},
      pricing: m.pricing || null,
    }));
    const cache = { data: mapped, fetchedAt: nowIso() };
    await indexedDBService.setSetting(MODELS_KEY, cache);
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

    await indexedDBService.setSetting(KEY_USAGE_KEY, cache);
    debugLog('api', 'full', '[OpenRouter] Credit data cached:', cache);
    return cache;
  },

  // Cache accessors
  async getCachedModels(): Promise<OpenRouterModelsCache | null> {
    return indexedDBService.getSetting<OpenRouterModelsCache>(MODELS_KEY);
  },
  async getCachedKeyUsage(): Promise<OpenRouterKeyUsageCache | null> {
    return indexedDBService.getSetting<OpenRouterKeyUsageCache>(KEY_USAGE_KEY);
  },

  // Last used helpers
  async setLastUsed(modelId: string): Promise<void> {
    try {
      const map = (await indexedDBService.getSetting<Record<string, string>>(LAST_USED_KEY)) || {};
      map[modelId] = nowIso();
      await indexedDBService.setSetting(LAST_USED_KEY, map);
    } catch {}
  },
  async getLastUsedMap(): Promise<Record<string, string>> {
    return (await indexedDBService.getSetting<Record<string, string>>(LAST_USED_KEY)) || {};
  },

  async getPricingForModel(modelId: string): Promise<ORPricing | null> {
    const cache = await this.getCachedModels();
    if (!cache || !cache.data) return null;
    const model = cache.data.find(m => m.id === modelId);
    return model?.pricing || null;
  },
};

export const isTextCapable = (m: OpenRouterModelRec): boolean => {
  const ins = (m.architecture?.input_modalities || []).map(x => String(x).toLowerCase());
  const outs = (m.architecture?.output_modalities || []).map(x => String(x).toLowerCase());
  return ins.includes('text') && outs.includes('text');
};

export const formatPerMillion = (x?: string | number | null): number | null => {
  if (x === null || x === undefined) return null;
  const n = typeof x === 'string' ? parseFloat(x) : x;
  if (!isFinite(n) || n <= 0) return null;
  return n * 1_000_000;
};
