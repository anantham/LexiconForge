import { NovelConfig } from '../types';

/**
 * Gets novel configuration based on URL or manual configuration
 * This allows for novel-specific metadata like title, author, etc.
 */
export const getNovelConfig = (firstChapterUrl?: string, manualConfig?: Partial<NovelConfig>): NovelConfig => {
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

  return { 
    ...defaultConfig, 
    ...novelSpecificConfig, 
    ...manualConfig 
  };
};
