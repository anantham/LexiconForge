/**
 * EPUB Asset Resolver
 *
 * Phase 2 of EPUB export pipeline: fetches binary assets (images via ImageCacheStore,
 * audio via AudioCacheStore) and converts them into {id, mimeType, arrayBuffer} records.
 *
 * Handles cache misses gracefully with fallback to base64 data.
 */

import { ImageCacheStore } from '../imageCacheService';
import { telemetryService } from '../telemetryService';
import type {
  CollectedData,
  ResolvedAssets,
  ResolvedChapter,
  ResolvedAsset
} from './types';

/**
 * Resolve all asset references into binary data
 *
 * For each image/audio reference:
 * 1. Try fetching from Cache API using cache key
 * 2. If cache miss, try base64 fallback
 * 3. If neither available, mark as missing and log warning
 *
 * @param collectedData Normalized chapter data from data collector
 * @returns Resolved assets with ArrayBuffers + updated chapter references
 */
export async function resolveAssets(
  collectedData: CollectedData
): Promise<ResolvedAssets> {
  const resolvedAssets: ResolvedAsset[] = [];
  const warnings: ResolvedAssets['warnings'] = [];
  const resolvedChapters: ResolvedChapter[] = [];

  // Process each chapter's image references
  for (const chapter of collectedData.chapters) {
    const resolvedImageRefs = await Promise.all(
      chapter.imageReferences.map(async (imageRef) => {
        // Try cache first if cache key exists
        if (imageRef.cacheKey) {
          try {
            const blob = await ImageCacheStore.getImageBlob(imageRef.cacheKey);

            if (blob) {
              // Cache hit - convert to ArrayBuffer (Node-compatible)
              const arrayBuffer = await blobToArrayBuffer(blob);
              const assetId = `img-${imageRef.cacheKey.chapterId}-${imageRef.placementMarker}`;

              resolvedAssets.push({
                id: assetId,
                mimeType: blob.type || 'image/png',
                data: arrayBuffer,
                extension: getExtensionFromMimeType(blob.type || 'image/png'),
                sourceRef: {
                  chapterId: chapter.id,
                  marker: imageRef.placementMarker,
                  type: 'image'
                }
              });

              return {
                ...imageRef,
                assetId,
                missing: false
              };
            }
          } catch (error) {
            telemetryService.captureError('asset-resolver-cache', error, {
              chapterId: chapter.id,
              marker: imageRef.placementMarker
            });
          }
        }

        // Cache miss - try base64 fallback
        if (imageRef.base64Fallback) {
          try {
            const arrayBuffer = await base64ToArrayBuffer(imageRef.base64Fallback);
            const assetId = `img-${chapter.id}-${imageRef.placementMarker}`;
            const mimeType = extractMimeTypeFromDataUrl(imageRef.base64Fallback);

            resolvedAssets.push({
              id: assetId,
              mimeType,
              data: arrayBuffer,
              extension: getExtensionFromMimeType(mimeType),
              sourceRef: {
                chapterId: chapter.id,
                marker: imageRef.placementMarker,
                type: 'image'
              }
            });

            warnings.push({
              type: 'cache-miss',
              assetId,
              chapterId: chapter.id,
              marker: imageRef.placementMarker,
              message: `Cache miss for ${imageRef.placementMarker}, used base64 fallback`
            });

            return {
              ...imageRef,
              assetId,
              missing: false
            };
          } catch (error) {
            telemetryService.captureError('asset-resolver-base64', error, {
              chapterId: chapter.id,
              marker: imageRef.placementMarker
            });
          }
        }

        // Both cache and fallback failed - mark as missing
        warnings.push({
          type: 'cache-miss',
          assetId: `missing-${chapter.id}-${imageRef.placementMarker}`,
          chapterId: chapter.id,
          marker: imageRef.placementMarker,
          message: `No asset found for ${imageRef.placementMarker} (cache miss + no fallback)`
        });

        return {
          ...imageRef,
          assetId: undefined,
          missing: true
        };
      })
    );

    resolvedChapters.push({
      ...chapter,
      imageReferences: resolvedImageRefs
    } as ResolvedChapter);
  }

  return {
    chapters: resolvedChapters,
    assets: resolvedAssets,
    warnings
  };
}

/**
 * Convert Blob to ArrayBuffer
 * Supports both browser (arrayBuffer) and Node.js (Buffer) environments
 */
async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  // Try native arrayBuffer() first (browser)
  if (typeof blob.arrayBuffer === 'function') {
    return await blob.arrayBuffer();
  }

  // Fallback for Node.js environment (vitest/jsdom)
  // Read blob as text and convert to ArrayBuffer
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = () => {
      reject(new Error('Failed to read blob'));
    };
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Convert base64 data URL to ArrayBuffer
 * Supports both browser (atob) and Node.js (Buffer) environments
 */
async function base64ToArrayBuffer(dataUrl: string): Promise<ArrayBuffer> {
  // Extract base64 data after "data:image/...;base64,"
  const base64Data = dataUrl.split(',')[1];
  if (!base64Data) {
    throw new Error('Invalid data URL format');
  }

  // Decode based on environment
  if (typeof atob !== 'undefined') {
    // Browser
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } else if (typeof Buffer !== 'undefined') {
    // Node.js
    const buffer = Buffer.from(base64Data, 'base64');
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } else {
    throw new Error('Neither atob nor Buffer available for base64 decoding');
  }
}

/**
 * Extract MIME type from data URL
 */
function extractMimeTypeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match ? match[1] : 'image/png';
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg'
  };

  return map[mimeType] || 'bin';
}
