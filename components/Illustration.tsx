import React from 'react';
import useAppStore from '../store/useAppStore';

interface IllustrationProps {
  marker: string;
}

const Illustration: React.FC<IllustrationProps> = ({ marker }) => {
  const currentChapterId = useAppStore(s => s.currentChapterId);
  const chapter = useAppStore(s => (s.currentChapterId ? s.getChapterById(s.currentChapterId) : null));

  const illust = chapter?.translationResult?.suggestedIllustrations?.find(
    (i) => i.placementMarker === marker
  );
  const base64 = (illust as any)?.url as string | undefined;

  if (!base64) return null; // Nothing to show yet

  return (
    <div className="my-6 flex justify-center flex-col items-center">
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
    </div>
  );
};

export default Illustration;
