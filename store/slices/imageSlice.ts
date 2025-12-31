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
import { ImageCacheStore } from '../../services/imageCacheService';
import { TranslationPersistenceService, type TranslationSettingsSnapshot } from '../../services/translationPersistenceService';
import { debugLog } from '../../utils/debug';
import type { GeneratedImageResult, ImageGenerationMetadata, ImageVersionStateEntry } from '../../types';
import { ImageOps } from '../../services/db/operations';

export interface ImageSliceState {
  // Generated images state
  generatedImages: Record<string, ImageState>; // chapterId:placementMarker -> ImageState

  // Version tracking (NEW)
  imageVersions: Record<string, number>; // chapterId:placementMarker -> latest version number (1-indexed)
  activeImageVersion: Record<string, number>; // chapterId:placementMarker -> currently displayed version

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
  loadExistingImages: (chapterId: string) => Promise<void>;
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
  
  // Version navigation (NEW)
  navigateToNextVersion: (chapterId: string, placementMarker: string) => void;
  navigateToPreviousVersion: (chapterId: string, placementMarker: string) => void;
  getVersionInfo: (chapterId: string, placementMarker: string) => { current: number; total: number } | null;
  deleteVersion: (chapterId: string, placementMarker: string, version?: number) => Promise<void>;

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
> = (set, get) => {
  const buildPersistenceSnapshot = (chapter: any): TranslationSettingsSnapshot | null => {
    const storeState = get();
    const settings = (storeState as any).settings;
    const promptTemplate = (storeState as any).activePromptTemplate;
    const chapterSnapshot = chapter?.translationSettingsSnapshot || {};

    const provider = chapterSnapshot.provider ?? settings?.provider;
    const model = chapterSnapshot.model ?? settings?.model;
    const temperature = chapterSnapshot.temperature ?? settings?.temperature ?? 0.7;
    const systemPrompt = chapterSnapshot.systemPrompt ?? settings?.systemPrompt ?? '';

    if (!provider || !model) {
      return null;
    }

    return {
      provider,
      model,
      temperature,
      systemPrompt,
      promptId: promptTemplate?.id,
      promptName: promptTemplate?.name
    };
  };

  const persistImageVersionState = async (chapterId: string, placementMarker: string, activeVersion: number) => {
    const storeState = get();
    const chapters = (storeState as any).chapters || new Map();
    const chapter = chapters.get(chapterId);
    if (!chapter?.translationResult) return;

    const versionStateMap = (chapter.translationResult as any).imageVersionState ?? {};
    const existingEntry = versionStateMap[placementMarker] as ImageVersionStateEntry | undefined;
    const versions = existingEntry?.versions ? { ...existingEntry.versions } : {};
    const latestFromStore = storeState.imageVersions?.[`${chapterId}:${placementMarker}`] ?? 0;
    const latestVersion = Math.max(
      existingEntry?.latestVersion ?? 0,
      latestFromStore,
      activeVersion
    );

    versionStateMap[placementMarker] = {
      latestVersion,
      activeVersion,
      versions
    };
    (chapter.translationResult as any).imageVersionState = versionStateMap;

    const snapshot = buildPersistenceSnapshot(chapter);
    if (!snapshot) return;

    try {
      await TranslationPersistenceService.persistUpdatedTranslation(
        chapter.id,
        chapter.translationResult as any,
        snapshot
      );
    } catch (error) {
      console.warn('[ImageSlice] Failed to persist image version state', {
        chapterId,
        placementMarker,
        error
      });
    }
  };

  return ({
  // Initial state
  generatedImages: {},
  imageVersions: {},
  activeImageVersion: {},
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
      loraStrengths: state.loraStrengths,
      imageVersions: state.imageVersions,
      activeImageVersion: state.activeImageVersion
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
      (imageStates, currentMetrics) => {
        // Update image states, progress, and metrics in real-time
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
            },
            // Update metrics in real-time as each image completes
            imageGenerationMetrics: currentMetrics ? {
              count: currentMetrics.count ?? 0,
              totalTime: currentMetrics.totalTime ?? 0,
              totalCost: currentMetrics.totalCost ?? 0,
              lastModel: currentMetrics.lastModel ?? ''
            } : prevState.imageGenerationMetrics
          };
        });
      }
    );
    
    // Update final states+version tracking
    set(prevState => {
      const versionUpdates: Record<string, number> = {};
      const activeUpdates: Record<string, number> = {};

      if (chapter?.translationResult?.suggestedIllustrations) {
        chapter.translationResult.suggestedIllustrations.forEach((illust: any) => {
          const marker = illust?.placementMarker;
          if (!marker) return;
          const key = `${chapterId}:${marker}`;
          const versionState = (chapter.translationResult as any)?.imageVersionState?.[marker];
          const version = versionState?.latestVersion ?? illust?.generatedImage?.imageCacheKey?.version ?? 1;

          const previousVersion = prevState.imageVersions[key] ?? 0;
          if (version > previousVersion) {
            versionUpdates[key] = version;
          } else if (!(key in prevState.imageVersions)) {
            versionUpdates[key] = version;
          }

          if (!(key in prevState.activeImageVersion)) {
            const activeVersion = versionState?.activeVersion ?? version;
            activeUpdates[key] = activeVersion;
          }
        });
      }

      return {
        generatedImages: { ...prevState.generatedImages, ...result.generatedImages },
        imageGenerationMetrics: result.metrics || prevState.imageGenerationMetrics,
        imageGenerationProgress: {
          ...prevState.imageGenerationProgress,
          [chapterId]: { completed: totalIllustrations, total: totalIllustrations }
        },
        imageVersions: Object.keys(versionUpdates).length > 0
          ? { ...prevState.imageVersions, ...versionUpdates }
          : prevState.imageVersions,
        activeImageVersion: Object.keys(activeUpdates).length > 0
          ? { ...prevState.activeImageVersion, ...activeUpdates }
          : prevState.activeImageVersion
      };
    });

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
    const key = `${chapterId}:${placementMarker}`;

    // Get next version number
    const currentMaxVersion = state.imageVersions[key] || 0;
    const nextVersion = currentMaxVersion + 1;

    const context: ImageGenerationContext = {
      chapters: (state as any).chapters || new Map(),
      settings: (state as any).settings,
      activePromptTemplate: (state as any).activePromptTemplate,
      steeringImages: state.steeringImages,
      negativePrompts: state.negativePrompts,
      guidanceScales: state.guidanceScales,
      loraModels: state.loraModels,
      loraStrengths: state.loraStrengths,
      imageVersions: state.imageVersions,
      activeImageVersion: state.activeImageVersion,
      nextVersion  // Pass version to generation service
    };

    const imageModel = context.settings?.imageModel;
    if (!imageModel || imageModel.toLowerCase() === 'none') {
      const message = 'Image generation is disabled. Pick an image model in Settings to generate illustrations.';
      const showNotification = (state as any).showNotification;
      if (typeof showNotification === 'function') {
        showNotification(message, 'warning');
      }

      debugLog(
        'image',
        'summary',
        `[ImageSlice] Retry skipped for ${key} (imageModel="${imageModel ?? 'undefined'}")`
      );

      set(prevState => ({
        generatedImages: {
          ...prevState.generatedImages,
          [key]: {
            isLoading: false,
            data: prevState.generatedImages[key]?.data ?? null,
            error: message,
          },
        },
      }));

      return;
    }

    // Set loading state
    set(prevState => ({
      generatedImages: {
        ...prevState.generatedImages,
        [key]: { isLoading: true, data: null, error: null }
      }
    }));

    debugLog('image', 'summary', `[ImageSlice] Retrying image for ${key} - creating version ${nextVersion}`);

    const result = await ImageGenerationService.retryImage(chapterId, placementMarker, context);

    const generationSucceeded = !result.imageState?.error;

    set(prevState => {
      const updates: Partial<ImageSliceState> = {
        generatedImages: {
          ...prevState.generatedImages,
          [key]: result.imageState
        }
      };

      if (generationSucceeded) {
        updates.imageVersions = {
          ...prevState.imageVersions,
          [key]: nextVersion
        };
        updates.activeImageVersion = {
          ...prevState.activeImageVersion,
          [key]: nextVersion
        };
      }

      return updates;
    });

    debugLog('image', 'summary', `[ImageSlice] Retry completed for ${key}`, result.metrics);
    
    // Update metrics if provided
    if (result.metrics) {
      get().updateMetrics(result.metrics);
    }
  },
  
  loadExistingImages: async (chapterId) => {
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

    const legacyMigrations: Promise<void>[] = [];

    if (chapter?.translationResult?.suggestedIllustrations) {
      const currentState = get();
      const persistenceSnapshot = buildPersistenceSnapshot(chapter);

      chapter.translationResult.suggestedIllustrations.forEach((illust: any) => {
        const legacyUrl = illust?.url;
        const hasCacheKey = !!illust?.generatedImage?.imageCacheKey;
        const marker = illust?.placementMarker;

        if (!marker) {
          return;
        }

        if (typeof legacyUrl === 'string' && legacyUrl.length > 0 && !hasCacheKey) {
          legacyMigrations.push((async () => {
            try {
              const { cacheKey } = await ImageCacheStore.migrateBase64Image(
                chapterId,
                marker,
                legacyUrl,
                1
              );

              if (!illust.generatedImage) {
                const migrated: GeneratedImageResult = {
                  imageData: '',
                  imageCacheKey: cacheKey,
                  requestTime: 0,
                  cost: 0
                };
                illust.generatedImage = migrated;
              } else {
                illust.generatedImage.imageCacheKey = cacheKey;
                illust.generatedImage.imageData = '';
              }

              delete (illust as any).url;

              const metadata: ImageGenerationMetadata = {
                version: cacheKey.version,
                prompt: illust?.imagePrompt || `Illustration ${marker}`,
                negativePrompt: currentState.negativePrompts?.[`${chapterId}:${marker}`],
                guidanceScale: currentState.guidanceScales?.[`${chapterId}:${marker}`],
                loraModel: currentState.loraModels?.[`${chapterId}:${marker}`] ?? null,
                loraStrength: currentState.loraStrengths?.[`${chapterId}:${marker}`],
                steeringImage: currentState.steeringImages?.[`${chapterId}:${marker}`] ?? null,
                provider: (currentState as any).settings?.provider ?? null,
                model: (currentState as any).settings?.imageModel ?? null,
                generatedAt: new Date().toISOString()
              };

              const existingState = (chapter.translationResult as any).imageVersionState ?? {};
              const existingEntry = existingState[marker] as ImageVersionStateEntry | undefined;
              const versions = existingEntry?.versions ? { ...existingEntry.versions } : {};
              versions[cacheKey.version] = metadata;

              const versionState: ImageVersionStateEntry = {
                latestVersion: Math.max(cacheKey.version, existingEntry?.latestVersion ?? 0),
                activeVersion: get().activeImageVersion?.[`${chapterId}:${marker}`] ?? cacheKey.version,
                versions
              };
              const currentVersionState = existingState;
              (chapter.translationResult as any).imageVersionState = {
                ...currentVersionState,
                [marker]: versionState
              };

              if (persistenceSnapshot) {
                await TranslationPersistenceService.persistUpdatedTranslation(
                  chapter.id,
                  chapter.translationResult as any,
                  persistenceSnapshot
                );
              }
            } catch (migrationError) {
              console.warn('[ImageSlice] Failed to migrate legacy base64 image', {
                chapterId,
                marker,
                error: migrationError
              });
            }
          })());
        }
      });
    }

    if (legacyMigrations.length > 0) {
      await Promise.allSettled(legacyMigrations);
    }

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

    const currentState = get();
    const versionUpdates: Record<string, number> = {};
    const activeUpdates: Record<string, number> = {};

    if (chapter?.translationResult?.suggestedIllustrations) {
      chapter.translationResult.suggestedIllustrations.forEach((illust: any) => {
        const marker = illust?.placementMarker;
        if (!marker) return;
        const key = `${chapterId}:${marker}`;
        const versionState = (chapter.translationResult as any)?.imageVersionState?.[marker];
        let version =
          versionState?.latestVersion ??
          illust?.generatedImage?.imageCacheKey?.version ??
          (typeof (illust as any)?.url === 'string' ? 1 : undefined);

        // If a version state exists but no concrete versions remain, keep a placeholder version so UI controls persist.
        if (versionState && (!version || version < 1)) {
          version = 1;
        }

        if (!version) return;

        const prevVersion = currentState.imageVersions?.[key] ?? 0;
        if (version > prevVersion || !(key in currentState.imageVersions)) {
          versionUpdates[key] = version;
        }

        if (!(key in currentState.activeImageVersion)) {
          const activeVersion =
            versionState?.activeVersion && versionState.activeVersion > 0
              ? versionState.activeVersion
              : version;
          activeUpdates[key] = activeVersion;
        }
      });
    }

    set(prevState => ({
      generatedImages: { ...prevState.generatedImages, ...existingImages },
      imageVersions: Object.keys(versionUpdates).length > 0
        ? { ...prevState.imageVersions, ...versionUpdates }
        : prevState.imageVersions,
      activeImageVersion: Object.keys(activeUpdates).length > 0
        ? { ...prevState.activeImageVersion, ...activeUpdates }
        : prevState.activeImageVersion
    }));
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
      imageVersions: {},
      activeImageVersion: {},
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
    const states = Object.values(generatedImages) as ImageState[];
    return states.some(state => state?.isLoading);
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

  // Version navigation
  navigateToNextVersion: (chapterId, placementMarker) => {
    const key = `${chapterId}:${placementMarker}`;
    let updatedVersion: number | null = null;
    set(state => {
      const currentVersion = state.activeImageVersion[key] || 1;
      const maxVersion = state.imageVersions[key] || 1;

      if (currentVersion < maxVersion) {
        debugLog('image', 'summary', `[ImageSlice] Navigate to next version: ${currentVersion} -> ${currentVersion + 1}`);
        updatedVersion = currentVersion + 1;
        return {
          activeImageVersion: {
            ...state.activeImageVersion,
            [key]: updatedVersion
          }
        };
      }

      return state; // Already at latest version
    });
    if (updatedVersion !== null) {
      void persistImageVersionState(chapterId, placementMarker, updatedVersion);
    }
  },

  navigateToPreviousVersion: (chapterId, placementMarker) => {
    const key = `${chapterId}:${placementMarker}`;
    let updatedVersion: number | null = null;
    set(state => {
      const currentVersion = state.activeImageVersion[key] || 1;

      if (currentVersion > 1) {
        debugLog('image', 'summary', `[ImageSlice] Navigate to previous version: ${currentVersion} -> ${currentVersion - 1}`);
        updatedVersion = currentVersion - 1;
        return {
          activeImageVersion: {
            ...state.activeImageVersion,
            [key]: updatedVersion
          }
        };
      }

      return state; // Already at first version
    });
    if (updatedVersion !== null) {
      void persistImageVersionState(chapterId, placementMarker, updatedVersion);
    }
  },

  getVersionInfo: (chapterId, placementMarker) => {
    const state = get();
    const key = `${chapterId}:${placementMarker}`;
    const hasKey = Object.prototype.hasOwnProperty.call(state.imageVersions, key);
    const totalVersions = hasKey ? state.imageVersions[key] : 0;

    if (totalVersions === 0) {
      const chapters = (state as any).chapters as Map<string, any> | undefined;
      const chapter = chapters?.get(chapterId);
      const hasIllustration = chapter?.translationResult?.suggestedIllustrations?.some(
        (ill: any) => ill?.placementMarker === placementMarker
      );

      if (!hasIllustration) return null;

      // Show placeholder controls so the marker can still be deleted or regenerated.
      return { current: 1, total: 1 };
    }

    const currentVersion = state.activeImageVersion[key] || totalVersions; // Default to latest

    return {
      current: currentVersion,
      total: totalVersions
    };
  },

  deleteVersion: async (chapterId, placementMarker, version) => {
    const state = get();
    const key = `${chapterId}:${placementMarker}`;
    const hasKey = Object.prototype.hasOwnProperty.call(state.imageVersions, key);
    const currentVersion = state.activeImageVersion[key] || state.imageVersions[key] || 1;
    const versionToDelete = version ?? currentVersion;
    const totalVersions = hasKey ? state.imageVersions[key] : 1;

    debugLog('image', 'summary', `[ImageSlice] Deleting version ${versionToDelete} for ${placementMarker} in chapter ${chapterId}`);

    try {
      let skippedIndexedDbCleanup = false;

      try {
        await ImageOps.deleteImageVersion(chapterId, placementMarker, versionToDelete);
      } catch (error: any) {
        const message = typeof error?.message === 'string' ? error.message : '';
        const isMissingChapter =
          message.includes('Chapter not found') ||
          message.includes('No active translation') ||
          message.includes('No image version state');

        if (isMissingChapter) {
          console.warn(`[ImageSlice] Record missing while deleting ${placementMarker} v${versionToDelete}; continuing with UI cleanup.`);
          skippedIndexedDbCleanup = true;
        } else {
          throw error;
        }
      }

      try {
        await ImageCacheStore.removeImage({
          chapterId,
          placementMarker,
          version: versionToDelete
        });
      } catch (cacheError) {
        console.warn('[ImageSlice] Failed to remove image from cache, continuing cleanup', cacheError);
      }

      // If we deleted the only version, clear all image state for this marker
      if (totalVersions === 1) {
        debugLog('image', 'summary', `[ImageSlice] Deleted last version, clearing all state for ${placementMarker}`);
        set(prevState => {
          const newGeneratedImages = { ...prevState.generatedImages };
          const newVersions = { ...prevState.imageVersions };
          const newActiveVersions = { ...prevState.activeImageVersion };
          const newSteeringImages = { ...prevState.steeringImages };
          const newNegativePrompts = { ...prevState.negativePrompts };
          const newGuidanceScales = { ...prevState.guidanceScales };
          const newLoraModels = { ...prevState.loraModels };
          const newLoraStrengths = { ...prevState.loraStrengths };

          delete newGeneratedImages[key];
          delete newVersions[key];
          delete newActiveVersions[key];
          delete newSteeringImages[key];
          delete newNegativePrompts[key];
          delete newGuidanceScales[key];
          delete newLoraModels[key];
          delete newLoraStrengths[key];

          return {
            generatedImages: newGeneratedImages,
            imageVersions: newVersions,
            activeImageVersion: newActiveVersions,
            steeringImages: newSteeringImages,
            negativePrompts: newNegativePrompts,
            guidanceScales: newGuidanceScales,
            loraModels: newLoraModels,
            loraStrengths: newLoraStrengths
          };
        });
      } else {
        // Multiple versions exist - adjust active version if needed
        let newActiveVersion = currentVersion;
        if (versionToDelete === currentVersion) {
          // If deleting current version, switch to latest remaining
          if (versionToDelete === totalVersions) {
            // Deleted the last version, go to previous
            newActiveVersion = totalVersions - 1;
          } else {
            // Deleted middle version, stay at same number (which now points to next version)
            newActiveVersion = versionToDelete;
          }
        }

        debugLog('image', 'summary', `[ImageSlice] Adjusting version tracking: total ${totalVersions} -> ${totalVersions - 1}, active ${currentVersion} -> ${newActiveVersion}`);

        set(prevState => ({
          imageVersions: {
            ...prevState.imageVersions,
            [key]: totalVersions - 1
          },
          activeImageVersion: {
            ...prevState.activeImageVersion,
            [key]: newActiveVersion
          }
        }));

        // Persist the new active version
        if (!skippedIndexedDbCleanup) {
          await persistImageVersionState(chapterId, placementMarker, newActiveVersion);
        }
      }

      debugLog('image', 'summary', `[ImageSlice] Successfully deleted version ${versionToDelete}`);
    } catch (error) {
      console.error(`[ImageSlice] Failed to delete version ${versionToDelete}:`, error);
      throw error;
    }
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
};
