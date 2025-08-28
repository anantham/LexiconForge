import { indexedDBService } from './indexeddb';

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
  usage: number | null; // USD
  limit: number | null; // USD (null = uncapped)
  remaining: number | null; // USD (null = uncapped)
  fetchedAt: string; // ISO
}

const MODELS_KEY = 'openrouter-models';
const KEY_USAGE_KEY = 'openrouter-key-usage';
const LAST_USED_KEY = 'openrouter-model-last-used';

const nowIso = () => new Date().toISOString();

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
    const dbg = (() => { try { const lvl = localStorage.getItem('LF_AI_DEBUG_LEVEL'); return lvl === 'summary' || lvl === 'full'; } catch { return false; } })();
    if (dbg) console.log('[OpenRouter] Fetching key usage…');
    const headers: Record<string, string> = { 'Authorization': `Bearer ${apiKey}` };
    const res = await fetch('https://openrouter.ai/api/v1/key', { headers });
    if (!res.ok) throw new Error(`OpenRouter key usage fetch failed: ${res.status}`);
    const json = await res.json();
    if (dbg) {
      try {
        // Log a masked/summary view to avoid leaking sensitive info
        const preview = {
          hasUsage: json?.usage != null,
          usage: typeof json?.usage === 'number' ? Number(json.usage.toFixed(4)) : json?.usage,
          hasLimit: json?.limit != null,
          limit: typeof json?.limit === 'number' ? Number(json.limit.toFixed(4)) : json?.limit,
          rawKeys: Object.keys(json || {})
        };
        console.log('[OpenRouter] Key usage response (summary):', preview);
      } catch {}
    }
    const usage = json?.usage ?? null; // USD
    const limit = json?.limit ?? null; // USD or null
    const remaining = (typeof limit === 'number' && typeof usage === 'number') ? (limit - usage) : null;
    const cache = { usage, limit, remaining, fetchedAt: nowIso() };
    await indexedDBService.setSetting(KEY_USAGE_KEY, cache);
    if (dbg) console.log('[OpenRouter] Key usage cached:', cache);
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
