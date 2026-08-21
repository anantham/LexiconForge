/**
 * Test intent:
 * - New brokers return a durable job id before completion and the client polls it.
 * - Reload recovery polls the existing broker job without submitting a new workflow.
 * - A 404 from an older broker safely falls back to the blocking endpoint because no job was accepted.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/imageUtils', () => ({
  blobToBase64DataUrl: vi.fn().mockResolvedValue('data:image/png;base64,aW1hZ2U='),
}));

vi.mock('../../utils/debug', () => ({ debugLog: vi.fn() }));

import {
  clearIndrasNetWorkflowCacheForTests,
  generateIndrasNetImage,
  resumeIndrasNetImageTask,
} from '../../services/providers/indrasNetImageProvider';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const image = () => new Response(new Uint8Array([1, 2, 3]), {
  status: 200,
  headers: { 'Content-Type': 'image/png' },
});

const catalogue = {
  workflows: [{
    name: 'gen_anime',
    client_ready: true,
    manifest: {
      name: 'gen_anime',
      display_name: 'Anime',
      client_ready: true,
      requires_image: false,
      inputs: { prompt: { required: true } },
    },
  }],
};

describe('IndrasNet resumable image jobs', () => {
  beforeEach(() => {
    clearIndrasNetWorkflowCacheForTests();
    vi.restoreAllMocks();
  });

  it('submits a broker job, exposes its durable id, then downloads completion', async () => {
    const events: unknown[] = [];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(catalogue))
      .mockResolvedValueOnce(json({ job_id: 'broker-job-1', status: 'queued' }, 202))
      .mockResolvedValueOnce(json({
        job_id: 'broker-job-1',
        status: 'completed',
        prompt_id: 'comfy-prompt-1',
        timing_ms: 8000,
        images: ['/api/comfyui/view?filename=result.png&type=output'],
      }))
      .mockResolvedValueOnce(image());
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateIndrasNetImage({
      model: 'indrasnet/gen_anime',
      baseUrl: 'https://asus.example',
      prompt: 'a blue dragon',
      onJobEvent: event => events.push(event),
    });

    expect(events).toContainEqual({
      type: 'submitted',
      externalTaskId: 'broker-job-1',
      resumeKind: 'indrasnet',
      brokerBaseUrl: 'https://asus.example',
    });
    expect(result).toMatchObject({ base64: 'aW1hZ2U=', mimeType: 'image/png', promptId: 'comfy-prompt-1', brokerTimingMs: 8000 });
    expect(fetchMock.mock.calls[1][0]).toBe('https://asus.example/api/comfyui/jobs');
    expect(fetchMock.mock.calls[2][0]).toBe('https://asus.example/api/comfyui/jobs/broker-job-1');
  });

  it('resumes by polling the existing job without posting a workflow', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({
        job_id: 'saved-job',
        status: 'completed',
        prompt_id: 'comfy-prompt-2',
        images: ['/api/comfyui/view?filename=recovered.png&type=output'],
      }))
      .mockResolvedValueOnce(image());
    vi.stubGlobal('fetch', fetchMock);

    const result = await resumeIndrasNetImageTask({
      baseUrl: 'https://asus.example',
      jobId: 'saved-job',
      workflowName: 'gen_anime',
    });

    expect(result.promptId).toBe('comfy-prompt-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]?.method).toBe('GET');
  });

  it('falls back to the old blocking route only when the jobs route is absent', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(catalogue))
      .mockResolvedValueOnce(json({ detail: 'Not Found' }, 404))
      .mockResolvedValueOnce(json({
        prompt_id: 'legacy-prompt',
        timing_ms: 9000,
        images: ['/api/comfyui/view?filename=legacy.png&type=output'],
      }))
      .mockResolvedValueOnce(image());
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateIndrasNetImage({
      model: 'indrasnet/gen_anime',
      baseUrl: 'https://asus.example',
      prompt: 'legacy broker request',
    });

    expect(result.promptId).toBe('legacy-prompt');
    expect(fetchMock.mock.calls[2][0]).toBe('https://asus.example/api/comfyui/run_workflow');
  });
});
