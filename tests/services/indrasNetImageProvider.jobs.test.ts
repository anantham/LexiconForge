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

  it('stops execution timing at terminal status before artifact download', async () => {
    vi.useFakeTimers();
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(6_000);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ job_id: 'timed-job', status: 'running' }))
      .mockResolvedValueOnce(json({
        job_id: 'timed-job',
        status: 'completed',
        images: ['/api/comfyui/view?filename=timed.png&type=output'],
      }))
      .mockResolvedValueOnce(image());
    vi.stubGlobal('fetch', fetchMock);

    const recovery = resumeIndrasNetImageTask({
      baseUrl: 'https://asus.example',
      jobId: 'timed-job',
      workflowName: 'gen_anime',
    });
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await recovery;

    expect(result.executionDurationMs).toBe(5_000);
    expect(result.executionTimingComplete).toBe(false);
    vi.useRealTimers();
  });

  it('marks recovered execution timing complete only after queued to running to terminal', async () => {
    vi.useFakeTimers();
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(2_000)
      .mockReturnValueOnce(9_000);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(json({ job_id: 'fully-observed-job', status: 'queued' }))
      .mockResolvedValueOnce(json({ job_id: 'fully-observed-job', status: 'running' }))
      .mockResolvedValueOnce(json({
        job_id: 'fully-observed-job',
        status: 'completed',
        images: ['/api/comfyui/view?filename=observed.png&type=output'],
      }))
      .mockResolvedValueOnce(image()));

    const recovery = resumeIndrasNetImageTask({
      baseUrl: 'https://asus.example',
      jobId: 'fully-observed-job',
      workflowName: 'gen_anime',
    });
    await vi.advanceTimersByTimeAsync(4_000);
    const result = await recovery;

    expect(result).toMatchObject({
      executionDurationMs: 7_000,
      executionTimingComplete: true,
    });
    vi.useRealTimers();
  });

  it.each([401, 403, 408, 425, 429, 500, 503])(
    'preserves an accepted broker task after transient poll HTTP %s',
    async status => {
      const fetchMock = vi.fn().mockResolvedValueOnce(json({ detail: 'temporary poll failure' }, status));
      vi.stubGlobal('fetch', fetchMock);

      const error = await resumeIndrasNetImageTask({
        baseUrl: 'https://asus.example',
        jobId: 'saved-transient-job',
        workflowName: 'gen_anime',
      }).catch(cause => cause);

      expect(error).toMatchObject({ retryable: true, status });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1]?.method).toBe('GET');
    },
  );

  it('retires an accepted broker task when the poll route reports it missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ detail: 'job not found' }, 404)));

    const error = await resumeIndrasNetImageTask({
      baseUrl: 'https://asus.example',
      jobId: 'missing-job',
      workflowName: 'gen_anime',
    }).catch(cause => cause);

    expect(error).toMatchObject({ retryable: false, status: 404 });
  });

  it('retires every explicit failed broker task even when a new submission may be retryable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({
      job_id: 'failed-job',
      status: 'failed',
      error: {
        code: 'COMFYUI_EXECUTION_FAILED',
        detail: 'model load failed',
        retryable: true,
        http_status: 503,
      },
    })));

    const error = await resumeIndrasNetImageTask({
      baseUrl: 'https://asus.example',
      jobId: 'failed-job',
      workflowName: 'gen_anime',
    }).catch(cause => cause);

    expect(error).toMatchObject({
      code: 'COMFYUI_EXECUTION_FAILED',
      retryable: false,
      status: 503,
    });
  });

  it('keeps broker-queued work submitted until the broker reports running', async () => {
    const originalSetTimeout = globalThis.setTimeout.bind(globalThis);
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((handler: TimerHandler, timeout?: number, ...args: any[]) => {
      if (timeout === 2000) {
        queueMicrotask(() => typeof handler === 'function' && handler(...args));
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }
      return originalSetTimeout(handler, timeout, ...args);
    }) as typeof setTimeout);
    const events: unknown[] = [];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(catalogue))
      .mockResolvedValueOnce(json({ job_id: 'broker-queued', status: 'queued' }, 202))
      .mockResolvedValueOnce(json({ job_id: 'broker-queued', status: 'queued' }))
      .mockResolvedValueOnce(json({ job_id: 'broker-queued', status: 'running' }))
      .mockResolvedValueOnce(json({
        job_id: 'broker-queued',
        status: 'completed',
        images: ['/api/comfyui/view?filename=queued.png&type=output'],
      }))
      .mockResolvedValueOnce(image());
    vi.stubGlobal('fetch', fetchMock);

    await generateIndrasNetImage({
      model: 'indrasnet/gen_anime',
      baseUrl: 'https://asus.example',
      prompt: 'a patient dragon',
      onJobEvent: event => events.push(event),
    });

    expect(events.map((event: any) => event.type)).toEqual(['submitted', 'submitted', 'running']);
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
