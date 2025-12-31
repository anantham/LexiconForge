import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../../store';
import { useBlobUrl } from '../../hooks/useBlobUrl';
import { useNovelMetadata } from '../../hooks/useNovelMetadata';
import type { SuggestedIllustration, ImageCacheKey } from '../../types';
import type { TranslationRecord } from '../../services/db/types';
import ImageLightbox from './ImageLightbox';

export interface GalleryImage {
  chapterId: string;
  chapterTitle: string;
  marker: string;
  prompt: string;
  imageCacheKey: ImageCacheKey | null;
  // For legacy support
  legacyImageData?: string;
}

export const GalleryPanel: React.FC = () => {
  const chapters = useAppStore((s) => s.chapters);
  const { novelMetadata, setCoverImage } = useNovelMetadata(chapters);

  const [lightboxImage, setLightboxImage] = useState<GalleryImage | null>(null);
  const [idbTranslations, setIdbTranslations] = useState<TranslationRecord[]>([]);
  const [isLoadingFromIdb, setIsLoadingFromIdb] = useState(true);

  // Load all translations from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    const loadFromIdb = async () => {
      try {
        const { TranslationOps } = await import('../../services/db/operations/translations');
        const { ChapterOps } = await import('../../services/db/operations/chapters');

        const [allTranslations, allChapters] = await Promise.all([
          TranslationOps.getAll(),
          ChapterOps.getAll(),
        ]);

        if (cancelled) return;

        // Only keep active translations (one per chapter)
        const activeByStableId = new Map<string, TranslationRecord>();
        for (const t of allTranslations) {
          if (t.isActive && t.stableId) {
            activeByStableId.set(t.stableId, t);
          }
        }

        // For translations without stableId, use chapterUrl as key
        for (const t of allTranslations) {
          if (t.isActive && !t.stableId) {
            activeByStableId.set(t.chapterUrl, t);
          }
        }

        setIdbTranslations(Array.from(activeByStableId.values()));
      } catch (err) {
        console.error('[GalleryPanel] Failed to load translations from IndexedDB:', err);
      } finally {
        if (!cancelled) setIsLoadingFromIdb(false);
      }
    };

    loadFromIdb();
    return () => { cancelled = true; };
  }, []);

  // Collect all images from both in-memory chapters and IndexedDB translations
  const imagesByChapter = useMemo(() => {
    const result: Record<string, GalleryImage[]> = {};

    // First, add from in-memory chapters (these are the most up-to-date)
    chapters.forEach((chapter, chapterId) => {
      const illustrations = chapter.translationResult?.suggestedIllustrations || [];
      const chapterTitle = chapter.translationResult?.translatedTitle || chapter.title || chapterId;

      const images = illustrations
        .filter((ill: SuggestedIllustration) => {
          // Has any kind of image data
          return (
            ill.imageCacheKey ||
            ill.generatedImage?.imageCacheKey ||
            ill.generatedImage?.imageData ||
            ill.url
          );
        })
        .map((ill: SuggestedIllustration): GalleryImage => {
          const cacheKey = ill.imageCacheKey || ill.generatedImage?.imageCacheKey || null;
          const legacyData =
            ill.generatedImage?.imageData ||
            ill.url ||
            undefined;

          return {
            chapterId,
            chapterTitle,
            marker: ill.placementMarker,
            prompt: ill.imagePrompt,
            imageCacheKey: cacheKey,
            legacyImageData: legacyData,
          };
        });

      if (images.length > 0) {
        result[chapterId] = images;
      }
    });

    // Then, add from IndexedDB translations (for chapters not in memory)
    for (const translation of idbTranslations) {
      const chapterId = translation.stableId || translation.chapterUrl;

      // Skip if already have images from in-memory chapters
      if (result[chapterId]) continue;

      const illustrations = translation.suggestedIllustrations || [];
      const chapterTitle = translation.translatedTitle || chapterId;

      const images = illustrations
        .filter((ill) => {
          return (
            ill.imageCacheKey ||
            (ill.generatedImage as any)?.imageCacheKey ||
            (ill.generatedImage as any)?.imageData ||
            ill.url
          );
        })
        .map((ill): GalleryImage => {
          const genImg = ill.generatedImage as any;
          const cacheKey = ill.imageCacheKey || genImg?.imageCacheKey || null;
          const legacyData = genImg?.imageData || ill.url || undefined;

          return {
            chapterId,
            chapterTitle,
            marker: ill.placementMarker,
            prompt: ill.imagePrompt,
            imageCacheKey: cacheKey,
            legacyImageData: legacyData,
          };
        });

      if (images.length > 0) {
        result[chapterId] = images;
      }
    }

    return result;
  }, [chapters, idbTranslations]);

  const allImages = useMemo(() => {
    return Object.values(imagesByChapter).flat();
  }, [imagesByChapter]);

  const handleImageClick = useCallback((image: GalleryImage) => {
    setLightboxImage(image);
  }, []);

  const handleSetCover = useCallback(
    (image: GalleryImage) => {
      setCoverImage({
        chapterId: image.chapterId,
        marker: image.marker,
        cacheKey: image.imageCacheKey,
      });
    },
    [setCoverImage]
  );

  const handleCloseLightbox = useCallback(() => {
    setLightboxImage(null);
  }, []);

  const isCover = useCallback(
    (image: GalleryImage) => {
      if (!novelMetadata?.coverImage) return false;
      return (
        novelMetadata.coverImage.chapterId === image.chapterId &&
        novelMetadata.coverImage.marker === image.marker
      );
    },
    [novelMetadata?.coverImage]
  );

  if (isLoadingFromIdb) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4 animate-pulse">🖼️</div>
        <p className="text-lg text-gray-600 dark:text-gray-300">Loading gallery...</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Retrieving images from storage
        </p>
      </div>
    );
  }

  if (Object.keys(imagesByChapter).length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">🖼️</div>
        <p className="text-lg text-gray-600 dark:text-gray-300">No images generated yet</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Generate illustrations in chapters to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          Image Gallery
        </h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Cover: {novelMetadata?.coverImage ? '✓ Selected' : 'None'}
        </span>
      </div>

      {Object.entries(imagesByChapter).map(([chapterId, images]) => (
        <ChapterSection
          key={chapterId}
          title={images[0]?.chapterTitle || chapterId}
          images={images}
          onImageClick={handleImageClick}
          isCover={isCover}
        />
      ))}

      {lightboxImage && (
        <ImageLightbox
          image={lightboxImage}
          allImages={allImages}
          onClose={handleCloseLightbox}
          onSetCover={handleSetCover}
          isCover={isCover(lightboxImage)}
        />
      )}
    </div>
  );
};

interface ChapterSectionProps {
  title: string;
  images: GalleryImage[];
  onImageClick: (image: GalleryImage) => void;
  isCover: (image: GalleryImage) => boolean;
}

const ChapterSection: React.FC<ChapterSectionProps> = ({
  title,
  images,
  onImageClick,
  isCover,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 p-3 text-left font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <span className="text-xs">{collapsed ? '▶' : '▼'}</span>
        <span className="flex-1 truncate">{title}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {images.length} {images.length === 1 ? 'image' : 'images'}
        </span>
      </button>

      {!collapsed && (
        <div className="p-3 grid grid-cols-3 gap-3">
          {images.map((image, idx) => (
            <GalleryThumbnail
              key={`${image.marker}-${idx}`}
              image={image}
              onClick={() => onImageClick(image)}
              isCover={isCover(image)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface GalleryThumbnailProps {
  image: GalleryImage;
  onClick: () => void;
  isCover: boolean;
}

const GalleryThumbnail: React.FC<GalleryThumbnailProps> = ({ image, onClick, isCover }) => {
  // Use blob URL hook for cache key images
  const blobUrl = useBlobUrl(image.imageCacheKey);

  // Determine final image URL
  const imageUrl = blobUrl || image.legacyImageData || null;

  if (!imageUrl) {
    return (
      <div
        className="relative aspect-square rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer"
        onClick={onClick}
      >
        <span className="text-gray-400 text-2xl">?</span>
      </div>
    );
  }

  return (
    <div
      className="relative aspect-square cursor-pointer group"
      onClick={onClick}
    >
      <img
        src={imageUrl}
        alt={image.prompt}
        className="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-gray-600 group-hover:border-blue-500 transition-colors"
      />
      {isCover && (
        <div className="absolute top-1 left-1 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded font-medium">
          🏆 Cover
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors" />
    </div>
  );
};

export default GalleryPanel;
