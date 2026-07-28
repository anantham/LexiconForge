import { NovelConfig } from '../types';

/**
 * Extracts novel title from chapter title by removing chapter numbering
 * Examples:
 * - "Eon: Chapter 1 – The Beginning" → "Eon"
 * - "Chapter 5: The Dark Lord" → "The Dark Lord"
 * - "Volume 2 Chapter 10 - Revelations" → "Revelations"
 */
export const extractNovelTitleFromChapter = (chapterTitle?: string): string | undefined => {
  if (!chapterTitle) return undefined;

  // Common patterns: "Novel: Chapter N", "Novel - Chapter N", "Chapter N: Title"
  const patterns = [
    /^(.+?):\s*(?:Chapter|Ch\.?|第)\s*\d+/i,  // "Eon: Chapter 1"
    /^(.+?)\s*[-–—]\s*(?:Chapter|Ch\.?|第)\s*\d+/i,  // "Eon - Chapter 1"
    /^(?:Volume|Vol\.?)\s*\d+\s*(?:Chapter|Ch\.?)\s*\d+\s*[-–—:]\s*(.+)$/i,  // "Vol 2 Ch 5: Title"
    /^(?:Chapter|Ch\.?|第)\s*\d+\s*[-–—:]\s*(.+)$/i,  // "Chapter 1: Title"
  ];

  for (const pattern of patterns) {
    const match = chapterTitle.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
};

/**
 * Drops keys whose value is undefined so a later spread cannot clobber
 * earlier defaults with undefined (e.g. { title: undefined } must not
 * overwrite defaultConfig.title).
 */
const omitUndefined = <T extends object>(obj?: Partial<T>): Partial<T> =>
  obj
    ? (Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined)
      ) as Partial<T>)
    : {};

/**
 * Gets novel configuration based on manual configuration, chapter data, or defaults.
 * Priority: manualConfig > site-generic URL hints > chapter title extraction > defaults.
 *
 * URL detection only supplies site-GENERIC hints (e.g. original language).
 * It must never assign novel-specific metadata (title/author/isbn/...), because a
 * site hosts many novels — hardcoding one novel's metadata per site shipped wrong
 * titles, authors and dc:identifiers for every other novel on that site.
 */
export const getNovelConfig = (
  firstChapterUrl?: string,
  manualConfig?: Partial<NovelConfig>,
  firstChapterTitle?: string
): NovelConfig => {
  // Default configuration
  const defaultConfig: NovelConfig = {
    title: 'Translated Novel',
    author: 'Unknown Author',
    language: 'en',
    originalLanguage: 'ja',
    publisher: 'LexiconForge Community'
  };

  // Site-generic hints based on URL patterns (never novel-specific metadata)
  const siteConfig: Partial<NovelConfig> = {};

  if (firstChapterUrl) {
    if (firstChapterUrl.includes('kakuyomu.jp') || firstChapterUrl.includes('syosetu.com')) {
      siteConfig.originalLanguage = 'ja';
    } else if (firstChapterUrl.includes('booktoki468.com')) {
      siteConfig.originalLanguage = 'ko';
    }
  }

  // Try to extract title from chapter if manualConfig did not provide one
  const hasManualTitle = manualConfig?.title && manualConfig.title !== 'Translated Novel';
  if (!hasManualTitle) {
    const extractedTitle = extractNovelTitleFromChapter(firstChapterTitle);
    if (extractedTitle) {
      siteConfig.title = extractedTitle;
      console.log(`[NovelConfig] Extracted novel title from chapter: "${extractedTitle}"`);
    }
  }

  return {
    ...defaultConfig,
    ...omitUndefined(siteConfig),
    ...omitUndefined(manualConfig)
  };
};
