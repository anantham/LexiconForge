import { describe, it, expect, vi, beforeEach } from 'vitest';

// generateImage is the PAID call — mock it and count invocations.
const { generateImageMock, resumePiApiImageTaskMock } = vi.hoisted(() => ({
  generateImageMock: vi.fn(),
  resumePiApiImageTaskMock: vi.fn(),
}));
vi.mock('../../services/imageService', () => ({
  generateImage: (...args: any[]) => generateImageMock(...args),
  modelConsumesSteeringImage: vi.fn().mockReturnValue(false),
  resumeIndrasNetTask: vi.fn(),
  resumePiApiImageTask: resumePiApiImageTaskMock,
}));
// Persistence hits IndexedDB — no-op it (the service already swallows its errors, but avoid the noise).
vi.mock('../../services/translationPersistenceService', () => ({
  TranslationPersistenceService: { persistUpdatedTranslation: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../services/imagePlanService', () => ({
  ensureIllustrationPlan: (x: any) => x,
  compileIllustrationPrompt: (illust: any) => ({
    compiledPrompt: illust.imagePrompt,
    imagePlan: null,
    imagePlanMode: 'off',
    imagePlanSourceCaption: illust.imagePrompt,
  }),
}));
vi.mock('../../utils/debug', () => ({ debugLog: vi.fn(), debugWarn: vi.fn() }));

import { ImageGenerationService, type ImageGenerationContext } from '../../services/imageGenerationService';

const context = (suggestedIllustrations: any[]): ImageGenerationContext => ({
  chapters: new Map([['ch-1', {
    id: 'ch-1',
    translationResult: { suggestedIllustrations, imageVersionState: {} },
  } as any]]),
  settings: { imageModel: 'test-image-model', provider: 'OpenRouter', model: 'm', temperature: 0 } as any,
  steeringImages: {},
  negativePrompts: {},
  guidanceScales: {},
  loraModels: {},
  loraStrengths: {},
  imageVersions: {},
  activeImageVersion: {},
});

describe('ImageGenerationService.generateImages — duplicate marker guard', () => {
  beforeEach(() => {
    generateImageMock.mockReset();
    generateImageMock.mockResolvedValue({
      imageData: 'data:image/png;base64,AAAA',
      cost: 0.01,
      requestTime: 100,
      imageCacheKey: { version: 1 },
    });
  });

  it('resumes with the durable task model while preserving fallback provenance', async () => {
    const fallback = {
      attemptedProvider: 'Asus / IndrasNet',
      attemptedModel: 'indrasnet/gen_anime',
      reasonCode: 'COMFYUI_OFFLINE',
      reason: 'broker offline',
    };
    resumePiApiImageTaskMock.mockResolvedValueOnce({
      imageData: 'data:image/png;base64,AAAA',
      requestTime: 4,
      cost: 0.03,
      execution: { provider: 'PiAPI', model: 'Qubico/flux1-dev' },
    });

    const result = await ImageGenerationService.resumeImageJobArtifact({
      id: 'fallback-job',
      chapterId: 'ch-1',
      placementMarker: '[ILLUSTRATION-1]',
      requestedModel: 'indrasnet/gen_anime',
      requestedProvider: 'Asus / IndrasNet',
      taskModel: 'Qubico/flux1-dev',
      taskProvider: 'PiAPI',
      fallback,
      status: 'interrupted',
      resumeKind: 'piapi',
      externalTaskId: 'pi-fallback-task',
      version: 1,
      startedAt: 1,
      updatedAt: 1,
      estimateSampleCount: 0,
    }, context([{ placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'one' }]));

    expect(resumePiApiImageTaskMock).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'pi-fallback-task',
      settings: expect.objectContaining({ imageModel: 'Qubico/flux1-dev' }),
    }));
    expect(result.execution).toMatchObject({
      provider: 'PiAPI',
      model: 'Qubico/flux1-dev',
      fallback,
    });
  });

  it('issues ONE paid generation for two illustrations sharing a marker', async () => {
    // Two prompts for the same marker used to produce two generateImage calls (two paid requests)
    // keyed to the same chapterId:marker, and the second overwrote the first — money spent, one
    // image lost. Only one image can render per marker, so exactly one paid call is correct.
    await ImageGenerationService.generateImages('ch-1', context([
      { placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'first' },
      { placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'second (duplicate)' },
    ]));

    expect(generateImageMock).toHaveBeenCalledTimes(1);
  });

  it('still generates one image per DISTINCT marker', async () => {
    await ImageGenerationService.generateImages('ch-1', context([
      { placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'one' },
      { placementMarker: '[ILLUSTRATION-2]', imagePrompt: 'two' },
    ]));

    expect(generateImageMock).toHaveBeenCalledTimes(2);
  });

  it('does not issue a paid generation for a marker owned by another image job', async () => {
    const ctx = context([
      { placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'already owned' },
      { placementMarker: '[ILLUSTRATION-2]', imagePrompt: 'new work' },
    ]);
    ctx.excludedPlacementMarkers = new Set(['[ILLUSTRATION-1]']);

    await ImageGenerationService.generateImages('ch-1', ctx);

    expect(generateImageMock).toHaveBeenCalledTimes(1);
    expect(generateImageMock.mock.calls[0][8]).toBe('[ILLUSTRATION-2]');
  });
});
