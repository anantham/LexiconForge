import { AppSettings } from '../../types';

export interface ChapterForEpub {
  title: string;
  originalTitle?: string;
  content: string;
  originalUrl: string;
  url?: string;
  translatedTitle: string;
  translatedContent?: string;
  prevUrl?: string | null;
  nextUrl?: string | null;
  usageMetrics: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    estimatedCost: number;
    requestTime: number;
    provider: string;
    model: string;
  };
  images: Array<{ 
    marker: string;
    imageData: string; // base64 data URL
    prompt: string;
  }>;
  footnotes?: Array<{ 
    marker: string;
    text: string;
  }>;
}

export interface TranslationStats {
  totalCost: number;
  totalTime: number;
  totalTokens: number;
  chapterCount: number;
  imageCount: number;
  providerBreakdown: Record<string, {
    chapters: number;
    cost: number;
    time: number;
    tokens: number;
  }>;
  modelBreakdown: Record<string, {
    chapters: number;
    cost: number;
    time: number;
    tokens: number;
  }>;
}

export interface TelemetryInsights {
  totalEvents: number;
  sessionDurationMs: number;
  navigation: { count: number; totalMs: number; averageMs: number };
  hydration: { count: number; totalMs: number; averageMs: number };
  chapterReady: { count: number; totalMs: number; averageMs: number };
  exports?: { json?: { count: number; totalMs: number; averageMs: number }; epub?: { count: number; totalMs: number; averageMs: number } };
}

export interface NovelConfig {
  title: string;
  author: string;
  originalTitle?: string;
  description?: string;
  genre?: string;
  language: string;
  originalLanguage?: string;
  coverImage?: string; // base64 or URL
  seriesName?: string;
  volumeNumber?: number;
  isbn?: string;
  publisher?: string;
  translationNotes?: string;
}

export interface EpubTemplate {
  gratitudeMessage?: string;
  projectDescription?: string;
  githubUrl?: string;
  additionalAcknowledgments?: string;
  customFooter?: string;
}

export interface EpubExportOptions {
  title?: string;
  author?: string;
  description?: string;
  chapters: ChapterForEpub[];
  settings: AppSettings;
  template?: EpubTemplate;
  novelConfig?: NovelConfig;
  telemetryInsights?: TelemetryInsights;
  includeTitlePage?: boolean;
  includeStatsPage?: boolean;
  customTemplate?: any;
  manualConfig?: any;
  chapterUrls?: string[];
}

export interface EpubChapter {
  id: string;
  title: string;
  xhtml: string;
  href: string;
}

export interface EpubMeta {
  title: string;
  author: string;
  description?: string;
  language?: string;
  identifier?: string;
  publisher?: string;
}