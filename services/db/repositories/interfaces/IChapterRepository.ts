import type { Chapter } from '../../../../types';
import type { ChapterRecord } from '../../types';

export interface IChapterRepository {
  storeChapter(chapter: Chapter): Promise<ChapterRecord>;
  getChapter(chapterUrl: string): Promise<ChapterRecord | null>;
  getChapterByStableId(stableId: string): Promise<ChapterRecord | null>;
  setChapterNumberByStableId(stableId: string, chapterNumber: number): Promise<void>;
  getAllChapters(): Promise<ChapterRecord[]>;
}
