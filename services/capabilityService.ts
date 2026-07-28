/**
 * Runtime capability detection using OpenRouter's APIs
 * Replaces hardcoded model name heuristics with actual API data
 */

import { withRetry, isNetworkError } from '../utils/retry';

/** Retry transient network failures + 429/5xx, but NOT genuine 4xx (dead slug). */
const isTransient = (e: unknown): boolean =>
  isNetworkError(e) || /HTTP\s(5\d\d|429)/.test((e as any)?.message ?? '');

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

/**
 * Where a capability answer came from.
 * - 'metadata':      real model/endpoint metadata answered the question.
 * - 'default-error': the metadata fetch FAILED — the answer is a hardcoded default, not knowledge.
 * - 'default-miss':  metadata loaded fine but does not contain this model id — also a default.
 *
 * The distinction matters because consumers change the SHAPE of paid requests on these answers
 * (e.g. downgrading structured outputs to json_object): acting on a default is a guess, and a
 * guess that silently weakens a paid request must be visible in the logs.
 */
export type CapabilityAnswerSource = 'metadata' | 'default-error' | 'default-miss';

export type StructuredOutputsSupport = {
  supported: boolean;
  source: CapabilityAnswerSource;
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

// One warning per (function, model) per session — a per-call warn would spam every request in a
// session where the capability API is down, and silence was the previous (worse) failure mode.
const warnedDefaultAnswers = new Set<string>();

function warnDefaultAnswer(
  fn: string,
  modelId: string,
  source: CapabilityAnswerSource,
  defaultedTo: boolean,
  detail?: string
): void {
  const key = `${fn}:${modelId}`;
  if (warnedDefaultAnswers.has(key)) return;
  warnedDefaultAnswers.add(key);
  const why = source === 'default-error'
    ? 'the capability metadata fetch FAILED'
    : 'the model is missing from capability metadata';
  console.warn(
    `[CapabilityService] ${fn}('${modelId}'${detail ? `, ${detail}` : ''}) answered ${defaultedTo} as a DEFAULT because ${why}. ` +
    `This is a guess, not metadata — paid requests may be silently mis-shaped. (warned once per model per session)`
  );
}

/**
 * The capability map is keyed by OpenRouter slugs ('openai/gpt-4o', 'deepseek/deepseek-chat').
 * Direct providers hand us bare ids ('gpt-4o', 'deepseek-chat'), which used to be a PERMANENT
 * map miss: structured outputs stayed off forever for direct OpenAI (which supports them) and
 * supportsParameters fail-opened forever. Namespace mapping: try the bare id first (real
 * OpenRouter slugs pass through unchanged), then retry under the provider's OpenRouter author
 * prefix — OpenAI's 'gpt-4o' resolves via 'openai/gpt-4o', DeepSeek's 'deepseek-chat' via
 * 'deepseek/deepseek-chat'.
 */
const DIRECT_PROVIDER_OPENROUTER_AUTHOR: Record<string, string> = {
  OpenAI: 'openai',
  DeepSeek: 'deepseek',
};

function candidateModelIds(providerName: string, modelId: string): string[] {
  const ids = [modelId];
  const author = DIRECT_PROVIDER_OPENROUTER_AUTHOR[providerName];
  if (author && !modelId.includes('/')) ids.push(`${author}/${modelId}`);
  return ids;
}

function lookupModelMeta(
  models: Map<string, ModelMeta>,
  providerName: string,
  modelId: string
): ModelMeta | undefined {
  for (const id of candidateModelIds(providerName, modelId)) {
    const meta = models.get(id);
    if (meta) return meta;
  }
  return undefined;
}

async function loadModels(): Promise<{ map: Map<string, ModelMeta>; loadError: boolean }> {
  const now = Date.now();
  if (cache.models && (now - cache.lastFetch) < cache.CACHE_DURATION) {
    return { map: cache.models, loadError: false };
  }

  try {
    const m = await withRetry(async () => {
      const r = await fetch(`${ORIGIN}/models`, { signal: AbortSignal.timeout(15_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const map = new Map<string, ModelMeta>();
      for (const row of json.data as any[]) map.set(row.id, row);
      return map;
    }, {
      maxAttempts: 4, initialDelay: 1500, isRetryable: isTransient,
      onRetry: (a, d) => console.warn(`[CapabilityService] models fetch retry ${a} in ${d}ms`),
    });
    cache.models = m;
    cache.lastFetch = now;
    return { map: m, loadError: false };
  } catch (error) {
    console.warn('[CapabilityService] Failed to load models (after retries):', error);
    // A HIT in the (possibly stale) cache is still real metadata; a MISS after a failed load
    // proves nothing about the model, so callers must treat misses as 'default-error'.
    return { map: cache.models || new Map(), loadError: true };
  }
}

async function loadEndpoints(
  author: string,
  slug: string
): Promise<{ endpoints: Endpoint[]; loadError: boolean }> {
  const key = `${author}/${slug}`;
  if (cache.endpoints.has(key)) {
    return { endpoints: cache.endpoints.get(key)!, loadError: false };
  }

  try {
    const eps = await withRetry(async () => {
      const r = await fetch(`${ORIGIN}/models/${author}/${slug}/endpoints`, { signal: AbortSignal.timeout(15_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      return (json.data?.endpoints ?? []) as Endpoint[];
    }, {
      maxAttempts: 4, initialDelay: 1500, isRetryable: isTransient,
      onRetry: (a, d) => console.warn(`[CapabilityService] endpoints fetch retry ${a} in ${d}ms for ${key}`),
    });
    cache.endpoints.set(key, eps);
    return { endpoints: eps, loadError: false };
  } catch (error) {
    console.warn(`[CapabilityService] Failed to load endpoints for ${key} (after retries):`, error);
    // Deliberately NOT cached: a later call may succeed. An empty list here is an unknown, not
    // an answer, and the caller needs to know the difference.
    return { endpoints: [], loadError: true };
  }
}

/**
 * Check if a model+provider combination supports structured outputs, with provenance.
 *
 * The boolean alone loses the difference between "metadata says no" and "we could not find out"
 * — and consumers downgrade paid requests to json_object on `false`, so the source matters.
 * All boolean outcomes are identical to the historical supportsStructuredOutputs().
 */
export async function getStructuredOutputsSupport(
  providerName: string,
  modelId: string
): Promise<StructuredOutputsSupport> {
  try {
    const { map: models, loadError } = await loadModels();
    const meta = lookupModelMeta(models, providerName, modelId);

    if (!meta) {
      const source: CapabilityAnswerSource = loadError ? 'default-error' : 'default-miss';
      warnDefaultAnswer('supportsStructuredOutputs', modelId, source, false);
      return { supported: false, source };
    }

    // Check if the model itself reports structured output support
    const modelHasSO =
      meta.supported_parameters?.includes("structured_outputs") ||
      meta.supported_parameters?.includes("response_format");

    if (!modelHasSO) return { supported: false, source: 'metadata' };

    // For OpenRouter, we can be even more specific if we have endpoint data. (Direct providers
    // do not route through OpenRouter's endpoints; the model-level answer is the right one.)
    if (providerName === 'OpenRouter' && meta.canonical_slug) {
      const slug = meta.canonical_slug.replace(/^@?/, "");
      const [author, ...rest] = slug.split("/");
      const simpleSlug = rest.join("/");

      if (author && simpleSlug) {
        const { endpoints: eps, loadError: endpointsError } = await loadEndpoints(author, simpleSlug);
        if (endpointsError) {
          // Model-level metadata said yes but endpoint verification failed. The historical
          // (conservative) answer is false — surfaced as a default, not as knowledge.
          warnDefaultAnswer('supportsStructuredOutputs', modelId, 'default-error', false);
          return { supported: false, source: 'default-error' };
        }
        // Does ANY available endpoint support it?
        const supported = eps.some(ep =>
          ep.supported_parameters?.includes("structured_outputs") ||
          ep.supported_parameters?.includes("response_format")
        );
        return { supported, source: 'metadata' };
      }
    }

    return { supported: true, source: 'metadata' };
  } catch (error) {
    warnDefaultAnswer('supportsStructuredOutputs', modelId, 'default-error', false);
    return { supported: false, source: 'default-error' };
  }
}

/**
 * Boolean compatibility wrapper around getStructuredOutputsSupport(). Prefer the full form in
 * consumers that alter request shape on a `false` — the source tells them whether that `false`
 * is metadata or a failure-default.
 */
export async function supportsStructuredOutputs(providerName: string, modelId: string): Promise<boolean> {
  return (await getStructuredOutputsSupport(providerName, modelId)).supported;
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
    const { map: models, loadError } = await loadModels();
    const meta = lookupModelMeta(models, providerName, modelId);
    if (!meta) {
      // Default to true if unknown, let the adapter handle retry — but say so loudly: failing
      // open on a metadata failure means unsupported params ship on paid requests.
      const source: CapabilityAnswerSource = loadError ? 'default-error' : 'default-miss';
      warnDefaultAnswer('supportsParameters', modelId, source, true, `[${parameters.join(', ')}]`);
      return true;
    }

    // 2. Check model-level support
    const modelSupports = parameters.every(p => meta.supported_parameters?.includes(p));
    if (!modelSupports) return false;

    // 3. For OpenRouter, verify across endpoints
    if (providerName === 'OpenRouter' && meta.canonical_slug) {
      const slug = meta.canonical_slug.replace(/^@?/, "");
      const [author, ...rest] = slug.split("/");
      const simpleSlug = rest.join("/");

      if (author && simpleSlug) {
        const { endpoints: eps } = await loadEndpoints(author, simpleSlug);
        if (eps.length > 0) {
          return eps.some(ep => parameters.every(p => ep.supported_parameters?.includes(p)));
        }
      }
    }

    return modelSupports;
  } catch (error) {
    warnDefaultAnswer('supportsParameters', modelId, 'default-error', true, `[${parameters.join(', ')}]`);
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
 * Synchronous check of the session's learned-failure cache. Request builders
 * consult this so a KNOWN failing parameter (e.g. require_parameters after an
 * OpenRouter "No endpoints found" 404) is pruned up front instead of
 * repeating the fail-then-retry cycle on every call (codex review).
 */
export function hasRecordedParameterFailure(modelId: string, parameter: string): boolean {
  return cache.failures.has(`${modelId}:${parameter}`);
}

/**
 * Get full model metadata
 */
export async function getModelMetadata(modelId: string): Promise<ModelMeta | null> {
  const { map: models } = await loadModels();
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
  warnedDefaultAnswers.clear();
}
