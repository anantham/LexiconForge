import type { AppSettings, TranslationResult } from '../../../types';
import { indexedDBService } from '../../indexeddb';
import { StableIdManager } from '../core/stable-ids';

export interface ChapterRef {
  stableId?: string;
  url?: string;
}

/**
 * Translation operations (new system) — migration-aware and StableID-centric.
 *
 * Note: Version assignment currently delegates to legacy storeTranslation() which
 * computes nextVersion internally. Atomic counters/unique constraints can be
 * introduced in a follow-up without changing this surface.
 */
export class TranslationOps {
  /**
   * Store a translation using either a stableId or a direct URL.
   * Resolves URL via StableIdManager (with auto-repair) when only stableId is provided.
   */
  static async store({ ref, result, settings }: {
    ref: ChapterRef,
    result: TranslationResult,
    settings: Pick<AppSettings, 'provider' | 'model' | 'temperature' | 'systemPrompt'> & {
      promptId?: string; promptName?: string;
    }
  }) {
    const url = await this.resolveUrl(ref);
    return indexedDBService.storeTranslationAtomic(url, result, settings);
  }

  /**
   * Set active translation by stableId + version (URL is resolved + auto-repaired if needed).
   */
  static async setActiveByStableId(stableId: string, version: number): Promise<void> {
    try {
      await indexedDBService.setActiveTranslationByStableId(stableId, version);
    } catch (e: any) {
      // Try to auto-repair mapping and retry once
      if ((e?.message || '').includes('No URL mapping')) {
        const url = await StableIdManager.getUrlForStableId(stableId);
        await indexedDBService.setActiveTranslation(url, version);
        // Opportunistically ensure mappings for future calls
        await StableIdManager.ensureUrlMappings(url, stableId);
        return;
      }
      throw e;
    }
  }

  private static async resolveUrl(ref: ChapterRef): Promise<string> {
    if (ref.url) return ref.url;
    if (!ref.stableId) throw new Error('ChapterRef requires stableId or url');
    return await StableIdManager.getUrlForStableId(ref.stableId);
  }
}
