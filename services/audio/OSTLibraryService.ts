/**
 * OST Library Service - Manages reference audio samples for audio2audio generation
 * 
 * Provides access to the OST library in /public/OSTs for style reference.
 * Supports scanning, categorizing, and serving audio samples.
 */

export interface OSTSample {
  id: string;
  name: string;
  path: string;
  url: string;
  category: string;
  size?: number;
  duration?: number;
}

export interface OSTCategory {
  name: string;
  samples: OSTSample[];
}

export class OSTLibraryService {
  private samples: OSTSample[] = [];
  private categories: OSTCategory[] = [];
  private initialized = false;

  /**
   * Initialize the OST library by scanning available samples
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // For now, we'll use a static list since we can't dynamically scan the filesystem
      // In a real implementation, this would be populated by a build script or API
      this.samples = await this.getStaticOSTList();
      this.categories = this.categorizeSamples(this.samples);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize OST library:', error);
      this.samples = [];
      this.categories = [];
    }
  }

  /**
   * Get all available OST samples
   */
  async getSamples(): Promise<OSTSample[]> {
    await this.initialize();
    return this.samples;
  }

  /**
   * Get samples organized by category
   */
  async getCategories(): Promise<OSTCategory[]> {
    await this.initialize();
    return this.categories;
  }

  /**
   * Get a specific sample by ID
   */
  async getSample(id: string): Promise<OSTSample | null> {
    await this.initialize();
    return this.samples.find(sample => sample.id === id) || null;
  }

  /**
   * Search samples by name or category
   */
  async searchSamples(query: string): Promise<OSTSample[]> {
    await this.initialize();
    const lowerQuery = query.toLowerCase();
    return this.samples.filter(sample =>
      sample.name.toLowerCase().includes(lowerQuery) ||
      sample.category.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Static list of OST samples (would be replaced by dynamic scanning)
   */
  private async getStaticOSTList(): Promise<OSTSample[]> {
    // This would be populated by a build script that scans the OSTs folder
    const samples: OSTSample[] = [
      {
        id: 'naruto-fighting-spirit',
        name: 'The Raising Fighting Spirit (Naruto)',
        path: '/OSTs/Instrumental/003 - Naruto Theme - The Raising Fighting Spirit.mp3',
        url: '/OSTs/Instrumental/003 - Naruto Theme - The Raising Fighting Spirit.mp3',
        category: 'Action/Epic'
      },
      {
        id: 'yoshida-brothers-kodo',
        name: 'Kodo (Yoshida Brothers)',
        path: '/OSTs/Instrumental/002 - YOSHIDA BROTHERS -- Kodo.mp3',
        url: '/OSTs/Instrumental/002 - YOSHIDA BROTHERS -- Kodo.mp3',
        category: 'Traditional/Japanese'
      },
      {
        id: 'isle-of-skye',
        name: 'The Isle of Skye',
        path: '/OSTs/Instrumental/006 - Jan Depreter plays The Isle of Skye - 1987 Miguel Rodriguez.mp3',
        url: '/OSTs/Instrumental/006 - Jan Depreter plays The Isle of Skye - 1987 Miguel Rodriguez.mp3',
        category: 'Folk/Celtic'
      },
      {
        id: 'genshin-liyue',
        name: 'Sounds of Liyue (Genshin Impact)',
        path: '/OSTs/Instrumental/019 - Producing the Sounds of Liyue ｜ Genshin Impact： Behind the Scenes.mp3',
        url: '/OSTs/Instrumental/019 - Producing the Sounds of Liyue ｜ Genshin Impact： Behind the Scenes.mp3',
        category: 'Fantasy/Orchestral'
      },
      {
        id: 'touhou-project',
        name: 'Best Songs From Touhou Project',
        path: '/OSTs/Instrumental/023 - The 6 Best Songs From Touhou Project.mp3',
        url: '/OSTs/Instrumental/023 - The 6 Best Songs From Touhou Project.mp3',
        category: 'Electronic/Game'
      },
      {
        id: 'salute-to-sun',
        name: 'Salute to the Sun',
        path: '/OSTs/Instrumental/031 - Salute to the Sun.mp3',
        url: '/OSTs/Instrumental/031 - Salute to the Sun.mp3',
        category: 'Ambient/Chill'
      },
      {
        id: 'east-of-eden',
        name: 'East of Eden (Confession Night)',
        path: '/OSTs/Instrumental/020 - 【#告白之夜⧸#告白の夜#TheReasonWhy】#eastofeden.mp3',
        url: '/OSTs/Instrumental/020 - 【#告白之夜⧸#告白の夜#TheReasonWhy】#eastofeden.mp3',
        category: 'Emotional/Drama'
      },
      {
        id: 'laxed-siren',
        name: 'Laxed (SIREN BEAT)',
        path: '/OSTs/Instrumental/021 - Laxed (SIREN BEAT).mp3',
        url: '/OSTs/Instrumental/021 - Laxed (SIREN BEAT).mp3',
        category: 'Hip-Hop/Modern'
      }
    ];

    return samples;
  }

  /**
   * Organize samples into categories
   */
  private categorizeSamples(samples: OSTSample[]): OSTCategory[] {
    const categoryMap = new Map<string, OSTSample[]>();

    samples.forEach(sample => {
      const category = sample.category;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(sample);
    });

    return Array.from(categoryMap.entries()).map(([name, samples]) => ({
      name,
      samples
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Validate that an OST sample is accessible
   */
  async validateSample(sample: OSTSample): Promise<boolean> {
    try {
      const response = await fetch(sample.url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const ostLibraryService = new OSTLibraryService();