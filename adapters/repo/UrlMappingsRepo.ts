import { indexedDBService } from '../../services/indexeddb';
import type { UrlMappingRecord } from '../../services/indexeddb';

export interface UrlMappingsRepo {
  getStableIdByUrl(url: string): Promise<string | null>;
  getUrlForStableId(stableId: string): Promise<string | null>;
  getUrlMappingForUrl(url: string): Promise<UrlMappingRecord | null>;
  getAllUrlMappings(): Promise<Array<{ url: string; stableId: string; isCanonical: boolean }>>;
}

export const urlMappingsRepo: UrlMappingsRepo = {
  getStableIdByUrl: (url) => indexedDBService.getStableIdByUrl(url),
  getUrlForStableId: (stableId) => indexedDBService.getUrlForStableId(stableId),
  getUrlMappingForUrl: (url) => indexedDBService.getUrlMappingForUrl(url),
  getAllUrlMappings: () => indexedDBService.getAllUrlMappings(),
};