import type { AppSettings, GeneratedImageResult } from '../types';
import { generateImage, imageProviderForModel } from './imageService';
import { isIndrasNetImageModel } from './providers/indrasNetImageProvider';
import type { ImageJobLifecycleListener } from './imageJobTypes';

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
  onJobEvent?: ImageJobLifecycleListener;
}

interface RetryableImageError extends Error {
  errorType?: string;
  canRetry?: boolean;
  fallbackEligible?: boolean;
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
    fallbackTaskSubmitted: boolean;
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
    // Once fallback owns a durable task, only that provider can say whether
    // its ID remains recoverable. Before fallback acceptance, retaining the
    // primary's retryability preserves the ordinary manual-retry affordance.
    this.canRetry = options.fallbackTaskSubmitted
      ? options.fallbackError.canRetry === true
      : options.primaryError.canRetry === true || options.fallbackError.canRetry === true;
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
    input.onJobEvent,
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
  let durablePrimarySubmitted = false;
  try {
    return await invoke({
      ...input,
      onJobEvent: event => {
        if (event.type === 'submitted') durablePrimarySubmitted = true;
        input.onJobEvent?.(event);
      },
    });
  } catch (unknownError) {
    const primaryElapsedSeconds = (performance.now() - primaryStartedAt) / 1000;
    const error = unknownError as RetryableImageError;
    const fallbackModel = input.settings.imageFallbackModel?.trim() || 'none';
    const localFallbackInvalid = isIndrasNetImageModel(fallbackModel);
    const fallbackEnabled = fallbackModel.toLowerCase() !== 'none' && !localFallbackInvalid;
    const eligible = isIndrasNetImageModel(input.settings.imageModel)
      && error.canRetry === true
      && error.fallbackEligible !== false
      && !durablePrimarySubmitted;

    if (localFallbackInvalid) {
      console.warn('[ImageGenerationFallback] Ignoring invalid local fallback; fallback must be a cloud model', {
        attemptedModel: input.settings.imageModel,
        configuredFallbackModel: fallbackModel,
      });
    }

    if (!eligible || !fallbackEnabled || fallbackModel === input.settings.imageModel) {
      throw unknownError;
    }

    const reasonCode = error.errorType || 'INDRASNET_RETRYABLE_FAILURE';
    const fallback = {
      attemptedProvider: imageProviderForModel(input.settings.imageModel),
      attemptedModel: input.settings.imageModel,
      reasonCode,
      reason: error.message,
    };
    console.warn('[ImageGenerationFallback] Using explicit cloud fallback', {
      attemptedModel: input.settings.imageModel,
      fallbackModel,
      reasonCode,
      reason: error.message,
    });
    input.onJobEvent?.({ type: 'provider_switched', model: fallbackModel, fallback });

    let fallbackResult: GeneratedImageResult;
    let durableFallbackSubmitted = false;
    try {
      fallbackResult = await invoke({
        ...input,
        settings: { ...input.settings, imageModel: fallbackModel },
        onJobEvent: event => {
          if (event.type === 'submitted') {
            durableFallbackSubmitted = true;
            input.onJobEvent?.({ ...event, fallback });
            return;
          }
          input.onJobEvent?.(event);
        },
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
        fallbackTaskSubmitted: durableFallbackSubmitted,
      });
    }
    return {
      ...fallbackResult,
      requestTime: primaryElapsedSeconds + fallbackResult.requestTime,
      execution: {
        provider: fallbackResult.execution?.provider || imageProviderForModel(fallbackModel),
        model: fallbackResult.execution?.model || fallbackModel,
        fallback,
      },
    };
  }
};
