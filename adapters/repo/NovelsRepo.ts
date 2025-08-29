import { indexedDBService } from '../../services/indexeddb';
import type { NovelRecord } from '../../services/indexeddb';

export interface NovelsRepo {
  getAllNovels(): Promise<NovelRecord[]>;
  exportFullSessionToJson(): Promise<any>;
}

export const novelsRepo: NovelsRepo = {
  getAllNovels: () => indexedDBService.getAllNovels(),
  exportFullSessionToJson: () => indexedDBService.exportFullSessionToJson(),
};