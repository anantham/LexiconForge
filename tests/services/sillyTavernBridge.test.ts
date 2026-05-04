/**
 * Bridge ping service tests (issue #4 follow-on).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pingSillyTavernBridge, isBridgeReachable } from '../../services/sillyTavernBridge';

describe('pingSillyTavernBridge', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns reachable when fetch resolves', async () => {
    // no-cors fetches resolve with opaque responses; the ping doesn't read them.
    (global.fetch as any).mockResolvedValueOnce({ type: 'opaque' });

    const result = await pingSillyTavernBridge('http://localhost:5001');

    expect(result.state).toBe('reachable');
    expect((global.fetch as any).mock.calls[0][0]).toBe('http://localhost:5001');
    expect((global.fetch as any).mock.calls[0][1].mode).toBe('no-cors');
  });

  it('returns unreachable when fetch rejects', async () => {
    (global.fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await pingSillyTavernBridge('http://localhost:5001');

    expect(result.state).toBe('unreachable');
    if (result.state === 'unreachable') {
      expect(result.reason).toContain('Failed to fetch');
    }
  });

  it('returns unreachable when URL is empty', async () => {
    const result = await pingSillyTavernBridge('');
    expect(result.state).toBe('unreachable');
    if (result.state === 'unreachable') {
      expect(result.reason).toBe('No bridge URL configured');
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns unreachable when URL is null/undefined', async () => {
    expect((await pingSillyTavernBridge(null)).state).toBe('unreachable');
    expect((await pingSillyTavernBridge(undefined)).state).toBe('unreachable');
  });
});

describe('isBridgeReachable', () => {
  it('returns true only for reachable status', () => {
    expect(isBridgeReachable({ state: 'reachable', checkedAt: 0 })).toBe(true);
    expect(isBridgeReachable({ state: 'unknown' })).toBe(false);
    expect(
      isBridgeReachable({ state: 'unreachable', checkedAt: 0, reason: 'x' }),
    ).toBe(false);
  });
});
