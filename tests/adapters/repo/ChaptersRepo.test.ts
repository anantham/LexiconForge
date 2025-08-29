import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as idbModule from '../../../services/indexeddb';
import { chaptersRepo } from '../../../adapters/repo/ChaptersRepo';

describe('ChaptersRepo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates getChapter to indexedDBService', async () => {
    const mockChapter = { url: 'test-url', title: 'Test Chapter' } as any;
    const spy = vi.spyOn(idbModule.indexedDBService, 'getChapter').mockResolvedValue(mockChapter);
    
    const result = await chaptersRepo.getChapter('test-url');
    
    expect(spy).toHaveBeenCalledWith('test-url');
    expect(result).toBe(mockChapter);
  });

  it('delegates getChapterByStableId to indexedDBService', async () => {
    const mockChapter = { stableId: 'stable-123', title: 'Test Chapter' } as any;
    const spy = vi.spyOn(idbModule.indexedDBService, 'getChapterByStableId').mockResolvedValue(mockChapter);
    
    const result = await chaptersRepo.getChapterByStableId('stable-123');
    
    expect(spy).toHaveBeenCalledWith('stable-123');
    expect(result).toBe(mockChapter);
  });

  it('delegates storeChapter to indexedDBService', async () => {
    const mockChapter = { url: 'test-url', title: 'Test Chapter' } as any;
    const spy = vi.spyOn(idbModule.indexedDBService, 'storeChapter').mockResolvedValue(undefined);
    
    await chaptersRepo.storeChapter(mockChapter);
    
    expect(spy).toHaveBeenCalledWith(mockChapter);
  });

  it('delegates getAllChapters to indexedDBService', async () => {
    const mockChapters = [
      { url: 'url1', title: 'Chapter 1' },
      { url: 'url2', title: 'Chapter 2' }
    ] as any[];
    const spy = vi.spyOn(idbModule.indexedDBService, 'getAllChapters').mockResolvedValue(mockChapters);
    
    const result = await chaptersRepo.getAllChapters();
    
    expect(spy).toHaveBeenCalled();
    expect(result).toBe(mockChapters);
  });

  it('delegates findChapterByUrl to indexedDBService', async () => {
    const mockResult = { stableId: 'stable-123', canonicalUrl: 'canonical-url', data: {} };
    const spy = vi.spyOn(idbModule.indexedDBService, 'findChapterByUrl').mockResolvedValue(mockResult);
    
    const result = await chaptersRepo.findChapterByUrl('test-url');
    
    expect(spy).toHaveBeenCalledWith('test-url');
    expect(result).toBe(mockResult);
  });
});