import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recordMetric: vi.fn(),
  generateIndrasNetImage: vi.fn(),
  resumeIndrasNetImageTask: vi.fn(),
}));

vi.mock('@google/genai', () => ({ GoogleGenAI: class {} }));
vi.mock('@google/generative-ai', () => ({ GoogleGenerativeAI: class {} }));
vi.mock('../../services/apiMetricsService', () => ({
  apiMetricsService: { recordMetric: mocks.recordMetric },
}));
vi.mock('../../services/openrouterImageModelAdapter', () => ({
  getVerifiedOpenRouterImageModel: vi.fn(),
  buildOpenRouterImageRequestConfig: vi.fn(),
}));
vi.mock('../../services/providers/indrasNetImageProvider', () => ({
  IndrasNetProviderError: class extends Error {},
  generateIndrasNetImage: mocks.generateIndrasNetImage,
  isIndrasNetImageModel: (model: string) => model.startsWith('indrasnet/'),
  resumeIndrasNetImageTask: mocks.resumeIndrasNetImageTask,
  workflowNameFromImageModel: (model: string) => model.slice('indrasnet/'.length),
}));
vi.mock('../../utils/debug', () => ({
  debugPipelineEnabled: () => false,
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}));

import { generateImage, resumeIndrasNetTask, resumePiApiImageTask } from '../../services/imageService';

const input = {
  taskId: 'broker-job-1',
  settings: { imageModel: 'indrasnet/gen_anime', indrasNetBaseUrl: 'https://asus.example' },
  chapterId: 'chapter-1',
  placementMarker: '[ILLUSTRATION-1]',
  version: 2,
} as const;

describe('restored image-job ETA metrics', () => {
  beforeEach(() => {
    mocks.recordMetric.mockReset().mockResolvedValue(undefined);
    mocks.generateIndrasNetImage.mockReset();
    mocks.resumeIndrasNetImageTask.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses the submitted IndrasNet task id for the initial success metric', async () => {
    const onJobEvent = vi.fn();
    mocks.generateIndrasNetImage.mockImplementation(async input => {
      input.onJobEvent?.({ type: 'submitted', externalTaskId: 'broker-initial-1', resumeKind: 'indrasnet' });
      input.onJobEvent?.({ type: 'running' });
      return { base64: 'aW1hZ2U=', mimeType: 'image/png' };
    });

    await generateImage(
      'a scene',
      { imageModel: 'indrasnet/gen_anime', indrasNetBaseUrl: 'https://asus.example' } as any,
      undefined, undefined, undefined, undefined, undefined,
      'chapter-1', undefined, undefined,
      onJobEvent,
    );

    expect(onJobEvent).toHaveBeenCalledWith({
      type: 'submitted',
      externalTaskId: 'broker-initial-1',
      resumeKind: 'indrasnet',
      submittedModel: 'indrasnet/gen_anime',
    });
    expect(mocks.recordMetric).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      idempotencyKey: 'image:indrasnet:broker-initial-1',
    }));
  });

  it('uses the submitted PiAPI task id for the initial success metric', async () => {
    const onJobEvent = vi.fn();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { task_id: 'pi-initial-1' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'completed',
        output: { base64: 'aW1hZ2U=' },
      }), { status: 200 }));

    await generateImage(
      'a scene',
      { imageModel: 'Qubico/flux1-schnell', apiKeyPiAPI: 'test-key' } as any,
      undefined, undefined, undefined, undefined, undefined,
      'chapter-1', undefined, undefined,
      onJobEvent,
    );

    expect(onJobEvent).toHaveBeenCalledWith({
      type: 'submitted',
      externalTaskId: 'pi-initial-1',
      resumeKind: 'piapi',
      submittedModel: 'Qubico/flux1-schnell',
    });
    expect(mocks.recordMetric).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      idempotencyKey: 'image:piapi:pi-initial-1',
    }));
  });

  it('records exact broker timing instead of browser wall time', async () => {
    mocks.resumeIndrasNetImageTask.mockResolvedValue({
      base64: 'aW1hZ2U=',
      mimeType: 'image/png',
      brokerTimingMs: 12_500,
    });

    const result = await resumeIndrasNetTask(input as any);

    expect(result.requestTime).toBe(12.5);
    expect(mocks.recordMetric).toHaveBeenCalledWith(expect.objectContaining({
      model: 'indrasnet/gen_anime',
      duration: 12.5,
      success: true,
      idempotencyKey: 'image:indrasnet:broker-job-1',
    }));
  });

  it('records an untimed recovered success when the broker has no full timing', async () => {
    mocks.resumeIndrasNetImageTask.mockResolvedValue({
      base64: 'aW1hZ2U=',
      mimeType: 'image/png',
    });

    await resumeIndrasNetTask(input as any);

    expect(mocks.recordMetric).toHaveBeenCalledWith(expect.objectContaining({
      apiType: 'image',
      provider: 'Asus / IndrasNet',
      model: 'indrasnet/gen_anime',
      imageCount: 1,
      success: true,
      idempotencyKey: 'image:indrasnet:broker-job-1',
    }));
    expect(mocks.recordMetric.mock.calls[0][0]).not.toHaveProperty('duration');
  });

  it('records recovered PiAPI spend once without treating partial polling time as an ETA sample', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: 'completed',
      output: { base64: 'aW1hZ2U=' },
    }), { status: 200 }));

    const result = await resumePiApiImageTask({
      taskId: 'pi-task-1',
      settings: { imageModel: 'Qubico/flux1-schnell', apiKeyPiAPI: 'test-key' } as any,
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      version: 2,
    });

    expect(result.cost).toBeGreaterThan(0);
    expect(mocks.recordMetric).toHaveBeenCalledWith(expect.objectContaining({
      apiType: 'image',
      provider: 'PiAPI',
      model: 'Qubico/flux1-schnell',
      costUsd: result.cost,
      success: true,
      idempotencyKey: 'image:piapi:pi-task-1',
    }));
    expect(mocks.recordMetric.mock.calls[0][0]).not.toHaveProperty('duration');
  });

  it('keeps an initial PiAPI task submitted until the provider reports processing', async () => {
    vi.useFakeTimers();
    const onJobEvent = vi.fn();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { task_id: 'pi-queued-1' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'pending' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'processing' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'completed',
        output: { base64: 'aW1hZ2U=' },
      }), { status: 200 }));

    const generation = generateImage(
      'a scene',
      { imageModel: 'Qubico/flux1-schnell', apiKeyPiAPI: 'test-key' } as any,
      undefined, undefined, undefined, undefined, undefined,
      'chapter-1', undefined, undefined,
      onJobEvent,
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(onJobEvent).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'submitted',
      externalTaskId: 'pi-queued-1',
    }));
    expect(onJobEvent).not.toHaveBeenCalledWith({ type: 'running' });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(onJobEvent).toHaveBeenCalledWith({ type: 'running' });
    await vi.advanceTimersByTimeAsync(1_000);
    await generation;
  });

  it('does not mark a restored PiAPI task running before its first provider status', async () => {
    vi.useFakeTimers();
    const onJobEvent = vi.fn();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'queued' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'completed',
        output: { base64: 'aW1hZ2U=' },
      }), { status: 200 }));

    const recovery = resumePiApiImageTask({
      taskId: 'pi-restored-queued',
      settings: { imageModel: 'Qubico/flux1-schnell', apiKeyPiAPI: 'test-key' } as any,
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      version: 2,
      onJobEvent,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(onJobEvent).toHaveBeenCalledTimes(1);
    expect(onJobEvent).toHaveBeenLastCalledWith({
      type: 'submitted',
      externalTaskId: 'pi-restored-queued',
      resumeKind: 'piapi',
    });
    expect(onJobEvent).not.toHaveBeenCalledWith({ type: 'running' });

    await vi.advanceTimersByTimeAsync(1_000);
    await recovery;
  });

  it('keeps a PiAPI task recoverable across credential errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      message: 'invalid API key',
    }), { status: 401 }));

    const error = await resumePiApiImageTask({
      taskId: 'pi-credential-task',
      settings: { imageModel: 'Qubico/flux1-schnell', apiKeyPiAPI: 'rotated-key' } as any,
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      version: 2,
    }).catch(cause => cause);

    expect(error).toMatchObject({ errorType: 'PIAPI_HTTP_401', canRetry: true });
    expect(mocks.recordMetric).not.toHaveBeenCalled();
  });

  it('retires a PiAPI task missing inside an HTTP-200 error envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      code: 404,
      message: 'task not found',
    }), { status: 200 }));

    const error = await resumePiApiImageTask({
      taskId: 'pi-missing-task',
      settings: { imageModel: 'Qubico/flux1-schnell', apiKeyPiAPI: 'test-key' } as any,
      chapterId: 'chapter-1',
      placementMarker: '[ILLUSTRATION-1]',
      version: 2,
    }).catch(cause => cause);

    expect(error).toMatchObject({ errorType: 'PIAPI_ENVELOPE_404', canRetry: false });
    expect(mocks.recordMetric).not.toHaveBeenCalled();
  });
});
