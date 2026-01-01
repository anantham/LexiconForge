import React, { useEffect, useCallback, useState } from 'react';
import { useBlobUrl } from '../../hooks/useBlobUrl';
import type { GalleryImage } from './GalleryPanel';
import CoverCropModal from './CoverCropModal';

interface ImageLightboxProps {
  image: GalleryImage;
  allImages: GalleryImage[];
  onClose: () => void;
  onSetCover: (image: GalleryImage, croppedDataUrl?: string) => void;
  isCover: boolean;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  image,
  allImages,
  onClose,
  onSetCover,
  isCover: initialIsCover,
}) => {
  const [currentIndex, setCurrentIndex] = useState(() =>
    allImages.findIndex(
      (img) => img.chapterId === image.chapterId && img.marker === image.marker
    )
  );

  const currentImage = allImages[currentIndex] || image;

  // Check if current image is cover
  const [isCoverCurrent, setIsCoverCurrent] = useState(initialIsCover);

  // Cover crop modal state
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);

  useEffect(() => {
    // Update cover status when navigating
    setIsCoverCurrent(
      currentImage.chapterId === image.chapterId && currentImage.marker === image.marker
        ? initialIsCover
        : false
    );
  }, [currentImage, image, initialIsCover]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
  }, [allImages.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
  }, [allImages.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToPrev, goToNext]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Open crop modal with current image
  const handleSetCoverClick = () => {
    // Get the image URL from the LightboxImage component's logic
    const blobUrl = currentImage.imageCacheKey ? null : currentImage.legacyImageData;
    // We'll use the LightboxImage's blobUrl, but need to get it here
    // For now, open crop modal and let it load the image
    setShowCropModal(true);
  };

  // Called when crop is confirmed
  const handleCropConfirm = (croppedDataUrl: string) => {
    onSetCover(currentImage, croppedDataUrl);
    setIsCoverCurrent(true);
    setShowCropModal(false);
    setCropImageUrl(null);
  };

  // Called when crop is cancelled
  const handleCropCancel = () => {
    setShowCropModal(false);
    setCropImageUrl(null);
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300 z-10"
        aria-label="Close"
      >
        ✕
      </button>

      {/* Navigation arrows */}
      {allImages.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-4xl hover:text-gray-300 z-10"
            aria-label="Previous image"
          >
            ◀
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-4xl hover:text-gray-300 z-10"
            aria-label="Next image"
          >
            ▶
          </button>
        </>
      )}

      {/* Main content */}
      <div
        className="max-w-4xl max-h-[90vh] flex flex-col items-center px-16"
        onClick={(e) => e.stopPropagation()}
      >
        <LightboxImage image={currentImage} />

        {/* Info panel */}
        <div className="mt-4 bg-gray-800 rounded-lg p-4 w-full max-w-xl">
          <div className="text-gray-400 text-sm">
            {currentImage.chapterTitle} • Image {currentIndex + 1} of {allImages.length}
          </div>
          <div className="text-white mt-2 text-sm line-clamp-3">
            Prompt: "{currentImage.prompt}"
          </div>

          <button
            onClick={handleSetCoverClick}
            disabled={isCoverCurrent}
            className={`mt-4 w-full py-2 rounded-lg font-medium transition-colors ${
              isCoverCurrent
                ? 'bg-green-600 text-white cursor-default'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isCoverCurrent ? '✓ Cover Selected' : '🏆 Set as Cover'}
          </button>
        </div>
      </div>

      {/* Cover Crop Modal */}
      {showCropModal && (
        <CropModalWrapper
          image={currentImage}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
};

// Wrapper to load image URL for crop modal
interface CropModalWrapperProps {
  image: GalleryImage;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

const CropModalWrapper: React.FC<CropModalWrapperProps> = ({ image, onConfirm, onCancel }) => {
  const blobUrl = useBlobUrl(image.imageCacheKey);
  const imageUrl = blobUrl || image.legacyImageData || null;

  if (!imageUrl) {
    return (
      <div className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center">
        <div className="text-white">Loading image...</div>
      </div>
    );
  }

  return (
    <CoverCropModal
      imageUrl={imageUrl}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};

interface LightboxImageProps {
  image: GalleryImage;
}

const LightboxImage: React.FC<LightboxImageProps> = ({ image }) => {
  // Use blob URL hook for cache key images
  const blobUrl = useBlobUrl(image.imageCacheKey);
  const imageUrl = blobUrl || image.legacyImageData || null;

  if (!imageUrl) {
    return (
      <div className="w-96 h-96 flex items-center justify-center bg-gray-700 rounded-lg">
        <span className="text-gray-400 text-4xl">?</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={image.prompt}
      className="max-h-[70vh] object-contain rounded-lg"
    />
  );
};

export default ImageLightbox;
