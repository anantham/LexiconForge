import type { Registry, NovelEntry } from '../types/novel';

// Built-in entries that appear alongside the remote registry
const BUILT_IN_ENTRIES: NovelEntry[] = [
  {
    id: 'sutta-mn10',
    title: 'Mahāsatipaṭṭhānasutta (MN 10)',
    alternateTitles: ['Great Discourse on Mindfulness', 'Satipatthana Sutta'],
    metadata: {
      originalLanguage: 'Pāli',
      targetLanguage: 'English',
      chapterCount: 51,
      genres: ['Buddhist Canon', 'Study'],
      description: 'Interactive word-by-word Pāli study of the Great Discourse on Mindfulness with morphological analysis, grammar relations, and aligned English translation.',
      author: 'Gotama Buddha (as recorded in the Pāli Canon)',
      coverImageUrl: '/mn10-cover.png',
      tags: ['pali', 'sutta', 'mindfulness', 'study-tool'],
      publicationStatus: 'Completed' as const,
      lastUpdated: '2026-03-29',
    },
    // No sessionJsonUrl — this entry routes to /sutta/demo instead
  },
];

// Always use GitHub registry (contains real data with Git LFS session files)
const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com/anantham/lexiconforge-novels/main/registry.json';

export class RegistryService {
  /**
   * Fetch the main registry file
   */
  static async fetchRegistry(url: string = DEFAULT_REGISTRY_URL): Promise<Registry> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const registry: Registry = await response.json();

      console.log(`[Registry] Fetched ${registry.novels.length} novels`);

      return registry;
    } catch (error: any) {
      console.error('[Registry] Failed to fetch registry:', error);
      throw new Error(`Failed to fetch registry: ${error.message}`);
    }
  }

  /**
   * Fetch metadata for a specific novel
   */
  static async fetchNovelMetadata(metadataUrl: string): Promise<NovelEntry> {
    try {
      const response = await fetch(metadataUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const metadata: NovelEntry = await response.json();

      console.log(`[Registry] Fetched metadata for ${metadata.title}`);

      return metadata;
    } catch (error: any) {
      console.error('[Registry] Failed to fetch metadata:', error);
      throw new Error(`Failed to fetch metadata: ${error.message}`);
    }
  }

  /**
   * Fetch a specific novel by registry id
   */
  static async fetchNovelById(id: string, registryUrl?: string): Promise<NovelEntry | null> {
    const registry = await this.fetchRegistry(registryUrl);
    const entry = registry.novels.find((candidate) => candidate.id === id);

    if (!entry) {
      return null;
    }

    return this.fetchNovelMetadata(entry.metadataUrl);
  }

  /**
   * Fetch all novel metadata from registry
   */
  static async fetchAllNovelMetadata(registryUrl?: string): Promise<NovelEntry[]> {
    const registry = await this.fetchRegistry(registryUrl);

    const metadataPromises = registry.novels.map(entry =>
      this.fetchNovelMetadata(entry.metadataUrl)
    );

    const results = await Promise.allSettled(metadataPromises);

    // Filter successful fetches
    const novels = results
      .filter((result): result is PromiseFulfilledResult<NovelEntry> =>
        result.status === 'fulfilled'
      )
      .map(result => result.value);

    // Log failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`[Registry] Failed to fetch ${registry.novels[index].id}:`, result.reason);
      }
    });

    return [...BUILT_IN_ENTRIES, ...novels];
  }
}
