import type { AppSettings } from '../types';
import type { ProviderPreferences } from '../adapters/providers/Provider';

const OPENROUTER_API_ORIGIN = 'https://openrouter.ai/api/v1';
const ENDPOINT_CACHE_MS = 30 * 60 * 1000;

type OpenRouterEndpointRecord = {
  provider_name?: string;
  tag?: string;
  status?: number | null;
};

type CachedEndpoints = {
  fetchedAt: number;
  endpoints: OpenRouterEndpointOption[];
};

export type OpenRouterRouteScope = 'text' | 'image';

export interface OpenRouterEndpointOption {
  /** Provider-routing slug accepted by `provider.only`, for example `deepinfra`. */
  id: string;
  label: string;
  tags: string[];
}

export interface OpenRouterRoutingOverride {
  endpoint?: string | null;
}

const endpointCache = new Map<string, CachedEndpoints>();

export const normalizeOpenRouterModelId = (modelId: string): string =>
  modelId.startsWith('openrouter/') ? modelId.slice('openrouter/'.length) : modelId;

const endpointUrlForModel = (modelId: string): string => {
  const normalized = normalizeOpenRouterModelId(modelId).trim();
  const [author, ...slugParts] = normalized.split('/');
  if (!author || slugParts.length === 0 || slugParts.some(part => !part)) {
    throw new Error(`OpenRouter model ID "${modelId}" must contain an author and model slug.`);
  }
  const encodedPath = [author, ...slugParts].map(encodeURIComponent).join('/');
  return `${OPENROUTER_API_ORIGIN}/models/${encodedPath}/endpoints`;
};

const providerSlugFromTag = (tag: string): string => tag.split('/')[0]?.trim().toLowerCase() || '';

const mapEndpointRecords = (records: OpenRouterEndpointRecord[]): OpenRouterEndpointOption[] => {
  const grouped = new Map<string, OpenRouterEndpointOption>();
  for (const record of records) {
    const tag = typeof record.tag === 'string' ? record.tag.trim() : '';
    const id = providerSlugFromTag(tag);
    if (!id) continue;
    const label = record.provider_name?.trim() || id;
    const existing = grouped.get(id);
    if (existing) {
      if (!existing.tags.includes(tag)) existing.tags.push(tag);
      continue;
    }
    grouped.set(id, { id, label, tags: [tag] });
  }
  return [...grouped.values()].sort((left, right) => left.label.localeCompare(right.label));
};

export async function fetchOpenRouterEndpoints(
  modelId: string,
  options: { force?: boolean; signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<OpenRouterEndpointOption[]> {
  const normalized = normalizeOpenRouterModelId(modelId).trim();
  const cached = endpointCache.get(normalized);
  if (!options.force && cached && Date.now() - cached.fetchedAt < ENDPOINT_CACHE_MS) {
    return cached.endpoints;
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('OpenRouter endpoint discovery requires fetch support.');

  let response: Response;
  try {
    response = await fetchImpl(endpointUrlForModel(normalized), {
      signal: options.signal ?? AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new Error(`OpenRouter endpoint discovery failed for ${normalized}: network request failed.`, {
      cause: error,
    });
  }
  if (!response.ok) {
    throw new Error(`OpenRouter endpoint discovery failed for ${normalized}: HTTP ${response.status}.`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new Error(`OpenRouter endpoint discovery failed for ${normalized}: unreadable JSON response.`, {
      cause: error,
    });
  }
  const records = (body as { data?: { endpoints?: unknown } })?.data?.endpoints;
  if (!Array.isArray(records)) {
    throw new Error(`OpenRouter endpoint discovery failed for ${normalized}: response has no endpoint list.`);
  }

  const endpoints = mapEndpointRecords(records as OpenRouterEndpointRecord[]);
  endpointCache.set(normalized, { fetchedAt: Date.now(), endpoints });
  return endpoints;
}

const selectedEndpoint = (
  settings: AppSettings,
  scope: OpenRouterRouteScope,
  override?: OpenRouterRoutingOverride,
): string => {
  const explicit = override && Object.prototype.hasOwnProperty.call(override, 'endpoint')
    ? override.endpoint
    : scope === 'text'
      ? settings.openRouterTextEndpoint
      : settings.openRouterImageEndpoint;
  return explicit?.trim().toLowerCase() || 'auto';
};

/**
 * Construct browser-request routing without requiring endpoint discovery on the paid path.
 * Saved endpoint slugs are sent exactly; OpenRouter returns a descriptive no-endpoint error
 * when a model/host pair is unavailable.
 */
export function buildOpenRouterRouting(
  settings: AppSettings,
  scope: OpenRouterRouteScope,
  override?: OpenRouterRoutingOverride,
): ProviderPreferences {
  const endpoint = selectedEndpoint(settings, scope, override);
  return {
    data_collection: 'deny',
    zdr: true,
    ...(endpoint === 'auto'
      ? {}
      : { only: [endpoint], allow_fallbacks: false }),
  };
}

/** Request preferences may add constraints but cannot weaken an exact route or data handling. */
export function mergeOpenRouterRouting(
  settings: AppSettings,
  scope: OpenRouterRouteScope,
  requestPreferences?: ProviderPreferences,
  override?: OpenRouterRoutingOverride,
): ProviderPreferences {
  const selectedRoute = buildOpenRouterRouting(settings, scope, override);
  return {
    ...(requestPreferences || {}),
    ...selectedRoute,
    data_collection: 'deny',
    zdr: true,
  };
}

export function resetOpenRouterEndpointCacheForTests(): void {
  endpointCache.clear();
}
