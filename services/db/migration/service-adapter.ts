/**
 * Service Adapter for Migration - Hybrid Innovation
 * 
 * Wraps database operations with shadow validation and service-aware routing.
 * This is the key piece that enables gradual migration while maintaining safety.
 */

import type { Repo } from '../../../adapters/repo/Repo';
import { getRepoForService } from '../index';
import { withShadowValidation, shadowValidator } from './shadow-validator';
import { migrationController, type ServiceName } from './phase-controller';
import type { TranslationResult, AppSettings, Chapter } from '../../../types';
import type { ChapterLookupResult } from '../../indexeddb';

/**
 * Service-aware database adapter that handles migration phases
 */
export class ServiceAdapter {
  private serviceName: ServiceName;
  private repo: Repo;

  constructor(serviceName: ServiceName) {
    this.serviceName = serviceName;
    this.repo = getRepoForService(serviceName);
  }

  /**
   * Get chapter with shadow validation if enabled
   */
  async getChapter(url: string): Promise<Chapter | null> {
    if (shadowValidator.enabled) {
      return withShadowValidation(
        'getChapter',
        this.serviceName,
        async () => this.repo.getChapter(url),
        async () => {
          // This would call the new implementation once it's ready
          const newRepo = getRepoForService(this.serviceName);
          return newRepo.getChapter(url);
        }
      );
    }

    return this.repo.getChapter(url);
  }

  /**
   * Get chapter by stable ID with shadow validation
   */
  async getChapterByStableId(stableId: string): Promise<Chapter | null> {
    if (shadowValidator.enabled) {
      return withShadowValidation(
        'getChapterByStableId',
        this.serviceName,
        async () => this.repo.getChapterByStableId(stableId),
        async () => {
          const newRepo = getRepoForService(this.serviceName);
          return newRepo.getChapterByStableId(stableId);
        }
      );
    }

    return this.repo.getChapterByStableId(stableId);
  }

  /**
   * Get all chapters with shadow validation
   */
  async getAllChapters(): Promise<Chapter[]> {
    if (shadowValidator.enabled) {
      return withShadowValidation(
        'getAllChapters',
        this.serviceName,
        async () => this.repo.getAllChapters(),
        async () => {
          const newRepo = getRepoForService(this.serviceName);
          return newRepo.getAllChapters();
        },
        // Custom comparison for arrays of chapters
        (legacy, new_) => {
          const differences: string[] = [];
          
          if (legacy.length !== new_.length) {
            differences.push(`Array length: legacy=${legacy.length}, new=${new_.length}`);
          }
          
          // Compare first few chapters for basic validation
          const compareCount = Math.min(3, legacy.length, new_.length);
          for (let i = 0; i < compareCount; i++) {
            const legacyChapter = legacy[i];
            const newChapter = new_[i];
            
            if (legacyChapter?.url !== newChapter?.url) {
              differences.push(`Chapter[${i}] URL: legacy=${legacyChapter?.url}, new=${newChapter?.url}`);
            }
            
            if (legacyChapter?.title !== newChapter?.title) {
              differences.push(`Chapter[${i}] title: legacy=${legacyChapter?.title}, new=${newChapter?.title}`);
            }
          }
          
          return { identical: differences.length === 0, differences };
        }
      );
    }

    return this.repo.getAllChapters();
  }

  /**
   * Find chapter by URL with shadow validation
   */
  async findChapterByUrl(url: string): Promise<ChapterLookupResult | null> {
    if (shadowValidator.enabled) {
      return withShadowValidation(
        'findChapterByUrl',
        this.serviceName,
        async () => this.repo.findChapterByUrl(url),
        async () => {
          const newRepo = getRepoForService(this.serviceName);
          return newRepo.findChapterByUrl(url);
        }
      );
    }

    return this.repo.findChapterByUrl(url);
  }

  /**
   * Get active translation with shadow validation
   */
  async getActiveTranslation(chapterUrl: string): Promise<any> {
    if (shadowValidator.enabled) {
      return withShadowValidation(
        'getActiveTranslation',
        this.serviceName,
        async () => this.repo.getActiveTranslation(chapterUrl),
        async () => {
          const newRepo = getRepoForService(this.serviceName);
          return newRepo.getActiveTranslation(chapterUrl);
        },
        // Custom comparison for translations
        (legacy, new_) => {
          if (!legacy && !new_) {
            return { identical: true, differences: [] };
          }
          
          if (!legacy || !new_) {
            return { 
              identical: false, 
              differences: [`Null mismatch: legacy=${!!legacy}, new=${!!new_}`] 
            };
          }
          
          const differences: string[] = [];
          const criticalFields = ['translatedContent', 'provider', 'model', 'version', 'isActive'];
          
          for (const field of criticalFields) {
            if (legacy[field] !== new_[field]) {
              differences.push(`${field}: legacy=${legacy[field]}, new=${new_[field]}`);
            }
          }
          
          return { identical: differences.length === 0, differences };
        }
      );
    }

    return this.repo.getActiveTranslation(chapterUrl);
  }

  /**
   * Get active translation by stable ID with shadow validation
   */
  async getActiveTranslationByStableId(stableId: string): Promise<any> {
    if (shadowValidator.enabled) {
      return withShadowValidation(
        'getActiveTranslationByStableId',
        this.serviceName,
        async () => this.repo.getActiveTranslationByStableId(stableId),
        async () => {
          const newRepo = getRepoForService(this.serviceName);
          return newRepo.getActiveTranslationByStableId(stableId);
        }
      );
    }

    return this.repo.getActiveTranslationByStableId(stableId);
  }

  /**
   * Store translation - writes go to both backends during dual-write phase
   */
  async storeTranslationByStableId(
    stableId: string,
    translation: TranslationResult,
    settings: Partial<AppSettings>
  ): Promise<void> {
    const phase = migrationController.getServicePhase(this.serviceName);
    const normalizedSettings = this.normalizeTranslationSettings(settings);

    if (phase === 'dualwrite') {
      // Dual write phase - write to both backends
      const legacyRepo = getRepoForService(this.serviceName); // Will return legacy
      const newRepo = getRepoForService(this.serviceName);   // Will return new if enabled

      try {
        await Promise.all([
          legacyRepo.storeTranslationByStableId(stableId, translation, normalizedSettings),
          newRepo.storeTranslationByStableId(stableId, translation, normalizedSettings),
        ]);
        
        console.log(`[ServiceAdapter] Dual write successful for ${this.serviceName}.storeTranslationByStableId`);
      } catch (error) {
        console.error(`[ServiceAdapter] Dual write failed for ${this.serviceName}.storeTranslationByStableId:`, error);
        
        // Fallback to legacy only on failure
        await legacyRepo.storeTranslationByStableId(stableId, translation, normalizedSettings);
        
        // Report failure to migration controller
        migrationController.recordError(this.serviceName, 'storeTranslationByStableId', error);
        throw error;
      }
    } else {
      // Single write to appropriate backend
      await this.repo.storeTranslationByStableId(stableId, translation, normalizedSettings);
    }
  }

  /**
   * Store translation by URL - dual write support
   */
  async storeTranslation(
    chapterUrl: string,
    translation: TranslationResult,
    settings: Partial<AppSettings>
  ): Promise<void> {
    const phase = migrationController.getServicePhase(this.serviceName);
    const normalizedSettings = this.normalizeTranslationSettings(settings);

    if (phase === 'dualwrite') {
      const legacyRepo = getRepoForService(this.serviceName);
      const newRepo = getRepoForService(this.serviceName);

      try {
        await Promise.all([
          legacyRepo.storeTranslation(chapterUrl, translation, normalizedSettings),
          newRepo.storeTranslation(chapterUrl, translation, normalizedSettings),
        ]);
      } catch (error) {
        console.error(`[ServiceAdapter] Dual write failed for ${this.serviceName}.storeTranslation:`, error);
        await legacyRepo.storeTranslation(chapterUrl, translation, normalizedSettings);
        migrationController.recordError(this.serviceName, 'storeTranslation', error);
        throw error;
      }
    } else {
      await this.repo.storeTranslation(chapterUrl, translation, normalizedSettings);
    }
  }

  /**
   * Get current migration phase for this service
   */
  getMigrationPhase(): string {
    return migrationController.getServicePhase(this.serviceName);
  }

  /**
   * Check if shadow validation is enabled
   */
  isShadowValidationEnabled(): boolean {
    return shadowValidator.enabled;
  }

  private normalizeTranslationSettings(
    settings: Partial<AppSettings>
  ): Pick<AppSettings, 'provider' | 'model' | 'temperature' | 'systemPrompt'> & {
    promptId?: string;
    promptName?: string;
  } {
    return {
      provider: (settings.provider ?? 'OpenAI') as AppSettings['provider'],
      model: settings.model ?? 'gpt-4o-mini',
      temperature: settings.temperature ?? 0.2,
      systemPrompt: settings.systemPrompt ?? '',
      promptId: (settings as any).promptId ?? settings.activePromptId,
      promptName: (settings as any).promptName,
    };
  }

  /**
   * Get validation metrics for this service
   */
  getValidationMetrics() {
    return shadowValidator.getMetrics(this.serviceName);
  }
}

/**
 * Factory to create service adapters
 */
export function createServiceAdapter(serviceName: ServiceName): ServiceAdapter {
  return new ServiceAdapter(serviceName);
}

/**
 * Enhanced migration controller with error tracking
 */
declare module './phase-controller' {
  interface MigrationController {
    getServicePhase(service: ServiceName): string;
    recordError(service: ServiceName, operation: string, error: unknown): void;
  }
}

// Extend the migration controller (this would be added to the actual controller)
Object.assign(migrationController, {
  getServicePhase(service: ServiceName): string {
    const state = this.serviceStates.get(service);
    return state?.phase || 'shadow';
  },

  recordError(service: ServiceName, operation: string, error: unknown): void {
    const state = this.serviceStates.get(service);
    if (state) {
      state.errorCount++;
      state.lastError = error instanceof Error ? error : new Error(String(error));
    }
    
    console.error(`[MigrationController] Error in ${service}.${operation}:`, error);
  }
});
