/**
 * Import Service - Handle session imports from URLs and files
 */

import { indexedDBService } from './indexeddb';

export class ImportService {
  /**
   * Import session from URL with CORS handling
   */
  static async importFromUrl(url: string): Promise<any> {
    try {
      // Convert GitHub URLs to raw format
      let fetchUrl = url;
      if (url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
        fetchUrl = url
          .replace('github.com', 'raw.githubusercontent.com')
          .replace('/blob/', '/');
      }

      // Convert Google Drive share links to direct download
      if (url.includes('drive.google.com/file/d/')) {
        const fileId = url.match(/\/d\/([^/]+)/)?.[1];
        if (fileId) {
          fetchUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
      }

      console.log(`[Import] Fetching from: ${fetchUrl}`);

      // Fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      try {
        const response = await fetch(fetchUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Check file size
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
          throw new Error('Session file too large (>50MB)');
        }

        const sessionData = await response.json();

        // Validate format
        if (!sessionData.metadata?.format?.startsWith('lexiconforge')) {
          throw new Error('Invalid session format. Expected lexiconforge export.');
        }

        // Use existing import logic
        await indexedDBService.importFullSessionData(sessionData);

        console.log(`[Import] Successfully imported ${sessionData.chapters?.length || 0} chapters`);

        return sessionData;
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Import timed out. File may be too large or server is slow.');
        }
        throw error;
      }
    } catch (error: any) {
      console.error('[Import] Failed to import from URL:', error);
      throw new Error(`Failed to import: ${error.message}`);
    }
  }

  /**
   * Import from File (existing behavior)
   */
  static async importFromFile(file: File): Promise<any> {
    try {
      const text = await file.text();
      const sessionData = JSON.parse(text);

      // Validate format
      if (!sessionData.metadata?.format?.startsWith('lexiconforge')) {
        throw new Error('Invalid session format');
      }

      await indexedDBService.importFullSessionData(sessionData);

      console.log(`[Import] Successfully imported from file: ${file.name}`);

      return sessionData;
    } catch (error: any) {
      console.error('[Import] Failed to import from file:', error);
      throw new Error(`Failed to import file: ${error.message}`);
    }
  }
}
