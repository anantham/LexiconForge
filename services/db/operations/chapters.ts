import type { Chapter } from '../../../types';
import { indexedDBService } from '../../indexeddb';
import { StableIdManager } from '../core/stable-ids';

/**
 * Chapter operations (new system) — always write URL mappings alongside chapters.
 */
export class ChapterOps {
  static async store(chapter: Chapter & { stableId?: string }): Promise<void> {
    // Store via legacy path
    await indexedDBService.storeChapter(chapter);
    // Ensure mapping exists (best-effort; chapter may not have stableId yet)
    if (chapter.stableId) {
      await StableIdManager.ensureUrlMappings(chapter.originalUrl, chapter.stableId);
    }
  }

  static async getByUrl(url: string) {
    return indexedDBService.getChapter(url);
  }

  static async getByStableId(stableId: string) {
    return indexedDBService.getChapterByStableId(stableId);
  }

  static async getAll() {
    return indexedDBService.getAllChapters();
  }

  static async findByUrl(pattern: string) {
    return indexedDBService.findChapterByUrl(pattern as any);
  }

  static async storeEnhanced(enhanced: any) {
    return indexedDBService.storeEnhancedChapter(enhanced);
  }
}
