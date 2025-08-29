import { indexedDBService } from '../../services/indexeddb';
import type { PromptTemplateRecord } from '../../services/indexeddb';

export interface PromptTemplatesRepo {
  storePromptTemplate(template: any): Promise<void>;
  getPromptTemplates(): Promise<PromptTemplateRecord[]>;
  getDefaultPromptTemplate(): Promise<PromptTemplateRecord | null>;
  getPromptTemplate(id: string): Promise<PromptTemplateRecord | null>;
  setDefaultPromptTemplate(id: string): Promise<void>;
}

export const promptTemplatesRepo: PromptTemplatesRepo = {
  storePromptTemplate: (template) => indexedDBService.storePromptTemplate(template),
  getPromptTemplates: () => indexedDBService.getPromptTemplates(),
  getDefaultPromptTemplate: () => indexedDBService.getDefaultPromptTemplate(),
  getPromptTemplate: (id) => indexedDBService.getPromptTemplate(id),
  setDefaultPromptTemplate: (id) => indexedDBService.setDefaultPromptTemplate(id),
};