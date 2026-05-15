import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchParallels } from '../../../services/scraping/scParallels';

describe('scParallels', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('flattens nested SC parallels into normalized rows', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ([
        [{ uid: 'dn22', root_lang: 'pli', type: 'full' }],
        [{ uid: 'ea12.1', root_lang: 'lzh', type: 'resembling' }],
        [{ uid: 'sht-sutta11', root_lang: 'san', type: 'mention' }],
      ]),
    } as Response);

    const out = await fetchParallels('mn10');
    expect(out.map((x) => [x.uid, x.rootLang, x.type])).toEqual([
      ['dn22', 'pli', 'full'],
      ['ea12.1', 'lzh', 'resembling'],
      ['sht-sutta11', 'san', 'mention'],
    ]);
  });
});
