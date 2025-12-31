import React from 'react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import PencilIcon from './icons/PencilIcon';

import AdvancedImageControls from './AdvancedImageControls';
import { isFluxModel } from '../utils/imageModelUtils';
import { getDefaultNegativePrompt, getDefaultGuidanceScale, getDefaultLoRAStrength } from '../services/configService';
import { useBlobUrl, isBase64DataUrl } from '../hooks/useBlobUrl';
import type { ImageCacheKey } from '../types';
import { debugLog } from '../utils/debug';
import { apiMetricsService } from '../services/apiMetricsService';

interface IllustrationProps {
  marker: string;
}

const normalizeMarker = (value?: string | null): string | null => {
  if (!value) return null;
  return value.trim().replace(/^\[|\]$/g, '').toUpperCase();
};

const Illustration: React.FC<IllustrationProps> = ({ marker }) => {
  const {
    currentChapterId,
    chapter,
    generatedImages,
    handleRetryImage,
    updateIllustrationPrompt,
    steeringImages,
    setSteeringImage,
    negativePrompts,
    setNegativePrompt,
    guidanceScales,
    setGuidanceScale,
    loraModels,
    setLoraModel,
    loraStrengths,
    setLoraStrength,
    settings,
    // Version navigation
    imageVersions,
    activeImageVersion,
    navigateToNextVersion,
    navigateToPreviousVersion,
    getVersionInfo,
    deleteVersion
  } = useAppStore(useShallow(s => ({
    currentChapterId: s.currentChapterId,
    chapter: s.currentChapterId ? s.getChapter(s.currentChapterId) : null,
    generatedImages: s.generatedImages,
    handleRetryImage: s.handleRetryImage,
    updateIllustrationPrompt: s.updateIllustrationPrompt,
    steeringImages: s.steeringImages,
    setSteeringImage: s.setSteeringImage,
    negativePrompts: s.negativePrompts,
    setNegativePrompt: s.setNegativePrompt,
    guidanceScales: s.guidanceScales,
    setGuidanceScale: s.setGuidanceScale,
    loraModels: s.loraModels,
    setLoraModel: s.setLoraModel,
    loraStrengths: s.loraStrengths,
    setLoraStrength: s.setLoraStrength,
    settings: s.settings,
    // Version navigation
    imageVersions: s.imageVersions,
    activeImageVersion: s.activeImageVersion,
    navigateToNextVersion: s.navigateToNextVersion,
    navigateToPreviousVersion: s.navigateToPreviousVersion,
    getVersionInfo: s.getVersionInfo,
    deleteVersion: s.deleteVersion
  })));

  // `chapter` is now selected from the store above; keep local reference for clarity
  // const chapter = currentChapterId ? getChapter(currentChapterId) : null;
  const normalizedMarker = React.useMemo(
    () => normalizeMarker(marker) ?? marker,
    [marker]
  );
  const illust = chapter?.translationResult?.suggestedIllustrations?.find(
    (i) => normalizeMarker(i.placementMarker) === normalizedMarker
  );
  const canonicalChapterId = chapter?.id ?? null;
  const candidateKeys = React.useMemo(() => {
    if (!canonicalChapterId) return [] as string[];

    const keys = new Set<string>();
    const addKey = (raw: string | null | undefined) => {
      if (!raw) return;
      keys.add(`${canonicalChapterId}:${raw}`);
      const normalized = normalizeMarker(raw);
      if (normalized && normalized !== raw) {
        keys.add(`${canonicalChapterId}:${normalized}`);
      }
      if (normalized && normalized !== marker) {
        keys.add(`${canonicalChapterId}:[${normalized}]`);
      }
    };

    addKey(marker);
    addKey(normalizedMarker);
    addKey(illust?.placementMarker);

    return Array.from(keys);
  }, [canonicalChapterId, marker, normalizedMarker, illust?.placementMarker]);

  const pickValue = React.useCallback(
    <T extends Record<string, any>>(map: T): T[keyof T] | undefined => {
      for (const key of candidateKeys) {
        if (key in map) {
          return map[key];
        }
      }
      return undefined;
    },
    [candidateKeys]
  );

  const canonicalMarkerForState = normalizedMarker ?? marker;

  // DIAGNOSTIC: Log illustration component mount and data
  React.useEffect(() => {
    debugLog('image', 'full', `[Illustration] Component mounted/updated for marker: ${marker}`, {
      chapterId: chapter?.id,
      marker,
      hasChapter: !!chapter,
      hasTranslationResult: !!chapter?.translationResult,
      totalSuggestedIllustrations: chapter?.translationResult?.suggestedIllustrations?.length || 0,
      allMarkers: chapter?.translationResult?.suggestedIllustrations?.map(i => i.placementMarker) || [],
      foundIllust: !!illust,
      illustData: illust
    });
  }, [marker, chapter?.id, illust, normalizedMarker]);

  const imageState = React.useMemo(() => {
    if (!canonicalChapterId) return undefined;
    for (const key of candidateKeys) {
      const state = generatedImages[key];
      if (state) return state;
    }
    return undefined;
  }, [candidateKeys, generatedImages, canonicalChapterId]);
  const base64FromIllust = (illust as any)?.url as string | undefined;
  const hasIllust = !!illust;
  const isLoading = imageState?.isLoading || false;
  const error = imageState?.error || null;

  // NEW: Support for Cache API with version tracking
  const baseCacheKey = illust?.generatedImage?.imageCacheKey ||
    (illust?.imageCacheKey as ImageCacheKey | undefined) || null;

  // Get version info for this illustration
  const versionInfo = canonicalChapterId && illust?.placementMarker
    ? getVersionInfo(canonicalChapterId, illust.placementMarker)
    : null;

  // Create cache key with active version (not latest)
  const imageCacheKey: ImageCacheKey | null = baseCacheKey && canonicalChapterId && illust?.placementMarker
    ? {
        chapterId: canonicalChapterId,
        placementMarker: illust.placementMarker,
        version: activeImageVersion[`${canonicalChapterId}:${illust.placementMarker}`] ||
                 imageVersions[`${canonicalChapterId}:${illust.placementMarker}`] ||
                 1
      }
    : null;

  // Use blob URL hook for cache keys (auto-cleanup on unmount)
  const blobUrlFromCache = useBlobUrl(imageCacheKey);

  // Determine final image URL (priority: generated state > cache > base64 fallback)
  const imageUrl = imageState?.data || // Currently generating/just generated
    blobUrlFromCache ||  // From Cache API (modern)
    (illust?.generatedImage?.imageData && isBase64DataUrl(illust.generatedImage.imageData)
      ? illust.generatedImage.imageData
      : null) ||  // Legacy base64 from generatedImage
    base64FromIllust ||  // Very old format (url field)
    null;

  const base64 = imageUrl; // Keep variable name for backwards compat with rest of component

  const [draftPrompt, setDraftPrompt] = React.useState<string>(illust?.imagePrompt || '');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [captionControlsVisible, setCaptionControlsVisible] = React.useState(false);

  // Countdown timer state for estimated time remaining
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = React.useState<number | null>(null);
  const [countdownStartTime, setCountdownStartTime] = React.useState<number | null>(null);
  const [estimatedTotalTime, setEstimatedTotalTime] = React.useState<number | null>(null);

  // Effect to manage countdown timer when loading starts/stops
  React.useEffect(() => {
    if (isLoading) {
      // Fetch estimated time when loading starts
      const imageModel = settings?.imageModel;

      const fetchEstimatedTime = async () => {
        let estimatedSeconds: number;

        if (imageModel) {
          // Try model-specific average first
          const timeData = await apiMetricsService.getAverageImageGenerationTime(imageModel);
          if (timeData?.avgTimeSeconds) {
            estimatedSeconds = timeData.avgTimeSeconds;
          } else {
            // Fall back to median of all models
            const medianTime = await apiMetricsService.getMedianImageGenerationTime();
            estimatedSeconds = medianTime;
          }
        } else {
          // No model selected, use median of all data
          const medianTime = await apiMetricsService.getMedianImageGenerationTime();
          estimatedSeconds = medianTime;
        }

        setEstimatedTotalTime(estimatedSeconds);
        setEstimatedTimeRemaining(estimatedSeconds);
        setCountdownStartTime(Date.now());
      };

      fetchEstimatedTime();
    } else {
      // Reset countdown when loading completes
      setEstimatedTimeRemaining(null);
      setCountdownStartTime(null);
      setEstimatedTotalTime(null);
    }
  }, [isLoading, settings?.imageModel]);

  // Effect to update countdown every second
  React.useEffect(() => {
    if (!isLoading || countdownStartTime === null || estimatedTotalTime === null) {
      return;
    }

    const intervalId = setInterval(() => {
      const elapsed = (Date.now() - countdownStartTime) / 1000;
      const remaining = Math.max(0, estimatedTotalTime - elapsed);
      setEstimatedTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isLoading, countdownStartTime, estimatedTotalTime]);

  // Advanced controls state
  const controlsKey = canonicalChapterId
    ? `${canonicalChapterId}:${canonicalMarkerForState}`
    : `?:${canonicalMarkerForState}`;
  const selectedSteeringImage = (pickValue(steeringImages) as string | null | undefined) ?? null;
  const currentNegativePrompt =
    (pickValue(negativePrompts) as string | undefined) ||
    negativePrompts[controlsKey] ||
    settings.defaultNegativePrompt ||
    getDefaultNegativePrompt();
  const currentGuidanceScale =
    (pickValue(guidanceScales) as number | undefined) ||
    guidanceScales[controlsKey] ||
    settings.defaultGuidanceScale ||
    getDefaultGuidanceScale();
  const currentLoRAModel =
    (pickValue(loraModels) as string | null | undefined) ??
    loraModels[controlsKey] ??
    null;
  const currentLoRAStrength =
    (pickValue(loraStrengths) as number | undefined) ||
    loraStrengths[controlsKey] ||
    getDefaultLoRAStrength();

  // Check if current image model supports advanced features
  const supportsAdvancedFeatures = isFluxModel(settings.imageModel);

  React.useEffect(() => {
    setDraftPrompt(illust?.imagePrompt || '');
  }, [illust?.imagePrompt, marker, chapter?.id]);

  const savePromptIfChanged = async () => {
    if (!chapter || !illust) return;
    const trimmed = (draftPrompt || '').trim();
    if (trimmed === (illust.imagePrompt || '').trim()) return;
    const targetMarker = illust.placementMarker || marker;
    try {
      setIsSaving(true);
      await updateIllustrationPrompt(chapter.id, targetMarker, trimmed);
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = () => setIsEditing(true);
  const cancelEditing = () => { setDraftPrompt(illust?.imagePrompt || ''); setIsEditing(false); };
  const saveAndClose = async () => { await savePromptIfChanged(); setIsEditing(false); };

  const handleSteeringImageChange = (imagePath: string | null) => {
    if (chapter) {
      setSteeringImage(chapter.id, canonicalMarkerForState, imagePath);
    }
  };

  const handleNegativePromptChange = (negativePrompt: string) => {
    if (chapter) {
      setNegativePrompt(chapter.id, canonicalMarkerForState, negativePrompt);
    }
  };

  const handleGuidanceScaleChange = (guidanceScale: number) => {
    if (chapter) {
      setGuidanceScale(chapter.id, canonicalMarkerForState, guidanceScale);
    }
  };

  const handleLoRAChange = (loraType: string | null) => {
    if (chapter) {
      setLoraModel(chapter.id, canonicalMarkerForState, loraType);
    }
  };

  const handleLoRAStrengthChange = (strength: number) => {
    if (chapter) {
      setLoraStrength(chapter.id, canonicalMarkerForState, strength);
    }
  };

  return (
    <div className="my-6 flex justify-center flex-col items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      {isLoading && (
        <div className="flex flex-col items-center justify-center h-48">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Generating illustration...</p>
          {estimatedTimeRemaining !== null && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
              {estimatedTimeRemaining > 0
                ? `~${Math.ceil(estimatedTimeRemaining)}s remaining`
                : 'Almost done...'}
            </p>
          )}
          {estimatedTotalTime !== null && countdownStartTime !== null && (
            <div className="mt-2 w-32 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-1000 ease-linear"
                style={{
                  width: `${Math.min(100, ((estimatedTotalTime - (estimatedTimeRemaining ?? 0)) / estimatedTotalTime) * 100)}%`
                }}
              />
            </div>
          )}
        </div>
      )}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center min-h-48 text-center p-4">
          <p className="text-red-500 font-semibold mb-2">Image generation failed</p>
          
          {/* Multi-line error display */}
          <div className="text-xs text-gray-600 dark:text-gray-400 max-w-md mb-4">
            {error.split('\n').map((line, index) => (
              <p key={index} className={line.startsWith('•') ? 'ml-2 mt-1' : line.startsWith('Suggestions:') ? 'font-semibold mt-2 mb-1' : ''}>
                {line}
              </p>
            ))}
          </div>
          {hasIllust && (
            <div className="w-full max-w-xl text-left mb-3">
              <div className="flex items-start justify-between gap-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">Illustration prompt</label>
                {!isEditing && (
                  <button onClick={startEditing} className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white" title="Edit caption" aria-label="Edit caption">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
              {!isEditing && (
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{illust?.imagePrompt || 'No prompt provided.'}</p>
              )}
              {isEditing && (
                <div>
                  <textarea
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    value={draftPrompt}
                    onChange={(e) => setDraftPrompt(e.target.value)}
                    placeholder="Describe the image you want..."
                  />
                  <div className="mt-2 flex gap-2">
                    <button onClick={saveAndClose} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition disabled:opacity-60" disabled={isSaving}>
                      {isSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={cancelEditing} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-xs rounded-md">Cancel</button>
                  </div>
                </div>
              )}
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Edit the prompt and retry to generate a new image.</p>
            </div>
          )}
          
          {/* Advanced Image Controls - Only for Flux models */}
          {supportsAdvancedFeatures && (
            <div className="w-full max-w-xl mb-3">
              <AdvancedImageControls
                selectedSteeringImage={selectedSteeringImage}
                onSteeringImageChange={handleSteeringImageChange}
                negativePrompt={currentNegativePrompt}
                guidanceScale={currentGuidanceScale}
                selectedLoRA={currentLoRAModel}
                loraStrength={currentLoRAStrength}
                onNegativePromptChange={handleNegativePromptChange}
                onGuidanceScaleChange={handleGuidanceScaleChange}
                onLoRAChange={handleLoRAChange}
                onLoRAStrengthChange={handleLoRAStrengthChange}
                defaultNegativePrompt={settings.defaultNegativePrompt || getDefaultNegativePrompt()}
                defaultGuidanceScale={settings.defaultGuidanceScale || getDefaultGuidanceScale()}
              />
            </div>
          )}
          <div className="flex gap-2">
            {hasIllust && (
              <button
                onClick={async () => {
                  await savePromptIfChanged();
                  setIsEditing(false);
                  if (chapter) {
                    const retryMarker = illust?.placementMarker ?? marker;
                    handleRetryImage(chapter.id, retryMarker);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition disabled:opacity-60"
                disabled={isSaving}
              >
                {isSaving ? 'Saving…' : 'Retry Generation'}
              </button>
            )}
          </div>
        </div>
      )}
      {!isLoading && !error && base64 && (
        <>
          <img
            src={base64}
            alt={illust?.imagePrompt || `Illustration ${marker}`}
            className="rounded-lg shadow-lg max-w-full h-auto border-4 border-gray-200 dark:border-gray-700"
          />

          {hasIllust && (
            <div className="w-full max-w-xl text-left mt-3">
              {/* Caption toggle button */}
              <button
                onClick={() => setCaptionControlsVisible(!captionControlsVisible)}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                <span>{captionControlsVisible ? '▼' : '▶'}</span>
                <span>Caption controls</span>
                {!captionControlsVisible && illust?.imagePrompt && (
                  <span className="text-xs text-gray-500 dark:text-gray-500 truncate max-w-xs ml-1">
                    — {illust.imagePrompt.slice(0, 50)}{illust.imagePrompt.length > 50 ? '...' : ''}
                  </span>
                )}
              </button>

              {/* Collapsible caption controls */}
              {captionControlsVisible && (
                <div className="mt-3 space-y-3 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                  <div className="flex items-start justify-between gap-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">Caption</label>
                    {!isEditing && (
                      <button onClick={startEditing} className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white" title="Edit caption" aria-label="Edit caption">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {!isEditing && (
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{illust?.imagePrompt || 'No caption.'}</p>
                  )}
                  {isEditing && (
                    <div>
                      <textarea
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        value={draftPrompt}
                        onChange={(e) => setDraftPrompt(e.target.value)}
                        placeholder="Describe or refine the image…"
                      />
                      <div className="mt-2 flex gap-2">
                        <button onClick={saveAndClose} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition disabled:opacity-60" disabled={isSaving}>
                          {isSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={cancelEditing} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-xs rounded-md">Cancel</button>
                      </div>
                    </div>
                  )}
                  
                  {/* Advanced Image Controls - Only for Flux models */}
                  {supportsAdvancedFeatures && (
                    <div>
                      <AdvancedImageControls
                        selectedSteeringImage={selectedSteeringImage}
                        onSteeringImageChange={handleSteeringImageChange}
                        negativePrompt={currentNegativePrompt}
                        guidanceScale={currentGuidanceScale}
                        selectedLoRA={currentLoRAModel}
                        loraStrength={currentLoRAStrength}
                        onNegativePromptChange={handleNegativePromptChange}
                        onGuidanceScaleChange={handleGuidanceScaleChange}
                        onLoRAChange={handleLoRAChange}
                        onLoRAStrengthChange={handleLoRAStrengthChange}
                        defaultNegativePrompt={settings.defaultNegativePrompt || getDefaultNegativePrompt()}
                        defaultGuidanceScale={settings.defaultGuidanceScale || getDefaultGuidanceScale()}
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        await savePromptIfChanged();
                        setIsEditing(false);
                        if (chapter) {
                          const retryMarker = illust?.placementMarker ?? marker;
                          handleRetryImage(chapter.id, retryMarker);
                        }
                      }}
                      className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition disabled:opacity-60"
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving…' : 'Regenerate'}
                    </button>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">try editing the caption and click regenerate to see a new image!</span>
                  </div>

                  {/* Version Navigation Controls - inside collapsible */}
                  {versionInfo && versionInfo.total >= 1 && canonicalChapterId && illust?.placementMarker && (
                    <div className="flex items-center justify-between gap-3 mt-3 px-3 py-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {versionInfo.total > 1 && (
                          <>
                            <button
                              onClick={() => navigateToPreviousVersion(canonicalChapterId, illust.placementMarker)}
                              disabled={versionInfo.current <= 1}
                              className="px-2 py-1 text-sm font-semibold rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
                              title="Previous version"
                            >
                              &lt;
                            </button>
                            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium min-w-[100px] text-center">
                              Version {versionInfo.current} of {versionInfo.total}
                            </span>
                            <button
                              onClick={() => navigateToNextVersion(canonicalChapterId, illust.placementMarker)}
                              disabled={versionInfo.current >= versionInfo.total}
                              className="px-2 py-1 text-sm font-semibold rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
                              title="Next version"
                            >
                              &gt;
                            </button>
                          </>
                        )}
                        {versionInfo.total === 1 && (
                          <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                            Version {versionInfo.current}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete version ${versionInfo.current}? This cannot be undone.`)) {
                            return;
                          }
                          try {
                            await deleteVersion(canonicalChapterId, illust.placementMarker);
                          } catch (error) {
                            console.error('Failed to delete version:', error);
                            alert('Failed to delete version. See console for details.');
                          }
                        }}
                        className="px-2 py-1 text-sm font-semibold rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                        title="Delete this version"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!isLoading && !error && !base64 && hasIllust && (
        <div className="flex flex-col items-center justify-center w-full text-center p-2">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">No image yet for {marker}.</p>
          
          <div className="w-full max-w-xl text-left">
            {/* Caption toggle button */}
            <button
              onClick={() => setCaptionControlsVisible(!captionControlsVisible)}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <span>{captionControlsVisible ? '▼' : '▶'}</span>
              <span>Image generation controls</span>
              {!captionControlsVisible && illust?.imagePrompt && (
                <span className="text-xs text-gray-500 dark:text-gray-500 truncate max-w-xs ml-1">
                  — {illust.imagePrompt.slice(0, 50)}{illust.imagePrompt.length > 50 ? '...' : ''}
                </span>
              )}
            </button>

            {/* Collapsible generation controls */}
            {captionControlsVisible && (
                <div className="mt-3 space-y-3 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                  <div className="flex items-start justify-between gap-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">Illustration prompt</label>
                    {!isEditing && (
                      <button onClick={startEditing} className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white" title="Edit prompt" aria-label="Edit prompt">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {!isEditing && (
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{illust?.imagePrompt || 'No prompt provided.'}</p>
                )}
                {isEditing && (
                  <div>
                    <textarea
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      value={draftPrompt}
                      onChange={(e) => setDraftPrompt(e.target.value)}
                      placeholder="Describe the image you want..."
                    />
                    <div className="mt-2 flex gap-2">
                      <button onClick={saveAndClose} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition disabled:opacity-60" disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={cancelEditing} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-xs rounded-md">Cancel</button>
                    </div>
                  </div>
                )}
                
                {/* Advanced Image Controls - Only for Flux models */}
                {supportsAdvancedFeatures && (
                  <div>
                    <AdvancedImageControls
                      selectedSteeringImage={selectedSteeringImage}
                      onSteeringImageChange={handleSteeringImageChange}
                      negativePrompt={currentNegativePrompt}
                      guidanceScale={currentGuidanceScale}
                      selectedLoRA={currentLoRAModel}
                      loraStrength={currentLoRAStrength}
                      onNegativePromptChange={handleNegativePromptChange}
                      onGuidanceScaleChange={handleGuidanceScaleChange}
                      onLoRAChange={handleLoRAChange}
                      onLoRAStrengthChange={handleLoRAStrengthChange}
                      defaultNegativePrompt={settings.defaultNegativePrompt || getDefaultNegativePrompt()}
                      defaultGuidanceScale={settings.defaultGuidanceScale || getDefaultGuidanceScale()}
                    />
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      await savePromptIfChanged();
                      setIsEditing(false);
                      if (chapter) {
                        const retryMarker = illust?.placementMarker ?? marker;
                        handleRetryImage(chapter.id, retryMarker);
                      }
                    }}
                    className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition disabled:opacity-60"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving…' : 'Generate Image'}
                  </button>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">click to generate image from prompt</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Illustration;
