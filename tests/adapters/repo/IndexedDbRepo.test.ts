import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as idbModule from '../../../services/indexeddb';
import { repo } from '../../../adapters/repo';

describe('IndexedDbRepo adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates getChapter to indexedDBService.getChapter', async () => {
    const spy = vi.spyOn(idbModule.indexedDBService, 'getChapter').mockResolvedValue({ url: 'u', title: 't' } as any);
    const res = await repo.getChapter('u');
    expect(spy).toHaveBeenCalledWith('u');
    expect(res).toEqual({ url: 'u', title: 't' });
  });

  it('delegates storeTranslation to indexedDBService.storeTranslation', async () => {
    const mockReturn = { id: 'id1', version: 1 } as any;
    const spy = vi.spyOn(idbModule.indexedDBService, 'storeTranslation').mockResolvedValue(mockReturn);
    const res = await repo.storeTranslation('u', { translatedTitle: '', translation: '' } as any, { provider: 'p', model: 'm', temperature: 0.1, systemPrompt: '' });
    expect(spy).toHaveBeenCalled();
    expect(res).toBe(mockReturn);
  });
});

