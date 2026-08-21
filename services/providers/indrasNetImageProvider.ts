import { blobToBase64DataUrl } from '../imageUtils';
import { debugLog } from '../../utils/debug';
import type { ImageJobLifecycleListener } from '../imageJobTypes';

export const INDRASNET_IMAGE_MODEL_PREFIX = 'indrasnet/';
export const DEFAULT_INDRASNET_BASE_URL = 'https://asus-strix-scar.tail4741ad.ts.net:9443';

const DISCOVERY_TIMEOUT_MS = 10_000;
const GENERATION_TIMEOUT_MS = 1_830_000;
const JOB_SUBMIT_TIMEOUT_MS = 30_000;
const JOB_POLL_TIMEOUT_MS = 10_000;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 60_000;
const CATALOGUE_TTL_MS = 60_000;
const UNSTRUCTURED_GATEWAY_AVAILABILITY_STATUSES = new Set([502, 504]);
const RETRYABLE_ARTIFACT_HTTP_STATUSES = new Set([408, 425, 429]);
const RETRYABLE_JOB_POLL_HTTP_STATUSES = new Set([401, 403, 408, 425, 429]);

export interface IndrasNetSemanticInput {
  required?: boolean;
}

export interface IndrasNetWorkflowManifest {
  name: string;
  display_name: string;
  description?: string;
  client_ready: boolean;
  requires_image: boolean;
  inputs: Record<string, IndrasNetSemanticInput>;
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
  workflows?: unknown;
}

interface RunWorkflowResponse {
  prompt_id?: string;
  timing_ms?: number;
  images?: string[];
}

interface SubmitJobResponse {
  job_id?: string;
  status?: string;
}

interface JobStatusResponse extends RunWorkflowResponse {
  job_id?: string;
  status?: string;
  error?: {
    detail?: string;
    code?: string;
    retryable?: boolean;
    http_status?: number;
  };
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export class IndrasNetProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly fallbackEligible: boolean;
  readonly status?: number;

  constructor(message: string, options: {
    code: string;
    retryable: boolean;
    fallbackEligible?: boolean;
    status?: number;
    cause?: unknown;
  }) {
    super(message, { cause: options.cause });
    this.name = 'IndrasNetProviderError';
    this.code = options.code;
    this.retryable = options.retryable;
    this.fallbackEligible = options.fallbackEligible !== false;
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
  const trimmedBaseUrl = rawBaseUrl?.trim();
  const value = (trimmedBaseUrl || DEFAULT_INDRASNET_BASE_URL).replace(/\/+$/, '');
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
  if (parsed.protocol === 'http:' && typeof window !== 'undefined' && window.location.protocol === 'https:') {
    throw new IndrasNetProviderError(
      'An HTTP IndrasNet endpoint cannot be used from this HTTPS page. Configure the Tailscale Serve HTTPS endpoint instead.',
      { code: 'INDRASNET_MIXED_CONTENT', retryable: false },
    );
  }
  return value;
};

const readErrorPayload = async (response: Response): Promise<ErrorPayload> => {
  try {
    const decoded = await response.json() as unknown;
    if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) return {};
    const candidate = decoded as Record<string, unknown>;
    return {
      detail: typeof candidate.detail === 'string' ? candidate.detail : undefined,
      code: typeof candidate.code === 'string' ? candidate.code : undefined,
      retryable: typeof candidate.retryable === 'boolean' ? candidate.retryable : undefined,
    };
  } catch {
    return {};
  }
};

const invalidJsonResponseError = (context: string, cause?: unknown): IndrasNetProviderError =>
  new IndrasNetProviderError(
    `IndrasNet returned an invalid response for ${context}; expected a JSON object from the broker API.`,
    { code: 'INDRASNET_INVALID_RESPONSE', retryable: false, cause },
  );

const ambiguousJobPollResponseError = (jobId: string, cause?: unknown): IndrasNetProviderError =>
  new IndrasNetProviderError(
    `IndrasNet returned an ambiguous response while checking accepted workflow job ${jobId}; the saved task ID was preserved for a later retry.`,
    {
      code: 'INDRASNET_INVALID_RESPONSE',
      retryable: true,
      fallbackEligible: false,
      cause,
    },
  );

const CLIENT_SEMANTIC_INPUTS = [
  'prompt',
  'negative_prompt',
  'seed',
  'width',
  'height',
  'guidance_scale',
] as const;

const toClientReadyWorkflow = (entry: unknown): IndrasNetWorkflowProfile | null => {
  if (!isRecord(entry)) return null;
  const manifest = entry.manifest;
  if (!isRecord(manifest) || !isRecord(manifest.inputs) || !isRecord(manifest.inputs.prompt)) {
    return null;
  }
  const canonicalName = typeof entry.name === 'string' ? entry.name.trim() : '';
  if (
    !canonicalName || entry.name !== canonicalName ||
    entry.client_ready !== true ||
    manifest.name !== canonicalName ||
    typeof manifest.display_name !== 'string' ||
    manifest.client_ready !== true ||
    manifest.requires_image !== false
  ) return null;

  for (const [semanticName, rawInput] of Object.entries(manifest.inputs)) {
    if (!isRecord(rawInput)) return null;
    if (rawInput.required === true && semanticName !== 'prompt') return null;
  }

  const inputs: Record<string, IndrasNetSemanticInput> = {};
  for (const semanticName of CLIENT_SEMANTIC_INPUTS) {
    const rawInput = manifest.inputs[semanticName];
    if (rawInput === undefined) continue;
    if (!isRecord(rawInput)) return null;
    inputs[semanticName] = rawInput.required === true ? { required: true } : {};
  }
  if (!inputs.prompt) return null;

  return {
    name: canonicalName,
    client_ready: true,
    manifest: {
      name: canonicalName,
      display_name: manifest.display_name,
      ...(typeof manifest.description === 'string' ? { description: manifest.description } : {}),
      client_ready: true,
      requires_image: false,
      inputs,
    },
  };
};

const readJsonObjectResponse = async <T extends object>(response: Response, context: string): Promise<T> => {
  let decoded: unknown;
  try {
    decoded = await response.json();
  } catch (cause) {
    throw invalidJsonResponseError(context, cause);
  }
  if (!isRecord(decoded)) {
    throw invalidJsonResponseError(context);
  }
  return decoded as T;
};

const requestError = async (
  response: Response,
  action: string,
  options: { retryable?: boolean; fallbackEligible?: boolean } = {},
): Promise<IndrasNetProviderError> => {
  const payload = await readErrorPayload(response);
  const code = payload.code || (response.status === 401 || response.status === 403
    ? 'INDRASNET_AUTH_REJECTED'
    : `INDRASNET_HTTP_${response.status}`);
  const retryable = options.retryable ?? (
    payload.retryable === true
    || (payload.retryable === undefined
      && !payload.code
      && UNSTRUCTURED_GATEWAY_AVAILABILITY_STATUSES.has(response.status))
  );
  return new IndrasNetProviderError(
    `${action} failed (${code}): ${payload.detail || `${response.status} ${response.statusText}`}`,
    { code, retryable, fallbackEligible: options.fallbackEligible, status: response.status },
  );
};

interface FetchFailurePolicy {
  retryable?: boolean;
  fallbackEligible?: boolean;
  timeoutCode?: string;
  unreachableCode?: string;
  timeoutMessage?: string;
  unreachableMessage?: string;
}

const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number,
  policy: FetchFailurePolicy = {},
): Promise<Response> => {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (cause) {
    const timeout = cause instanceof DOMException && cause.name === 'TimeoutError';
    throw new IndrasNetProviderError(
      timeout
        ? policy.timeoutMessage || `IndrasNet did not respond within ${Math.round(timeoutMs / 1000)} seconds.`
        : policy.unreachableMessage || 'IndrasNet is unreachable from this device. Check Tailscale, the HTTPS endpoint, and the broker service.',
      {
        code: timeout ? policy.timeoutCode || 'INDRASNET_TIMEOUT' : policy.unreachableCode || 'COMFYUI_OFFLINE',
        retryable: policy.retryable ?? true,
        fallbackEligible: policy.fallbackEligible,
        cause,
      },
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

  const payload = await readJsonObjectResponse<WorkflowCatalogueResponse>(response, 'workflow discovery');
  if (!Array.isArray(payload.workflows)) {
    throw new IndrasNetProviderError('IndrasNet returned a malformed workflow catalogue.', {
      code: 'INDRASNET_INVALID_RESPONSE',
      retryable: false,
    });
  }

  const entries = payload.workflows as unknown[];
  if (entries.some(entry => !isRecord(entry))) {
    throw invalidJsonResponseError('workflow discovery');
  }

  const workflows = entries
    .map(toClientReadyWorkflow)
    .filter((workflow): workflow is IndrasNetWorkflowProfile => workflow !== null);
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
  onJobEvent?: ImageJobLifecycleListener;
}

export interface GenerateIndrasNetImageOutput {
  base64: string;
  mimeType: string;
  promptId?: string;
  brokerTimingMs?: number;
  executionDurationMs?: number;
  /** True only when this polling session observed queued before running. */
  executionTimingComplete?: boolean;
}

interface PolledIndrasNetJob {
  result: RunWorkflowResponse;
  executionDurationMs?: number;
  executionTimingComplete: boolean;
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

  debugLog('image', 'full', '[IndrasNetImageProvider] Submitting workflow', {
    endpoint: baseUrl,
    workflow: workflowName,
    promptLength: input.prompt.length,
    semanticInputs: Object.keys(body).filter(key => key !== 'workflow_name'),
  });
  let response = await fetchWithTimeout(
    `${baseUrl}/api/comfyui/jobs`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    JOB_SUBMIT_TIMEOUT_MS,
    {
      // Fetch cannot distinguish a request that never reached the broker from
      // one that was accepted before the response timed out/disconnected.
      // Starting a cloud fallback here could duplicate already-running work.
      fallbackEligible: false,
    },
  );
  let result: RunWorkflowResponse;
  let executionDurationMs: number | undefined;
  if (response.status === 404) {
    // Rollout compatibility: an older broker cannot have accepted a job at a
    // missing route, so falling back to the blocking endpoint cannot duplicate
    // GPU work. This path intentionally has no reload recovery.
    response = await fetchWithTimeout(
      `${baseUrl}/api/comfyui/run_workflow`,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      GENERATION_TIMEOUT_MS,
    );
    if (!response.ok) throw await requestError(response, `IndrasNet workflow "${workflowName}"`);
    result = await readJsonObjectResponse<RunWorkflowResponse>(response, `workflow "${workflowName}"`);
  } else {
    if (!response.ok) throw await requestError(response, `IndrasNet workflow job "${workflowName}"`);
    const submitted = await readJsonObjectResponse<SubmitJobResponse>(response, `workflow job "${workflowName}"`);
    const jobId = submitted.job_id?.trim();
    if (!jobId) throw invalidJsonResponseError(`workflow job "${workflowName}"`);
    input.onJobEvent?.({
      type: 'submitted',
      externalTaskId: jobId,
      resumeKind: 'indrasnet',
      brokerBaseUrl: baseUrl,
    });
    const polled = await pollIndrasNetJob(baseUrl, jobId, input.onJobEvent);
    result = polled.result;
    executionDurationMs = polled.executionDurationMs;
  }
  const output = await downloadIndrasNetResult(baseUrl, workflowName, result);
  return executionDurationMs === undefined ? output : { ...output, executionDurationMs };
};

export interface ResumeIndrasNetImageTaskInput {
  baseUrl?: string;
  jobId: string;
  workflowName: string;
  onJobEvent?: ImageJobLifecycleListener;
}

export const resumeIndrasNetImageTask = async (
  input: ResumeIndrasNetImageTaskInput,
): Promise<GenerateIndrasNetImageOutput> => {
  const baseUrl = normalizeIndrasNetBaseUrl(input.baseUrl);
  const polled = await pollIndrasNetJob(baseUrl, input.jobId, input.onJobEvent);
  const output = await downloadIndrasNetResult(baseUrl, input.workflowName, polled.result);
  return {
    ...output,
    ...(polled.executionDurationMs === undefined ? {} : { executionDurationMs: polled.executionDurationMs }),
    executionTimingComplete: polled.executionTimingComplete,
  };
};

const pollIndrasNetJob = async (
  baseUrl: string,
  jobId: string,
  onJobEvent?: ImageJobLifecycleListener,
): Promise<PolledIndrasNetJob> => {
  const deadline = Date.now() + GENERATION_TIMEOUT_MS;
  let executionStartedAt: number | undefined;
  let queuedObserved = false;
  while (Date.now() < deadline) {
    const response = await fetchWithTimeout(
      `${baseUrl}/api/comfyui/jobs/${encodeURIComponent(jobId)}`,
      { method: 'GET', headers: { Accept: 'application/json' } },
      JOB_POLL_TIMEOUT_MS,
    );
    if (!response.ok) {
      throw await requestError(response, `IndrasNet workflow job ${jobId}`, {
        // Once a durable task has been accepted, transient/auth polling
        // failures must preserve its ID. Explicit job failure and missing-job
        // responses remain terminal through the normal status/404 paths.
        retryable: RETRYABLE_JOB_POLL_HTTP_STATUSES.has(response.status) || response.status >= 500,
      });
    }
    const job = await readJsonObjectResponse<JobStatusResponse>(response, `workflow job ${jobId}`)
      .catch(cause => { throw ambiguousJobPollResponseError(jobId, cause); });
    const status = job.status?.toLowerCase();
    if (status === 'completed') {
      const terminalObservedAt = performance.now();
      return {
        result: job,
        executionTimingComplete: queuedObserved && executionStartedAt !== undefined,
        ...(executionStartedAt === undefined
          ? {}
          : { executionDurationMs: Math.max(0, terminalObservedAt - executionStartedAt) }),
      };
    }
    if (status === 'failed') {
      throw new IndrasNetProviderError(
        job.error?.detail || `IndrasNet workflow job ${jobId} failed.`,
        {
          code: job.error?.code || 'INDRASNET_JOB_FAILED',
          // The accepted task ID is terminal regardless of whether the
          // broker thinks a brand-new user submission might succeed.
          retryable: false,
          status: job.error?.http_status,
        },
      );
    }
    if (status !== 'queued' && status !== 'running') {
      throw ambiguousJobPollResponseError(jobId);
    }
    if (status === 'running') {
      if (executionStartedAt === undefined) executionStartedAt = performance.now();
      onJobEvent?.({ type: 'running' });
    } else {
      queuedObserved = true;
      // Re-emitting submitted preserves the already-accepted durable ID while
      // keeping the client in the honest provider-queued state.
      onJobEvent?.({
        type: 'submitted',
        externalTaskId: jobId,
        resumeKind: 'indrasnet',
        brokerBaseUrl: baseUrl,
      });
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new IndrasNetProviderError(
    `IndrasNet workflow job ${jobId} did not complete within ${Math.round(GENERATION_TIMEOUT_MS / 1000)} seconds.`,
    { code: 'INDRASNET_TIMEOUT', retryable: true },
  );
};

const downloadIndrasNetResult = async (
  baseUrl: string,
  workflowName: string,
  result: RunWorkflowResponse,
): Promise<GenerateIndrasNetImageOutput> => {
  if (result.images !== undefined && (
    !Array.isArray(result.images)
    || !result.images.every(image => typeof image === 'string')
  )) {
    throw invalidJsonResponseError(`workflow "${workflowName}"`);
  }
  const imagePath = result.images?.[0]?.trim();
  if (!imagePath) {
    throw new IndrasNetProviderError('IndrasNet completed the workflow but returned no image.', {
      code: 'INDRASNET_NO_IMAGE',
      retryable: false,
    });
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(imagePath, `${baseUrl}/`);
  } catch (cause) {
    throw new IndrasNetProviderError(
      `IndrasNet workflow "${workflowName}" returned an invalid image artifact URL.`,
      { code: 'INDRASNET_INVALID_ARTIFACT_URL', retryable: false, cause },
    );
  }
  if (imageUrl.origin !== new URL(baseUrl).origin) {
    throw new IndrasNetProviderError(
      `IndrasNet workflow "${workflowName}" returned an image artifact URL outside the configured broker origin.`,
      { code: 'INDRASNET_INVALID_ARTIFACT_URL', retryable: false },
    );
  }
  const imageResponse = await fetchWithTimeout(
    imageUrl.toString(),
    { method: 'GET', headers: { Accept: 'image/*' } },
    IMAGE_DOWNLOAD_TIMEOUT_MS,
    {
      retryable: true,
      fallbackEligible: false,
      timeoutCode: 'INDRASNET_IMAGE_DOWNLOAD_TIMEOUT',
      unreachableCode: 'INDRASNET_IMAGE_DOWNLOAD_FAILED',
      timeoutMessage: 'IndrasNet completed the workflow, but the image download did not finish within 60 seconds.',
      unreachableMessage: 'IndrasNet completed the workflow, but the image could not be downloaded from this device.',
    },
  );
  if (!imageResponse.ok) {
    const retryable = RETRYABLE_ARTIFACT_HTTP_STATUSES.has(imageResponse.status)
      || imageResponse.status >= 500;
    throw await requestError(imageResponse, 'IndrasNet image download', {
      retryable,
      fallbackEligible: false,
    });
  }

  const mimeType = imageResponse.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() || '';
  let imageBlob: Blob;
  try {
    imageBlob = await imageResponse.blob();
  } catch (cause) {
    throw new IndrasNetProviderError(
      'IndrasNet completed the workflow, but reading the downloaded image failed.',
      {
        code: 'INDRASNET_IMAGE_DOWNLOAD_FAILED',
        retryable: true,
        fallbackEligible: false,
        cause,
      },
    );
  }
  if (!mimeType.startsWith('image/') || imageBlob.size === 0) {
    throw new IndrasNetProviderError(
      `IndrasNet returned an invalid image artifact (${mimeType || 'missing content type'}, ${imageBlob.size} bytes).`,
      { code: 'INDRASNET_INVALID_IMAGE', retryable: false },
    );
  }

  let dataUrl: string;
  try {
    dataUrl = await blobToBase64DataUrl(imageBlob);
  } catch (cause) {
    throw new IndrasNetProviderError(
      'IndrasNet completed the workflow, but encoding the downloaded image failed.',
      { code: 'INDRASNET_INVALID_IMAGE', retryable: false, cause },
    );
  }
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
