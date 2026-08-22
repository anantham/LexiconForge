import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/capabilityService', () => ({
  getModelLimits: vi.fn()
}));

import { getModelLimits } from '../../services/capabilityService';
import { rateLimitService } from '../../services/rateLimitService';

const mockGetModelLimits = vi.mocked(getModelLimits);

describe('rateLimitService.acquireRequestSlot', () => {
  beforeEach(() => {
    rateLimitService.clearLimits();
    vi.clearAllMocks();
    mockGetModelLimits.mockResolvedValue({ requests_per_minute: 5 } as any);
  });

  afterEach(() => {
    rateLimitService.clearLimits();
    vi.useRealTimers();
  });

  it('resolves immediately when under the limit', async () => {
    await expect(rateLimitService.acquireRequestSlot('model-a')).resolves.toBeUndefined();
    expect(mockGetModelLimits).toHaveBeenCalledWith('model-a');
  });

  it('resolves immediately when the model has no rate limits', async () => {
    mockGetModelLimits.mockResolvedValue(null);
    await expect(rateLimitService.acquireRequestSlot('model-b')).resolves.toBeUndefined();
  });

  it('parks over the limit and admits the caller after the window resets', async () => {
    mockGetModelLimits.mockResolvedValue({ requests_per_minute: 1 } as any);
    vi.useFakeTimers();

    await rateLimitService.acquireRequestSlot('model-c');
    const parked = rateLimitService.acquireRequestSlot('model-c');

    let settled = false;
    void parked.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(61_000);
    await expect(parked).resolves.toBeUndefined();
  });

  it('rejects parked callers instead of stranding them when state is cleared', async () => {
    mockGetModelLimits.mockResolvedValue({ requests_per_minute: 1 } as any);
    vi.useFakeTimers();

    await rateLimitService.acquireRequestSlot('model-d');
    const parked = rateLimitService.acquireRequestSlot('model-d');
    await vi.advanceTimersByTimeAsync(0);

    rateLimitService.clearLimits();
    await expect(parked).rejects.toThrow(/cleared while the request was queued/i);
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      rateLimitService.acquireRequestSlot('model-e', { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('pulls a parked caller out of the queue when its signal aborts', async () => {
    mockGetModelLimits.mockResolvedValue({ requests_per_minute: 1 } as any);
    vi.useFakeTimers();

    await rateLimitService.acquireRequestSlot('model-f');
    const controller = new AbortController();
    const parked = rateLimitService.acquireRequestSlot('model-f', { signal: controller.signal });
    await vi.advanceTimersByTimeAsync(0);

    controller.abort();
    await expect(parked).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('does not consume a slot when the pre-aborted signal rejects', async () => {
    mockGetModelLimits.mockResolvedValue(null);
    const controller = new AbortController();
    controller.abort();

    await expect(
      rateLimitService.acquireRequestSlot('model-g', { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
    // A normal caller is still admitted: nothing was recorded against the model
    await expect(rateLimitService.acquireRequestSlot('model-g')).resolves.toBeUndefined();
  });

  it('does not consume a slot when the signal aborts during the model-limit lookup', async () => {
    let releaseLookup!: (limits: Record<string, number> | null) => void;
    mockGetModelLimits.mockReturnValue(
      new Promise(resolve => { releaseLookup = resolve; })
    );

    const controller = new AbortController();
    const acquiring = rateLimitService.acquireRequestSlot('model-h', { signal: controller.signal });
    const assertion = expect(acquiring).rejects.toMatchObject({ name: 'AbortError' });

    controller.abort();
    releaseLookup({ requests_per_minute: 5 });
    await assertion;

    // No capacity was charged for the canceled request
    expect(rateLimitService.getStatus('model-h')).toBeNull();
  });
});
