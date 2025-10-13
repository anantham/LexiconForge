/**
 * EPUB Export Pipeline Types
 *
 * Defines the contracts between each module in the export pipeline:
 * 1. Data Collector → Collected Chapters
 * 2. Asset Resolver → Resolved Assets
 * 3. Content Builder → HTML/Manifest
 * 4. Package Builder → Final EPUB Blob
 * 5. Export Service → Orchestration
 */

import type { AppSettings } from '../../types';

// ============================================================================
// EXPORT OPTIONS
// ============================================================================

export interface EpubExportOptions {
  /** Chapter ordering: by number or by navigation links */
  order: 'number' | 'navigation';

  /** Include title page */
  includeTitlePage: boolean;

  /** Include statistics page at end */
  includeStatsPage: boolean;

  /** Custom EPUB metadata overrides */
  metadata?: {
    gratitudeMessage?: string;
    projectDescription?: string;
    footer?: string | null;
  };

  /** Settings snapshot for statistics */
  settings: AppSettings;
}

// ============================================================================
// DATA COLLECTOR OUTPUT
// ============================================================================

export interface CollectedChapter {
  /** Stable chapter ID */
  id: string;

  /** Chapter number (for ordering) */
  chapterNumber?: number;

  /** Original title */
  title: string;

  /** Original content (HTML) */
  content: string;

  /** Translated title */
  translatedTitle?: string;

  /** Translated content (HTML) */
  translatedContent?: string;

  /** Footnotes */
  footnotes: Array<{ marker: string; text: string }>;

  /** Image references (not yet resolved) */
  imageReferences: Array<{
    placementMarker: string;
    prompt: string;
    cacheKey?: { chapterId: string; placementMarker: string };
    base64Fallback?: string; // Legacy data
  }>;

  /** Translation metadata for statistics */
  translationMeta?: {
    provider: string;
    model: string;
    cost: number;
    tokens: number;
    requestTime: number;
  };

  /** Navigation URLs */
  prevUrl?: string | null;
  nextUrl?: string | null;
}

export interface CollectedData {
  chapters: CollectedChapter[];

  /** Session metadata */
  metadata: {
    novelTitle?: string;
    totalChapters: number;
    translatedChapters: number;
    exportDate: string;
  };

  /** Warnings from collection phase */
  warnings: Array<{
    type: 'missing-translation' | 'missing-content' | 'ordering-gap';
    chapterId: string;
    message: string;
  }>;
}

// ============================================================================
// ASSET RESOLVER OUTPUT
// ============================================================================

export interface ResolvedAsset {
  /** Internal asset ID (e.g., "img-ch1-ILLUSTRATION-1") */
  id: string;

  /** MIME type (e.g., "image/png", "audio/mpeg") */
  mimeType: string;

  /** Binary data */
  data: ArrayBuffer;

  /** File extension for manifest (e.g., "png", "mp3") */
  extension: string;

  /** Original source reference */
  sourceRef: {
    chapterId: string;
    marker: string;
    type: 'image' | 'audio';
  };
}

export interface ResolvedChapter extends CollectedChapter {
  /** Image references now have resolved asset IDs */
  imageReferences: Array<{
    placementMarker: string;
    prompt: string;
    assetId?: string; // Set by resolver if asset found
    missing?: boolean; // True if cache miss
  }>;
}

export interface ResolvedAssets {
  chapters: ResolvedChapter[];
  assets: ResolvedAsset[];

  /** Asset resolution warnings */
  warnings: Array<{
    type: 'cache-miss' | 'invalid-data' | 'conversion-failed';
    assetId: string;
    chapterId: string;
    marker: string;
    message: string;
  }>;
}

// ============================================================================
// CONTENT BUILDER OUTPUT
// ============================================================================

export interface EpubManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
}

export interface EpubSpineItem {
  idref: string;
  linear?: 'yes' | 'no';
}

export interface EpubNavItem {
  title: string;
  href: string;
  children?: EpubNavItem[];
}

export interface BuiltContent {
  /** Per-chapter XHTML files */
  chapterFiles: Array<{
    filename: string; // e.g., "chapter-001.xhtml"
    content: string;  // XHTML string
    chapterId: string;
  }>;

  /** Optional title page XHTML */
  titlePage?: {
    filename: string;
    content: string;
  };

  /** Optional statistics page XHTML */
  statsPage?: {
    filename: string;
    content: string;
  };

  /** OPF manifest items (for content.opf) */
  manifestItems: EpubManifestItem[];

  /** OPF spine items (reading order) */
  spineItems: EpubSpineItem[];

  /** Navigation document structure */
  navigation: EpubNavItem[];

  /** Package metadata */
  packageMeta: {
    title: string;
    language: string;
    identifier: string;
    date: string;
  };
}

// ============================================================================
// PACKAGE BUILDER OUTPUT
// ============================================================================

export interface EpubPackage {
  /** Final EPUB as blob */
  blob: Blob;

  /** File size in bytes */
  sizeBytes: number;

  /** Package validation result */
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

// ============================================================================
// EXPORT SERVICE (ORCHESTRATION)
// ============================================================================

export interface ExportProgress {
  phase: 'collecting' | 'resolving' | 'building' | 'packaging' | 'complete' | 'error';
  percent: number; // 0-100
  message: string;
  detail?: string;
}

export type ProgressCallback = (progress: ExportProgress) => void;

export interface ExportResult {
  success: boolean;
  blob?: Blob;
  error?: string;

  /** Summary statistics */
  stats: {
    totalChapters: number;
    assetsResolved: number;
    assetsMissing: number;
    warnings: number;
    durationMs: number;
  };
}
