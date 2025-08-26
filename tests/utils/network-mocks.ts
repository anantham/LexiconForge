import { vi } from 'vitest';
import { Chapter } from '../../types';
import { createMockChapter } from './test-data';

export const mockFetchSuccess = (chapter: Chapter) => {
  const mockResponse = {
    ok: true,
    status: 200,
    text: () => Promise.resolve(chapter.content),
    json: () => Promise.resolve(chapter),
  };
  vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any);
};

export const mockFetchError = (status: number, statusText: string) => {
  const mockResponse = {
    ok: false,
    status,
    statusText,
    text: () => Promise.resolve(statusText),
  };
  vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any);
};

export const mockFetchCorrupted = () => {
  const mockResponse = {
    ok: true,
    status: 200,
    text: () => Promise.resolve('<html><body><p>Corrupted HTML</p></body></html>'),
  };
  vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any);
};
