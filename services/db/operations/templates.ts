import { indexedDBService } from '../../indexeddb';

export class TemplatesOps {
  static async store(template: any) {
    return indexedDBService.storePromptTemplate(template);
  }
  static async getAll() {
    return indexedDBService.getPromptTemplates();
  }
  static async getDefault() {
    return indexedDBService.getDefaultPromptTemplate();
  }
  static async get(id: string) {
    return indexedDBService.getPromptTemplate(id);
  }
  static async setDefault(id: string) {
    return indexedDBService.setDefaultPromptTemplate(id);
  }
}
