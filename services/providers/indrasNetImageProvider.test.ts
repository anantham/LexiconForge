// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearIndrasNetWorkflowCacheForTests,
  fetchIndrasNetWorkflows,
  generateIndrasNetImage,
  imageModelFromWorkflowName,
  IndrasNetProviderError,
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

  afterEach(() => vi.restoreAllMocks());

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

  it('submits only semantic inputs exposed by the workflow manifest and downloads the image', async () => {
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
});
