import type { EnhancedChapter } from '../stableIdService';
import type { NovelMetadata } from '../../types/novel';
import type { TranslationResult } from '../../types';

export type StoredNovelMetadata = NovelMetadata & {
  title?: string;
  alternateTitles?: string[];
};

export type HydratedTranslationResult = TranslationResult & {
  id: string;
  version?: number;
  customVersionLabel?: string;
  createdAt?: string;
  isActive?: boolean;
  stableId?: string;
  chapterUrl?: string;
};

export interface NavigationContext {
  chapters: Map<string, EnhancedChapter>;
  urlIndex: Map<string, string>;
  rawUrlIndex: Map<string, string>;
  navigationHistory: string[];
  hydratingChapters: Record<string, boolean>;
}

export interface NavigationResult {
  chapterId?: string;
  chapter?: EnhancedChapter;
  error?: string;
  shouldUpdateBrowserHistory?: boolean;
  navigationHistory?: string[];
}

export interface FetchResult {
  chapters?: Map<string, EnhancedChapter>;
  urlIndex?: Map<string, string>;
  rawUrlIndex?: Map<string, string>;
  novels?: Map<string, any>;
  currentChapterId?: string;
  navigationHistory?: string[];
  error?: string;
}
