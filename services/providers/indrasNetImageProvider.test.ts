// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearIndrasNetWorkflowCacheForTests,
  DEFAULT_INDRASNET_BASE_URL,
  fetchIndrasNetWorkflows,
  generateIndrasNetImage,
  imageModelFromWorkflowName,
  IndrasNetProviderError,
  normalizeIndrasNetBaseUrl,
} from './indrasNetImageProvider';

const endpoint = 'https://asus-strix-scar.example.ts.net';
const clientReadyWorkflow = {
  name: 'storybook',
  client_ready: true,
  manifest: {
    name: 'storybook',
    display_name: 'Storybook XL',
    description: 'A custom workflow',
    client_ready: true,
    requires_image: false,
    inputs: {
      prompt: { node_id: '12', input_key: 'text', required: true },
      seed: { node_id: '18', input_key: 'seed' },
    },
  },
};

describe('IndrasNet image provider', () => {
  beforeEach(() => {
    clearIndrasNetWorkflowCacheForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the default endpoint when the saved endpoint contains only whitespace', () => {
    expect(normalizeIndrasNetBaseUrl('  \n  ')).toBe(DEFAULT_INDRASNET_BASE_URL);
  });

  it('rejects an HTTP endpoint as configuration error when the page uses HTTPS', () => {
    vi.stubGlobal('window', { location: { protocol: 'https:' } });

    expect(() => normalizeIndrasNetBaseUrl('http://100.81.65.74:7777')).toThrowError(
      expect.objectContaining({ code: 'INDRASNET_MIXED_CONTENT', retryable: false }),
    );
  });

  it('advertises only client-ready text-to-image workflows with prompt bindings', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      workflows: [
        clientReadyWorkflow,
        { ...clientReadyWorkflow, name: 'repaint', manifest: { ...clientReadyWorkflow.manifest, requires_image: true } },
        { ...clientReadyWorkflow, name: 'operator_only', client_ready: false },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const workflows = await fetchIndrasNetWorkflows(endpoint);

    expect(workflows.map(workflow => workflow.name)).toEqual(['storybook']);
  });

  it('reports invalid workflow-catalogue JSON as a descriptive provider error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>proxy error</html>', { status: 200 }));

    const error = await fetchIndrasNetWorkflows(endpoint).catch(cause => cause);

    expect(error).toBeInstanceOf(IndrasNetProviderError);
    expect(error).toMatchObject({ code: 'INDRASNET_INVALID_RESPONSE', retryable: false });
    expect(error.message).toContain('workflow discovery');
  });

  it('rejects a null workflow-catalogue envelope with a provider error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('null', { status: 200 }));

    const error = await fetchIndrasNetWorkflows(endpoint).catch(cause => cause);

    expect(error).toMatchObject({ code: 'INDRASNET_INVALID_RESPONSE', retryable: false });
    expect(error.message).toContain('expected a JSON object');
  });

  it('rejects null catalogue elements before inspecting their manifest', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      workflows: [null],
    }), { status: 200 }));

    const error = await fetchIndrasNetWorkflows(endpoint).catch(cause => cause);

    expect(error).toMatchObject({ code: 'INDRASNET_INVALID_RESPONSE', retryable: false });
    expect(error.message).toContain('workflow discovery');
  });

  it('submits only semantic inputs exposed by the workflow manifest and downloads the image', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ workflows: [clientReadyWorkflow] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        prompt_id: 'prompt-7',
        timing_ms: 4321,
        images: ['/api/comfyui/view?filename=result.png&type=output'],
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(new Blob(['image-bytes'], { type: 'image/png' }), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }));

    const result = await generateIndrasNetImage({
      model: imageModelFromWorkflowName('storybook'),
      baseUrl: endpoint,
      prompt: 'A moonlit library',
      negativePrompt: 'watermark',
      seed: 42,
      width: 1536,
      guidanceScale: 4.5,
    });

    const runRequest = fetchMock.mock.calls[1];
    expect(runRequest[0]).toBe(`${endpoint}/api/comfyui/run_workflow`);
    expect(JSON.parse(String(runRequest[1]?.body))).toEqual({
      workflow_name: 'storybook',
      prompt: 'A moonlit library',
      seed: 42,
    });
    expect(result).toMatchObject({ mimeType: 'image/png', promptId: 'prompt-7', brokerTimingMs: 4321 });
    expect(result.base64.length).toBeGreaterThan(0);
    expect(timeoutSpy.mock.calls.map(([timeoutMs]) => timeoutMs)).toEqual([10_000, 1_830_000, 60_000]);
  });

  it('preserves structured broker errors for explicit fallback decisions', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ workflows: [clientReadyWorkflow] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        detail: 'GPU lease is busy',
        code: 'GPU_BUSY',
        retryable: true,
      }), { status: 503 }));

    const error = await generateIndrasNetImage({
      model: imageModelFromWorkflowName('storybook'),
      baseUrl: endpoint,
      prompt: 'A lighthouse',
    }).catch(cause => cause);

    expect(error).toBeInstanceOf(IndrasNetProviderError);
    expect(error).toMatchObject({ code: 'GPU_BUSY', retryable: true, status: 503 });
  });

  it('does not infer fallback eligibility from an unstructured internal server error', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ workflows: [clientReadyWorkflow] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('internal failure', { status: 500 }));

    const error = await generateIndrasNetImage({
      model: imageModelFromWorkflowName('storybook'),
      baseUrl: endpoint,
      prompt: 'A lighthouse',
    }).catch(cause => cause);

    expect(error).toMatchObject({ code: 'INDRASNET_HTTP_500', retryable: false, status: 500 });
  });

  it('treats a null error envelope as an unstructured nonretryable server error', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ workflows: [clientReadyWorkflow] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('null', { status: 500, statusText: 'Internal Server Error' }));

    const error = await generateIndrasNetImage({
      model: imageModelFromWorkflowName('storybook'),
      baseUrl: endpoint,
      prompt: 'A lighthouse',
    }).catch(cause => cause);

    expect(error).toBeInstanceOf(IndrasNetProviderError);
    expect(error).toMatchObject({ code: 'INDRASNET_HTTP_500', retryable: false, status: 500 });
    expect(error.message).toContain('500 Internal Server Error');
  });

  it('treats an unstructured gateway timeout as an availability failure', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ workflows: [clientReadyWorkflow] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('gateway timeout', { status: 504 }));

    const error = await generateIndrasNetImage({
      model: imageModelFromWorkflowName('storybook'),
      baseUrl: endpoint,
      prompt: 'A lighthouse',
    }).catch(cause => cause);

    expect(error).toMatchObject({ code: 'INDRASNET_HTTP_504', retryable: true, status: 504 });
  });

  it('does not fallback when a completed workflow returns no image', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ workflows: [clientReadyWorkflow] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ prompt_id: 'prompt-without-output' }), { status: 200 }));

    const error = await generateIndrasNetImage({
      model: imageModelFromWorkflowName('storybook'),
      baseUrl: endpoint,
      prompt: 'A lighthouse',
    }).catch(cause => cause);

    expect(error).toMatchObject({ code: 'INDRASNET_NO_IMAGE', retryable: false });
  });

  it('reports invalid workflow-result JSON without authorizing fallback', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ workflows: [clientReadyWorkflow] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('<html>proxy error</html>', { status: 200 }));

    const error = await generateIndrasNetImage({
      model: imageModelFromWorkflowName('storybook'),
      baseUrl: endpoint,
      prompt: 'A lighthouse',
    }).catch(cause => cause);

    expect(error).toMatchObject({ code: 'INDRASNET_INVALID_RESPONSE', retryable: false });
    expect(error.message).toContain('workflow "storybook"');
  });

  it('rejects a null workflow-result envelope without authorizing fallback', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ workflows: [clientReadyWorkflow] }), { status: 200 }))
      .mockResolvedValueOnce(new Response('null', { status: 200 }));

    const error = await generateIndrasNetImage({
      model: imageModelFromWorkflowName('storybook'),
      baseUrl: endpoint,
      prompt: 'A lighthouse',
    }).catch(cause => cause);

    expect(error).toMatchObject({ code: 'INDRASNET_INVALID_RESPONSE', retryable: false });
    expect(error.message).toContain('expected a JSON object');
  });

  it('rejects non-string workflow image entries without authorizing fallback', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ workflows: [clientReadyWorkflow] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ images: [{}] }), { status: 200 }));

    const error = await generateIndrasNetImage({
      model: imageModelFromWorkflowName('storybook'),
      baseUrl: endpoint,
      prompt: 'A lighthouse',
    }).catch(cause => cause);

    expect(error).toMatchObject({ code: 'INDRASNET_INVALID_RESPONSE', retryable: false });
  });

  it('wraps malformed artifact URLs in a descriptive provider error', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ workflows: [clientReadyWorkflow] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ images: ['http://[invalid'] }), { status: 200 }));

    const error = await generateIndrasNetImage({
      model: imageModelFromWorkflowName('storybook'),
      baseUrl: endpoint,
      prompt: 'A lighthouse',
    }).catch(cause => cause);

    expect(error).toBeInstanceOf(IndrasNetProviderError);
    expect(error).toMatchObject({ code: 'INDRASNET_INVALID_ARTIFACT_URL', retryable: false });
    expect(error.message).toContain('workflow "storybook"');
  });

  it('rejects artifact URLs outside the configured broker origin', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ workflows: [clientReadyWorkflow] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ images: ['https://untrusted.example/image.png'] }), {
        status: 200,
      }));

    const error = await generateIndrasNetImage({
      model: imageModelFromWorkflowName('storybook'),
      baseUrl: endpoint,
      prompt: 'A lighthouse',
    }).catch(cause => cause);

    expect(error).toMatchObject({ code: 'INDRASNET_INVALID_ARTIFACT_URL', retryable: false });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps HTTP artifact download failures out of cloud fallback', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ workflows: [clientReadyWorkflow] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ images: ['/api/comfyui/view?filename=result.png'] }), {
        status: 200,
      }))
      .mockResolvedValueOnce(new Response('gateway timeout', { status: 504 }));

    const error = await generateIndrasNetImage({
      model: imageModelFromWorkflowName('storybook'),
      baseUrl: endpoint,
      prompt: 'A lighthouse',
    }).catch(cause => cause);

    expect(error).toMatchObject({ code: 'INDRASNET_HTTP_504', retryable: false, status: 504 });
  });

  it('keeps artifact body-read failures out of cloud fallback', async () => {
    const imageResponse = new Response(new Blob(['image-bytes'], { type: 'image/png' }), { status: 200 });
    vi.spyOn(imageResponse, 'blob').mockRejectedValue(new DOMException('stream aborted', 'AbortError'));
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ workflows: [clientReadyWorkflow] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ images: ['/api/comfyui/view?filename=result.png'] }), {
        status: 200,
      }))
      .mockResolvedValueOnce(imageResponse);

    const error = await generateIndrasNetImage({
      model: imageModelFromWorkflowName('storybook'),
      baseUrl: endpoint,
      prompt: 'A lighthouse',
    }).catch(cause => cause);

    expect(error).toMatchObject({ code: 'INDRASNET_IMAGE_DOWNLOAD_FAILED', retryable: false });
  });

  it('rejects an HTML artifact body returned with HTTP 200', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ workflows: [clientReadyWorkflow] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ images: ['/api/comfyui/view?filename=result.png'] }), {
        status: 200,
      }))
      .mockResolvedValueOnce(new Response('<html>sign in</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }));

    const error = await generateIndrasNetImage({
      model: imageModelFromWorkflowName('storybook'),
      baseUrl: endpoint,
      prompt: 'A lighthouse',
    }).catch(cause => cause);

    expect(error).toMatchObject({ code: 'INDRASNET_INVALID_IMAGE', retryable: false });
    expect(error.message).toContain('text/html');
  });

  it('rejects an empty image artifact returned with HTTP 200', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ workflows: [clientReadyWorkflow] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ images: ['/api/comfyui/view?filename=result.png'] }), {
        status: 200,
      }))
      .mockResolvedValueOnce(new Response(new Uint8Array(0), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }));

    const error = await generateIndrasNetImage({
      model: imageModelFromWorkflowName('storybook'),
      baseUrl: endpoint,
      prompt: 'A lighthouse',
    }).catch(cause => cause);

    expect(error).toMatchObject({ code: 'INDRASNET_INVALID_IMAGE', retryable: false });
    expect(error.message).toContain('0 bytes');
  });
});
