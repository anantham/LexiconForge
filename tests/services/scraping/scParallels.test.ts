import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchParallels, fetchParallelText } from '../../../services/scraping/scParallels';

describe('scParallels', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('flattens real-shaped SC parallels into normalized rows', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        mn10: [
          {
            enumber: 10,
            type: 'full',
            to: { uid: 'dn22', root_lang: 'pli', acronym: 'DN 22' },
          },
          {
            enumber: 10,
            type: 'resembling',
            to: { uid: 'ea12.1', root_lang: 'lzh', acronym: 'EA 12.1' },
          },
        ],
        'mn10#44.1': [
          {
            enumber: 10,
            type: 'mention',
            to: { uid: 'sht-sutta11', root_lang: 'san', acronym: 'SHT 11' },
          },
        ],
      }),
    } as Response);

    const out = await fetchParallels('mn10');
    expect(out.map((x) => [x.uid, x.rootLang, x.type])).toEqual([
      ['dn22', 'pli', 'full'],
      ['ea12.1', 'lzh', 'resembling'],
      ['sht-sutta11', 'san', 'mention'],
    ]);
  });

  it('reads root text from /api/suttas payloads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        root_text: {
          'ea12.1:0.1': '如是我聞',
          'ea12.1:1.1': '一時佛在舍衛國',
        },
      }),
    } as Response);

    const out = await fetchParallelText('ea12.1');
    expect(out).toContain('如是我聞');
    expect(out).toContain('一時佛在舍衛國');
  });
});
