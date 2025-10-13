/**
 * Image Slice - Manages image generation and advanced image controls
 * 
 * Handles:
 * - Image generation for illustrations
 * - Generated image state management
 * - Advanced image controls (steering, LoRA, negative prompts)
 * - Image retry functionality
 * - Image generation metrics
 */

import type { StateCreator } from 'zustand';
import { ImageGenerationService, type ImageGenerationContext, type ImageState, type ImageGenerationMetrics } from '../../services/imageGenerationService';
import { TranslationPersistenceService } from '../../services/translationPersistenceService';
import { debugLog } from '../../utils/debug';

export interface ImageSliceState {
  // Generated images state
  generatedImages: Record<string, ImageState>; // chapterId:placementMarker -> ImageState
  
  // Advanced controls
  steeringImages: Record<string, string | null>; // chapterId:placementMarker -> steering image filename
  negativePrompts: Record<string, string>; // chapterId:placementMarker -> negative prompt
  guidanceScales: Record<string, number>; // chapterId:placementMarker -> guidance scale
  loraModels: Record<string, string | null>; // chapterId:placementMarker -> LoRA model name
  loraStrengths: Record<string, number>; // chapterId:placementMarker -> LoRA strength
  
  // Metrics and status
  imageGenerationMetrics: ImageGenerationMetrics | null;
  imageGenerationProgress: Record<string, {
    completed: number;
    total: number;
    currentPrompt?: string;
  }>;
}

export interface ImageSliceActions {
  // Image generation
  handleGenerateImages: (chapterId: string) => Promise<void>;
  handleRetryImage: (chapterId: string, placementMarker: string) => Promise<void>;
  loadExistingImages: (chapterId: string) => void;
  updateIllustrationPrompt: (chapterId: string, placementMarker: string, newPrompt: string) => Promise<void>;
  
  // Image state management
  setImageState: (key: string, state: ImageState) => void;
  clearImageState: (chapterId: string) => void;
  clearAllImages: () => void;
  
  // Advanced controls
  setSteeringImage: (chapterId: string, placementMarker: string, imagePath: string | null) => void;
  setNegativePrompt: (chapterId: string, placementMarker: string, prompt: string) => void;
  setGuidanceScale: (chapterId: string, placementMarker: string, scale: number) => void;
  setLoraModel: (chapterId: string, placementMarker: string, model: string | null) => void;
  setLoraStrength: (chapterId: string, placementMarker: string, strength: number) => void;
  
  // Batch controls
  resetAdvancedControls: (chapterId: string, placementMarker: string) => void;
  resetAllAdvancedControls: (chapterId: string) => void;
  
  // Utilities
  getImageState: (chapterId: string, placementMarker: string) => ImageState | null;
  getImageProgress: (chapterId: string) => { completed: number; total: number } | null;
  hasImagesInProgress: () => boolean;
  getAdvancedControls: (chapterId: string, placementMarker: string) => {
    steeringImage: string | null;
    negativePrompt: string;
    guidanceScale: number;
    loraModel: string | null;
    loraStrength: number;
  };
  
  // Metrics
  updateMetrics: (metrics: Partial<ImageGenerationMetrics>) => void;
  clearMetrics: () => void;
}

export type ImageSlice = ImageSliceState & ImageSliceActions;

export const createImageSlice: StateCreator<
  any,
  [],
  [],
  ImageSlice
> = (set, get) => ({
  // Initial state
  generatedImages: {},
  steeringImages: {},
  negativePrompts: {},
  guidanceScales: {},
  loraModels: {},
  loraStrengths: {},
  imageGenerationMetrics: null,
  imageGenerationProgress: {},
  
  // Image generation
  handleGenerateImages: async (chapterId) => {
    const state = get();
    const context: ImageGenerationContext = {
      chapters: (state as any).chapters || new Map(),
      settings: (state as any).settings,
      activePromptTemplate: (state as any).activePromptTemplate,
      steeringImages: state.steeringImages,
      negativePrompts: state.negativePrompts,
      guidanceScales: state.guidanceScales,
      loraModels: state.loraModels,
      loraStrengths: state.loraStrengths
    };
    
    const chapter = context.chapters.get(chapterId);
    if (!chapter?.translationResult?.suggestedIllustrations) {
      debugLog('image', 'summary', `[ImageSlice] No suggested illustrations for chapter ${chapterId}; skipping generation.`);
      return;
    }

    const imageModel = context.settings?.imageModel;
    if (!imageModel || imageModel.toLowerCase() === 'none') {
      debugLog('image', 'summary', `[ImageSlice] Image generation disabled for ${chapterId}; clearing metrics.`);
      set({ imageGenerationMetrics: null });
      return;
    }

    const totalIllustrations = chapter.translationResult.suggestedIllustrations.length;
    debugLog('image', 'summary', `[ImageSlice] Starting image generation for ${chapterId}. Illustrations: ${totalIllustrations}`);
    
    // Initialize progress tracking
    set(prevState => ({
      imageGenerationProgress: {
        ...prevState.imageGenerationProgress,
        [chapterId]: { completed: 0, total: totalIllustrations }
      }
    }));
    
    const result = await ImageGenerationService.generateImages(
      chapterId,
      context,
      (imageStates) => {
        // Update image states and progress
        const summary = Object.entries(imageStates).reduce<Record<string, { isLoading: boolean; hasData: boolean; error: string | null }>>((acc, [key, state]) => {
          acc[key] = {
            isLoading: state.isLoading,
            hasData: !!state.data,
            error: state.error,
          };
          return acc;
        }, {});
        debugLog('image', 'full', `[ImageSlice] Progress update for ${chapterId}`, summary);
        set(prevState => {
          const completed = Object.values(imageStates).filter(
            state => !state.isLoading && (state.data || state.error)
          ).length;
          
          return {
            generatedImages: { ...prevState.generatedImages, ...imageStates },
            imageGenerationProgress: {
              ...prevState.imageGenerationProgress,
              [chapterId]: { completed, total: totalIllustrations }
            }
          };
        });
      }
    );
    
    // Update final states
    set(prevState => ({
      generatedImages: { ...prevState.generatedImages, ...result.generatedImages },
      imageGenerationMetrics: result.metrics || prevState.imageGenerationMetrics,
      imageGenerationProgress: {
        ...prevState.imageGenerationProgress,
        [chapterId]: { completed: totalIllustrations, total: totalIllustrations }
      }
    }));

    debugLog('image', 'summary', `[ImageSlice] Image generation finished for ${chapterId}`, result.metrics);
    
    // Clean up progress after a delay
    setTimeout(() => {
      set(prevState => {
        const newProgress = { ...prevState.imageGenerationProgress };
        delete newProgress[chapterId];
        return { imageGenerationProgress: newProgress };
      });
    }, 5000);
  },
  
  handleRetryImage: async (chapterId, placementMarker) => {
    const state = get();
    const context: ImageGenerationContext = {
      chapters: (state as any).chapters || new Map(),
      settings: (state as any).settings,
      activePromptTemplate: (state as any).activePromptTemplate,
      steeringImages: state.steeringImages,
      negativePrompts: state.negativePrompts,
      guidanceScales: state.guidanceScales,
      loraModels: state.loraModels,
      loraStrengths: state.loraStrengths
    };
    
    const key = `${chapterId}:${placementMarker}`;
    
    // Set loading state
    set(prevState => ({
      generatedImages: {
        ...prevState.generatedImages,
        [key]: { isLoading: true, data: null, error: null }
      }
    }));

    debugLog('image', 'summary', `[ImageSlice] Retrying image for ${key}`);

    const result = await ImageGenerationService.retryImage(chapterId, placementMarker, context);

    // Update image state
    set(prevState => ({
      generatedImages: {
        ...prevState.generatedImages,
        [key]: result.imageState
      }
    }));

    debugLog('image', 'summary', `[ImageSlice] Retry completed for ${key}`, result.metrics);
    
    // Update metrics if provided
    if (result.metrics) {
      get().updateMetrics(result.metrics);
    }
  },
  
  loadExistingImages: (chapterId) => {
    const chapters = (get() as any).chapters || new Map();
    const chapter = chapters.get(chapterId);

    // DIAGNOSTIC: Log detailed information before loading
    console.log('[ImageSlice:loadExistingImages] Called for chapter', {
      chapterId,
      hasChapter: !!chapter,
      hasTranslationResult: !!chapter?.translationResult,
      hasSuggestedIllustrations: !!chapter?.translationResult?.suggestedIllustrations,
      suggestedIllustrationsCount: chapter?.translationResult?.suggestedIllustrations?.length || 0,
      suggestedIllustrationsData: chapter?.translationResult?.suggestedIllustrations,
      currentGeneratedImagesKeys: Object.keys(get().generatedImages)
    });

    const existingImages = ImageGenerationService.loadExistingImages(chapterId, chapters);
    const count = Object.keys(existingImages).length;

    // DIAGNOSTIC: Log what was loaded
    console.log('[ImageSlice:loadExistingImages] Loaded existing images', {
      chapterId,
      loadedImageCount: count,
      imageKeys: Object.keys(existingImages),
      imageDetails: existingImages
    });

    debugLog('image', 'summary', `[ImageSlice] Hydrated ${count} existing images for ${chapterId}`);

    if (count > 0) {
      set(prevState => ({
        generatedImages: { ...prevState.generatedImages, ...existingImages }
      }));
    }
  },
  
  // Image state management
  setImageState: (key, state) => {
    set(prevState => ({
      generatedImages: {
        ...prevState.generatedImages,
        [key]: state
      }
    }));
  },
  
  clearImageState: (chapterId) => {
    set(prevState => {
      const newGeneratedImages = { ...prevState.generatedImages };
      const newSteeringImages = { ...prevState.steeringImages };
      const newNegativePrompts = { ...prevState.negativePrompts };
      const newGuidanceScales = { ...prevState.guidanceScales };
      const newLoraModels = { ...prevState.loraModels };
      const newLoraStrengths = { ...prevState.loraStrengths };
      
      // Remove all entries for this chapter
      Object.keys(newGeneratedImages).forEach(key => {
        if (key.startsWith(`${chapterId}:`)) {
          delete newGeneratedImages[key];
        }
      });
      
      Object.keys(newSteeringImages).forEach(key => {
        if (key.startsWith(`${chapterId}:`)) {
          delete newSteeringImages[key];
        }
      });
      
      Object.keys(newNegativePrompts).forEach(key => {
        if (key.startsWith(`${chapterId}:`)) {
          delete newNegativePrompts[key];
        }
      });
      
      Object.keys(newGuidanceScales).forEach(key => {
        if (key.startsWith(`${chapterId}:`)) {
          delete newGuidanceScales[key];
        }
      });
      
      Object.keys(newLoraModels).forEach(key => {
        if (key.startsWith(`${chapterId}:`)) {
          delete newLoraModels[key];
        }
      });
      
      Object.keys(newLoraStrengths).forEach(key => {
        if (key.startsWith(`${chapterId}:`)) {
          delete newLoraStrengths[key];
        }
      });
      
      return {
        generatedImages: newGeneratedImages,
        steeringImages: newSteeringImages,
        negativePrompts: newNegativePrompts,
        guidanceScales: newGuidanceScales,
        loraModels: newLoraModels,
        loraStrengths: newLoraStrengths
      };
    });
  },
  
  clearAllImages: () => {
    set({
      generatedImages: {},
      steeringImages: {},
      negativePrompts: {},
      guidanceScales: {},
      loraModels: {},
      loraStrengths: {},
      imageGenerationMetrics: null,
      imageGenerationProgress: {}
    });
  },
  
  // Advanced controls
  setSteeringImage: (chapterId, placementMarker, imagePath) => {
    const key = `${chapterId}:${placementMarker}`;
    set(prevState => ({
      steeringImages: {
        ...prevState.steeringImages,
        [key]: imagePath
      }
    }));
  },
  
  setNegativePrompt: (chapterId, placementMarker, prompt) => {
    const key = `${chapterId}:${placementMarker}`;
    set(prevState => ({
      negativePrompts: {
        ...prevState.negativePrompts,
        [key]: prompt
      }
    }));
  },
  
  setGuidanceScale: (chapterId, placementMarker, scale) => {
    const key = `${chapterId}:${placementMarker}`;
    set(prevState => ({
      guidanceScales: {
        ...prevState.guidanceScales,
        [key]: scale
      }
    }));
  },
  
  setLoraModel: (chapterId, placementMarker, model) => {
    const key = `${chapterId}:${placementMarker}`;
    set(prevState => ({
      loraModels: {
        ...prevState.loraModels,
        [key]: model
      }
    }));
  },
  
  setLoraStrength: (chapterId, placementMarker, strength) => {
    const key = `${chapterId}:${placementMarker}`;
    set(prevState => ({
      loraStrengths: {
        ...prevState.loraStrengths,
        [key]: strength
      }
    }));
  },
  
  // Batch controls
  resetAdvancedControls: (chapterId, placementMarker) => {
    const key = `${chapterId}:${placementMarker}`;
    set(prevState => {
      const newState = { ...prevState };
      delete newState.steeringImages[key];
      delete newState.negativePrompts[key];
      delete newState.guidanceScales[key];
      delete newState.loraModels[key];
      delete newState.loraStrengths[key];
      return newState;
    });
  },
  
  resetAllAdvancedControls: (chapterId) => {
    set(prevState => {
      const newSteeringImages = { ...prevState.steeringImages };
      const newNegativePrompts = { ...prevState.negativePrompts };
      const newGuidanceScales = { ...prevState.guidanceScales };
      const newLoraModels = { ...prevState.loraModels };
      const newLoraStrengths = { ...prevState.loraStrengths };
      
      Object.keys(newSteeringImages).forEach(key => {
        if (key.startsWith(`${chapterId}:`)) {
          delete newSteeringImages[key];
        }
      });
      
      Object.keys(newNegativePrompts).forEach(key => {
        if (key.startsWith(`${chapterId}:`)) {
          delete newNegativePrompts[key];
        }
      });
      
      Object.keys(newGuidanceScales).forEach(key => {
        if (key.startsWith(`${chapterId}:`)) {
          delete newGuidanceScales[key];
        }
      });
      
      Object.keys(newLoraModels).forEach(key => {
        if (key.startsWith(`${chapterId}:`)) {
          delete newLoraModels[key];
        }
      });
      
      Object.keys(newLoraStrengths).forEach(key => {
        if (key.startsWith(`${chapterId}:`)) {
          delete newLoraStrengths[key];
        }
      });
      
      return {
        steeringImages: newSteeringImages,
        negativePrompts: newNegativePrompts,
        guidanceScales: newGuidanceScales,
        loraModels: newLoraModels,
        loraStrengths: newLoraStrengths
      };
    });
  },
  
  // Utilities
  getImageState: (chapterId, placementMarker) => {
    const key = `${chapterId}:${placementMarker}`;
    return get().generatedImages[key] || null;
  },
  
  getImageProgress: (chapterId) => {
    return get().imageGenerationProgress[chapterId] || null;
  },
  
  hasImagesInProgress: () => {
    const { generatedImages } = get();
    return Object.values(generatedImages).some(state => state.isLoading);
  },
  
  getAdvancedControls: (chapterId, placementMarker) => {
    const key = `${chapterId}:${placementMarker}`;
    const state = get();
    const settings = (state as any).settings;
    
    return {
      steeringImage: state.steeringImages[key] || null,
      negativePrompt: state.negativePrompts[key] || settings?.defaultNegativePrompt || '',
      guidanceScale: state.guidanceScales[key] || settings?.defaultGuidanceScale || 3.5,
      loraModel: state.loraModels[key] || null,
      loraStrength: state.loraStrengths[key] || 0.8
    };
  },
  
  // Metrics
  updateMetrics: (metrics) => {
    set(prevState => {
      const currentMetrics = prevState.imageGenerationMetrics;
      
      if (!currentMetrics) {
        return {
          imageGenerationMetrics: {
            count: metrics.count || 0,
            totalTime: metrics.totalTime || 0,
            totalCost: metrics.totalCost || 0,
            lastModel: metrics.lastModel || ''
          }
        };
      }
      
      return {
        imageGenerationMetrics: {
          count: currentMetrics.count + (metrics.count || 0),
          totalTime: currentMetrics.totalTime + (metrics.totalTime || 0),
          totalCost: currentMetrics.totalCost + (metrics.totalCost || 0),
          lastModel: metrics.lastModel || currentMetrics.lastModel
        }
      };
    });
  },
  
  clearMetrics: () => {
    set({ imageGenerationMetrics: null });
  },
  
  // Update illustration prompt and persist to IndexedDB
  updateIllustrationPrompt: async (chapterId, placementMarker, newPrompt) => {
    try {
      // Get current state to access chapters and settings
      const state = get() as any;
      const chapters = state.chapters;
      const settings = state.settings;
      const activePromptTemplate = state.activePromptTemplate;
      
      const chapter = chapters?.get(chapterId);
      if (!chapter || !chapter.translationResult || !Array.isArray(chapter.translationResult.suggestedIllustrations)) {
        console.warn(`[ImageSlice] Cannot update illustration prompt: chapter ${chapterId} not found or has no illustrations`);
        return;
      }

      const idx = chapter.translationResult.suggestedIllustrations.findIndex(
        (s: any) => s.placementMarker === placementMarker
      );
      if (idx < 0) {
        console.warn(`[ImageSlice] Illustration with marker ${placementMarker} not found in chapter ${chapterId}`);
        return;
      }

      // Update in-memory state
      const chaptersActions = state as any;
      if (chaptersActions.updateChapter) {
        // Clone the chapter and update the specific illustration
        const updatedIllustrations = [...chapter.translationResult.suggestedIllustrations];
        updatedIllustrations[idx] = {
          ...updatedIllustrations[idx],
          imagePrompt: newPrompt
        };
        
        chaptersActions.updateChapter(chapterId, {
          translationResult: {
            ...chapter.translationResult,
            suggestedIllustrations: updatedIllustrations
          }
        });
        
        debugLog('translation', 'summary', `[ImageSlice] ✅ Updated illustration prompt for ${placementMarker} in memory`);
      }

      // Persist to IndexedDB by updating existing translation record
      await TranslationPersistenceService.persistUpdatedTranslation(
        chapterId,
        chapter.translationResult as any,
        {
          provider: settings?.provider,
          model: settings?.model,
          temperature: settings?.temperature,
          systemPrompt: settings?.systemPrompt,
          promptId: activePromptTemplate?.id,
          promptName: activePromptTemplate?.name,
        }
      );
      
      debugLog('translation', 'summary', `[ImageSlice] ✅ Updated illustration prompt persisted for ${placementMarker}`);
      
    } catch (error) {
      console.error(`[ImageSlice] Failed to update illustration prompt for ${placementMarker}:`, error);
    }
  }
});
