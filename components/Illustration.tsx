import React from 'react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import PencilIcon from './icons/PencilIcon';

import AdvancedImageControls from './AdvancedImageControls';
import { isFluxModel } from '../utils/imageModelUtils';
import { getDefaultNegativePrompt, getDefaultGuidanceScale, getDefaultLoRAStrength } from '../services/configService';

interface IllustrationProps {
  marker: string;
}

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
    settings
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
  })));

  // `chapter` is now selected from the store above; keep local reference for clarity
  // const chapter = currentChapterId ? getChapter(currentChapterId) : null;
  const illust = chapter?.translationResult?.suggestedIllustrations?.find(
    (i) => i.placementMarker === marker
  );

  // DIAGNOSTIC: Log illustration component mount and data
  React.useEffect(() => {
    console.log(`[Illustration] Component mounted/updated for marker: ${marker}`, {
      chapterId: chapter?.id,
      marker,
      hasChapter: !!chapter,
      hasTranslationResult: !!chapter?.translationResult,
      totalSuggestedIllustrations: chapter?.translationResult?.suggestedIllustrations?.length || 0,
      allMarkers: chapter?.translationResult?.suggestedIllustrations?.map(i => i.placementMarker) || [],
      foundIllust: !!illust,
      illustData: illust
    });
  }, [marker, chapter?.id, illust]);

  const key = chapter ? `${chapter.id}:${marker}` : `?:${marker}`;
  const imageState = generatedImages[key];
  const base64FromIllust = (illust as any)?.url as string | undefined;
  const hasIllust = !!illust;
  const isLoading = imageState?.isLoading || false;
  const base64 = imageState?.data || base64FromIllust || null;
  const error = imageState?.error || null;

  const [draftPrompt, setDraftPrompt] = React.useState<string>(illust?.imagePrompt || '');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [captionControlsVisible, setCaptionControlsVisible] = React.useState(false);
  
  // Advanced controls state
  const controlsKey = chapter ? `${chapter.id}:${marker}` : `?:${marker}`;
  const selectedSteeringImage = steeringImages[controlsKey] || null;
  const currentNegativePrompt = negativePrompts[controlsKey] || settings.defaultNegativePrompt || getDefaultNegativePrompt();
  const currentGuidanceScale = guidanceScales[controlsKey] || settings.defaultGuidanceScale || getDefaultGuidanceScale();
  const currentLoRAModel = loraModels[controlsKey] || null;
  const currentLoRAStrength = loraStrengths[controlsKey] || getDefaultLoRAStrength();
  
  // Check if current image model supports advanced features
  const supportsAdvancedFeatures = isFluxModel(settings.imageModel);

  React.useEffect(() => {
    setDraftPrompt(illust?.imagePrompt || '');
  }, [illust?.imagePrompt, marker, chapter?.id]);

  const savePromptIfChanged = async () => {
    if (!chapter || !illust) return;
    const trimmed = (draftPrompt || '').trim();
    if (trimmed === (illust.imagePrompt || '').trim()) return;
    try {
      setIsSaving(true);
      await updateIllustrationPrompt(chapter.id, marker, trimmed);
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = () => setIsEditing(true);
  const cancelEditing = () => { setDraftPrompt(illust?.imagePrompt || ''); setIsEditing(false); };
  const saveAndClose = async () => { await savePromptIfChanged(); setIsEditing(false); };

  const handleSteeringImageChange = (imagePath: string | null) => {
    if (chapter) {
      setSteeringImage(chapter.id, marker, imagePath);
    }
  };

  const handleNegativePromptChange = (negativePrompt: string) => {
    if (chapter) {
      setNegativePrompt(chapter.id, marker, negativePrompt);
    }
  };

  const handleGuidanceScaleChange = (guidanceScale: number) => {
    if (chapter) {
      setGuidanceScale(chapter.id, marker, guidanceScale);
    }
  };

  const handleLoRAChange = (loraType: string | null) => {
    if (chapter) {
      setLoraModel(chapter.id, marker, loraType);
    }
  };

  const handleLoRAStrengthChange = (strength: number) => {
    if (chapter) {
      setLoraStrength(chapter.id, marker, strength);
    }
  };

  return (
    <div className="my-6 flex justify-center flex-col items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      {isLoading && (
        <div className="flex flex-col items-center justify-center h-48">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Generating illustration...</p>
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
                onClick={async () => { await savePromptIfChanged(); setIsEditing(false); handleRetryImage(chapter!.id, marker); }}
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
                        defaultNegativePrompt={settings.defaultNegativePrompt}
                        defaultGuidanceScale={settings.defaultGuidanceScale}
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => { await savePromptIfChanged(); setIsEditing(false); handleRetryImage(chapter!.id, marker); }}
                      className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition disabled:opacity-60"
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving…' : 'Regenerate'}
                    </button>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">try editing the caption and click regenerate to see a new image!</span>
                  </div>
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
                    onClick={async () => { await savePromptIfChanged(); setIsEditing(false); handleRetryImage(chapter!.id, marker); }}
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
