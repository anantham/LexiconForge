import { indexedDBService } from '../../services/indexeddb';
import type { TranslationResult } from '../../types';
import type { TranslationRecord } from '../../services/indexeddb';

export interface TranslationsRepo {
  storeTranslation(chapterUrl: string, translation: TranslationResult, settings: {
    provider: string;
    model: string;
    temperature: number;
    systemPrompt: string;
    promptId?: string;
    promptName?: string;
  }): Promise<TranslationRecord>;
  
  storeTranslationByStableId(stableId: string, translation: TranslationResult, settings: {
    provider: string;
    model: string;
    temperature: number;
    systemPrompt: string;
    promptId?: string;
    promptName?: string;
  }): Promise<TranslationRecord>;
  
  getTranslationVersions(chapterUrl: string): Promise<TranslationRecord[]>;
  getTranslationVersionsByStableId(stableId: string): Promise<TranslationRecord[]>;
  getActiveTranslation(chapterUrl: string): Promise<TranslationRecord | null>;
  getActiveTranslationByStableId(stableId: string): Promise<TranslationRecord | null>;
  setActiveTranslation(chapterUrl: string, version: number): Promise<void>;
  setActiveTranslationByStableId(stableId: string, version: number): Promise<void>;
  getRecentActiveTranslationsByDomain(domain: string, limit?: number, excludeStableId?: string): Promise<Array<{ translation: TranslationRecord; chapter: any }>>;
}

export const translationsRepo: TranslationsRepo = {
  storeTranslation: (chapterUrl, translation, settings) => 
    indexedDBService.storeTranslation(chapterUrl, translation, settings),
  
  storeTranslationByStableId: (stableId, translation, settings) => 
    indexedDBService.storeTranslationByStableId(stableId, translation, settings),
  
  getTranslationVersions: (chapterUrl) => 
    indexedDBService.getTranslationVersions(chapterUrl),
  
  getTranslationVersionsByStableId: (stableId) => 
    indexedDBService.getTranslationVersionsByStableId(stableId),
  
  getActiveTranslation: (chapterUrl) => 
    indexedDBService.getActiveTranslation(chapterUrl),
  
  getActiveTranslationByStableId: (stableId) => 
    indexedDBService.getActiveTranslationByStableId(stableId),
  
  setActiveTranslation: (chapterUrl, version) => 
    indexedDBService.setActiveTranslation(chapterUrl, version),
  
  setActiveTranslationByStableId: (stableId, version) => 
    indexedDBService.setActiveTranslationByStableId(stableId, version),
  
  getRecentActiveTranslationsByDomain: (domain, limit, excludeStableId) => 
    indexedDBService.getRecentActiveTranslationsByDomain(domain, limit, excludeStableId),
};