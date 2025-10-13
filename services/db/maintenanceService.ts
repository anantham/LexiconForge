/**
 * Database Maintenance Service
 * 
 * Extracted from indexeddb.ts to separate database maintenance concerns.
 * This service handles:
 * - Cleanup of duplicate translation versions
 * - Database integrity checks
 * - Performance optimization tasks
 */

import { indexedDBService } from '../indexeddb';
import { debugLog } from '../../utils/debug';

/**
 * Clean up duplicate translation versions
 * Removes older versions when there are multiple translations for the same URL
 */
export async function cleanupDuplicateVersions(): Promise<void> {
  debugLog('indexeddb', 'summary', '[Cleanup] Starting duplicate version cleanup');
  
  try {
    // Open database for cleanup operation  
    const db = await indexedDBService.openDatabase();
    
    const transaction = db.transaction(['translations'], 'readwrite');
    const store = transaction.objectStore('translations');
    
    return new Promise((resolve, reject) => {
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = async () => {
        const allTranslations = getAllRequest.result as any[];
        debugLog('indexeddb', 'summary', `[Cleanup] Found ${allTranslations.length} total translations`);
        
        // Group by URL
        const translationsByUrl: { [url: string]: any[] } = {};
        for (const translation of allTranslations) {
          const url = translation.url || '';
          if (!translationsByUrl[url]) {
            translationsByUrl[url] = [];
          }
          translationsByUrl[url].push(translation);
        }
        
        let duplicatesRemoved = 0;
        
        // Process each URL group
        for (const [url, translations] of Object.entries(translationsByUrl)) {
          if (translations.length > 1) {
            debugLog('indexeddb', 'summary', `[Cleanup] Found ${translations.length} translations for ${url}`);
            
            // Sort by timestamp (keep newest)
            translations.sort((a, b) => 
              new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
            );
            
            // Remove older versions (keep first/newest)
            const toRemove = translations.slice(1);
            for (const oldTranslation of toRemove) {
              const deleteRequest = store.delete(oldTranslation.id);
              deleteRequest.onsuccess = () => {
                duplicatesRemoved++;
                debugLog('indexeddb', 'summary', `[Cleanup] Removed duplicate translation: ${oldTranslation.id}`);
              };
            }
          }
        }
        
        transaction.oncomplete = () => {
          debugLog('indexeddb', 'summary', `[Cleanup] Cleanup completed. Removed ${duplicatesRemoved} duplicate translations`);
          resolve();
        };
        
        transaction.onerror = () => {
          reject(new Error('Cleanup transaction failed'));
        };
      };
      
      getAllRequest.onerror = () => {
        reject(new Error('Failed to retrieve translations for cleanup'));
      };
    });
  } catch (error) {
    console.error('[Cleanup] Cleanup failed:', error);
    throw error;
  }
}
