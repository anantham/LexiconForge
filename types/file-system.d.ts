/**
 * File System Access API type declarations
 * These APIs are available in Chromium-based browsers for accessing the local file system.
 */

interface FileSystemDirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: FileSystemHandle | 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}

interface Window {
  showDirectoryPicker(options?: FileSystemDirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}
