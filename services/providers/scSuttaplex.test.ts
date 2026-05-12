import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../compiler/dictionary', () => ({
  fetchJsonViaProxies: vi.fn(),
}));

import { fetchJsonViaProxies } from '../compiler/dictionary';
import { SuttaCentralSuttaplexParallelProvider } from './scSuttaplex';

const mockFetch = vi.mocked(fetchJsonViaProxies);

describe('SuttaCentralSuttaplexParallelProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('extracts work-level parallels from the top-level key', async () => {
    mockFetch.mockResolvedValueOnce({
      mn10: [
        { to: { uid: 'dn22', acronym: 'DN 22', original_title: 'Mahāsatipaṭṭhānasutta', translated_title: 'The Long Discourse', type: 'full' } },
        { to: { uid: 'ma98', acronym: 'MA 98', translated_title: 'Smṛtyupasthāna sūtra (Madhyama-āgama)', type: 'full' } },
      ],
    });
    const provider = new SuttaCentralSuttaplexParallelProvider();
    const parallels = await provider.getParallels('mn10');
    expect(parallels).toHaveLength(2);
    expect(parallels[0].workId).toBe('dn22');
    expect(parallels[0].segmentId).toBeUndefined();
    expect(parallels[0].note).toContain('full');
    expect(parallels[0].note).toContain('The Long Discourse');
    expect(parallels[0].citationId).toBe('cite:sc-suttaplex:mn10→dn22');
  });

  it('extracts segment-level parallels and converts # to : in segment ids', async () => {
    mockFetch.mockResolvedValueOnce({
      'mn10#44.1': [
        { to: { uid: 'sn47.40', type: 'partial' } },
      ],
      'mn10#47.1': [
        { to: { uid: 'an4.41', type: 'partial' } },
      ],
    });
    const provider = new SuttaCentralSuttaplexParallelProvider();
    const parallels = await provider.getParallels('mn10');
    expect(parallels).toHaveLength(2);
    expect(parallels[0].segmentId).toBe('mn10:44.1');
    expect(parallels[0].workId).toBe('sn47.40');
    expect(parallels[1].segmentId).toBe('mn10:47.1');
    expect(parallels[1].workId).toBe('an4.41');
  });

  it('merges work-level and segment-level parallels into one flat list', async () => {
    mockFetch.mockResolvedValueOnce({
      mn10: [{ to: { uid: 'dn22', type: 'full' } }],
      'mn10#44.1': [{ to: { uid: 'sn47.40', type: 'partial' } }],
    });
    const provider = new SuttaCentralSuttaplexParallelProvider();
    const parallels = await provider.getParallels('mn10');
    expect(parallels).toHaveLength(2);
    const workLevel = parallels.find((p) => !p.segmentId);
    const segmentLevel = parallels.find((p) => !!p.segmentId);
    expect(workLevel?.workId).toBe('dn22');
    expect(segmentLevel?.segmentId).toBe('mn10:44.1');
  });

  it('returns empty when an entry lacks a `to.uid`', async () => {
    mockFetch.mockResolvedValueOnce({ mn10: [{ to: {} }, { to: null }, {}] });
    const provider = new SuttaCentralSuttaplexParallelProvider();
    expect(await provider.getParallels('mn10')).toEqual([]);
  });

  it('returns empty on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('boom'));
    const provider = new SuttaCentralSuttaplexParallelProvider();
    expect(await provider.getParallels('mn10')).toEqual([]);
  });

  it('returns empty for an empty / whitespace workId without hitting the network', async () => {
    const provider = new SuttaCentralSuttaplexParallelProvider();
    expect(await provider.getParallels('   ')).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('caches per-sutta — repeated lookups for the same workId hit the network once', async () => {
    mockFetch.mockResolvedValueOnce({ mn10: [{ to: { uid: 'dn22', type: 'full' } }] });
    const provider = new SuttaCentralSuttaplexParallelProvider();
    await provider.getParallels('mn10');
    await provider.getParallels('mn10');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('handles a non-object response gracefully', async () => {
    mockFetch.mockResolvedValueOnce('not-an-object' as unknown);
    const provider = new SuttaCentralSuttaplexParallelProvider();
    expect(await provider.getParallels('mn10')).toEqual([]);
  });

  it('uses `to.to` as fallback when `to.uid` is absent', async () => {
    mockFetch.mockResolvedValueOnce({
      mn10: [{ to: { to: 'dn22', type: 'full' } }],
    });
    const provider = new SuttaCentralSuttaplexParallelProvider();
    const parallels = await provider.getParallels('mn10');
    expect(parallels[0].workId).toBe('dn22');
  });
});
