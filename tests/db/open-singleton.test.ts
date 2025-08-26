// tests/db/open-singleton.test.ts
import { indexedDBService } from '@/services/indexeddb';

it('returns one connection under stampede', async () => {
  const spy = vi.spyOn(globalThis.indexedDB, 'open');
  const results = await Promise.all([...Array(50)].map(() => indexedDBService.openDatabase()));
  expect(new Set(results).size).toBe(1);
  expect(spy).toHaveBeenCalledTimes(1);
});
