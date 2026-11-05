// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadSession } from '../../../services/import/downloadSession';
import { IMPORT_LIMITS } from '../../../services/import/sessionValidation';

const bytes = new TextEncoder().encode(JSON.stringify({ metadata: { format: 'lexiconforge-session' }, chapters: [] }));
const limits = { bytes: bytes.length, downloadMs: 1000, chunks: 100 };
const response = (chunks: Uint8Array[], headers = new Headers(), cancel = vi.fn()) => ({
  ok: true, headers, body: new ReadableStream({
    start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); }, cancel,
  }),
}) as Response;

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('remote session received-byte and absolute-time limits', () => {
  it.each([undefined, '1', 'not-a-number', '-100'])('uses received bytes when Content-Length is %s', async advertised => {
    const headers = advertised === undefined ? new Headers() : new Headers({ 'content-length': advertised });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([bytes.subarray(0, 10), bytes.subarray(10)], headers)));
    const progress = vi.fn();
    const staged = await downloadSession('https://example.test/session.json', progress, undefined, limits);
    expect(staged.chunks.reduce((count, chunk) => count + chunk.length, 0)).toBe(bytes.length);
    expect(progress.mock.calls.at(-1)?.[0]).toBe(bytes.length);
  });

  it.each([undefined, '1', 'junk'])('rejects an oversized received body with header %s and cancels', async advertised => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(bytes); controller.enqueue(new Uint8Array([32]));
    }, cancel });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: new Headers(advertised ? { 'content-length': advertised } : {}), body }));
    await expect(downloadSession('https://example.test/session.json', undefined, undefined, limits)).rejects.toThrow('received body too large');
    expect(cancel).toHaveBeenCalledOnce();
    expect((fetch as any).mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('rejects an oversized advertised size before body reading', async () => {
    const read = vi.fn(); const cancel = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-length': String(limits.bytes + 1) }),
      body: { getReader: () => ({ read, cancel, releaseLock: vi.fn() }) } }));
    await expect(downloadSession('https://example.test/session.json', undefined, undefined, limits)).rejects.toThrow('file too large');
    expect(read).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalledOnce();
  });

  it.each(['headers', 'body', 'slow-drip'])('applies one absolute deadline across %s', async phase => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) {
      if (phase === 'slow-drip') {
        controller.enqueue(bytes.subarray(0, 1));
        setTimeout(() => controller.enqueue(bytes.subarray(1, 2)), 600);
      }
    }, cancel });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => phase === 'headers' ? new Promise(() => {}) : Promise.resolve({ ok: true, headers: new Headers(), body })));
    const promise = downloadSession('https://example.test/session.json', undefined, undefined, limits);
    const rejected = expect(promise).rejects.toThrow('absolute deadline');
    await vi.advanceTimersByTimeAsync(limits.downloadMs);
    await rejected;
    expect((fetch as any).mock.calls[0][1].signal.aborted).toBe(true);
    if (phase !== 'headers') expect(cancel).toHaveBeenCalledOnce();
  });

  it('bounds tiny-chunk overhead independently of total bytes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([bytes.subarray(0, 1), bytes.subarray(1, 2), bytes.subarray(2)])));
    await expect(downloadSession('https://example.test/session.json', undefined, undefined, { ...limits, chunks: 2 })).rejects.toThrow('too many download chunks');
  });

  it('rejects invalid UTF-8 and clears its deadline on rejection', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([new Uint8Array([0xff])])));
    await expect(downloadSession('https://example.test/session.json', undefined, undefined, limits)).rejects.toThrow('not valid UTF-8');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the deadline and releases the reader after success', async () => {
    vi.useFakeTimers();
    const res = response([bytes]); const reader = res.body!.getReader();
    const releaseLock = vi.spyOn(reader, 'releaseLock');
    vi.spyOn(res.body!, 'getReader').mockReturnValue(reader);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));
    await downloadSession('https://example.test/session.json', undefined, undefined, limits);
    expect(releaseLock).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps a finite production cap compatible with the documented 272 MB session', () => {
    expect(IMPORT_LIMITS.bytes).toBe(500 * 1024 * 1024);
    expect(IMPORT_LIMITS.downloadMs).toBe(120_000);
  });
});
