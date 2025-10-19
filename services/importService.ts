/**
 * Import Service - Handle session imports from URLs and files
 */

import { indexedDBService } from './indexeddb';

export interface ImportProgress {
  stage: 'downloading' | 'parsing' | 'importing' | 'complete';
  progress: number; // 0-100
  loaded?: number;
  total?: number;
  message?: string;
}

export class ImportService {
  /**
   * Import session from URL with CORS handling and progress tracking
   */
  static async importFromUrl(
    url: string,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<any> {
    try {
      // Convert GitHub URLs to raw format
      let fetchUrl = url;
      if (url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
        fetchUrl = url
          .replace('github.com', 'raw.githubusercontent.com')
          .replace('/blob/', '/');
      }

      // Convert Google Drive share links to Google Drive API endpoint
      if (url.includes('drive.google.com/file/d/')) {
        const fileId = url.match(/\/d\/([^/]+)/)?.[1];
        if (fileId) {
          // Use Google Drive API v3 endpoint which supports CORS
          // Requires GOOGLE_DRIVE_API_KEY in environment variables
          const apiKey = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY;

          if (apiKey) {
            // Google Drive API v3 with API key (supports CORS)
            fetchUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
          } else {
            // Fallback to direct download (will fail with CORS error)
            console.warn('[Import] GOOGLE_DRIVE_API_KEY not found. Set VITE_GOOGLE_DRIVE_API_KEY in .env.local to enable Google Drive downloads.');
            fetchUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
          }
        }
      }

      console.log(`[Import] Fetching from: ${fetchUrl}`);

      // Fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      try {
        onProgress?.({ stage: 'downloading', progress: 0, message: 'Starting download...' });

        const response = await fetch(fetchUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Check file size
        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength) : 0;

        if (total && total > 500 * 1024 * 1024) {
          throw new Error('Session file too large (>500MB)');
        }

        // Read response with progress tracking
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        let receivedLength = 0;
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          chunks.push(value);
          receivedLength += value.length;

          if (total) {
            const downloadProgress = Math.min((receivedLength / total) * 100, 99);
            onProgress?.({
              stage: 'downloading',
              progress: downloadProgress,
              loaded: receivedLength,
              total,
              message: `Downloading... ${(receivedLength / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB`
            });
          } else {
            onProgress?.({
              stage: 'downloading',
              progress: 50,
              loaded: receivedLength,
              message: `Downloading... ${(receivedLength / 1024 / 1024).toFixed(1)}MB`
            });
          }
        }

        onProgress?.({ stage: 'parsing', progress: 0, message: 'Parsing session data...' });

        // Convert chunks to text
        const blob = new Blob(chunks);
        const text = await blob.text();
        const sessionData = JSON.parse(text);

        // Validate format
        if (!sessionData.metadata?.format?.startsWith('lexiconforge')) {
          throw new Error('Invalid session format. Expected lexiconforge export.');
        }

        onProgress?.({ stage: 'importing', progress: 0, message: 'Importing to database...' });

        // Use existing import logic
        await indexedDBService.importFullSessionData(sessionData);

        onProgress?.({ stage: 'complete', progress: 100, message: 'Import complete!' });

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
