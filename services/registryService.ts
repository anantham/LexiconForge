import type { Registry, NovelEntry } from '../types/novel';

// For local development: use local registry in public folder
// For production: point to actual GitHub registry
const DEFAULT_REGISTRY_URL = import.meta.env.DEV
  ? '/registry/registry.json'
  : 'https://raw.githubusercontent.com/lexiconforge/lexiconforge-novels/main/registry.json';

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

    return novels;
  }
}
