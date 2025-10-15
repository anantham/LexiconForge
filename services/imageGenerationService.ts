/**
 * ImageGenerationService - Handles all image generation operations
 * 
 * Extracted from useAppStore to separate image generation concerns.
 * This service manages:
 * - Image generation for chapter illustrations
 * - Image retry functionality
 * - Loading existing images from persistent data
 * - Advanced image controls (steering, negative prompts, guidance)
 * - Image metrics and persistence
 */

import { generateImage } from './imageService';
import { TranslationPersistenceService } from './translationPersistenceService';
import type { AppSettings, PromptTemplate } from '../types';
import type { EnhancedChapter } from './stableIdService';
import { debugLog, debugWarn } from '../utils/debug';

const slog = (...args: any[]) => debugLog('image', 'summary', ...args);
const swarn = (...args: any[]) => debugWarn('image', 'summary', ...args);

export interface ImageGenerationContext {
  chapters: Map<string, EnhancedChapter>;
  settings: AppSettings;
  activePromptTemplate?: PromptTemplate;
  // Advanced controls
  steeringImages: Record<string, string | null>;
  negativePrompts: Record<string, string>;
  guidanceScales: Record<string, number>;
  loraModels: Record<string, string | null>;
  loraStrengths: Record<string, number>;
  imageVersions: Record<string, number>;
  activeImageVersion: Record<string, number>;
  // Version tracking for image regeneration
  nextVersion?: number;
}

export interface ImageState {
  isLoading: boolean;
  data: string | null;
  error: string | null;
  errorType?: string;
  canRetry?: boolean;
}

export interface ImageGenerationMetrics {
  count: number;
  totalTime: number;
  totalCost: number;
  lastModel: string;
}

export interface ImageGenerationResult {
  generatedImages: Record<string, ImageState>;
  metrics?: ImageGenerationMetrics;
  error?: string;
}

export class ImageGenerationService {

  /**
   * Load existing images for a chapter from its translation result
   */
  static loadExistingImages(chapterId: string, chapters: Map<string, EnhancedChapter>): Record<string, ImageState> {
    slog(`[ImageGen] Loading existing images for ${chapterId}`);
    const chapter = chapters.get(chapterId);
    const translationResult = chapter?.translationResult;

    if (!translationResult || !translationResult.suggestedIllustrations) {
      slog(`[ImageGen] No illustrations found for chapter ${chapterId}`);
      return {};
    }

    const imageStateUpdates: Record<string, ImageState> = {};
    let foundExistingImages = false;

    translationResult.suggestedIllustrations.forEach((illust: any) => {
      const generated = illust.generatedImage;
      const url = (illust as any)?.url;
      const payload = generated?.imageData || (typeof url === 'string' && url.trim().length > 0 ? url : null);

      if (payload) {
        const key = `${chapterId}:${illust.placementMarker}`;
        imageStateUpdates[key] = {
          isLoading: false,
          data: payload,
          error: null
        };
        foundExistingImages = true;
        slog(`[ImageGen] Loaded existing image for ${illust.placementMarker}`);
      }
    });

    if (foundExistingImages) {
      slog(`[ImageGen] Loaded ${Object.keys(imageStateUpdates).length} existing images for chapter ${chapterId}`);
    }

    return imageStateUpdates;
  }

  /**
   * Generate images for all suggested illustrations in a chapter
   */
  static async generateImages(
    chapterId: string,
    context: ImageGenerationContext,
    onProgressUpdate?: (imageStates: Record<string, ImageState>) => void
  ): Promise<ImageGenerationResult> {
    slog(`[ImageGen] Starting image generation for ${chapterId}`);
    const { chapters, settings, steeringImages, negativePrompts, guidanceScales, loraModels, loraStrengths } = context;
    const chapter = chapters.get(chapterId);
    const translationResult = chapter?.translationResult;

    if (!settings.imageModel || settings.imageModel.toLowerCase() === 'none') {
      slog('[ImageGen] Image generation is disabled in settings.');
      return { generatedImages: {} };
    }

    if (!translationResult || !translationResult.suggestedIllustrations) {
      swarn('[ImageGen] No illustrations suggested for this chapter.');
      return { generatedImages: {} };
    }

    // Initialize loading states for all illustrations
    const initialImageStates: Record<string, ImageState> = {};
    translationResult.suggestedIllustrations.forEach((illust: any) => {
      const key = `${chapterId}:${illust.placementMarker}`;
      initialImageStates[key] = { isLoading: true, data: null, error: null };
    });

    onProgressUpdate?.(initialImageStates);

    let totalTime = 0;
    let totalCost = 0;
    let generatedCount = 0;
    const generatedImages: Record<string, ImageState> = { ...initialImageStates };

    // Only generate images for illustrations that don't already have generated data
    const illustrationsNeedingGeneration = translationResult.suggestedIllustrations.filter(
      (illust: any) => !illust.generatedImage
    );

    debugLog('image', 'summary', '[ImageGen] Illustration breakdown', {
      chapterId,
      total: translationResult.suggestedIllustrations.length,
      existing: translationResult.suggestedIllustrations.length - illustrationsNeedingGeneration.length,
      generating: illustrationsNeedingGeneration.length,
    });

    if (illustrationsNeedingGeneration.length === 0) {
      slog('[ImageGen] All illustrations already have generated images');
      return { 
        generatedImages: this.loadExistingImages(chapterId, chapters),
        metrics: { count: 0, totalTime: 0, totalCost: 0, lastModel: settings.imageModel }
      };
    }

    slog(`[ImageGen] Generating ${illustrationsNeedingGeneration.length}/${translationResult.suggestedIllustrations.length} new images`);

    // Sequentially generate images to avoid overwhelming the API
    for (const illust of illustrationsNeedingGeneration) {
      const key = `${chapterId}:${illust.placementMarker}`;
      
      try {
        slog(`[ImageGen] Generating image for marker: ${illust.placementMarker}`);
        
        // Get advanced controls for this illustration
        const steeringImagePath = steeringImages[key] || null;
        const negativePrompt = negativePrompts[key] || settings.defaultNegativePrompt || '';
        const guidanceScale = guidanceScales[key] || settings.defaultGuidanceScale || 3.5;
        const loraModel = loraModels[key] || null;
        const loraStrength = loraStrengths[key] || 0.8;

        const result = await generateImage(
          illust.imagePrompt,
          settings,
          steeringImagePath,
          negativePrompt,
          guidanceScale,
          loraModel,
          loraStrength,
          chapterId,  // NEW: for Cache API storage
          illust.placementMarker,  // NEW: for Cache API storage
          1  // version: initial generation is always v1
        );

        debugLog('image', 'full', '[ImageGen] Generation prompt payload', {
          chapterId,
          placementMarker: illust.placementMarker,
          prompt: illust.imagePrompt,
          steeringImagePath,
          negativePrompt,
          guidanceScale,
          loraModel,
          loraStrength,
          model: settings.imageModel,
        });

        totalTime += result.requestTime;
        totalCost += result.cost;
        generatedCount++;

        // Update state for immediate UI updates
        generatedImages[key] = {
          isLoading: false,
          data: result.imageData,
          error: null
        };

        onProgressUpdate?.(generatedImages);

        // Store in chapter's translationResult for persistence
        if (chapter && chapter.translationResult) {
          const suggestionIndex = chapter.translationResult.suggestedIllustrations.findIndex(
            (s: any) => s.placementMarker === illust.placementMarker
          );
          
          if (suggestionIndex >= 0) {
            const target = chapter.translationResult.suggestedIllustrations[suggestionIndex];
            target.generatedImage = result;
            // Write base64 into url so UI/exports can embed images (only for legacy base64, not cache keys)
            if (result.imageData && result.imageData.length > 0) {
              (target as any).url = result.imageData;
            }

            const keyWithMarker = `${chapterId}:${illust.placementMarker}`;
            const latestVersion = result.imageCacheKey?.version
              ?? Math.max(context.imageVersions?.[keyWithMarker] ?? 0, 1);
            const activeVersion = context.activeImageVersion?.[keyWithMarker] ?? latestVersion;

            const currentState = (chapter.translationResult as any).imageVersionState ?? {};
            (chapter.translationResult as any).imageVersionState = {
              ...currentState,
              [illust.placementMarker]: {
                latestVersion,
                activeVersion
              }
            };
            
            // Persist to IndexedDB using stableId mapping
            try {
              await TranslationPersistenceService.persistUpdatedTranslation(
                chapter.id,
                chapter.translationResult as any,
                {
                  provider: settings.provider,
                  model: settings.model,
                  temperature: settings.temperature,
                  systemPrompt: settings.systemPrompt,
                  promptId: context.activePromptTemplate?.id,
                  promptName: context.activePromptTemplate?.name,
                }
              );
              slog(`[ImageGen] Persisted image for ${illust.placementMarker} to IndexedDB`);
            } catch (error) {
              swarn(`[ImageGen] Failed to persist image to IndexedDB:`, error);
            }
          }
        }
        
        slog(`[ImageGen] Successfully generated and stored image for ${illust.placementMarker}`);
        
      } catch (error: any) {
        console.error(`[ImageGen] Failed to generate image for ${illust.placementMarker}:`, error);
        
        // Enhanced error message with suggestions
        let errorMessage = error.message || 'Image generation failed';
        if (error.suggestedActions && error.suggestedActions.length > 0) {
          errorMessage += `\n\nSuggestions:\n• ${error.suggestedActions.join('\n• ')}`;
        }
        
        generatedImages[key] = {
          isLoading: false,
          data: null,
          error: errorMessage,
          errorType: error.errorType,
          canRetry: error.canRetry
        };

        onProgressUpdate?.(generatedImages);
      }
    }

    const metrics: ImageGenerationMetrics = {
      count: generatedCount,
      totalTime: totalTime,
      totalCost: totalCost,
      lastModel: settings.imageModel,
    };

    slog(`[ImageGen] Finished generation. Total time: ${totalTime.toFixed(2)}s, Total cost: ${totalCost.toFixed(5)}`);

    return {
      generatedImages,
      metrics
    };
  }

  /**
   * Retry generation for a specific image
   */
  static async retryImage(
    chapterId: string,
    placementMarker: string,
    context: ImageGenerationContext
  ): Promise<{ imageState: ImageState; metrics?: Partial<ImageGenerationMetrics> }> {
    slog(`[ImageGen] Retrying image generation for ${placementMarker} in chapter ${chapterId}`);
    const { chapters, settings, steeringImages, negativePrompts, guidanceScales, loraModels, loraStrengths } = context;
    const chapter = chapters.get(chapterId);
    const illust = chapter?.translationResult?.suggestedIllustrations?.find(
      (i: any) => i.placementMarker === placementMarker
    );

    if (!illust) {
      console.error(`[ImageGen] Could not find illustration with marker ${placementMarker} to retry.`);
      return {
        imageState: {
          isLoading: false,
          data: null,
          error: `Illustration with marker ${placementMarker} not found`
        }
      };
    }

    if (settings.imageModel === 'None') {
      const errorMessage = 'Image generation is disabled in Settings (Image Generation Model = None). Choose Imagen 3.0/4.0 or a Gemini image-capable model to enable.';
      slog('[ImageGen] Retry skipped because image model is None');
      return {
        imageState: {
          isLoading: false,
          data: null,
          error: errorMessage
        }
      };
    }

    const key = `${chapterId}:${placementMarker}`;

    try {
      // Get advanced controls for this illustration
      const steeringImagePath = steeringImages[key] || null;
      const negativePrompt = negativePrompts[key] || settings.defaultNegativePrompt || '';
      const guidanceScale = guidanceScales[key] || settings.defaultGuidanceScale || 3.5;
      const loraModel = loraModels[key] || null;
      const loraStrength = loraStrengths[key] || 0.8;

      const result = await generateImage(
        illust.imagePrompt,
        settings,
        steeringImagePath,
        negativePrompt,
        guidanceScale,
        loraModel,
        loraStrength,
        chapterId,  // NEW: for Cache API storage
        placementMarker,  // NEW: for Cache API storage
        context.nextVersion || 1  // version: use context.nextVersion or default to 1
      );

      debugLog('image', 'full', '[ImageGen] Retry prompt payload', {
        chapterId,
        placementMarker,
        prompt: illust.imagePrompt,
        steeringImagePath,
        negativePrompt,
        guidanceScale,
        loraModel,
        loraStrength,
        model: settings.imageModel,
      });

      // Update chapter translation and persist
      if (chapter && chapter.translationResult) {
        const suggestionIndex = chapter.translationResult.suggestedIllustrations.findIndex(
          (s: any) => s.placementMarker === placementMarker
        );
        
        if (suggestionIndex >= 0) {
          const target = chapter.translationResult.suggestedIllustrations[suggestionIndex];
          target.generatedImage = result;
          // Write base64 into url so UI/exports can embed images (only for legacy base64, not cache keys)
          if (result.imageData && result.imageData.length > 0) {
            (target as any).url = result.imageData;
          }

          const keyWithMarker = `${chapterId}:${placementMarker}`;
          const latestVersion = result.imageCacheKey?.version
            ?? Math.max(context.imageVersions?.[keyWithMarker] ?? 0, 1);
          const activeVersion = context.activeImageVersion?.[keyWithMarker] ?? latestVersion;
          const currentState = (chapter.translationResult as any).imageVersionState ?? {};
          (chapter.translationResult as any).imageVersionState = {
            ...currentState,
            [placementMarker]: {
              latestVersion,
              activeVersion
            }
          };
          
          try {
            await TranslationPersistenceService.persistUpdatedTranslation(
              chapter.id,
              chapter.translationResult as any,
              {
                provider: settings.provider,
                model: settings.model,
                temperature: settings.temperature,
                systemPrompt: settings.systemPrompt,
                promptId: context.activePromptTemplate?.id,
                promptName: context.activePromptTemplate?.name,
              }
            );
            slog(`[ImageGen] Persisted retry image for ${placementMarker} to IndexedDB`);
          } catch (e) {
            swarn('[ImageGen] Failed to persist retry image to IndexedDB', e);
          }
        }
      }

      slog(`[ImageGen] Successfully retried and stored image for ${placementMarker}`);

      return {
        imageState: {
          isLoading: false,
          data: result.imageData,
          error: null
        },
        metrics: {
          count: 1,
          totalTime: result.requestTime,
          totalCost: result.cost,
          lastModel: settings.imageModel
        }
      };

    } catch (error: any) {
      console.error(`[ImageGen] Failed to retry image for ${placementMarker}:`, error);
      
      return {
        imageState: {
          isLoading: false,
          data: null,
          error: error.message || 'Image generation failed'
        }
      };
    }
  }

  /**
   * Check if chapter has illustrations that need generation
   */
  static hasIllustrationsNeedingGeneration(chapter: EnhancedChapter): boolean {
    const translationResult = chapter?.translationResult;
    if (!translationResult || !translationResult.suggestedIllustrations) {
      return false;
    }

    return translationResult.suggestedIllustrations.some((illust: any) => !illust.generatedImage);
  }

  /**
   * Get illustration count statistics for a chapter
   */
  static getIllustrationStats(chapter: EnhancedChapter): { total: number; generated: number; pending: number } {
    const translationResult = chapter?.translationResult;
    if (!translationResult || !translationResult.suggestedIllustrations) {
      return { total: 0, generated: 0, pending: 0 };
    }

    const total = translationResult.suggestedIllustrations.length;
    const generated = translationResult.suggestedIllustrations.filter((illust: any) => illust.generatedImage).length;
    const pending = total - generated;

    return { total, generated, pending };
  }

  /**
   * Update advanced image controls for a specific illustration
   */
  static updateAdvancedControls(
    chapterId: string,
    placementMarker: string,
    controls: {
      steeringImage?: string | null;
      negativePrompt?: string;
      guidanceScale?: number;
      loraModel?: string | null;
      loraStrength?: number;
    }
  ): Partial<ImageGenerationContext> {
    const key = `${chapterId}:${placementMarker}`;
    const updates: Partial<ImageGenerationContext> = {};

    if (controls.steeringImage !== undefined) {
      updates.steeringImages = { [key]: controls.steeringImage };
    }
    if (controls.negativePrompt !== undefined) {
      updates.negativePrompts = { [key]: controls.negativePrompt };
    }
    if (controls.guidanceScale !== undefined) {
      updates.guidanceScales = { [key]: controls.guidanceScale };
    }
    if (controls.loraModel !== undefined) {
      updates.loraModels = { [key]: controls.loraModel };
    }
    if (controls.loraStrength !== undefined) {
      updates.loraStrengths = { [key]: controls.loraStrength };
    }

    return updates;
  }
}
