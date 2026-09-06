const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 35 * 60 * 1000;

export class BrokerJobError extends Error {
    constructor(message, { code = 'BROKER_ERROR', retryable = false, status = null } = {}) {
        super(message);
        this.name = 'BrokerJobError';
        this.code = code;
        this.retryable = retryable;
        this.status = status;
    }
}

function normalizeBaseUrl(value) {
    if (!value?.trim()) {
        throw new BrokerJobError('Configure your IndrasNet broker URL in extension settings', {
            code: 'BROKER_ENDPOINT_REQUIRED',
        });
    }
    let url;
    try {
        url = new URL(value);
    } catch {
        throw new TypeError('IndrasNet broker URL must be a valid HTTP(S) URL');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new TypeError('IndrasNet broker URL must use HTTP(S)');
    }
    if (url.username || url.password) {
        throw new TypeError('IndrasNet broker URL must not contain credentials');
    }
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
}

async function readJson(response) {
    try {
        return await response.json();
    } catch {
        throw new BrokerJobError('IndrasNet returned an unreadable response', {
            code: 'BROKER_BAD_RESPONSE',
            status: response.status,
        });
    }
}

function errorFromResponse(response, body) {
    return new BrokerJobError(body?.detail || `IndrasNet request failed (${response.status})`, {
        code: body?.code || `BROKER_HTTP_${response.status}`,
        retryable: Boolean(body?.retryable),
        status: response.status,
    });
}

export function createBrokerClient({
    baseUrl,
    fetchImpl = globalThis.fetch,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    now = () => Date.now(),
} = {}) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    if (typeof fetchImpl !== 'function') {
        throw new TypeError('A fetch implementation is required');
    }

    async function request(path, options) {
        let response;
        try {
            response = await fetchImpl(`${normalizedBaseUrl}${path}`, options);
        } catch (error) {
            throw new BrokerJobError('IndrasNet broker is unreachable', {
                code: 'BROKER_OFFLINE',
                retryable: true,
                cause: error,
            });
        }
        const body = await readJson(response);
        if (!response.ok) throw errorFromResponse(response, body);
        return body;
    }

    async function listWorkflows({ signal } = {}) {
        const body = await request('/api/comfyui/workflows', { signal });
        if (!Array.isArray(body.workflows)) {
            throw new BrokerJobError('IndrasNet workflow catalogue is malformed', {
                code: 'BROKER_BAD_RESPONSE',
            });
        }
        return body.workflows.filter((workflow) => workflow?.client_ready && workflow?.name);
    }

    async function run({
        workflowName,
        prompt,
        negativePrompt = '',
        pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        onState = () => {},
        signal,
    }) {
        const submitted = await request('/api/comfyui/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                workflow_name: workflowName,
                prompt,
                negative_prompt: negativePrompt,
                timeout_seconds: 1800,
                gpu_wait_timeout_seconds: 300,
            }),
            signal,
        });
        if (!submitted.job_id) {
            throw new BrokerJobError('IndrasNet did not return a job ID', {
                code: 'BROKER_BAD_RESPONSE',
            });
        }

        const startedAt = now();
        let job = submitted;
        let previousStatus;
        while (true) {
            if (job.status !== previousStatus) {
                onState({ ...job, elapsedMs: now() - startedAt });
                previousStatus = job.status;
            }
            if (job.status === 'completed') {
                const relativeImageUrl = job.images?.[0];
                if (!relativeImageUrl) {
                    throw new BrokerJobError('IndrasNet completed the job without an image', {
                        code: 'BROKER_IMAGE_MISSING',
                    });
                }
                return {
                    jobId: job.job_id,
                    promptId: job.prompt_id || null,
                    timingMs: job.timing_ms ?? null,
                    imageUrl: new URL(relativeImageUrl, `${normalizedBaseUrl}/`).toString(),
                };
            }
            if (job.status === 'failed') {
                throw new BrokerJobError(job.error?.detail || 'IndrasNet image job failed', {
                    code: job.error?.code || 'BROKER_JOB_FAILED',
                    retryable: Boolean(job.error?.retryable),
                    status: job.error?.http_status ?? null,
                });
            }
            if (!['queued', 'running'].includes(job.status)) {
                throw new BrokerJobError(`IndrasNet returned unknown job state: ${String(job.status)}`, {
                    code: 'BROKER_BAD_RESPONSE',
                });
            }
            if (now() - startedAt >= timeoutMs) {
                throw new BrokerJobError('Timed out waiting for the IndrasNet image job', {
                    code: 'BROKER_CLIENT_TIMEOUT',
                    retryable: true,
                });
            }
            await sleep(pollIntervalMs);
            job = await request(`/api/comfyui/jobs/${encodeURIComponent(submitted.job_id)}`, { signal });
        }
    }

    return { listWorkflows, run };
}
