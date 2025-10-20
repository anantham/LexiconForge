/**
 * Session Export/Import Types
 */

import type { NovelProvenance } from './novel';

export interface SessionMetadata {
  format: 'lexiconforge-session';
  version: '2.0';
  exportedAt: string;
}

export interface SessionNovelInfo {
  id: string;
  title: string;
}

export interface SessionVersion {
  versionId: string;
  displayName: string;
  style: 'faithful' | 'liberal' | 'image-heavy' | 'audio-enhanced' | 'other';
  features: string[];
}

export interface SessionProvenance extends NovelProvenance {
  // Inherits all fields from NovelProvenance
}

export interface SessionData {
  metadata: SessionMetadata;
  novel: SessionNovelInfo;
  version: SessionVersion;
  provenance?: SessionProvenance;
  chapters: any[];  // Will be defined by existing chapter types
  settings?: any;    // EPUB and other settings
}
