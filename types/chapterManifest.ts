/** Exact publication identities for one hosted-library version. */
export interface ChapterArtifactReference {
  url: string;
  sha256: string;
  byteLength: number;
}

export interface PublishedChapterIdentity {
  chapterNumber: number;
  stableId: string;
  canonicalUrl: string;
  /** Reserved for independently downloadable chapter artifacts. */
  artifact?: ChapterArtifactReference;
}

export interface ChapterPublicationManifest {
  format: 'lexiconforge-chapter-manifest';
  version: '1.0';
  novelId: string;
  versionId: string;
  generatedAt: string;
  /** Expected size of the work; it may exceed what this version has published. */
  expectedChapterCount: number;
  /** Exact number of currently published identities in `chapters`. */
  publishedChapterCount: number;
  session: ChapterArtifactReference;
  chapters: PublishedChapterIdentity[];
}

export interface ChapterManifestContext {
  novelId?: string;
  versionId?: string;
  sessionUrl?: string;
  expectedChapterCount?: number;
  publishedChapterCount?: number;
  chapterRange?: { from: number; to: number };
  completionStatus?: 'Complete' | 'In Progress' | 'Abandoned';
}
