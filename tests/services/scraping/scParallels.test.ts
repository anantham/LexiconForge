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
          { enumber: 10, type: 'full', to: { uid: 'dn22', root_lang: 'pli', acronym: 'DN 22' } },
          { enumber: 10, type: 'resembling', to: { uid: 'ea12.1', root_lang: 'lzh', acronym: 'EA 12.1' } },
        ],
        'mn10#44.1': [
          { enumber: 10, type: 'mention', to: { uid: 'sht-sutta11', root_lang: 'san', acronym: 'SHT 11' } },
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

  it('reads and strips html blob from /api/suttas root_text.text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        root_text: { text: '<p>如是我聞</p><p>一時佛在舍衛國</p>' },
      }),
    } as Response);

    const out = await fetchParallelText('ea12.1');
    expect(out).toContain('如是我聞');
    expect(out).toContain('一時佛在舍衛國');
    expect(out).not.toContain('<p>');
  });

  it('uses bilara author metadata to fetch segmented pali root text', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bilara_root_text: { author_uid: 'sujato' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ root_text: { 'dn22:1.1': 'Evaṃ me sutaṃ', 'dn22:1.2': 'ekaṃ samayaṃ' } }),
      } as Response);

    const out = await fetchParallelText('dn22');
    expect(out).toContain('Evaṃ me sutaṃ');
    expect(fetchMock.mock.calls[1][0]).toContain('/api/fetch-proxy?url=');
    expect(decodeURIComponent(String(fetchMock.mock.calls[1][0]))).toContain('/api/bilarasuttas/dn22/sujato');
  });

  it('throws a clear unsupported-source message when no root text exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ root_text: null, bilara_root_text: null }),
    } as Response);

    await expect(fetchParallelText('sht-sutta11')).rejects.toThrow(/No root text available/);
  });
});
