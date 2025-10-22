/**
 * Novel Library Types
 * Metadata for curated novel sessions with version support
 */

export interface TranslatorInfo {
  name: string;
  link?: string;
  bio?: string;  // Optional translator bio/introduction
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
  medianImagesPerChapter?: number;  // New: better centrality measure
  avgFootnotesPerChapter: number;
  medianFootnotesPerChapter?: number;  // New: better centrality measure
  avgChapterLength?: number;  // New: mean chapter length in characters
  medianChapterLength?: number;  // New: median chapter length
}

export interface VersionTranslationStats {
  translationType: 'human' | 'ai' | 'hybrid';
  aiPercentage?: number;  // If hybrid
  qualityRating?: number; // Community rating 1-5
  feedbackCount: number;
  // Auto-computed analytics from session.json
  amendmentCount?: number;  // Number of amendment proposals
  totalCost?: number;  // Total translation cost in USD
  totalTokens?: number;  // Total tokens used
  mostUsedModel?: string;  // Most frequently used model (format: "provider/model")
  dateRange?: {  // Translation date range
    start: string;  // ISO date
    end: string;    // ISO date
  };
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
  description?: string;  // What makes this version unique/special
  translationPhilosophy?: string;  // Translator's approach and philosophy
  contentNotes?: string;  // Additional notes about content/style
}

export interface SourceLinks {
  novelUpdates?: string;
  rawSource?: string;
  lnAdaptation?: string;
  bestTranslation?: string;
  manga?: string;
  anime?: string;
}

export interface NovelMetadata {
  originalLanguage: string;
  targetLanguage?: string;  // Make optional since versions have this
  chapterCount: number;      // Total chapters published for this novel (required)
  genres: string[];
  description: string;
  coverImageUrl?: string;
  author?: string;
  sourceLinks?: SourceLinks;
  tags?: string[];
  publicationStatus?: 'Ongoing' | 'Completed' | 'Hiatus' | 'Cancelled';
  originalPublicationDate?: string;
  lastUpdated: string;
  mediaCorrespondence?: MediaCorrespondenceAnchor[];  // Cross-media alignment anchors
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

// Cross-Media Correspondence Types
export interface MediaReference {
  // Range of content at this anchor point
  chapters?: { from: number; to: number };
  volume?: number;
  episodes?: {
    season?: number;
    from: number;
    to: number;
  };

  // Optional: Direct link to start reading/watching from here
  startUrl?: string;

  // Optional: Notes about this specific medium's coverage
  notes?: string;
}

export interface MediaCorrespondenceAnchor {
  id: string;
  label: string; // e.g., "Season 1 End", "Volume 3 Complete"
  description?: string;

  // References to each medium at this anchor point
  webNovel?: MediaReference;
  lightNovel?: MediaReference;
  manga?: MediaReference;
  manhua?: MediaReference;
  anime?: MediaReference;
  donghua?: MediaReference;
}
