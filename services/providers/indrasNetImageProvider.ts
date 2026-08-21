import { blobToBase64DataUrl } from '../imageUtils';

export const INDRASNET_IMAGE_MODEL_PREFIX = 'indrasnet/';
export const DEFAULT_INDRASNET_BASE_URL = 'https://asus-strix-scar.tail4741ad.ts.net:9443';

const DISCOVERY_TIMEOUT_MS = 10_000;
const GENERATION_TIMEOUT_MS = 1_830_000;
const CATALOGUE_TTL_MS = 60_000;

export interface IndrasNetSemanticBinding {
  node_id: string;
  input_key: string;
  required?: boolean;
}

export interface IndrasNetWorkflowManifest {
  name: string;
  display_name: string;
  description?: string;
  client_ready: boolean;
  requires_image: boolean;
  inputs: Record<string, IndrasNetSemanticBinding>;
  source?: string;
}

export interface IndrasNetWorkflowProfile {
  name: string;
  file?: string;
  source?: string;
  client_ready: boolean;
  manifest: IndrasNetWorkflowManifest;
}

interface WorkflowCatalogueResponse {
  workflows?: Array<Partial<IndrasNetWorkflowProfile> & { manifest?: IndrasNetWorkflowManifest | null }>;
}

interface RunWorkflowResponse {
  prompt_id?: string;
  timing_ms?: number;
  images?: string[];
}

interface ErrorPayload {
  detail?: string;
  code?: string;
  retryable?: boolean;
}

interface CachedCatalogue {
  fetchedAt: number;
  workflows: IndrasNetWorkflowProfile[];
}

const catalogueCache = new Map<string, CachedCatalogue>();

export class IndrasNetProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(message: string, options: { code: string; retryable: boolean; status?: number; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.name = 'IndrasNetProviderError';
    this.code = options.code;
    this.retryable = options.retryable;
    this.status = options.status;
  }
}

export const isIndrasNetImageModel = (model: string): boolean =>
  model.startsWith(INDRASNET_IMAGE_MODEL_PREFIX);

export const workflowNameFromImageModel = (model: string): string => {
  if (!isIndrasNetImageModel(model)) {
    throw new IndrasNetProviderError(`Not an IndrasNet image model: ${model}`, {
      code: 'INVALID_INDRASNET_MODEL',
      retryable: false,
    });
  }
  const encodedName = model.slice(INDRASNET_IMAGE_MODEL_PREFIX.length);
  try {
    const name = decodeURIComponent(encodedName).trim();
    if (!name) throw new Error('empty workflow name');
    return name;
  } catch (cause) {
    throw new IndrasNetProviderError(`Invalid IndrasNet workflow model id: ${model}`, {
      code: 'INVALID_INDRASNET_MODEL',
      retryable: false,
      cause,
    });
  }
};

export const imageModelFromWorkflowName = (workflowName: string): string =>
  `${INDRASNET_IMAGE_MODEL_PREFIX}${encodeURIComponent(workflowName)}`;

export const normalizeIndrasNetBaseUrl = (rawBaseUrl?: string): string => {
  const value = (rawBaseUrl || DEFAULT_INDRASNET_BASE_URL).trim().replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (cause) {
    throw new IndrasNetProviderError(`Invalid IndrasNet endpoint URL: ${value || '(empty)'}`, {
      code: 'INVALID_INDRASNET_ENDPOINT',
      retryable: false,
      cause,
    });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new IndrasNetProviderError('IndrasNet endpoint must use HTTP or HTTPS.', {
      code: 'INVALID_INDRASNET_ENDPOINT',
      retryable: false,
    });
  }
  return value;
};

const readErrorPayload = async (response: Response): Promise<ErrorPayload> => {
  try {
    return await response.json() as ErrorPayload;
  } catch {
    return {};
  }
};

const requestError = async (response: Response, action: string): Promise<IndrasNetProviderError> => {
  const payload = await readErrorPayload(response);
  const code = payload.code || (response.status === 401 || response.status === 403
    ? 'INDRASNET_AUTH_REJECTED'
    : `INDRASNET_HTTP_${response.status}`);
  const retryable = payload.retryable ?? response.status >= 500;
  return new IndrasNetProviderError(
    `${action} failed (${code}): ${payload.detail || `${response.status} ${response.statusText}`}`,
    { code, retryable, status: response.status },
  );
};

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number): Promise<Response> => {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (cause) {
    const timeout = cause instanceof DOMException && cause.name === 'TimeoutError';
    throw new IndrasNetProviderError(
      timeout
        ? `IndrasNet did not respond within ${Math.round(timeoutMs / 1000)} seconds.`
        : 'IndrasNet is unreachable from this device. Check Tailscale, the HTTPS endpoint, and the broker service.',
      { code: timeout ? 'INDRASNET_TIMEOUT' : 'COMFYUI_OFFLINE', retryable: true, cause },
    );
  }
};

export const fetchIndrasNetWorkflows = async (
  rawBaseUrl?: string,
  options: { force?: boolean } = {},
): Promise<IndrasNetWorkflowProfile[]> => {
  const baseUrl = normalizeIndrasNetBaseUrl(rawBaseUrl);
  const cached = catalogueCache.get(baseUrl);
  if (!options.force && cached && Date.now() - cached.fetchedAt < CATALOGUE_TTL_MS) {
    return cached.workflows;
  }

  const response = await fetchWithTimeout(
    `${baseUrl}/api/comfyui/workflows`,
    { method: 'GET', headers: { Accept: 'application/json' } },
    DISCOVERY_TIMEOUT_MS,
  );
  if (!response.ok) throw await requestError(response, 'IndrasNet workflow discovery');

  const payload = await response.json() as WorkflowCatalogueResponse;
  if (!Array.isArray(payload.workflows)) {
    throw new IndrasNetProviderError('IndrasNet returned a malformed workflow catalogue.', {
      code: 'INDRASNET_INVALID_RESPONSE',
      retryable: false,
    });
  }

  const workflows = payload.workflows.filter((entry): entry is IndrasNetWorkflowProfile => {
    const manifest = entry.manifest;
    return Boolean(
      entry.name &&
      entry.client_ready &&
      manifest?.client_ready &&
      !manifest.requires_image &&
      manifest.inputs?.prompt,
    );
  });
  catalogueCache.set(baseUrl, { fetchedAt: Date.now(), workflows });
  return workflows;
};

export interface GenerateIndrasNetImageInput {
  model: string;
  baseUrl?: string;
  prompt: string;
  negativePrompt?: string;
  seed?: number | null;
  width?: number;
  height?: number;
  guidanceScale?: number;
}

export interface GenerateIndrasNetImageOutput {
  base64: string;
  mimeType: string;
  promptId?: string;
  brokerTimingMs?: number;
}

export const generateIndrasNetImage = async (
  input: GenerateIndrasNetImageInput,
): Promise<GenerateIndrasNetImageOutput> => {
  const baseUrl = normalizeIndrasNetBaseUrl(input.baseUrl);
  const workflowName = workflowNameFromImageModel(input.model);
  const workflows = await fetchIndrasNetWorkflows(baseUrl);
  const workflow = workflows.find(candidate => candidate.name === workflowName);
  if (!workflow) {
    throw new IndrasNetProviderError(
      `Workflow "${workflowName}" is unavailable or lacks a client-ready semantic manifest. Refresh the provider list or register its manifest on IndrasNet.`,
      { code: 'WORKFLOW_MANIFEST_REQUIRED', retryable: false },
    );
  }

  const supportedInputs = workflow.manifest.inputs;
  const semanticValues: Record<string, string | number | undefined> = {
    prompt: input.prompt,
    negative_prompt: input.negativePrompt,
    seed: input.seed ?? undefined,
    width: input.width,
    height: input.height,
    guidance_scale: input.guidanceScale,
  };
  const body: Record<string, unknown> = { workflow_name: workflowName };
  for (const [name, value] of Object.entries(semanticValues)) {
    if (value !== undefined && supportedInputs[name]) body[name] = value;
  }

  console.info('[IndrasNetImageProvider] Submitting workflow', {
    endpoint: baseUrl,
    workflow: workflowName,
    promptLength: input.prompt.length,
    semanticInputs: Object.keys(body).filter(key => key !== 'workflow_name'),
  });
  const response = await fetchWithTimeout(
    `${baseUrl}/api/comfyui/run_workflow`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    GENERATION_TIMEOUT_MS,
  );
  if (!response.ok) throw await requestError(response, `IndrasNet workflow "${workflowName}"`);

  const result = await response.json() as RunWorkflowResponse;
  const imagePath = result.images?.[0];
  if (!imagePath) {
    throw new IndrasNetProviderError('IndrasNet completed the workflow but returned no image.', {
      code: 'INDRASNET_NO_IMAGE',
      retryable: true,
    });
  }

  const imageUrl = new URL(imagePath, `${baseUrl}/`).toString();
  const imageResponse = await fetchWithTimeout(
    imageUrl,
    { method: 'GET', headers: { Accept: 'image/*' } },
    DISCOVERY_TIMEOUT_MS,
  );
  if (!imageResponse.ok) throw await requestError(imageResponse, 'IndrasNet image download');

  const mimeType = imageResponse.headers.get('content-type') || 'image/png';
  const dataUrl = await blobToBase64DataUrl(await imageResponse.blob());
  const comma = dataUrl.indexOf(',');
  if (comma < 0) {
    throw new IndrasNetProviderError('Could not encode the IndrasNet image response.', {
      code: 'INDRASNET_INVALID_IMAGE',
      retryable: false,
    });
  }
  return {
    base64: dataUrl.slice(comma + 1),
    mimeType,
    promptId: result.prompt_id,
    brokerTimingMs: result.timing_ms,
  };
};

export const clearIndrasNetWorkflowCacheForTests = (): void => catalogueCache.clear();
