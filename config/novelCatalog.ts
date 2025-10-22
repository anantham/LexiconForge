/**
 * Novel Catalog - Curated collection of web novels
 *
 * @deprecated This static catalog is deprecated in favor of the dynamic registry system.
 * The NovelLibrary component now fetches novels from a remote registry via RegistryService.
 * This file is kept for backwards compatibility and reference.
 *
 * For the new system, see:
 * - services/registryService.ts (fetches from remote registry)
 * - components/NovelLibrary.tsx (uses RegistryService)
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
        chapterCount: 509,
        genres: ['Dark Fantasy', 'Strategy', 'Psychological', 'Demon Lord'],
        description: 'I reincarnated as a Demon Lord and now I have to save humanity from itself. Using wit, manipulation, and careful planning, I must survive in a world where everyone wants me dead. A dark psychological thriller that explores morality, strategy, and the price of survival.',
        coverImageUrl: '/dungeon-defense-cover.jpg',
        author: 'Yoo Heonhwa',
        sourceLinks: {
          novelUpdates: 'https://www.novelupdates.com/series/dungeon-defense/'
        },
        tags: ['Anti-Hero', 'Cunning Protagonist', 'Dark', 'Game Elements', 'Gore'],
        lastUpdated: '2025-10-19',
        mediaCorrespondence: [
          {
            id: 'volume-1-end',
            label: 'Volume 1 Complete',
            description: 'Dantalian establishes his position in the demon world',
            webNovel: {
              chapters: { from: 1, to: 45 }
            },
            manhua: {
              chapters: { from: 1, to: 28 },
              notes: 'Manhwa adaptation includes additional artwork'
            }
          },
          {
            id: 'volume-2-end',
            label: 'Volume 2 Complete',
            description: 'The first major war arc concludes',
            webNovel: {
              chapters: { from: 46, to: 120 }
            },
            manhua: {
              chapters: { from: 29, to: 67 }
            }
          }
        ]
      }
    },
    {
      id: 'strongest-exorcist',
      title: 'The Exorcist Who Failed To Save The World',
      sessionJsonUrl: 'https://raw.githubusercontent.com/YOUR_ORG/lexiconforge-novels/main/sessions/strongest-exorcist.json',
      metadata: {
        originalLanguage: 'Japanese',
        chapterCount: 35,
        genres: ['Fantasy', 'Isekai', 'Magic', 'Reincarnation'],
        description: 'The strongest exorcist in the world failed to save it from destruction. Reincarnated 1000 years later, he must use his knowledge of the past to prevent the same catastrophe. But in this peaceful world, will his dark methods be accepted?',
        coverImageUrl: 'https://i.imgur.com/placeholder.jpg',
        author: 'Kisetsu Morita',
        sourceLinks: {
          novelUpdates: 'https://www.novelupdates.com/series/the-exorcist-who-failed-to-save-the-world/'
        },
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
        chapterCount: 25,
        genres: ['Action', 'Adventure', 'Fantasy', 'Apocalypse'],
        description: 'The novel he had been reading for 10 years suddenly becomes reality. Kim Dokja, the sole reader who finished the story, must use his unique knowledge to survive the apocalypse. A meta-narrative masterpiece about stories, readers, and reality.',
        coverImageUrl: 'https://i.imgur.com/placeholder2.jpg',
        author: 'Sing Shong',
        sourceLinks: {
          novelUpdates: 'https://www.novelupdates.com/series/omniscient-readers-viewpoint/'
        },
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
        chapterCount: 100,
        genres: ['Xuanhuan', 'Cultivation', 'Action'],
        description: 'A young disciple rises from obscurity to challenge the heavens. Classic cultivation journey with face-slapping and pill refinement.',
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
        chapterCount: 45,
        genres: ['Fantasy', 'Romance', 'Comedy'],
        description: 'A wholesome story about adventurers in a fantasy world. Slice of life meets dungeon exploration.',
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
