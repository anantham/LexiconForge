import type { GeneratedImageResult, ImageCacheKey } from '../../types';

export interface ChapterRecord {
  url: string;
  stableId?: string;
  title: string;
  content: string;
  originalUrl: string;
  nextUrl?: string;
  prevUrl?: string;
  fanTranslation?: string;
  dateAdded: string;
  lastAccessed: string;
  chapterNumber?: number;
  canonicalUrl?: string;
}

export interface ChapterSummaryRecord {
  stableId: string;
  canonicalUrl?: string;
  title: string;
  translatedTitle?: string;
  chapterNumber?: number;
  hasTranslation: boolean;
  hasImages: boolean;
  lastAccessed?: string;
  lastTranslatedAt?: string;
}

export interface ExportSessionOptions {
  includeChapters?: boolean;
  includeTelemetry?: boolean;
  includeImages?: boolean;
}

export interface ExportedImageAsset {
  chapterId: string | null;
  chapterUrl?: string | null;
  translationVersion: number;
  marker: string;
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
  source: 'cache' | 'legacy';
  cacheKey?: { chapterId: string; placementMarker: string; version: number };
}

export interface TranslationRecord {
  id: string;
  chapterUrl: string;
  stableId?: string;
  version: number;
  translatedTitle: string;
  translation: string;
  footnotes: Array<{ marker: string; text: string }>;
  suggestedIllustrations: Array<{
    placementMarker: string;
    imagePrompt: string;
    url?: string;
    generatedImage?: string | GeneratedImageResult;
    imageCacheKey?: ImageCacheKey;
  }>;
  provider: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  promptId?: string;
  promptName?: string;
  customVersionLabel?: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
  requestTime: number;
  createdAt: string;
  isActive: boolean;
  settingsSnapshot?: {
    provider: string;
    model: string;
    temperature: number;
    systemPrompt: string;
    promptId?: string;
    promptName?: string;
  };
  proposal?: {
    observation: string;
    currentRule: string;
    proposedChange: string;
    reasoning: string;
  };
}

export interface ChapterLookupResult {
  stableId: string;
  canonicalUrl: string;
  title: string;
  content: string;
  nextUrl?: string;
  prevUrl?: string;
  chapterNumber?: number;
  fanTranslation?: string;
  data: {
    chapter: {
      title: string;
      content: string;
      originalUrl: string;
      nextUrl?: string;
      prevUrl?: string;
      chapterNumber?: number;
    };
    translationResult: TranslationRecord | null;
  };
}

export interface SettingsRecord {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface FeedbackRecord {
  id: string;
  chapterUrl: string;
  translationId?: string;
  type: 'positive' | 'negative' | 'suggestion';
  selection: string;
  comment: string;
  createdAt: string;
}

export interface PromptTemplateRecord {
  id: string;
  name: string;
  description?: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
  lastUsed?: string;
}

export interface UrlMappingRecord {
  url: string;
  stableId: string;
  isCanonical: boolean;
  dateAdded: string;
}

export interface NovelRecord {
  id: string;
  title?: string;
  source: string;
  chapterCount: number;
  dateAdded: string;
  lastAccessed: string;
}

export interface AmendmentLogRecord {
  id: string;
  timestamp: number;
  chapterId?: string;
  proposal: {
    observation: string;
    currentRule: string;
    proposedChange: string;
    reasoning: string;
  };
  action: 'accepted' | 'rejected' | 'modified';
  finalPromptChange?: string;
  notes?: string;
}
