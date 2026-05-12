import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../compiler/dictionary', () => ({
  fetchJsonViaProxies: vi.fn(),
}));

import { fetchJsonViaProxies } from '../compiler/dictionary';
import { SuttaCentralBilaraVariantsProvider } from './scBilaraVariants';

const mockFetch = vi.mocked(fetchJsonViaProxies);

describe('SuttaCentralBilaraVariantsProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('parses a single-variant entry into VariantReading', async () => {
    mockFetch.mockResolvedValueOnce({
      'mn10:4.3': 'satova → sato (bj, sya-all, pts1ed) ',
    });
    const provider = new SuttaCentralBilaraVariantsProvider();
    const variants = await provider.getVariantsForSegment('mn10:4.3');
    expect(variants).toHaveLength(1);
    expect(variants[0]).toMatchObject({
      segmentId: 'mn10:4.3',
      original: 'satova',
      reading: 'sato',
      witnesses: ['bj', 'sya-all', 'pts1ed'],
    });
    expect(variants[0].citationId).toBe('cite:sc-bilara:mn10:4.3#0');
    expect(variants[0].rawExcerpt).toContain('satova');
  });

  it('parses multi-variant entries (pipe-separated) as distinct readings', async () => {
    mockFetch.mockResolvedValueOnce({
      'mn10:10.2': 'nhāru → nahāru (bj, pts1ed); nahārū (sya-all) | siṅghāṇikā lasikā muttan’ti → muttaṁ matthaluṅganti (mr) ',
    });
    const provider = new SuttaCentralBilaraVariantsProvider();
    const variants = await provider.getVariantsForSegment('mn10:10.2');
    // The semicolon-separated alternates after `→` aren't split (we only split on `|`).
    // The pipe gives us 2 entries; the second is the muttan'ti variant.
    expect(variants).toHaveLength(2);
    expect(variants[0].original).toBe('nhāru');
    expect(variants[1].original).toContain('siṅghāṇikā');
    expect(variants[1].witnesses).toEqual(['mr']);
  });

  it('returns an empty array when the segment has no recorded variant', async () => {
    mockFetch.mockResolvedValueOnce({ 'mn10:4.3': 'satova → sato (bj)' });
    const provider = new SuttaCentralBilaraVariantsProvider();
    const variants = await provider.getVariantsForSegment('mn10:1.1');  // not in the dict
    expect(variants).toEqual([]);
  });

  it('returns an empty array when the variant file is missing (network failure)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('404'));
    const provider = new SuttaCentralBilaraVariantsProvider();
    const variants = await provider.getVariantsForSegment('mn10:1.1');
    expect(variants).toEqual([]);
  });

  it('caches per-sutta — multiple segment lookups for one sutta hit the network once', async () => {
    mockFetch.mockResolvedValueOnce({
      'mn10:4.3': 'satova → sato (bj)',
      'mn10:5.4': 'Evampi → evampi (bj)',
    });
    const provider = new SuttaCentralBilaraVariantsProvider();
    await provider.getVariantsForSegment('mn10:4.3');
    await provider.getVariantsForSegment('mn10:5.4');
    await provider.getVariantsForSegment('mn10:1.1');  // not in the dict, no extra fetch
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('skips malformed entries silently', async () => {
    mockFetch.mockResolvedValueOnce({
      'mn10:4.3': 'this is not the expected format',
      'mn10:5.4': 'satova → sato (bj)',
    });
    const provider = new SuttaCentralBilaraVariantsProvider();
    expect(await provider.getVariantsForSegment('mn10:4.3')).toEqual([]);
    const ok = await provider.getVariantsForSegment('mn10:5.4');
    expect(ok).toHaveLength(1);
  });

  it('handles a non-object response gracefully (cache empty)', async () => {
    mockFetch.mockResolvedValueOnce('not-an-object' as unknown);
    const provider = new SuttaCentralBilaraVariantsProvider();
    expect(await provider.getVariantsForSegment('mn10:1.1')).toEqual([]);
  });
});
