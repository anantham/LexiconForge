import { indexedDBService } from '../../indexeddb';

export class ExportOps {
  static async exportFullSessionToJson() {
    return indexedDBService.exportFullSessionToJson();
  }
}
