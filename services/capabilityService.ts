/**
 * Runtime capability detection using OpenRouter's APIs
 * Replaces hardcoded model name heuristics with actual API data
 */

type ModelMeta = {
  id: string;
  name?: string;
  supported_parameters?: string[];
  canonical_slug?: string; // e.g. "openai/gpt-4o"
  context_length?: number;
  pricing?: {
    prompt?: string | number;
    completion?: string | number;
    image?: string | number;
    request?: string | number;
  };
  per_request_limits?: {
    [key: string]: number;
  } | null;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
    instruct_type?: string;
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
};

type Endpoint = {
  provider_name: string;            // e.g. "OpenRouter", "OpenAI", "Fireworks"
  supported_parameters?: string[];  // provider-specific support
};

const ORIGIN = "https://openrouter.ai/api/v1";

const cache = {
  models: null as Map<string, ModelMeta> | null,
  endpoints: new Map<string, Endpoint[]>(), // key: canonical_slug or id
  lastFetch: 0,
  CACHE_DURATION: 30 * 60 * 1000, // 30 minutes
};

async function loadModels(): Promise<Map<string, ModelMeta>> {
  const now = Date.now();
  if (cache.models && (now - cache.lastFetch) < cache.CACHE_DURATION) {
    return cache.models;
  }
  
  try {
    const r = await fetch(`${ORIGIN}/models`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    const m = new Map<string, ModelMeta>();
    for (const row of json.data as any[]) {
      m.set(row.id, row);
    }
    cache.models = m;
    cache.lastFetch = now;
    return m;
  } catch (error) {
    console.warn('[CapabilityService] Failed to load models:', error);
    // Return cached data if available, even if stale
    return cache.models || new Map();
  }
}

async function loadEndpoints(author: string, slug: string): Promise<Endpoint[]> {
  const key = `${author}/${slug}`;
  if (cache.endpoints.has(key)) {
    return cache.endpoints.get(key)!;
  }
  
  try {
    const r = await fetch(`${ORIGIN}/models/${author}/${slug}/endpoints`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    const eps = (json.data?.endpoints ?? []) as Endpoint[];
    cache.endpoints.set(key, eps);
    return eps;
  } catch (error) {
    console.warn(`[CapabilityService] Failed to load endpoints for ${key}:`, error);
    return [];
  }
}

/**
 * Check if a model+provider combination supports structured outputs
 * Uses OpenRouter's APIs to get actual capability data
 */
export async function supportsStructuredOutputs(providerName: string, modelId: string): Promise<boolean> {
  let apiSaysYes = false;
  try {
    // 1) Model-level (union across providers) — quick check
    const models = await loadModels();
    const meta = models.get(modelId);
    const modelUnionHasSO =
      !!meta?.supported_parameters?.includes("structured_outputs") &&
      !!meta?.supported_parameters?.includes("response_format");

    // 2) If the model has a canonical slug, look up per-provider support
    const slug = (meta?.canonical_slug || modelId).replace(/^@?/, "");
    const [author, ...rest] = slug.split("/");
    const simpleSlug = rest.join("/");
    let providerHasSO = false;

    if (author && simpleSlug && providerName === 'OpenRouter') {
      try {
        const eps = await loadEndpoints(author, simpleSlug);
        // For OpenRouter, check if ANY endpoint supports both structured_outputs and response_format
        // OpenRouter will route to the best available endpoint
        providerHasSO = eps.some(endpoint => 
          !!endpoint?.supported_parameters?.includes("structured_outputs") &&
          !!endpoint?.supported_parameters?.includes("response_format")
        );
      } catch {
        // network issues: fall back to model-level union
        providerHasSO = modelUnionHasSO;
      }
    } else {
      // For non-OpenRouter providers, use model-level data
      providerHasSO = modelUnionHasSO;
    }
    apiSaysYes = providerHasSO;

  } catch (error) {
    console.warn('[CapabilityService] Error checking structured outputs support:', error);
  }

  if (apiSaysYes) {
    return true;
  }

  // Fallback for non-OpenRouter providers that don't have a capability API
  if (providerName === 'OpenAI') {
    return (
      modelId.startsWith('gpt-4o') ||
      modelId.startsWith('gpt-4.1')
    );
  }

  // For OpenRouter, we rely on the API check. If it fails, we assume no support.
  return false;
}

/**
 * Get full model metadata including pricing and limits
 */
export async function getModelMetadata(modelId: string): Promise<ModelMeta | null> {
  try {
    const models = await loadModels();
    return models.get(modelId) || null;
  } catch (error) {
    console.warn('[CapabilityService] Error getting model metadata:', error);
    return null;
  }
}

/**
 * Get pricing data for cost-aware model selection
 */
export async function getModelPricing(modelId: string): Promise<{ input: number; output: number } | null> {
  try {
    const meta = await getModelMetadata(modelId);
    if (!meta?.pricing) return null;
    
    const prompt = typeof meta.pricing.prompt === 'string' ? parseFloat(meta.pricing.prompt) : meta.pricing.prompt;
    const completion = typeof meta.pricing.completion === 'string' ? parseFloat(meta.pricing.completion) : meta.pricing.completion;
    
    if (typeof prompt === 'number' && typeof completion === 'number') {
      return {
        input: prompt * 1_000_000, // Convert to per-million tokens
        output: completion * 1_000_000
      };
    }
    return null;
  } catch (error) {
    console.warn('[CapabilityService] Error getting model pricing:', error);
    return null;
  }
}

/**
 * Get rate limits for a model to respect per_request_limits
 */
export async function getModelLimits(modelId: string): Promise<{ [key: string]: number } | null> {
  try {
    const meta = await getModelMetadata(modelId);
    return meta?.per_request_limits || null;
  } catch (error) {
    console.warn('[CapabilityService] Error getting model limits:', error);
    return null;
  }
}

/**
 * Check if a model supports specific parameters (generic capability checker)
 */
export async function supportsParameters(providerName: string, modelId: string, parameters: string[]): Promise<boolean> {
  try {
    const models = await loadModels();
    const meta = models.get(modelId);
    
    // Check model-level support first
    const modelSupportsAll = parameters.every(param => 
      meta?.supported_parameters?.includes(param)
    );
    
    if (!modelSupportsAll) return false;
    
    // For OpenRouter, check provider-specific support
    if (providerName === 'OpenRouter' && meta?.canonical_slug) {
      const slug = meta.canonical_slug.replace(/^@?/, "");
      const [author, ...rest] = slug.split("/");
      const simpleSlug = rest.join("/");
      
      if (author && simpleSlug) {
        try {
          const eps = await loadEndpoints(author, simpleSlug);
          // For OpenRouter, check if ANY endpoint supports all required parameters
          // OpenRouter will route to the best available endpoint
          return eps.some(endpoint => 
            parameters.every(param => 
              endpoint?.supported_parameters?.includes(param)
            )
          );
        } catch {
          // Fallback to model-level check
          return modelSupportsAll;
        }
      }
    }
    
    return modelSupportsAll;
  } catch (error) {
    console.warn('[CapabilityService] Error checking parameter support:', error);
    return false;
  }
}

/**
 * Clear capability cache (useful for development/testing)
 */
export function clearCapabilityCache(): void {
  cache.models = null;
  cache.endpoints.clear();
  cache.lastFetch = 0;
}