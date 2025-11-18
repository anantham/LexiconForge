/**
 * Database Maintenance Service
 * 
 * Extracted from indexeddb.ts to separate database maintenance concerns.
 * This service handles:
 * - Cleanup of duplicate translation versions
 * - Database integrity checks
 * - Performance optimization tasks
 */

import type { TranslationRecord } from './types';
import { debugLog } from '../../utils/debug';
import { TranslationOps } from './operations';

/**
 * Clean up duplicate translation versions
 * Removes older versions when there are multiple translations for the same URL
 */
export async function cleanupDuplicateVersions(): Promise<void> {
  debugLog('indexeddb', 'summary', '[Cleanup] Starting duplicate version cleanup');
  
  try {
    const translations = await TranslationOps.getAll();
    debugLog('indexeddb', 'summary', `[Cleanup] Found ${translations.length} total translations`);

    const translationsByUrl = new Map<string, TranslationRecord[]>();
    for (const record of translations) {
      const url = record.chapterUrl || '';
      if (!translationsByUrl.has(url)) {
        translationsByUrl.set(url, []);
      }
      translationsByUrl.get(url)!.push(record);
    }

    let duplicatesRemoved = 0;

    for (const [url, records] of translationsByUrl.entries()) {
      if (records.length <= 1) continue;

      debugLog('indexeddb', 'summary', `[Cleanup] Found ${records.length} translations for ${url}`);
      const sorted = records.slice().sort((a, b) => {
        const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (createdA !== createdB) return createdB - createdA;
        return (b.version || 0) - (a.version || 0);
      });

      const toRemove = sorted.slice(1);
      for (const duplicate of toRemove) {
        await TranslationOps.deleteVersion(duplicate.id);
        duplicatesRemoved++;
        debugLog('indexeddb', 'summary', `[Cleanup] Removed duplicate translation: ${duplicate.id}`);
      }
    }

    debugLog('indexeddb', 'summary', `[Cleanup] Cleanup completed. Removed ${duplicatesRemoved} duplicate translations`);
  } catch (error) {
    console.error('[Cleanup] Cleanup failed:', error);
    throw error;
  }
}
