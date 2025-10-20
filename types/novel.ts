/**
 * Novel Library Types
 * Metadata for curated novel sessions with version support
 */

export interface TranslatorInfo {
  name: string;
  link?: string;
}

export interface ChapterRange {
  from: number;
  to: number;
}

export interface VersionContentStats {
  totalImages: number;
  totalFootnotes: number;
  totalRawChapters: number;
  totalTranslatedChapters: number;
  avgImagesPerChapter: number;
  avgFootnotesPerChapter: number;
}

export interface VersionTranslationStats {
  translationType: 'human' | 'ai' | 'hybrid';
  aiPercentage?: number;  // If hybrid
  qualityRating?: number; // Community rating 1-5
  feedbackCount: number;
}

export interface ChapterCoverageStats {
  chaptersWithMultipleVersions: number;
  avgVersionsPerChapter: number;
  medianVersionsPerChapter: number;
  maxVersionsForAnyChapter: number;
  coverageDistribution: { [chapterNumber: number]: number }; // chapter -> version count
}

export interface VersionStats {
  downloads: number;
  fileSize: string;
  content: VersionContentStats;
  translation: VersionTranslationStats;
  coverage?: ChapterCoverageStats; // Optional: for aggregate view
}

export interface NovelVersion {
  versionId: string;
  displayName: string;
  translator: TranslatorInfo;
  sessionJsonUrl: string;
  targetLanguage: string;
  style: 'faithful' | 'liberal' | 'image-heavy' | 'audio-enhanced' | 'other';
  features: string[];
  chapterRange: ChapterRange;
  completionStatus: 'Complete' | 'In Progress' | 'Abandoned';
  lastUpdated: string;
  basedOn?: string;  // Parent version ID for forks
  stats: VersionStats;
  description?: string;
}

export interface SourceLinks {
  novelUpdates?: string;
  rawSource?: string;
  manga?: string;
  anime?: string;
}

export interface NovelMetadata {
  originalLanguage: string;
  targetLanguage?: string;  // Make optional since versions have this
  chapterCount?: number;     // Make optional since versions have ranges
  genres: string[];
  description: string;
  coverImageUrl?: string;
  author?: string;
  rating?: number;
  sourceLinks?: SourceLinks;
  translator?: string;       // Deprecated: use version.translator
  tags?: string[];
  publicationStatus?: 'Ongoing' | 'Completed' | 'Hiatus' | 'Cancelled';
  originalPublicationDate?: string;
  lastUpdated: string;
}

export interface NovelEntry {
  id: string;
  title: string;
  alternateTitles?: string[];
  sessionJsonUrl?: string;   // Deprecated: use versions
  metadata: NovelMetadata;
  versions?: NovelVersion[];  // New: multiple versions per novel
}

export interface NovelCatalog {
  version: string;
  lastUpdated: string;
  novels: NovelEntry[];
}

// New: Registry structure
export interface RegistryEntry {
  id: string;
  metadataUrl: string;
}

export interface Registry {
  version: string;
  lastUpdated: string;
  novels: RegistryEntry[];
}

// New: Session provenance tracking
export interface VersionContributor {
  name: string;
  link?: string;
  role: 'original-translator' | 'enhancer' | 'editor' | 'other';
  changes?: string;
  dateRange: string;
}

export interface NovelProvenance {
  originalCreator: {
    name: string;
    link?: string;
    versionId: string;
    createdAt: string;
  };
  forkedFrom?: {
    versionId: string;
    sessionUrl: string;
    forkedAt: string;
  };
  contributors: VersionContributor[];
}
