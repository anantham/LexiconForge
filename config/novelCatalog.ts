/**
 * Novel Catalog - Curated collection of web novels
 *
 * This is the registry of available novels for the library browser.
 * Each novel entry contains metadata and a link to its session JSON.
 */

import type { NovelEntry, NovelCatalog } from '../types/novel';

export const NOVEL_CATALOG: NovelCatalog = {
  version: '1.0',
  lastUpdated: '2025-10-17',
  novels: [
    {
      id: 'dungeon-defense',
      title: 'Dungeon Defense',
      sessionJsonUrl: 'https://media.githubusercontent.com/media/anantham/LexiconForge/main/session-files/dungeon-defense.json',
      metadata: {
        originalLanguage: 'Korean',
        targetLanguage: 'English',
        chapterCount: 509,
        genres: ['Dark Fantasy', 'Strategy', 'Psychological', 'Demon Lord'],
        description: 'I reincarnated as a Demon Lord and now I have to save humanity from itself. Using wit, manipulation, and careful planning, I must survive in a world where everyone wants me dead. A dark psychological thriller that explores morality, strategy, and the price of survival.',
        coverImageUrl: '/dungeon-defense-cover.jpg',
        author: 'Yoo Heonhwa',
        rating: 4.5,
        sourceUrl: 'https://www.novelupdates.com/series/dungeon-defense/',
        sourceName: 'Novel Updates',
        translator: 'Community',
        tags: ['Anti-Hero', 'Cunning Protagonist', 'Dark', 'Game Elements', 'Gore'],
        lastUpdated: '2025-10-19'
      }
    },
    {
      id: 'strongest-exorcist',
      title: 'The Exorcist Who Failed To Save The World',
      sessionJsonUrl: 'https://raw.githubusercontent.com/YOUR_ORG/lexiconforge-novels/main/sessions/strongest-exorcist.json',
      metadata: {
        originalLanguage: 'Japanese',
        targetLanguage: 'English',
        chapterCount: 35,
        genres: ['Fantasy', 'Isekai', 'Magic', 'Reincarnation'],
        description: 'The strongest exorcist in the world failed to save it from destruction. Reincarnated 1000 years later, he must use his knowledge of the past to prevent the same catastrophe. But in this peaceful world, will his dark methods be accepted?',
        coverImageUrl: 'https://i.imgur.com/placeholder.jpg',
        author: 'Kisetsu Morita',
        rating: 4.2,
        sourceUrl: 'https://www.novelupdates.com/series/the-exorcist-who-failed-to-save-the-world/',
        sourceName: 'Novel Updates',
        translator: 'Community',
        tags: ['Overpowered Protagonist', 'Magic', 'Reincarnation', 'Fantasy World'],
        lastUpdated: '2025-10-15'
      }
    },
    {
      id: 'omniscient-readers-viewpoint',
      title: "Omniscient Reader's Viewpoint",
      sessionJsonUrl: 'https://raw.githubusercontent.com/YOUR_ORG/lexiconforge-novels/main/sessions/orv.json',
      metadata: {
        originalLanguage: 'Korean',
        targetLanguage: 'English',
        chapterCount: 25,
        genres: ['Action', 'Adventure', 'Fantasy', 'Apocalypse'],
        description: 'The novel he had been reading for 10 years suddenly becomes reality. Kim Dokja, the sole reader who finished the story, must use his unique knowledge to survive the apocalypse. A meta-narrative masterpiece about stories, readers, and reality.',
        coverImageUrl: 'https://i.imgur.com/placeholder2.jpg',
        author: 'Sing Shong',
        rating: 4.8,
        sourceUrl: 'https://www.novelupdates.com/series/omniscient-readers-viewpoint/',
        sourceName: 'Novel Updates',
        translator: 'Community',
        tags: ['Clever Protagonist', 'Apocalypse', 'System', 'Survival', 'Breaking the Fourth Wall'],
        lastUpdated: '2025-10-16'
      }
    },
    // Placeholder novels for demo
    {
      id: 'sample-novel-1',
      title: 'Sample Chinese Cultivation Novel',
      sessionJsonUrl: '', // Empty for now
      metadata: {
        originalLanguage: 'Chinese',
        targetLanguage: 'English',
        chapterCount: 100,
        genres: ['Xuanhuan', 'Cultivation', 'Action'],
        description: 'A young disciple rises from obscurity to challenge the heavens. Classic cultivation journey with face-slapping and pill refinement.',
        rating: 3.8,
        tags: ['Cultivation', 'Revenge', 'Harem'],
        lastUpdated: '2025-10-10'
      }
    },
    {
      id: 'sample-novel-2',
      title: 'Sample Japanese Light Novel',
      sessionJsonUrl: '',
      metadata: {
        originalLanguage: 'Japanese',
        targetLanguage: 'English',
        chapterCount: 45,
        genres: ['Fantasy', 'Romance', 'Comedy'],
        description: 'A wholesome story about adventurers in a fantasy world. Slice of life meets dungeon exploration.',
        rating: 4.0,
        tags: ['Slice of Life', 'Fantasy', 'Guild'],
        lastUpdated: '2025-10-12'
      }
    }
  ]
};

/**
 * Get novel by ID
 */
export function getNovelById(id: string): NovelEntry | null {
  return NOVEL_CATALOG.novels.find(n => n.id === id) || null;
}

/**
 * Get all novels
 */
export function getAllNovels(): NovelEntry[] {
  return NOVEL_CATALOG.novels;
}

/**
 * Get novels by language
 */
export function getNovelsByLanguage(language: string): NovelEntry[] {
  return NOVEL_CATALOG.novels.filter(
    n => n.metadata.originalLanguage.toLowerCase() === language.toLowerCase()
  );
}

/**
 * Get novels by genre
 */
export function getNovelsByGenre(genre: string): NovelEntry[] {
  return NOVEL_CATALOG.novels.filter(n =>
    n.metadata.genres.some(g => g.toLowerCase().includes(genre.toLowerCase()))
  );
}
