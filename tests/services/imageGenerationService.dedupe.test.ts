import { describe, it, expect, vi, beforeEach } from 'vitest';

// generateImage is the PAID call — mock it and count invocations.
const generateImageMock = vi.hoisted(() => vi.fn());
vi.mock('../../services/imageService', () => ({
  generateImage: (...args: any[]) => generateImageMock(...args),
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
});
