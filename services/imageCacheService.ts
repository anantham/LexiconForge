/**
 * Image Cache Service - Browser-managed disk cache for generated images
 *
 * Architecture:
 * - Images stored in Cache API (browser disk, persistent across sessions)
 * - Cache KEYS stored in IndexedDB (chapterId + placementMarker)
 * - Blob URLs generated on-demand per render (session-scoped, must be revoked)
 *
 * This mirrors the audio cache architecture and keeps RAM usage minimal.
 *
 * IMPORTANT: Blob URLs are session-scoped! Never persist blob:// strings.
 * Always store the cache key and regenerate blob URLs on each page load.
 */

import { telemetryService } from './telemetryService';

export interface ImageCacheKey {
  chapterId: string;
  placementMarker: string;
  version: number;  // Version number for tracking multiple generations (1-indexed)
}

export interface ImageCacheStats {
  images: number;
  totalSizeMB: number;
}

export class ImageCacheStore {
  private static readonly CACHE_NAME = 'lexicon-images-v1';

  /**
   * Check if Cache API is available
   */
  static isSupported(): boolean {
    return typeof caches !== 'undefined';
  }

  /**
   * Open the image cache
   */
  private static async openCache(): Promise<Cache> {
    if (!this.isSupported()) {
      throw new Error('Cache Storage not available');
    }
    return await caches.open(this.CACHE_NAME);
  }

  /**
   * Generate stable cache URL for an image
   * Format: https://lexiconforge.local/images/{chapterId}/{encodedMarker}
   *
   * Note: Cache API requires HTTP/HTTPS URLs, not custom schemes.
   * This domain won't actually be fetched - it's just a unique identifier.
   */
  static getCacheUrl(chapterId: string, placementMarker: string, version: number = 1): string {
    return `https://lexiconforge.local/images/${chapterId}/${encodeURIComponent(placementMarker)}/v${version}`;
  }

  /**
   * Parse cache URL back to key components
   */
  static parseCacheUrl(cacheUrl: string): ImageCacheKey | null {
    const match = cacheUrl.match(/^https:\/\/lexiconforge\.local\/images\/([^/]+)\/([^/]+)(?:\/v(\d+))?$/);
    if (!match) return null;

    return {
      chapterId: match[1],
      placementMarker: decodeURIComponent(match[2]),
      version: match[3] ? parseInt(match[3], 10) : 1
    };
  }

  /**
   * Convert base64 data URL to Blob using atob (avoids fetch size limits)
   * Supports both browser (atob) and Node.js (Buffer) environments
   */
  private static base64ToBlob(dataUrl: string): Blob {
    try {
      // Extract MIME type and base64 data
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        throw new Error('Invalid data URL format');
      }

      const mimeType = match[1];
      const base64Data = match[2];

      // Decode base64 - use atob in browser, Buffer in Node.js
      let bytes: Uint8Array;
      if (typeof atob !== 'undefined') {
        // Browser environment
        const binaryString = atob(base64Data);
        bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
      } else if (typeof Buffer !== 'undefined') {
        // Node.js environment (tests, SSR)
        bytes = new Uint8Array(Buffer.from(base64Data, 'base64'));
      } else {
        throw new Error('Neither atob nor Buffer available for base64 decoding');
      }

      return new Blob([bytes], { type: mimeType });
    } catch (error) {
      telemetryService.captureError('base64-to-blob', error, {
        dataUrlPrefix: dataUrl.substring(0, 50)
      });
      throw new Error(`Failed to convert base64 to Blob: ${error}`);
    }
  }

  /**
   * Store image in Cache API
   * @returns Cache key for later retrieval (NOT a blob URL)
   */
  static async storeImage(
    chapterId: string,
    placementMarker: string,
    imageData: string, // base64 data URL
    version: number = 1 // Version number for this generation
  ): Promise<ImageCacheKey> {
    const startTime = performance.now();
    const cacheUrl = this.getCacheUrl(chapterId, placementMarker, version);

    try {
      const cache = await this.openCache();

      // Convert base64 to Blob
      const blob = this.base64ToBlob(imageData);

      // Create response with metadata
      const response = new Response(blob, {
        headers: {
          'Content-Type': blob.type,
          'X-Cached-At': new Date().toISOString(),
          'X-Chapter-Id': chapterId,
          'X-Placement-Marker': placementMarker,
          'X-Version': String(version),
          'X-Original-Size': String(imageData.length),
          'X-Blob-Size': String(blob.size)
        }
      });

      await cache.put(cacheUrl, response);

      const durationMs = performance.now() - startTime;

      telemetryService.captureMemorySnapshot('image-cached', {
        chapterId,
        placementMarker,
        version,
        originalSizeKB: (imageData.length / 1024).toFixed(2),
        blobSizeKB: (blob.size / 1024).toFixed(2),
        compressionRatio: (imageData.length / blob.size).toFixed(2),
        durationMs: durationMs.toFixed(2)
      });

      // Return cache key (NOT a blob URL - those are session-scoped)
      return { chapterId, placementMarker, version };

    } catch (error) {
      telemetryService.captureError('image-cache-store', error, {
        chapterId,
        placementMarker
      });
      throw error;
    }
  }

  /**
   * Migrate a legacy base64 image into the Cache API, reusing an existing entry when present.
   *
   * @returns Cache key + version information
   */
  static async migrateBase64Image(
    chapterId: string,
    placementMarker: string,
    imageData: string,
    existingVersion: number = 1
  ): Promise<{ cacheKey: ImageCacheKey; migrated: boolean }> {
    if (!this.isSupported()) {
      return {
        cacheKey: { chapterId, placementMarker, version: existingVersion },
        migrated: false
      };
    }

    const candidateKey: ImageCacheKey = { chapterId, placementMarker, version: existingVersion };

    try {
      const alreadyExists = await this.has(candidateKey);
      if (alreadyExists) {
        return { cacheKey: candidateKey, migrated: false };
      }

      const cacheKey = await this.storeImage(chapterId, placementMarker, imageData, existingVersion);
      return { cacheKey, migrated: true };
    } catch (error) {
      telemetryService.captureError('image-cache-migrate', error, {
        chapterId,
        placementMarker,
        existingVersion
      });
      throw error;
    }
  }

  /**
   * Generate a fresh Blob URL for an image
   * IMPORTANT: Caller must revoke this URL when done via URL.revokeObjectURL()
   */
  static async createBlobUrl(cacheKey: ImageCacheKey): Promise<string | null> {
    try {
      const cache = await this.openCache();
      const cacheUrl = this.getCacheUrl(cacheKey.chapterId, cacheKey.placementMarker, cacheKey.version);
      const response = await cache.match(cacheUrl);

      if (!response) {
        telemetryService.captureWarning('cache-miss', 'Image not found in cache', {
          chapterId: cacheKey.chapterId,
          placementMarker: cacheKey.placementMarker
        });
        return null;
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      return blobUrl;
    } catch (error) {
      telemetryService.captureError('blob-url-create', error, {
        cacheKey,
      });
      return null;
    }
  }

  /**
   * Check if image exists in cache
   */
  static async has(cacheKey: ImageCacheKey): Promise<boolean> {
    try {
      const cache = await this.openCache();
      const cacheUrl = this.getCacheUrl(cacheKey.chapterId, cacheKey.placementMarker, cacheKey.version);
      const response = await cache.match(cacheUrl);
      return !!response;
    } catch {
      return false;
    }
  }

  /**
   * Get image as Blob (for EPUB export)
   * Returns null if cache miss (graceful degradation)
   */
  static async getImageBlob(cacheKey: ImageCacheKey): Promise<Blob | null> {
    try {
      const cache = await this.openCache();
      const cacheUrl = this.getCacheUrl(cacheKey.chapterId, cacheKey.placementMarker, cacheKey.version);
      const response = await cache.match(cacheUrl);

      if (!response) {
        telemetryService.captureWarning('cache-miss-export', 'Image not found for export', {
          chapterId: cacheKey.chapterId,
          placementMarker: cacheKey.placementMarker
        });
        return null;
      }

      return await response.blob();
    } catch (error) {
      telemetryService.captureError('blob-fetch', error, {
        cacheKey,
      });
      return null;
    }
  }

  /**
   * Remove specific image from cache
   */
  static async removeImage(cacheKey: ImageCacheKey): Promise<boolean> {
    try {
      const cache = await this.openCache();
      const cacheUrl = this.getCacheUrl(cacheKey.chapterId, cacheKey.placementMarker, cacheKey.version);
      return await cache.delete(cacheUrl);
    } catch (error) {
      telemetryService.captureError('cache-delete', error, {
        cacheKey,
      });
      return false;
    }
  }

  /**
   * List all cached images for a chapter
   */
  static async listChapterImages(chapterId: string): Promise<string[]> {
    try {
      const cache = await this.openCache();
      const requests = await cache.keys();
      const prefix = `image://${chapterId}/`;

      return requests
        .map(req => req.url)
        .filter(url => url.includes(prefix))
        .map(url => {
          const parts = url.split('/');
          return decodeURIComponent(parts[parts.length - 1]);
        });
    } catch (error) {
      telemetryService.captureError('cache-list', error, { chapterId });
      return [];
    }
  }

  /**
   * Get cache usage statistics
   */
  static async getUsage(): Promise<ImageCacheStats> {
    try {
      const cache = await this.openCache();
      const requests = await cache.keys();
      let totalSize = 0;

      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }

      return {
        images: requests.length,
        totalSizeMB: parseFloat((totalSize / 1024 / 1024).toFixed(2))
      };
    } catch (error) {
      telemetryService.captureError('cache-usage', error);
      return { images: 0, totalSizeMB: 0 };
    }
  }

  /**
   * Clear all cached images
   * IMPORTANT: This will break any active Blob URLs
   */
  static async clear(): Promise<void> {
    if (!this.isSupported()) return;

    try {
      await caches.delete(this.CACHE_NAME);
      telemetryService.captureMemorySnapshot('cache-cleared', {
        cacheName: this.CACHE_NAME
      });
    } catch (error) {
      telemetryService.captureError('cache-clear', error);
      throw error;
    }
  }

  /**
   * Estimate quota usage (if supported)
   */
  static async estimateQuota(): Promise<{ usedMB: number; quotaMB: number; percentUsed: number } | null> {
    if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
      return null;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usedMB = (estimate.usage || 0) / 1024 / 1024;
      const quotaMB = (estimate.quota || 0) / 1024 / 1024;
      const percentUsed = quotaMB > 0 ? (usedMB / quotaMB) * 100 : 0;

      return {
        usedMB: parseFloat(usedMB.toFixed(2)),
        quotaMB: parseFloat(quotaMB.toFixed(2)),
        percentUsed: parseFloat(percentUsed.toFixed(1))
      };
    } catch (error) {
      telemetryService.captureError('quota-estimate', error);
      return null;
    }
  }
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).ImageCacheStore = ImageCacheStore;
}
