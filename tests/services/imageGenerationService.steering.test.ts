/**
 * Steering-image provenance honesty (integrity item 6).
 *
 * Only the PiAPI (Qubico/) branch of imageService actually sends the steering image to the
 * provider; every other branch ignores it. The persisted ImageGenerationMetadata used to record
 * `steeringImage: <path>` regardless — provenance claiming an influence that never reached the
 * provider. Now an ignored steering image is recorded as steeringImage: null +
 * steeringIgnored: true.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// generateImage is the PAID call — mock it; keep the REAL modelConsumesSteeringImage so this
// test exercises the actual provider-branch predicate, not a re-implementation of it.
const generateImageMock = vi.hoisted(() => vi.fn());
vi.mock('../../services/imageService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/imageService')>();
  return {
    ...actual,
    generateImage: (...args: any[]) => generateImageMock(...args),
  };
});
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

const makeContext = (imageModel: string, steeringPath: string | null): {
  context: ImageGenerationContext;
  chapter: any;
} => {
  const chapter = {
    id: 'ch-1',
    translationResult: {
      suggestedIllustrations: [{ placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'a scene' }],
      imageVersionState: {},
    },
  } as any;
  const context: ImageGenerationContext = {
    chapters: new Map([['ch-1', chapter]]),
    settings: { imageModel, provider: 'Gemini', model: 'm', temperature: 0 } as any,
    steeringImages: steeringPath ? { 'ch-1:[ILLUSTRATION-1]': steeringPath } : {},
    negativePrompts: {},
    guidanceScales: {},
    loraModels: {},
    loraStrengths: {},
    imageVersions: {},
    activeImageVersion: {},
  };
  return { context, chapter };
};

const metadataOf = (chapter: any) =>
  chapter.translationResult.suggestedIllustrations[0].generatedImage.metadata;

describe('ImageGenerationService — steering-image provenance (integrity item 6)', () => {
  beforeEach(() => {
    generateImageMock.mockReset();
    generateImageMock.mockResolvedValue({
      imageData: 'data:image/png;base64,AAAA',
      cost: 0.01,
      requestTime: 1,
      imageCacheKey: { version: 1 },
    });
  });

  it('records steeringImage: null + steeringIgnored for a provider branch that ignores steering', async () => {
    // Imagen branch never consumes steering images. RED pre-fix: metadata recorded
    // steeringImage: 'steer.png' as if it had been applied.
    const { context, chapter } = makeContext('imagen-3.0-generate-002', 'steer.png');

    await ImageGenerationService.generateImages('ch-1', context);

    const metadata = metadataOf(chapter);
    expect(metadata.steeringImage).toBeNull();
    expect(metadata.steeringIgnored).toBe(true);
    // The version-state copy of the metadata must agree.
    const versionMeta = chapter.translationResult.imageVersionState['[ILLUSTRATION-1]'].versions[1];
    expect(versionMeta.steeringImage).toBeNull();
    expect(versionMeta.steeringIgnored).toBe(true);
  });

  it('records the steering image as applied for the PiAPI (Qubico/) branch', async () => {
    const { context, chapter } = makeContext('Qubico/flux1-dev', 'steer.png');

    await ImageGenerationService.generateImages('ch-1', context);

    const metadata = metadataOf(chapter);
    expect(metadata.steeringImage).toBe('steer.png');
    expect(metadata.steeringIgnored).toBeUndefined();
  });

  it('does not flag anything when no steering image is configured', async () => {
    const { context, chapter } = makeContext('imagen-3.0-generate-002', null);

    await ImageGenerationService.generateImages('ch-1', context);

    const metadata = metadataOf(chapter);
    expect(metadata.steeringImage).toBeNull();
    expect(metadata.steeringIgnored).toBeUndefined();
  });

  it('retryImage applies the same honesty', async () => {
    const { context, chapter } = makeContext('gemini-2.5-flash-image-preview', 'steer.png');
    context.nextVersion = 2;

    await ImageGenerationService.retryImage('ch-1', '[ILLUSTRATION-1]', context);

    const metadata = metadataOf(chapter);
    expect(metadata.steeringImage).toBeNull();
    expect(metadata.steeringIgnored).toBe(true);
  });

  it('preserves provider retryability when a single-image retry returns an error state', async () => {
    const { context } = makeContext('indrasnet/gen_anime', null);
    generateImageMock.mockRejectedValueOnce(Object.assign(
      new Error('Completed artifact is temporarily unreachable'),
      { errorType: 'INDRASNET_IMAGE_DOWNLOAD_FAILED', canRetry: true },
    ));

    const result = await ImageGenerationService.retryImage(
      'ch-1',
      '[ILLUSTRATION-1]',
      context,
    );

    expect(result.imageState).toMatchObject({
      error: expect.stringContaining('temporarily unreachable'),
      errorType: 'INDRASNET_IMAGE_DOWNLOAD_FAILED',
      canRetry: true,
    });
  });

  it('reports the model that actually executed in batch progress and final metrics', async () => {
    const { context } = makeContext('indrasnet/gen_anime', null);
    const onProgressUpdate = vi.fn();
    generateImageMock.mockResolvedValueOnce({
      imageData: 'data:image/png;base64,AAAA',
      cost: 0.04,
      requestTime: 12,
      imageCacheKey: { version: 1 },
      execution: { provider: 'Imagen', model: 'imagen-3.0-generate-002' },
    });

    const result = await ImageGenerationService.generateImages(
      'ch-1', context, onProgressUpdate
    );

    expect(onProgressUpdate).toHaveBeenLastCalledWith(expect.any(Object), expect.objectContaining({
      lastModel: 'imagen-3.0-generate-002',
    }));
    expect(result.metrics?.lastModel).toBe('imagen-3.0-generate-002');
  });
});
