import { indexedDBService } from '../../services/indexeddb';
import type { Chapter } from '../../types';
import type { ChapterRecord } from '../../services/indexeddb';

export interface ChaptersRepo {
  getChapter(url: string): Promise<ChapterRecord | null>;
  getChapterByStableId(stableId: string): Promise<ChapterRecord | null>;
  storeChapter(chapter: Chapter): Promise<void>;
  storeEnhancedChapter(enhanced: any): Promise<void>;
  getAllChapters(): Promise<ChapterRecord[]>;
  findChapterByUrl(url: string): Promise<{ stableId: string; canonicalUrl: string; data: any } | null>;
}

export const chaptersRepo: ChaptersRepo = {
  getChapter: (url) => indexedDBService.getChapter(url),
  getChapterByStableId: (stableId) => indexedDBService.getChapterByStableId(stableId),
  storeChapter: (chapter) => indexedDBService.storeChapter(chapter),
  storeEnhancedChapter: (enhanced) => indexedDBService.storeEnhancedChapter(enhanced),
  getAllChapters: () => indexedDBService.getAllChapters(),
  findChapterByUrl: (url) => indexedDBService.findChapterByUrl(url),
};