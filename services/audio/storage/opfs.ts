/**
 * OPFS (Origin Private File System) storage for pinned audio
 *
 * High-performance local file storage for audio that users want to keep offline.
 * Falls back gracefully when OPFS is not available (Safari, older browsers).
 */

import { sha256Hex } from './utils';

export const OPFS = {
  kind: 'opfs' as const,

  /**
   * Check if OPFS is available in this browser
   */
  isSupported(): boolean {
    return typeof navigator !== 'undefined' &&
           'storage' in navigator &&
           typeof (navigator.storage as any).getDirectory === 'function';
  },

  /**
   * Get or create the OST directory in OPFS
   */
  async dir(name = 'ost'): Promise<FileSystemDirectoryHandle> {
    if (!this.isSupported()) {
      throw new Error('OPFS not available in this browser');
    }

    try {
      // @ts-ignore - OPFS is experimental but widely supported
      const root = await (navigator.storage as any).getDirectory();
      return await root.getDirectoryHandle(name, { create: true });
    } catch (error) {
      throw new Error(`OPFS directory access failed: ${error.message}`);
    }
  },

  /**
   * Save audio data to OPFS with content hashing for deduplication.
   *
   * Accepts ArrayBuffer or Blob only. (An earlier version also advertised
   * ReadableStream input, but the stream was consumed for hashing and the
   * write path then unconditionally threw "ReadableStream can only be
   * consumed once" — the type now reflects what actually works.)
   */
  async save(
    data: ArrayBuffer | Blob,
    mime = 'audio/mpeg',
    nameHint = 'track'
  ): Promise<{ uri: string; hash: string; size: number }> {
    const dir = await this.dir();

    let size = 0;
    if (data instanceof ArrayBuffer) {
      size = data.byteLength;
    } else if (data instanceof Blob) {
      size = data.size;
    } else {
      throw new Error('Unsupported data type for OPFS save');
    }

    // Generate content hash for deduplication
    const hash = await sha256Hex(data);

    const ext = mime.includes('mpeg') ? 'mp3' :
               mime.includes('ogg') ? 'ogg' :
               mime.includes('wav') ? 'wav' : 'bin';
    const fileName = `${hash}.${ext}`;

    try {
      // Check if file already exists (deduplication)
      const existingFile = await dir.getFileHandle(fileName);
      const existingFileObj = await existingFile.getFile();

      return {
        uri: `opfs://ost/${fileName}`,
        hash,
        size: existingFileObj.size
      };
    } catch {
      // File doesn't exist, create it
    }

    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();

    try {
      await writable.write(data);
      await writable.close();

      return {
        uri: `opfs://ost/${fileName}`,
        hash,
        size
      };
    } catch (error) {
      await writable.abort();
      throw error;
    }
  },

  /**
   * Open a file from OPFS and return as a Blob for URL.createObjectURL
   */
  async open(uri: string): Promise<File> {
    const fileName = uri.split('/').pop()!;
    const dir = await this.dir();

    try {
      const fileHandle = await dir.getFileHandle(fileName);
      // @ts-ignore - OPFS File interface
      return await fileHandle.getFile() as File;
    } catch (error) {
      throw new Error(`Failed to open OPFS file ${fileName}: ${error.message}`);
    }
  },

  /**
   * Remove a file from OPFS
   */
  async remove(uri: string): Promise<void> {
    const fileName = uri.split('/').pop()!;
    const dir = await this.dir();

    try {
      await dir.removeEntry(fileName);
    } catch (error) {
      // File might not exist, which is fine
      console.warn(`Failed to remove OPFS file ${fileName}:`, error.message);
    }
  },

  /**
   * Check if a file exists in OPFS
   */
  async exists(uri: string): Promise<boolean> {
    const fileName = uri.split('/').pop()!;
    const dir = await this.dir();

    try {
      await dir.getFileHandle(fileName);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * List all files in the OST directory
   */
  async listFiles(): Promise<string[]> {
    const dir = await this.dir();
    const files: string[] = [];

    // @ts-ignore - AsyncIterable interface
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === 'file') {
        files.push(`opfs://ost/${name}`);
      }
    }

    return files;
  },

  /**
   * Get storage usage for the OST directory
   */
  async getUsage(): Promise<{ files: number; totalSize: number }> {
    const dir = await this.dir();
    let files = 0;
    let totalSize = 0;

    try {
      // @ts-ignore - AsyncIterable interface
      for await (const [name, handle] of dir.entries()) {
        if (handle.kind === 'file') {
          const file = await handle.getFile();
          files++;
          totalSize += file.size;
        }
      }
    } catch (error) {
      console.warn('Failed to calculate OPFS usage:', error);
    }

    return { files, totalSize };
  }
};
