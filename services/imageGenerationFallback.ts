import type { AppSettings, GeneratedImageResult } from '../types';
import { generateImage, imageProviderForModel } from './imageService';
import { isIndrasNetImageModel } from './providers/indrasNetImageProvider';

export interface ImageGenerationInvocation {
  prompt: string;
  settings: AppSettings;
  steeringImagePath?: string;
  negativePrompt?: string;
  guidanceScale?: number;
  loraModel?: string | null;
  loraStrength?: number;
  chapterId?: string;
  placementMarker?: string;
  version?: number;
}

interface RetryableImageError extends Error {
  errorType?: string;
  canRetry?: boolean;
}

export class ImageFallbackError extends Error {
  readonly errorType = 'IMAGE_FALLBACK_FAILED';
  readonly canRetry: boolean;
  readonly primaryError: Error;
  readonly fallbackError: Error;
  readonly attemptedModel: string;
  readonly fallbackModel: string;

  constructor(options: {
    primaryError: RetryableImageError;
    fallbackError: RetryableImageError;
    attemptedModel: string;
    fallbackModel: string;
    primaryReasonCode: string;
  }) {
    const fallbackReasonCode = options.fallbackError.errorType || 'FALLBACK_PROVIDER_FAILURE';
    super(
      `Image generation failed on ${imageProviderForModel(options.attemptedModel)} (${options.attemptedModel}) `
      + `[${options.primaryReasonCode}]: ${options.primaryError.message}. `
      + `The configured fallback ${imageProviderForModel(options.fallbackModel)} (${options.fallbackModel}) `
      + `also failed [${fallbackReasonCode}]: ${options.fallbackError.message}`,
      { cause: options.fallbackError },
    );
    this.name = 'ImageFallbackError';
    this.primaryError = options.primaryError;
    this.fallbackError = options.fallbackError;
    this.attemptedModel = options.attemptedModel;
    this.fallbackModel = options.fallbackModel;
    this.canRetry = options.fallbackError.canRetry === true;
  }
}

const invoke = (input: ImageGenerationInvocation): Promise<GeneratedImageResult> =>
  generateImage(
    input.prompt,
    input.settings,
    input.steeringImagePath,
    input.negativePrompt,
    input.guidanceScale,
    input.loraModel,
    input.loraStrength,
    input.chapterId,
    input.placementMarker,
    input.version,
  );

/**
 * Run the selected model and, only for a retryable IndrasNet failure, use the
 * cloud model that the user explicitly selected. The fallback is recorded in
 * the result so persistence and UI consumers do not mistake it for local work.
 */
export const generateImageWithConfiguredFallback = async (
  input: ImageGenerationInvocation,
): Promise<GeneratedImageResult> => {
  const primaryStartedAt = performance.now();
  try {
    return await invoke(input);
  } catch (unknownError) {
    const primaryElapsedSeconds = (performance.now() - primaryStartedAt) / 1000;
    const error = unknownError as RetryableImageError;
    const fallbackModel = input.settings.imageFallbackModel?.trim() || 'none';
    const fallbackEnabled = fallbackModel.toLowerCase() !== 'none';
    const eligible = isIndrasNetImageModel(input.settings.imageModel) && error.canRetry === true;

    if (!eligible || !fallbackEnabled || fallbackModel === input.settings.imageModel) {
      throw unknownError;
    }

    const reasonCode = error.errorType || 'INDRASNET_RETRYABLE_FAILURE';
    console.warn('[ImageGenerationFallback] Using explicit cloud fallback', {
      attemptedModel: input.settings.imageModel,
      fallbackModel,
      reasonCode,
      reason: error.message,
    });

    let fallbackResult: GeneratedImageResult;
    try {
      fallbackResult = await invoke({
        ...input,
        settings: { ...input.settings, imageModel: fallbackModel },
      });
    } catch (fallbackUnknownError) {
      const fallbackError = fallbackUnknownError instanceof Error
        ? fallbackUnknownError as RetryableImageError
        : Object.assign(new Error(String(fallbackUnknownError)), { errorType: 'FALLBACK_PROVIDER_FAILURE' });
      throw new ImageFallbackError({
        primaryError: error,
        fallbackError,
        attemptedModel: input.settings.imageModel,
        fallbackModel,
        primaryReasonCode: reasonCode,
      });
    }
    return {
      ...fallbackResult,
      requestTime: primaryElapsedSeconds + fallbackResult.requestTime,
      execution: {
        provider: fallbackResult.execution?.provider || imageProviderForModel(fallbackModel),
        model: fallbackResult.execution?.model || fallbackModel,
        fallback: {
          attemptedProvider: imageProviderForModel(input.settings.imageModel),
          attemptedModel: input.settings.imageModel,
          reasonCode,
          reason: error.message,
        },
      },
    };
  }
};
