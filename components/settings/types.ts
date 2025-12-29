import type { NovelMetadata } from '../../types/novel';
import type { ImageCacheKey } from '../../types';

/**
 * Cover image reference from the gallery
 * Points to a generated image in a chapter
 */
export interface CoverImageRef {
  chapterId: string;
  marker: string;
  cacheKey: ImageCacheKey | null;
}

export type PublisherMetadata = NovelMetadata & {
  title?: string;
  alternateTitles?: string[];
  translatorName?: string;
  translatorWebsite?: string;
  translatorBio?: string;
  translatorRating?: number;
  translationApproach?: string;
  versionDescription?: string;
  contentNotes?: string;
  /** Selected cover image from the gallery */
  coverImage?: CoverImageRef;
};
