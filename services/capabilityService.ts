/**
 * Runtime capability detection using OpenRouter's APIs
 * Replaces hardcoded model name heuristics with actual API data
 */

export type ModelMeta = {
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

export type Endpoint = {
  provider_name: string;            // e.g. "OpenRouter", "OpenAI", "Fireworks"
  supported_parameters?: string[];  // provider-specific support
};

const ORIGIN = "https://openrouter.ai/api/v1";

const cache = {
  models: null as Map<string, ModelMeta> | null,
  endpoints: new Map<string, Endpoint[]>(), // key: canonical_slug or id
  lastFetch: 0,
  CACHE_DURATION: 30 * 60 * 1000, // 30 minutes
  // Runtime learning: parameters that explicitly failed despite metadata
  failures: new Set<string>(), // key: "modelId:parameter"
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
 */
export async function supportsStructuredOutputs(providerName: string, modelId: string): Promise<boolean> {
  try {
    const models = await loadModels();
    const meta = models.get(modelId);
    
    // Check if the model itself reports structured output support
    const modelHasSO = 
      meta?.supported_parameters?.includes("structured_outputs") || 
      meta?.supported_parameters?.includes("response_format");

    if (!modelHasSO) return false;

    // For OpenRouter, we can be even more specific if we have endpoint data
    if (providerName === 'OpenRouter' && meta?.canonical_slug) {
      const slug = meta.canonical_slug.replace(/^@?/, "");
      const [author, ...rest] = slug.split("/");
      const simpleSlug = rest.join("/");
      
      if (author && simpleSlug) {
        const eps = await loadEndpoints(author, simpleSlug);
        // Does ANY available endpoint support it?
        return eps.some(ep => 
          ep.supported_parameters?.includes("structured_outputs") || 
          ep.supported_parameters?.includes("response_format")
        );
      }
    }

    return !!modelHasSO;
  } catch (error) {
    return false;
  }
}

/**
 * Check if a model supports specific parameters (generic capability checker)
 */
export async function supportsParameters(providerName: string, modelId: string, parameters: string[]): Promise<boolean> {
  // 1. Check runtime failure cache first (if it failed once, don't try again)
  for (const param of parameters) {
    if (cache.failures.has(`${modelId}:${param}`)) {
      return false;
    }
  }

  try {
    const models = await loadModels();
    const meta = models.get(modelId);
    if (!meta) return true; // Default to true if unknown, let the adapter handle retry

    // 2. Check model-level support
    const modelSupports = parameters.every(p => meta.supported_parameters?.includes(p));
    if (!modelSupports) return false;

    // 3. For OpenRouter, verify across endpoints
    if (providerName === 'OpenRouter' && meta.canonical_slug) {
      const slug = meta.canonical_slug.replace(/^@?/, "");
      const [author, ...rest] = slug.split("/");
      const simpleSlug = rest.join("/");
      
      if (author && simpleSlug) {
        const eps = await loadEndpoints(author, simpleSlug);
        if (eps.length > 0) {
          return eps.some(ep => parameters.every(p => ep.supported_parameters?.includes(p)));
        }
      }
    }
    
    return modelSupports;
  } catch (error) {
    return true; // Fallback to permissive
  }
}

/**
 * Mark a parameter as failed for a specific model during this session
 */
export function recordParameterFailure(modelId: string, parameter: string): void {
  console.warn(`[CapabilityService] Recording failure for ${modelId}:${parameter}. Will prune in future requests.`);
  cache.failures.add(`${modelId}:${parameter}`);
}

/**
 * Get full model metadata
 */
export async function getModelMetadata(modelId: string): Promise<ModelMeta | null> {
  const models = await loadModels();
  return models.get(modelId) || null;
}

export async function getModelPricing(modelId: string): Promise<{ input: number; output: number } | null> {
  const meta = await getModelMetadata(modelId);
  if (!meta?.pricing) return null;
  const prompt = typeof meta.pricing.prompt === 'string' ? parseFloat(meta.pricing.prompt) : meta.pricing.prompt;
  const completion = typeof meta.pricing.completion === 'string' ? parseFloat(meta.pricing.completion) : meta.pricing.completion;
  if (typeof prompt === 'number' && typeof completion === 'number') {
    return { input: prompt * 1_000_000, output: completion * 1_000_000 };
  }
  return null;
}

export async function getModelLimits(modelId: string): Promise<{ [key: string]: number } | null> {
  const meta = await getModelMetadata(modelId);
  return meta?.per_request_limits || null;
}

export function clearCapabilityCache(): void {
  cache.models = null;
  cache.endpoints.clear();
  cache.lastFetch = 0;
  cache.failures.clear();
}