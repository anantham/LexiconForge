import { describe, it, expect, vi } from 'vitest';
import { getConnection } from '../../services/db/core/connection';

describe('getConnection singleton', () => {
  it('returns one connection under stampede', async () => {
    const spy = vi.spyOn(globalThis.indexedDB, 'open');
    const results = await Promise.all([...Array(50)].map(() => getConnection()));
    expect(new Set(results).size).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
