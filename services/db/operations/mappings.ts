import { indexedDBService } from '../../indexeddb';

export class MappingsOps {
  static async getStableIdByUrl(url: string) {
    return indexedDBService.getStableIdByUrl(url);
  }
  static async getUrlMappingForUrl(url: string) {
    return indexedDBService.getUrlMappingForUrl(url);
  }
  static async getAllUrlMappings() {
    return indexedDBService.getAllUrlMappings();
  }
  static async getAllNovels() {
    return indexedDBService.getAllNovels();
  }
}
