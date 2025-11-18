import { promptTemplatesRepository } from '../repositories/instances';

export class TemplatesOps {
  static async store(template: any) {
    return promptTemplatesRepository.storeTemplate(template);
  }
  static async getAll() {
    return promptTemplatesRepository.getTemplates();
  }
  static async getDefault() {
    return promptTemplatesRepository.getDefaultTemplate();
  }
  static async get(id: string) {
    return promptTemplatesRepository.getTemplate(id);
  }
  static async setDefault(id: string) {
    return promptTemplatesRepository.setDefaultTemplate(id);
  }
  static async delete(id: string) {
    return promptTemplatesRepository.deleteTemplate(id);
  }
}
