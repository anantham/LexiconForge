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
 * Gets novel configuration based on URL, chapter data, or manual configuration
 * Priority: manualConfig > URL pattern detection > chapter title extraction > defaults
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

  // Novel-specific configurations based on URL patterns
  let novelSpecificConfig: Partial<NovelConfig> = {};

  if (firstChapterUrl) {
    if (firstChapterUrl.includes('kakuyomu.jp')) {
      // Enhanced configuration based on Novel Updates data
      novelSpecificConfig = {
        title: 'The Reincarnation of the Strongest Exorcist in Another World',
        author: 'Kosuzu Kiichi',
        originalTitle: '最強陰陽師の異世界転生記 〜下僕の妖怪どもに比べてモンスターが弱すぎるんだが〜',
        description: 'Haruyoshi, the strongest exorcist was on the verge of death after the betrayal of his companions. Hoping to be happy in the next life, he tried the secret technique of reincarnation and was sent to a different world! Born into a family of magicians, the magic he failed to inherit was nothing compared to his previous skills as an exorcist. "Who needs magic? I\'ll survive in this world with my old techniques!"',
        genre: 'Action, Adventure, Fantasy, Harem, Romance',
        originalLanguage: 'ja',
        seriesName: 'The Reincarnation of the Strongest Exorcist',
        volumeNumber: 1,
        isbn: 'urn:uuid:strongest-exorcist-v1',
        publisher: 'Futabasha (Original) / J-Novel Club (English)',
        translationNotes: 'Translated from Japanese web novel published on Kakuyomu and Syosetu. Originally published in 2018 by Kosuzu Kiichi. Licensed by J-Novel Club for English publication. This is an AI-powered fan translation for educational and entertainment purposes.'
      };
    } else if (firstChapterUrl.includes('booktoki468.com')) {
      novelSpecificConfig = {
        title: 'Dungeon Defense',
        author: 'Yoo Heonhwa',
        originalTitle: '던전 디펜스',
        description: 'A dark fantasy novel about survival and strategy in a dungeon world where the protagonist must use cunning and manipulation to survive against overwhelming odds.',
        genre: 'Dark Fantasy, Strategy, Psychological',
        originalLanguage: 'ko',
        seriesName: 'Dungeon Defense',
        volumeNumber: 1,
        isbn: 'urn:uuid:dungeon-defense-v1',
        publisher: 'BookToki (Original)',
        translationNotes: 'Translated from Korean web novel published on BookToki. Known for its complex psychological elements and strategic gameplay mechanics.'
      };
    } else if (firstChapterUrl.includes('syosetu.com') || firstChapterUrl.includes('ncode.syosetu.com')) {
      // Syosetu - Japanese web novel platform
      novelSpecificConfig = {
        title: 'Web Novel from Syosetu',
        author: 'Unknown Syosetu Author',
        originalTitle: '小説家になろう作品',
        description: 'Japanese web novel from the popular Syosetu platform.',
        genre: 'Web Novel, Japanese Literature',
        originalLanguage: 'ja',
        publisher: 'Syosetu (Original)',
        translationNotes: 'Translated from Japanese web novel published on Syosetu (Shōsetsuka ni Narō).'
      };
    } else if (firstChapterUrl.includes('novelupdates.com')) {
      // Novel Updates - aggregator site
      novelSpecificConfig = {
        title: 'Novel from Novel Updates',
        author: 'Unknown Author',
        description: 'Novel sourced from Novel Updates database.',
        genre: 'Various',
        publisher: 'Novel Updates Community',
        translationNotes: 'Novel information sourced from Novel Updates community database.'
      };
    }
    // Add more novel configurations as needed
  }

  // Try to extract title from chapter if neither URL detection nor manualConfig provided one
  const hasManualTitle = manualConfig?.title && manualConfig.title !== 'Translated Novel';
  if (!hasManualTitle && (!novelSpecificConfig.title || novelSpecificConfig.title === 'Translated Novel')) {
    const extractedTitle = extractNovelTitleFromChapter(firstChapterTitle);
    if (extractedTitle) {
      novelSpecificConfig.title = extractedTitle;
      console.log(`[NovelConfig] Extracted novel title from chapter: "${extractedTitle}"`);
    }
  }

  return {
    ...defaultConfig,
    ...novelSpecificConfig,
    ...manualConfig
  };
};
