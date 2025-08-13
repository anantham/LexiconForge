import React from 'react';
import useAppStore from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import Loader from './Loader';

interface IllustrationProps {
  marker: string;
}

const Illustration: React.FC<IllustrationProps> = ({ marker }) => {
  const { imageState } = useAppStore(useShallow(state => ({
    imageState: state.generatedImages[marker],
  })));

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
      </div>
    );
  }

  if (data) {
    return (
      <div className="my-6 flex justify-center">
        <img 
          src={data} 
          alt={`AI-generated illustration for marker ${marker}`}
          className="rounded-lg shadow-lg max-w-full h-auto border-4 border-gray-200 dark:border-gray-700"
        />
      </div>
    );
  }

  return null; // Should not be reached
};

export default Illustration;
