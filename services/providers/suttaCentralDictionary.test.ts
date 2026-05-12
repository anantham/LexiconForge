import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the underlying transport before importing the provider, so the
// constructor + per-call code paths exercise the mock.
vi.mock('../compiler/dictionary', () => ({
  fetchJsonViaProxies: vi.fn(),
}));

import { fetchJsonViaProxies } from '../compiler/dictionary';
import { SuttaCentralDictionaryProvider } from './suttaCentralDictionary';

const mockFetch = vi.mocked(fetchJsonViaProxies);

describe('SuttaCentralDictionaryProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns one LexiconEntry per dictionary item in a top-level array response', async () => {
    mockFetch.mockResolvedValueOnce([
      { dictionary: 'ped', word: 'sati', text: 'sati, f. mindfulness, awareness.' },
      { dictionary: 'ncped', word: 'sati', text: 'recollection; mindfulness.' },
    ]);
    const provider = new SuttaCentralDictionaryProvider();
    const entries = await provider.lookup('sati');
    expect(entries).toHaveLength(2);
    expect(entries[0].sourceId).toBe('ped:sati:0');
    expect(entries[0].citationId).toBe('cite:sc-dictionary-full:ped:sati:0');
    expect(entries[0].rawExcerpt).toContain('mindfulness');
    expect(entries[1].sourceId).toBe('ncped:sati:1');
  });

  it('handles wrapped { dictionaries: [...] } payloads', async () => {
    mockFetch.mockResolvedValueOnce({
      dictionaries: [{ dictionary: 'ped', word: 'kāya', text: 'kāya, m. body.' }],
    });
    const provider = new SuttaCentralDictionaryProvider();
    const entries = await provider.lookup('kāya');
    expect(entries).toHaveLength(1);
    expect(entries[0].rawExcerpt).toContain('body');
  });

  it('returns an empty array on a malformed payload (does not throw)', async () => {
    mockFetch.mockResolvedValueOnce({ unexpected: 'shape' });
    const provider = new SuttaCentralDictionaryProvider();
    const entries = await provider.lookup('sati');
    expect(entries).toEqual([]);
  });

  it('returns an empty array on network failure (does not propagate)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('boom'));
    const provider = new SuttaCentralDictionaryProvider();
    const entries = await provider.lookup('sati');
    expect(entries).toEqual([]);
  });

  it('returns an empty array for an empty / whitespace lemma without hitting the network', async () => {
    const provider = new SuttaCentralDictionaryProvider();
    const entries = await provider.lookup('   ');
    expect(entries).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('caches per-session — repeated lookups for the same lemma hit the network once', async () => {
    mockFetch.mockResolvedValueOnce([{ dictionary: 'ped', word: 'sati', text: 'sati, f. mindfulness.' }]);
    const provider = new SuttaCentralDictionaryProvider();
    await provider.lookup('sati');
    await provider.lookup('sati');
    await provider.lookup('sati');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('caches empty results too — failures are not retried within a session', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));
    const provider = new SuttaCentralDictionaryProvider();
    const first = await provider.lookup('obscure');
    const second = await provider.lookup('obscure');
    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('calls throttle before the network request when provided', async () => {
    mockFetch.mockResolvedValueOnce([]);
    const provider = new SuttaCentralDictionaryProvider();
    const throttle = vi.fn(async () => {});
    await provider.lookup('sati', { throttle });
    expect(throttle).toHaveBeenCalledOnce();
  });

  it('normalises surrounding whitespace + punctuation from the query', async () => {
    mockFetch.mockResolvedValueOnce([{ dictionary: 'ped', word: 'sati', text: '...' }]);
    const provider = new SuttaCentralDictionaryProvider();
    await provider.lookup('  "sati"!  ');
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl.endsWith('sati')).toBe(true);
  });

  it('clearCache flushes per-session results', async () => {
    mockFetch.mockResolvedValue([{ dictionary: 'ped', word: 'sati', text: '...' }]);
    const provider = new SuttaCentralDictionaryProvider();
    await provider.lookup('sati');
    provider.clearCache();
    await provider.lookup('sati');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
