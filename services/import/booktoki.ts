import { generateStableChapterId, normalizeUrlAggressively } from '../stableIdService';

export interface BookTokiScrapeMetadata {
  scrapeDate?: string;
  totalChapters?: number;
  source?: string;
  scraper?: string;
  version?: string;
  sessionStartTime?: string;
}

export interface BookTokiScrapeChapter {
  chapterNumber?: number;
  content?: string;
  title?: string;
  url?: string;
  nextUrl?: string;
  prevUrl?: string;
  timestamp?: string;
  koreanCount?: number;
  paragraphCount?: number;
}

export interface BookTokiScrapePayload {
  metadata: BookTokiScrapeMetadata;
  chapters: BookTokiScrapeChapter[];
}

export function isBookTokiScrapePayload(value: unknown): value is BookTokiScrapePayload {
  if (!value || typeof value !== 'object') return false;
  const obj = value as any;
  if (!obj.metadata || typeof obj.metadata !== 'object') return false;
  if (!Array.isArray(obj.chapters)) return false;

  const source = String(obj.metadata.source ?? '');
  if (!source.includes('booktoki')) return false;

  // Heuristic: at least one chapter has a URL and numeric chapterNumber.
  return obj.chapters.some((ch: any) => {
    const urlOk = typeof ch?.url === 'string' && ch.url.length > 0;
    const numOk = typeof ch?.chapterNumber === 'number' && Number.isFinite(ch.chapterNumber);
    return urlOk && numOk;
  });
}

type LexiconForgeNavigation = {
  history: string[];
  lastActive: { id: string } | null;
};

type LexiconForgeFullPayload = {
  metadata: Record<string, unknown> & { format: 'lexiconforge-full-1'; generatedAt: string };
  settings: unknown | null;
  navigation: LexiconForgeNavigation;
  urlMappings: Array<{
    url: string;
    stableId: string;
    isCanonical: boolean;
    dateAdded: string;
  }>;
  novels: Array<{
    id: string;
    title: string;
    source: string;
    chapterCount: number;
    dateAdded: string;
    lastAccessed: string;
  }>;
  chapters: Array<{
    stableId: string;
    canonicalUrl: string;
    title: string;
    content: string;
    fanTranslation: null;
    nextUrl: string | null;
    prevUrl: string | null;
    chapterNumber: number | null;
    translations: any[];
    feedback: any[];
  }>;
  promptTemplates: any[];
  amendmentLogs: any[];
  diffResults: any[];
  telemetry: null;
  images?: undefined;
};

const inferNovelId = (firstUrl: string): { id: string; source: string } => {
  try {
    const url = new URL(firstUrl);
    const source = url.hostname;
    const novelIdFromPath = url.pathname.match(/\/novel\/(\d+)/)?.[1] ?? 'unknown';
    return { id: `${source.replace(/[^a-z0-9]/gi, '')}_${novelIdFromPath}`, source };
  } catch {
    return { id: `booktoki_unknown_${Date.now()}`, source: 'booktoki' };
  }
};

const inferNovelTitle = (title: string): string => {
  // Common pattern: "<Novel name>-2화"
  const match = title.match(/^(.+?)-\s*\d+\s*화\b/);
  if (match?.[1]) return match[1].trim();
  return title.trim() || 'Imported BookToki Novel';
};

const normalizeMaybe = (url?: string): string | null => {
  const normalized = normalizeUrlAggressively(url);
  return normalized ?? (typeof url === 'string' ? url : null);
};

export function convertBookTokiToLexiconForgeFullPayload(
  payload: BookTokiScrapePayload
): LexiconForgeFullPayload {
  if (!payload.chapters || payload.chapters.length === 0) {
    throw new Error('BookToki payload has no chapters');
  }

  const generatedAt = new Date().toISOString();

  const converted = payload.chapters
    .map((ch, index) => {
      const rawUrl = typeof ch.url === 'string' ? ch.url : '';
      const canonicalUrl = normalizeMaybe(rawUrl);
      if (!canonicalUrl) return null;

      const chapterNumber =
        typeof ch.chapterNumber === 'number' && Number.isFinite(ch.chapterNumber)
          ? ch.chapterNumber
          : index + 1;

      const title = (ch.title || `Chapter ${chapterNumber}`).trim();
      const content = (ch.content || '').trim();

      const stableId = generateStableChapterId(content, chapterNumber, title);

      return {
        stableId,
        canonicalUrl,
        title,
        content,
        fanTranslation: null,
        nextUrl: normalizeMaybe(ch.nextUrl),
        prevUrl: normalizeMaybe(ch.prevUrl),
        chapterNumber,
        translations: [],
        feedback: [],
      };
    })
    .filter((ch): ch is NonNullable<typeof ch> => Boolean(ch));

  if (converted.length === 0) {
    throw new Error('BookToki payload had no importable chapters (missing URLs)');
  }

  converted.sort((a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0));

  const { id: novelId, source } = inferNovelId(converted[0].canonicalUrl);
  const novelTitle = inferNovelTitle(converted[0].title);

  const navigation: LexiconForgeNavigation = {
    history: converted.map((c) => c.stableId),
    lastActive: { id: converted[0].stableId },
  };

  const urlMappings = converted.map((c) => ({
    url: c.canonicalUrl,
    stableId: c.stableId,
    isCanonical: true,
    dateAdded: generatedAt,
  }));

  return {
    metadata: {
      format: 'lexiconforge-full-1',
      generatedAt,
      importSource: 'booktoki',
      booktoki: payload.metadata ?? null,
    },
    settings: null,
    navigation,
    urlMappings,
    novels: [
      {
        id: novelId,
        title: novelTitle,
        source,
        chapterCount: converted.length,
        dateAdded: generatedAt,
        lastAccessed: generatedAt,
      },
    ],
    chapters: converted.map((c) => ({
      stableId: c.stableId,
      canonicalUrl: c.canonicalUrl,
      title: c.title,
      content: c.content,
      fanTranslation: null,
      nextUrl: c.nextUrl,
      prevUrl: c.prevUrl,
      chapterNumber: c.chapterNumber ?? null,
      translations: [],
      feedback: [],
    })),
    promptTemplates: [],
    amendmentLogs: [],
    diffResults: [],
    telemetry: null,
  };
}

