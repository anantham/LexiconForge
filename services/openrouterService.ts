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
    console.log('[OpenRouter] fetchModels called, apiKey present:', !!apiKey);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const res = await fetch('https://openrouter.ai/api/v1/models', { headers });
    console.log('[OpenRouter] fetchModels response status:', res.status);
    if (!res.ok) throw new Error(`OpenRouter models fetch failed: ${res.status}`);
    const json = await res.json();
    const data = (json?.data || []) as any[];
    console.log('[OpenRouter] fetchModels raw data count:', data.length);
    const mapped: OpenRouterModelRec[] = data.map((m: any) => ({
      id: m.id || m.slug || m.name,
      name: m.name || m.id,
      architecture: m.architecture || {},
      pricing: m.pricing || null,
    }));
    console.log('[OpenRouter] fetchModels mapped count:', mapped.length);
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

export const isTextCapable = (m: OpenRouterModelRec): boolean => {
  const ins = (m.architecture?.input_modalities || []).map(x => String(x).toLowerCase());
  const outs = (m.architecture?.output_modalities || []).map(x => String(x).toLowerCase());
  return ins.includes('text') && outs.includes('text');
};

export const isImageCapable = (m: OpenRouterModelRec): boolean => {
  // ONLY check output_modalities for 'image' - this is the reliable indicator
  // NOTE: pricing.image means the model accepts images as INPUT (vision),
  // NOT that it can generate images as output!
  const outs = (m.architecture?.output_modalities || []).map(x => String(x).toLowerCase());
  return outs.includes('image');
};

export const formatPerMillion = (x?: string | number | null): number | null => {
  if (x === null || x === undefined) return null;
  const n = typeof x === 'string' ? parseFloat(x) : x;
  if (!isFinite(n) || n <= 0) return null;
  return n * 1_000_000;
};

/**
 * Get image-capable models from cached OpenRouter models.
 * Will auto-fetch the models catalog if cache is empty.
 */
export const getOpenRouterImageModels = async (): Promise<Array<{
  id: string;
  name: string;
  pricePerImage: number | null;
}>> => {
  let cache = await openrouterService.getCachedModels();
  console.log('[OpenRouter] getOpenRouterImageModels - cache status:', {
    hasCache: !!cache,
    dataLength: cache?.data?.length ?? 0,
  });

  // If cache is empty, try to fetch fresh data
  if (!cache?.data || cache.data.length === 0) {
    console.log('[OpenRouter] Models cache empty, fetching...');
    try {
      cache = await openrouterService.fetchModels();
      console.log('[OpenRouter] Fetched models:', cache?.data?.length ?? 0);
    } catch (err) {
      console.error('[OpenRouter] Failed to fetch models:', err);
      return [];
    }
  }

  if (!cache?.data) return [];

  // Debug: Count models with different image indicators
  const withOutputModality = cache.data.filter(m =>
    (m.architecture?.output_modalities || []).map(x => String(x).toLowerCase()).includes('image')
  );
  const withImagePricing = cache.data.filter(m => {
    const p = m.pricing?.image;
    return p !== null && p !== undefined && p !== 0 && p !== '0';
  });
  console.log('[OpenRouter] Models that can GENERATE images (output_modalities=image):', withOutputModality.length);
  console.log('[OpenRouter] Models that can ACCEPT images as input (pricing.image, vision):', withImagePricing.length);
  console.log('[OpenRouter] NOTE: Only output_modalities=image models are shown in image model picker');

  // Check for specific models user asked about
  const targetModels = ['flux', 'seedream', 'riverflow', 'imagen'];
  const matchingAny = cache.data.filter(m =>
    targetModels.some(t => m.id.toLowerCase().includes(t))
  );
  if (matchingAny.length > 0) {
    console.log('[OpenRouter] Found target model patterns:', matchingAny.map(m => ({
      id: m.id,
      outputModalities: m.architecture?.output_modalities,
      imagePrice: m.pricing?.image,
    })));
  } else {
    console.log('[OpenRouter] No flux/seedream/riverflow/imagen models in cache');
  }

  // Filter to image-capable models
  const imageModels = cache.data.filter(isImageCapable);
  console.log('[OpenRouter] Image-capable models found:', imageModels.length);

  // Log a sample of models with their pricing - EXPANDED for debugging
  if (imageModels.length > 0) {
    const samples = imageModels.slice(0, 5).map(m => ({
      id: m.id,
      pricingObj: m.pricing,
      imageField: m.pricing?.image,
      imageFieldType: typeof m.pricing?.image,
      allPricingKeys: m.pricing ? Object.keys(m.pricing) : [],
    }));
    console.log('[OpenRouter] Sample image model pricing (EXPANDED):');
    samples.forEach(s => console.log('  -', s.id, '| image:', s.imageField, `(${s.imageFieldType})`, '| keys:', s.allPricingKeys));
  }

  const mapped = imageModels.map(m => {
    // Image pricing from OpenRouter is per-image directly
    const imagePrice = m.pricing?.image;
    let pricePerImage: number | null = null;
    if (imagePrice !== null && imagePrice !== undefined) {
      const parsed = typeof imagePrice === 'string' ? parseFloat(imagePrice) : imagePrice;
      if (isFinite(parsed) && parsed >= 0) {
        pricePerImage = parsed;
      }
    }
    return {
      id: m.id,
      name: m.name,
      pricePerImage,
    };
  });

  // Log final parsed prices
  console.log('[OpenRouter] Final parsed image prices:');
  mapped.forEach(m => console.log('  -', m.id, '| pricePerImage:', m.pricePerImage));

  return mapped
    .sort((a, b) => {
      // Sort by price (nulls last)
      const pa = a.pricePerImage ?? Infinity;
      const pb = b.pricePerImage ?? Infinity;
      return pa - pb || a.name.localeCompare(b.name);
    });
};

/**
 * Get dynamic image pricing for a model from OpenRouter cache.
 * Will auto-fetch the models catalog if cache is empty.
 */
export const getOpenRouterImagePrice = async (modelId: string): Promise<number | null> => {
  // Strip 'openrouter/' prefix if present
  const cleanId = modelId.startsWith('openrouter/') ? modelId.slice(11) : modelId;

  let cache = await openrouterService.getCachedModels();

  // If cache is empty or stale (>24h), try to fetch fresh data
  if (!cache?.data || cache.data.length === 0) {
    debugLog('api', 'summary', '[OpenRouter] Models cache empty, fetching...');
    try {
      cache = await openrouterService.fetchModels();
    } catch (err) {
      debugLog('api', 'summary', '[OpenRouter] Failed to fetch models for pricing:', err);
    }
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

/**
 * Estimate per-image cost using historical token data × per-token pricing.
 * This provides more accurate per-image costs than raw API pricing data
 * (which is per-token, not per-image).
 *
 * @param modelId The OpenRouter model ID (e.g., "openai/gpt-5-image")
 * @returns Estimated cost per image in USD, or null if insufficient data
 */
export const estimateImageCostFromHistory = async (
  modelId: string
): Promise<{
  estimatedCostPerImage: number;
  confidence: 'high' | 'medium' | 'low';
  sampleCount: number;
  avgTokens: number;
  perTokenPrice: number;
} | null> => {
  // Lazy import to avoid circular dependencies
  const { apiMetricsService } = await import('./apiMetricsService');

  // Get historical token usage for this model
  const fullModelId = modelId.startsWith('openrouter/') ? modelId : `openrouter/${modelId}`;
  const tokenData = await apiMetricsService.getAverageTokensPerImage(fullModelId);

  if (!tokenData || tokenData.sampleCount === 0) {
    debugLog('api', 'summary', `[OpenRouter] No historical data for ${modelId}`);
    return null;
  }

  // Get per-token pricing from cache
  const cache = await openrouterService.getCachedModels();
  const cleanId = modelId.startsWith('openrouter/') ? modelId.slice(11) : modelId;
  const model = cache?.data?.find(m => m.id === cleanId);

  if (!model?.pricing) {
    debugLog('api', 'summary', `[OpenRouter] No pricing data for ${modelId}`);
    return null;
  }

  // OpenRouter uses per-token pricing for input (prompt), output (completion), and image
  // Image-related tokens may use the 'image' price, or we can weight prompt/completion
  const promptPrice = parseFloat(String(model.pricing.prompt || 0));
  const completionPrice = parseFloat(String(model.pricing.completion || 0));
  const imagePrice = parseFloat(String(model.pricing.image || 0));

  // Calculate estimated cost: (prompt_tokens × prompt_price) + (completion_tokens × completion_price)
  // If image pricing is separate, use that for image-related tokens
  let estimatedCost: number;
  let perTokenPrice: number;

  if (imagePrice > 0 && imagePrice !== promptPrice) {
    // Use image-specific pricing for all tokens (some models have dedicated image token pricing)
    estimatedCost = tokenData.avgTotal * imagePrice;
    perTokenPrice = imagePrice;
  } else {
    // Use weighted prompt/completion pricing
    estimatedCost =
      tokenData.avgPrompt * promptPrice + tokenData.avgCompletion * completionPrice;
    perTokenPrice = (promptPrice + completionPrice) / 2; // Average for display
  }

  // Determine confidence based on sample count
  const confidence: 'high' | 'medium' | 'low' =
    tokenData.sampleCount >= 10 ? 'high' : tokenData.sampleCount >= 3 ? 'medium' : 'low';

  const result = {
    estimatedCostPerImage: estimatedCost,
    confidence,
    sampleCount: tokenData.sampleCount,
    avgTokens: tokenData.avgTotal,
    perTokenPrice,
  };

  debugLog('api', 'summary', `[OpenRouter] Estimated image cost for ${modelId}:`, result);
  return result;
};
