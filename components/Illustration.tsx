import React from 'react';
import useAppStore from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import Loader from './Loader';
import RefreshIcon from './icons/RefreshIcon';

interface IllustrationProps {
  marker: string;
}

const Illustration: React.FC<IllustrationProps> = ({ marker }) => {
  const { imageState, retryFailedImages, currentUrl, sessionData } = useAppStore(useShallow(state => ({
    imageState: state.generatedImages[marker],
    retryFailedImages: state.retryFailedImages,
    currentUrl: state.currentUrl,
    sessionData: state.sessionData, // Add sessionData to fetched state
  })));

  // Try to get cached image data from IndexedDB (via sessionData)
  const cachedIllustration = currentUrl && sessionData[currentUrl]?.translationResult?.suggestedIllustrations?.find(
    (illust) => illust.placementMarker === marker
  );
  const cachedImageData = cachedIllustration?.url; // This is the base64 data from IndexedDB

  const handleRetry = async () => {
    if (currentUrl) {
      await retryFailedImages(currentUrl);
    }
  };

  if (!imageState) {
    // This can happen briefly before the state is initialized
    return <Loader text={`Initializing illustration ${marker}...`} />;
  }

  const { isLoading, data, error } = imageState;

  if (isLoading) {
    return <Loader text={`Generating illustration for ${marker}...`} />;
  }

  if (error) {
    return (
      <div className="my-4 p-4 border border-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
        <p className="font-semibold text-red-700 dark:text-red-300">Illustration Failed</p>
        <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
        <button
          onClick={handleRetry}
          className="mt-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md flex items-center gap-1 mx-auto transition-colors"
          title="Retry image generation"
        >
          <RefreshIcon className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  // Prioritize cached image data if available
  const displayImageData = cachedImageData || data;

  if (displayImageData) {
    return (
      <div className="my-6 flex justify-center flex-col items-center">
        <img 
          src={displayImageData} 
          alt={imageState.imagePrompt} // Changed alt to imagePrompt
          className="rounded-lg shadow-lg max-w-full h-auto border-4 border-gray-200 dark:border-gray-700"
        />
        {imageState.imagePrompt && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic text-center max-w-prose">
            {imageState.imagePrompt} (Marker: {marker})
          </p>
        )}
      </div>
    );
  }

  return null; // Should not be reached
};

export default Illustration;
