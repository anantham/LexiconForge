/**
 * Database repair service.
 *
 * Repairs legacy translation records that predate model/provider tracking.
 */

import type { AppSettings } from '../../types';

const FALLBACK_TRANSLATION_SETTINGS: Pick<AppSettings, 'provider' | 'model'> = {
  provider: 'OpenAI',
  model: 'gpt-4o-mini',
};

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
