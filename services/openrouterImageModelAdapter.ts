import { SettingsOps } from './db/operations';
import { debugLog } from '../utils/debug';

type ORPricing = {
  prompt?: string | number | null;
  completion?: string | number | null;
  image?: string | number | null;
  request?: string | number | null;
  [k: string]: unknown;
};

type ORArchitecture = {
  input_modalities?: string[];
  output_modalities?: string[];
  [k: string]: unknown;
};

type ORImageModelRow = {
  id?: string;
  name?: string;
  pricing?: ORPricing | null;
  architecture?: ORArchitecture | null;
};

type AspectRatioOption = {
  label: string;
  value: number;
};

export interface OpenRouterImageModelProfile {
  id: string;
  name: string;
  inputModalities: string[];
  outputModalities: string[];
  requestModalities: Array<'image' | 'text'>;
  priceEstimate: number | null;
  pricingLabel: string;
  sortKey: number | null;
  supportsImageConfig: boolean;
  supportsExtendedAspectRatios: boolean;
  supportsHalfKImageSize: boolean;
}

export interface OpenRouterImageModelsCache {
  data: OpenRouterImageModelProfile[];
  fetchedAt: string;
}

export interface OpenRouterImageRequestConfig {
  aspect_ratio: string;
  image_size: string;
}

const IMAGE_MODELS_KEY = 'openrouter-image-models-v2';
const IMAGE_MODEL_CACHE_MS = 60 * 60 * 1000;
const IMAGE_MODELS_URL = 'https://openrouter.ai/api/v1/models?output_modalities=image';

const STANDARD_ASPECT_RATIOS: AspectRatioOption[] = [
  { label: '1:1', value: 1 / 1 },
  { label: '2:3', value: 2 / 3 },
  { label: '3:2', value: 3 / 2 },
  { label: '3:4', value: 3 / 4 },
  { label: '4:3', value: 4 / 3 },
  { label: '4:5', value: 4 / 5 },
  { label: '5:4', value: 5 / 4 },
  { label: '9:16', value: 9 / 16 },
  { label: '16:9', value: 16 / 9 },
  { label: '21:9', value: 21 / 9 },
];

const EXTENDED_ASPECT_RATIOS: AspectRatioOption[] = [
  { label: '1:4', value: 1 / 4 },
  { label: '4:1', value: 4 / 1 },
  { label: '1:8', value: 1 / 8 },
  { label: '8:1', value: 8 / 1 },
];

const IMAGE_PRICE_HINTS: Record<string, { estimate: number; label: string }> = {
  'google/gemini-2.5-flash-image': { estimate: 0.03, label: '$0.0300/image (est.)' },
  'google/gemini-3-pro-image-preview': { estimate: 0.12, label: '$0.1200/image (est.)' },
  'openai/gpt-5-image': { estimate: 0.04, label: '$0.0400/image (est.)' },
  'openai/gpt-5-image-mini': { estimate: 0.008, label: '$0.0080/image (est.)' },
  'black-forest-labs/flux.2-klein-4b': { estimate: 0.014, label: 'from $0.0140/image' },
  'black-forest-labs/flux.2-max': { estimate: 0.07, label: 'from $0.0700/image' },
  'black-forest-labs/flux.2-pro': { estimate: 0.03, label: 'from $0.0300/image' },
  'black-forest-labs/flux.2-flex': { estimate: 0.06, label: 'from $0.0600/image' },
  'bytedance-seed/seedream-4.5': { estimate: 0.04, label: '$0.0400/image' },
  'sourceful/riverflow-v2-pro': { estimate: 0.15, label: 'from $0.1500/image' },
  'sourceful/riverflow-v2-fast': { estimate: 0.02, label: 'from $0.0200/image' },
  'sourceful/riverflow-v2-max-preview': { estimate: 0.075, label: '$0.0750/image' },
  'sourceful/riverflow-v2-standard-preview': { estimate: 0.035, label: '$0.0350/image' },
  'sourceful/riverflow-v2-fast-preview': { estimate: 0.03, label: '$0.0300/image' },
};

const nowIso = () => new Date().toISOString();

const normalizeModelId = (modelId: string): string =>
  modelId.startsWith('openrouter/') ? modelId.slice(11) : modelId;

const toLowerCaseSet = (values?: string[]): string[] =>
  (values || []).map((value) => String(value).toLowerCase());

const parseNonNegativeNumber = (value?: string | number | null): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const formatPerMillion = (value: number): number => value * 1_000_000;

const formatUsd = (value: number): string => {
  if (value === 0) return '0.0000';
  if (value < 0.01) return value.toFixed(4);
  return value.toFixed(3);
};

const buildPricingSummary = (
  modelId: string,
  pricing?: ORPricing | null
): { priceEstimate: number | null; pricingLabel: string; sortKey: number | null } => {
  const imagePrice = parseNonNegativeNumber(pricing?.image);
  if (imagePrice !== null && imagePrice > 0) {
    return {
      priceEstimate: imagePrice,
      pricingLabel: `$${formatUsd(imagePrice)}/image`,
      sortKey: imagePrice,
    };
  }

  const hint = IMAGE_PRICE_HINTS[modelId];
  if (hint) {
    return {
      priceEstimate: hint.estimate,
      pricingLabel: hint.label,
      sortKey: hint.estimate,
    };
  }

  const promptPrice = parseNonNegativeNumber(pricing?.prompt);
  const completionPrice = parseNonNegativeNumber(pricing?.completion);
  if (promptPrice !== null && completionPrice !== null) {
    const inputPerMillion = formatPerMillion(promptPrice);
    const outputPerMillion = formatPerMillion(completionPrice);
    return {
      priceEstimate: null,
      pricingLabel: `USD ${inputPerMillion.toFixed(2)}/${outputPerMillion.toFixed(2)} per 1M`,
      sortKey: inputPerMillion + outputPerMillion,
    };
  }

  return {
    priceEstimate: null,
    pricingLabel: 'pricing varies',
    sortKey: null,
  };
};

const supportsImageConfig = (modelId: string): boolean => modelId.startsWith('google/');

const supportsExtendedAspectRatios = (modelId: string): boolean =>
  modelId === 'google/gemini-3.1-flash-image-preview';

const supportsHalfKImageSize = (modelId: string): boolean =>
  modelId === 'google/gemini-3.1-flash-image-preview';

const mapRowToProfile = (row: ORImageModelRow): OpenRouterImageModelProfile | null => {
  const id = row.id || row.name;
  if (!id || id === 'openrouter/auto') return null;

  const inputModalities = toLowerCaseSet(row.architecture?.input_modalities);
  const outputModalities = toLowerCaseSet(row.architecture?.output_modalities);
  if (!outputModalities.includes('image')) return null;

  const requestModalities: Array<'image' | 'text'> = outputModalities.includes('text')
    ? ['image', 'text']
    : ['image'];

  const pricing = buildPricingSummary(id, row.pricing);

  return {
    id,
    name: row.name || id,
    inputModalities,
    outputModalities,
    requestModalities,
    priceEstimate: pricing.priceEstimate,
    pricingLabel: pricing.pricingLabel,
    sortKey: pricing.sortKey,
    supportsImageConfig: supportsImageConfig(id),
    supportsExtendedAspectRatios: supportsExtendedAspectRatios(id),
    supportsHalfKImageSize: supportsHalfKImageSize(id),
  };
};

export async function fetchVerifiedOpenRouterImageModels(
  apiKey?: string
): Promise<OpenRouterImageModelsCache> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  debugLog('api', 'summary', '[OpenRouterImageAdapter] Fetching verified image models');
  const response = await fetch(IMAGE_MODELS_URL, { headers });
  if (!response.ok) {
    throw new Error(`OpenRouter image models fetch failed: ${response.status}`);
  }

  const json = await response.json();
  const rows = Array.isArray(json?.data) ? (json.data as ORImageModelRow[]) : [];
  const mapped = rows
    .map(mapRowToProfile)
    .filter((profile): profile is OpenRouterImageModelProfile => profile !== null)
    .sort((a, b) => {
      const providerCompare = a.id.localeCompare(b.id);
      const sortA = a.sortKey ?? Number.POSITIVE_INFINITY;
      const sortB = b.sortKey ?? Number.POSITIVE_INFINITY;
      return sortA - sortB || providerCompare;
    });

  const cache: OpenRouterImageModelsCache = {
    data: mapped,
    fetchedAt: nowIso(),
  };
  await SettingsOps.set(IMAGE_MODELS_KEY, cache);
  return cache;
}

export async function getCachedOpenRouterImageModels(): Promise<OpenRouterImageModelsCache | null> {
  return SettingsOps.getKey<OpenRouterImageModelsCache>(IMAGE_MODELS_KEY);
}

export async function getVerifiedOpenRouterImageModels(force = false): Promise<OpenRouterImageModelsCache> {
  const cached = await getCachedOpenRouterImageModels();
  if (!force && cached?.fetchedAt) {
    const ageMs = Date.now() - new Date(cached.fetchedAt).getTime();
    if (ageMs < IMAGE_MODEL_CACHE_MS && cached.data.length > 0) {
      return cached;
    }
  }

  return fetchVerifiedOpenRouterImageModels();
}

export async function getVerifiedOpenRouterImageModel(
  modelId: string
): Promise<OpenRouterImageModelProfile | null> {
  const normalizedId = normalizeModelId(modelId);
  const cached = await getVerifiedOpenRouterImageModels(false);
  let model = cached.data.find((entry) => entry.id === normalizedId) || null;

  if (!model) {
    const refreshed = await getVerifiedOpenRouterImageModels(true);
    model = refreshed.data.find((entry) => entry.id === normalizedId) || null;
  }

  return model;
}

const pickAspectRatio = (
  width: number,
  height: number,
  allowExtended: boolean
): string => {
  const ratios = allowExtended
    ? STANDARD_ASPECT_RATIOS.concat(EXTENDED_ASPECT_RATIOS)
    : STANDARD_ASPECT_RATIOS;
  const target = width / height;

  return ratios
    .slice()
    .sort((a, b) => Math.abs(a.value - target) - Math.abs(b.value - target))[0]
    .label;
};

const pickImageSize = (
  width: number,
  height: number,
  allowHalfK: boolean
): string => {
  const maxDimension = Math.max(width, height);
  if (allowHalfK && maxDimension <= 768) return '0.5K';
  if (maxDimension >= 2048) return '4K';
  if (maxDimension >= 1536) return '2K';
  return '1K';
};

export function buildOpenRouterImageRequestConfig(
  profile: OpenRouterImageModelProfile,
  width: number,
  height: number
): OpenRouterImageRequestConfig | undefined {
  if (!profile.supportsImageConfig) return undefined;

  return {
    aspect_ratio: pickAspectRatio(width, height, profile.supportsExtendedAspectRatios),
    image_size: pickImageSize(width, height, profile.supportsHalfKImageSize),
  };
}
