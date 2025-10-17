/**
 * Novel Library Types
 * Metadata for curated novel sessions
 */

export interface NovelMetadata {
  originalLanguage: string;
  targetLanguage: string;
  chapterCount: number;
  genres: string[];
  description: string;
  coverImageUrl?: string;
  author?: string;
  rating?: number;
  sourceUrl?: string;        // Where original chapters are hosted
  sourceName?: string;        // e.g., "Novel Updates", "Kakuyomu"
  translator?: string;        // Original translator if applicable
  tags?: string[];
  lastUpdated: string;
}

export interface NovelEntry {
  id: string;                 // URL-safe slug: 'dungeon-defense'
  title: string;              // Display name: 'Dungeon Defense'
  sessionJsonUrl: string;     // Where session JSON is hosted
  metadata: NovelMetadata;
}

export interface NovelCatalog {
  version: string;
  lastUpdated: string;
  novels: NovelEntry[];
}
