/**
 * Utility functions for audio storage
 */

/**
 * Generate SHA-256 hash from a ReadableStream, ArrayBuffer, or Blob
 */
export async function sha256Hex(data: ReadableStream<Uint8Array> | ArrayBuffer | Blob): Promise<string> {
  let buffer: ArrayBuffer;
  
  if (data instanceof ArrayBuffer) {
    buffer = data;
  } else if (data instanceof Blob) {
    buffer = await data.arrayBuffer();
  } else {
    // ReadableStream - consume it to get bytes
    const chunks: Uint8Array[] = [];
    const reader = data.getReader();
    
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    // Combine chunks into single buffer
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    buffer = combined.buffer;
  }
  
  // Generate hash using Web Crypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Format bytes for human-readable display
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration in seconds to MM:SS format
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Check if storage quota is available
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number; percentage: number }> {
  if (!navigator.storage || !navigator.storage.estimate) {
    return { usage: 0, quota: 0, percentage: 0 };
  }
  
  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percentage = quota > 0 ? (usage / quota) * 100 : 0;
    
    return { usage, quota, percentage };
  } catch (error) {
    console.warn('Failed to get storage estimate:', error);
    return { usage: 0, quota: 0, percentage: 0 };
  }
}

/**
 * Request persistent storage
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persist) {
    return false;
  }
  
  try {
    return await navigator.storage.persist();
  } catch (error) {
    console.warn('Failed to request persistent storage:', error);
    return false;
  }
}

/**
 * Create a short hash for display purposes (first 8 chars)
 */
export function shortHash(hash: string): string {
  return hash.substring(0, 8);
}

/**
 * Generate a unique ID for audio manifests
 */
export function generateManifestId(chapterId: string, hash: string): string {
  return `${chapterId}:${shortHash(hash)}`;
}

/**
 * Parse manifest ID back to chapter ID and short hash
 */
export function parseManifestId(id: string): { chapterId: string; shortHash: string } {
  const [chapterId, shortHash] = id.split(':', 2);
  return { chapterId, shortHash };
}