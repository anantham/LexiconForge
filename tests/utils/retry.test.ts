import { describe, it, expect, vi } from 'vitest';
import { withRetry, isNetworkError } from '../../utils/retry';

describe('isNetworkError', () => {
  it('returns true for AbortError', () => {
    expect(isNetworkError(new DOMException('Aborted', 'AbortError'))).toBe(true);
  });

  it('returns true for network-related messages', () => {
    expect(isNetworkError(new Error('network error'))).toBe(true);
    expect(isNetworkError(new Error('fetch failed'))).toBe(true);
    expect(isNetworkError(new Error('timeout exceeded'))).toBe(true);
    expect(isNetworkError(new Error('connection refused'))).toBe(true);
    expect(isNetworkError(new Error('429 Too Many Requests'))).toBe(true);
  });

  it('returns false for non-network errors', () => {
    expect(isNetworkError(new Error('Invalid JSON'))).toBe(false);
    expect(isNetworkError(new Error('File not found'))).toBe(false);
    expect(isNetworkError(new TypeError('undefined is not a function'))).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce('recovered');

    const result = await withRetry(fn, { initialDelay: 1 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws immediately on non-retryable error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Invalid JSON'));

    await expect(withRetry(fn, { maxAttempts: 3, initialDelay: 1 }))
      .rejects.toThrow('Invalid JSON');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network error'));

    await expect(withRetry(fn, { maxAttempts: 3, initialDelay: 1 }))
      .rejects.toThrow('network error');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('calls onRetry callback before each retry', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('ok');

    await withRetry(fn, { initialDelay: 1, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Number), expect.any(Error));
    expect(onRetry).toHaveBeenCalledWith(2, expect.any(Number), expect.any(Error));
  });

  it('respects custom isRetryable predicate', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('custom retryable'));

    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        initialDelay: 1,
        isRetryable: (e) => (e as Error).message === 'custom retryable',
      })
    ).rejects.toThrow('custom retryable');

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('passes attempt index to fn', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce('ok');

    await withRetry(fn, { initialDelay: 1 });
    expect(fn).toHaveBeenCalledWith(0);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('respects abort signal', async () => {
    const controller = new AbortController();
    controller.abort();

    const fn = vi.fn().mockResolvedValue('ok');

    await expect(
      withRetry(fn, { signal: controller.signal })
    ).rejects.toThrow('Aborted');
    expect(fn).not.toHaveBeenCalled();
  });

  it('caps delay at maxDelay', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce('ok');

    await withRetry(fn, { initialDelay: 50000, maxDelay: 100, onRetry });
    expect(onRetry).toHaveBeenCalledWith(1, 100, expect.any(Error));
  });
});
