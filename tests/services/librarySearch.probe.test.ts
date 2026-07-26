import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { probeCandidateUrl } from '../../services/librarySearch/searchService';

/**
 * Integrity-scan P0 guard: the probe goes through our own allowlist-gated
 * fetch-proxy, which answers 403 for EVERY off-allowlist domain — valid or
 * not. That 403 is the instrument's blindness, not evidence the URL is
 * hallucinated. The search prompt explicitly solicits fan translations on
 * novelupdates/wuxiaworld/webnovel (none allowlisted), so scoring the 403
 * as nonexistence silently destroyed every genuine candidate there.
 */
describe('probeCandidateUrl allowlist scope', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps an off-allowlist candidate WITHOUT probing (the proxy would 403 it regardless)', async () => {
    fetchMock.mockResolvedValue({ status: 403 });
    const kept = await probeCandidateUrl('https://www.novelupdates.com/series/some-novel/');
    expect(kept).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still drops an allowlisted candidate that the proxy reports as 404', async () => {
    fetchMock.mockResolvedValue({ status: 404 });
    const kept = await probeCandidateUrl('https://suttacentral.net/xyz-does-not-exist');
    expect(kept).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps an allowlisted candidate the proxy fetches successfully', async () => {
    fetchMock.mockResolvedValue({ status: 200 });
    const kept = await probeCandidateUrl('https://suttacentral.net/mn10');
    expect(kept).toBe(true);
  });

  it('drops an unparseable URL', async () => {
    const kept = await probeCandidateUrl('not a url at all');
    expect(kept).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
