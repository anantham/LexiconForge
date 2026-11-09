/**
 * useBlobUrl Hook - Manages blob URL lifecycle with automatic cleanup
 *
 * Blob URLs are session-scoped and must be revoked to prevent memory leaks.
 * This hook handles creation and cleanup automatically.
 *
 * Usage:
 * ```tsx
 * const blobUrl = useBlobUrl(imageCacheKey);
 * return <img src={blobUrl || fallbackUrl} />;
 * ```
 */

import { useState, useEffect } from 'react';
import { ImageCacheStore, type ImageCacheKey } from '../services/imageCacheService';
import { telemetryService } from '../services/telemetryService';

export function useBlobUrl(cacheKey: ImageCacheKey | null | undefined): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    // No cache key provided
    if (!cacheKey) {
      setBlobUrl(null);
      return;
    }

    let currentBlobUrl: string | null = null;
    let isMounted = true;

    // Create blob URL from cache
    const loadBlobUrl = async () => {
      try {
        const url = await ImageCacheStore.createBlobUrl(cacheKey);

        if (isMounted) {
          if (url) {
            currentBlobUrl = url;
            setBlobUrl(url);
            setError(false);
          } else {
            // Cache miss
            setBlobUrl(null);
            setError(true);
            telemetryService.captureWarning('blob-url-cache-miss', 'Failed to load image from cache', {
              chapterId: cacheKey.chapterId,
              placementMarker: cacheKey.placementMarker
            });
          }
        } else {
          // Component unmounted before load completed - clean up immediately
          if (url) {
            URL.revokeObjectURL(url);
          }
        }
      } catch (err) {
        if (isMounted) {
          setBlobUrl(null);
          setError(true);
          telemetryService.captureError('blob-url-load', err, {
            chapterId: cacheKey.chapterId,
            placementMarker: cacheKey.placementMarker
          });
        }
      }
    };

    loadBlobUrl();

    // Cleanup: Revoke blob URL when component unmounts or cache key changes
    return () => {
      isMounted = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [cacheKey?.chapterId, cacheKey?.placementMarker, cacheKey?.version]);

  return blobUrl;
}

/**
 * Helper: Check if image data is a base64 data URL or needs cache lookup
 */
export function isBase64DataUrl(imageData: string | undefined): boolean {
  if (!imageData) return false;
  return imageData.startsWith('data:image/');
}
