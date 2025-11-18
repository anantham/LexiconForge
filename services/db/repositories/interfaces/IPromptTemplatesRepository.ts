import type { PromptTemplate } from '../../../../types';
import type { PromptTemplateRecord } from '../../types';

export interface IPromptTemplatesRepository {
  storeTemplate(template: PromptTemplate): Promise<void>;
  getTemplates(): Promise<PromptTemplateRecord[]>;
  getDefaultTemplate(): Promise<PromptTemplateRecord | null>;
  getTemplate(id: string): Promise<PromptTemplateRecord | null>;
  deleteTemplate(id: string): Promise<void>;
  setDefaultTemplate(id: string): Promise<void>;
}
