import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recordMetric: vi.fn(),
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
  generateIndrasNetImage: vi.fn(),
  isIndrasNetImageModel: (model: string) => model.startsWith('indrasnet/'),
  resumeIndrasNetImageTask: mocks.resumeIndrasNetImageTask,
  workflowNameFromImageModel: (model: string) => model.slice('indrasnet/'.length),
}));
vi.mock('../../utils/debug', () => ({
  debugPipelineEnabled: () => false,
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}));

import { resumeIndrasNetTask } from '../../services/imageService';

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
    mocks.resumeIndrasNetImageTask.mockReset();
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
    }));
  });

  it('does not create an empirical sample when the broker has no full timing', async () => {
    mocks.resumeIndrasNetImageTask.mockResolvedValue({
      base64: 'aW1hZ2U=',
      mimeType: 'image/png',
    });

    await resumeIndrasNetTask(input as any);

    expect(mocks.recordMetric).not.toHaveBeenCalled();
  });
});
