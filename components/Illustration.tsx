import React from 'react';
import useAppStore from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

interface IllustrationProps {
  marker: string;
}

const Illustration: React.FC<IllustrationProps> = ({ marker }) => {
  const {
    currentChapterId,
    getChapterById,
    generatedImages,
    handleRetryImage
  } = useAppStore(useShallow(s => ({
    currentChapterId: s.currentChapterId,
    getChapterById: s.getChapterById,
    generatedImages: s.generatedImages,
    handleRetryImage: s.handleRetryImage,
  })));

  const chapter = currentChapterId ? getChapterById(currentChapterId) : null;
  const illust = chapter?.translationResult?.suggestedIllustrations?.find(
    (i) => i.placementMarker === marker
  );

  const imageState = generatedImages[marker];

  if (!imageState) return null; // Nothing to show yet

  const { isLoading, data: base64, error } = imageState;

  return (
    <div className="my-6 flex justify-center flex-col items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      {isLoading && (
        <div className="flex flex-col items-center justify-center h-48">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Generating illustration...</p>
        </div>
      )}
      {error && (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <p className="text-red-500 font-semibold">Image generation failed</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md">{error}</p>
          <button
            onClick={() => handleRetryImage(chapter!.id, marker)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition"
          >
            Retry
          </button>
        </div>
      )}
      {base64 && (
        <>
          <img
            src={base64}
            alt={illust?.imagePrompt || `Illustration ${marker}`}
            className="rounded-lg shadow-lg max-w-full h-auto border-4 border-gray-200 dark:border-gray-700"
          />
          {illust?.imagePrompt && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic text-center max-w-prose">
              {illust.imagePrompt} (Marker: {marker})
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default Illustration;
