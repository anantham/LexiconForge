/**
 * Database Migration Service
 * 
 * Extracted from indexeddb.ts to separate migration concerns.
 * This service handles:
 * - Migration from localStorage to IndexedDB
 * - Version upgrades and schema migrations
 * - Data transformation and compatibility
 */

import { translationFacade } from './repositories/translationFacade';
import type { AppSettings, TranslationResult, FeedbackItem } from '../../types';
import { ChapterOps, FeedbackOps, SettingsOps } from './operations';

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
              await ChapterOps.store((data as any).chapter as any);
            }
            
            // Store translation data
            if ((data as any).translationResult) {
              const migrationSettings = resolveMigrationSettings((data as any).translationResult);
              await translationFacade.storeByUrl(
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
        await SettingsOps.store(settings as AppSettings);
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
              await FeedbackOps.store(url, feedback as FeedbackItem);
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

/**
 * Repair translations with missing model/provider fields.
 *
 * This repairs legacy data where model wasn't tracked.
 * Returns count of repaired records.
 */
export async function repairMissingModelFields(): Promise<{
  scanned: number;
  repaired: number;
  errors: string[];
}> {
  const { getConnection } = await import('./core/connection');
  const { STORE_NAMES } = await import('./core/schema');

  const result = {
    scanned: 0,
    repaired: 0,
    errors: [] as string[],
  };

  console.log('[DataRepair] Starting repair of missing model fields...');

  try {
    const db = await getConnection();
    const tx = db.transaction(STORE_NAMES.TRANSLATIONS, 'readwrite');
    const store = tx.objectStore(STORE_NAMES.TRANSLATIONS);

    const allRecords = await new Promise<any[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    result.scanned = allRecords.length;
    console.log(`[DataRepair] Scanning ${allRecords.length} translation records...`);

    for (const record of allRecords) {
      const needsRepair = !record.model || record.model === 'unknown' || !record.provider;

      if (needsRepair) {
        const originalModel = record.model;
        const originalProvider = record.provider;

        // Try to get from settingsSnapshot first
        const snapshot = record.settingsSnapshot;
        record.model = record.model || snapshot?.model || FALLBACK_TRANSLATION_SETTINGS.model;
        record.provider = record.provider || snapshot?.provider || FALLBACK_TRANSLATION_SETTINGS.provider;

        // Mark as repaired for audit trail
        record.dataRepairLog = record.dataRepairLog || [];
        record.dataRepairLog.push({
          repairedAt: new Date().toISOString(),
          field: 'model/provider',
          originalModel,
          originalProvider,
          newModel: record.model,
          newProvider: record.provider,
          reason: 'Missing model/provider field repair',
        });

        try {
          await new Promise<void>((resolve, reject) => {
            const putRequest = store.put(record);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          });

          result.repaired++;
          console.log(
            `[DataRepair] Repaired record ${record.id}: ` +
            `model: ${originalModel || 'null'} → ${record.model}, ` +
            `provider: ${originalProvider || 'null'} → ${record.provider}`
          );
        } catch (error) {
          const msg = `Failed to repair record ${record.id}: ${error}`;
          result.errors.push(msg);
          console.error(`[DataRepair] ${msg}`);
        }
      }
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    console.log(
      `[DataRepair] Complete. Scanned: ${result.scanned}, Repaired: ${result.repaired}, Errors: ${result.errors.length}`
    );

    // Mark repair as completed
    localStorage.setItem('model-field-repair-completed', new Date().toISOString());

  } catch (error) {
    const msg = `Data repair failed: ${error}`;
    result.errors.push(msg);
    console.error(`[DataRepair] ${msg}`);
  }

  return result;
}

/**
 * Check if model field repair has been run
 */
export function isModelFieldRepairCompleted(): boolean {
  return !!localStorage.getItem('model-field-repair-completed');
}

/**
 * Run model field repair if not already completed
 */
export async function ensureModelFieldsRepaired(): Promise<void> {
  if (isModelFieldRepairCompleted()) {
    return;
  }

  console.log('[DataRepair] Model field repair not yet run, starting...');
  const result = await repairMissingModelFields();

  if (result.errors.length > 0) {
    console.warn('[DataRepair] Repair completed with errors:', result.errors);
  }
}
