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
  /** Pre-cropped base64 data URL for portrait EPUB cover */
  croppedCoverData?: string;
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
