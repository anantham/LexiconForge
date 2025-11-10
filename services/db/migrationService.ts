/**
 * Database Migration Service
 * 
 * Extracted from indexeddb.ts to separate migration concerns.
 * This service handles:
 * - Migration from localStorage to IndexedDB
 * - Version upgrades and schema migrations
 * - Data transformation and compatibility
 */

import { indexedDBService } from '../indexeddb';
import type { AppSettings, TranslationResult } from '../../types';

// Migration state tracking
let migrationInProgress = false;

const FALLBACK_TRANSLATION_SETTINGS: Pick<AppSettings, 'provider' | 'model' | 'temperature' | 'systemPrompt'> = {
  provider: 'OpenAI',
  model: 'gpt-4o-mini',
  temperature: 0.2,
  systemPrompt: '',
};

function resolveMigrationSettings(
  result: TranslationResult
): Pick<AppSettings, 'provider' | 'model' | 'temperature' | 'systemPrompt'> & {
  promptId?: string;
  promptName?: string;
} {
  const snapshot = result.translationSettings ?? null;

  return {
    provider: (result.provider as AppSettings['provider']) ?? (snapshot?.provider as AppSettings['provider']) ?? FALLBACK_TRANSLATION_SETTINGS.provider,
    model: result.model ?? snapshot?.model ?? FALLBACK_TRANSLATION_SETTINGS.model,
    temperature: result.temperature ?? snapshot?.temperature ?? FALLBACK_TRANSLATION_SETTINGS.temperature,
    systemPrompt: snapshot?.systemPrompt ?? FALLBACK_TRANSLATION_SETTINGS.systemPrompt,
    promptId: result.promptId ?? snapshot?.promptId ?? undefined,
    promptName: result.promptName ?? snapshot?.promptName ?? undefined,
  };
}

/**
 * Migrate data from localStorage to IndexedDB
 * This is a one-time migration for users upgrading from the localStorage system
 */
export async function migrateFromLocalStorage(): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`[Migration ${timestamp}] Starting localStorage to IndexedDB migration`);
  
  // Check if migration is already in progress
  if (migrationInProgress) {
    console.log('[Migration] Migration already in progress, skipping');
    return;
  }
  
  try {
    // Set migration mutex
    migrationInProgress = true;
    console.log('[Migration] 🔒 Migration mutex acquired');
    
    // Set flag IMMEDIATELY to prevent race conditions
    localStorage.setItem('indexeddb-migration-completed', 'true');
    console.log('[Migration] 🔒 Migration flag set immediately to prevent duplicates');
    
    // Check if we actually need to migrate
    const hasLocalStorageData = localStorage.getItem('session-data') || 
                                 localStorage.getItem('app-settings') ||
                                 localStorage.getItem('feedback-history');
    
    if (!hasLocalStorageData) {
      console.log('[Migration] No localStorage data found, skipping migration');
      return;
    }
    
    console.log('[Migration] Found localStorage data, proceeding with migration...');
    
    // Migrate session data (chapters and translations)
    try {
      const sessionDataStr = localStorage.getItem('session-data');
      if (sessionDataStr) {
        const sessionData = JSON.parse(sessionDataStr);
        console.log(`[Migration] Migrating ${Object.keys(sessionData).length} chapters from localStorage`);
        
        for (const [url, data] of Object.entries(sessionData as any)) {
          if (data && typeof data === 'object') {
            // Store chapter data
            if ((data as any).chapter) {
              await indexedDBService.storeChapter((data as any).chapter);
            }
            
            // Store translation data
            if ((data as any).translationResult) {
              const migrationSettings = resolveMigrationSettings((data as any).translationResult);
              await indexedDBService.storeTranslationAtomic(
                url,
                (data as any).translationResult,
                migrationSettings
              );
            }
          }
        }
        console.log('[Migration] ✅ Session data migration completed');
      }
    } catch (error) {
      console.error('[Migration] Failed to migrate session data:', error);
    }
    
    // Migrate app settings
    try {
      const settingsStr = localStorage.getItem('app-settings');
      if (settingsStr) {
        const settings = JSON.parse(settingsStr);
        await indexedDBService.storeSettings(settings);
        console.log('[Migration] ✅ Settings migration completed');
      }
    } catch (error) {
      console.error('[Migration] Failed to migrate settings:', error);
    }
    
    // Migrate feedback history
    try {
      const feedbackStr = localStorage.getItem('feedback-history');
      if (feedbackStr) {
        const feedbackHistory = JSON.parse(feedbackStr);
        console.log(`[Migration] Migrating feedback for ${Object.keys(feedbackHistory).length} URLs`);
        
        for (const [url, feedbackList] of Object.entries(feedbackHistory as any)) {
          if (Array.isArray(feedbackList)) {
            for (const feedback of feedbackList) {
              await indexedDBService.storeFeedback(url, feedback);
            }
          }
        }
        console.log('[Migration] ✅ Feedback migration completed');
      }
    } catch (error) {
      console.error('[Migration] Failed to migrate feedback:', error);
    }
    
    console.log('[Migration] 🎉 Migration completed successfully');
    
    // Optional: Clean up localStorage after successful migration
    // Uncomment if you want to remove old data after migration
    /*
    localStorage.removeItem('session-data');
    localStorage.removeItem('app-settings');
    localStorage.removeItem('feedback-history');
    console.log('[Migration] 🧹 Cleaned up localStorage after migration');
    */
    
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    // Don't remove the completion flag if migration failed
    localStorage.removeItem('indexeddb-migration-completed');
    throw error;
  } finally {
    migrationInProgress = false;
    console.log('[Migration] 🔓 Migration mutex released');
  }
}

/**
 * Check if migration has been completed
 */
export function isMigrationCompleted(): boolean {
  return localStorage.getItem('indexeddb-migration-completed') === 'true';
}

/**
 * Reset migration state (for testing or manual re-migration)
 */
export function resetMigrationState(): void {
  localStorage.removeItem('indexeddb-migration-completed');
  migrationInProgress = false;
  console.log('[Migration] Migration state reset');
}
