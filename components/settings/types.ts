import type { NovelMetadata } from '../../types/novel';

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
};
