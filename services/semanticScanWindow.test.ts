import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scanInOwnerWindow } from './semanticScanWindow';
import { MAX_SCAN_MESSAGE, OWNER_SCAN_PROTOCOL as protocol, parseOwnerScanRequest } from './semanticScanProtocol';

const origin = 'https://owner.example';
const corpus = { corpusId: 'book-a', versionId: 'v1', contentHash: `sha256:${'a'.repeat(64)}` as const, chapterCount: 2 };
const result = {
  ok: true, protocol: 'lexiconforge-semantic-oscilloscope-v1', corpus, query: 'trust', scores: [0.31, 0.62],
  scoreSemantics: 'cosine-similarity-clipped-0-1', scoring: { algorithm: 'chapter-top-2-mean-cosine-v1', range: [0, 1] },
  vectorSpace: 'qwen3-embedding-8b:mrl-512:l2-v1', dimensions: 512,
};
let popup: Window;
let controller: AbortController;
const message = (data: unknown, source = popup, sender = origin) => window.dispatchEvent(new MessageEvent('message', {
  data: typeof data === 'string' ? data : JSON.stringify(data), source, origin: sender,
}));
const requestId = () => JSON.parse(vi.mocked(popup.postMessage).mock.calls[0][0]).requestId;

beforeEach(() => {
  vi.useFakeTimers();
  controller = new AbortController();
  popup = { close: vi.fn(), postMessage: vi.fn(), closed: false } as unknown as Window;
  vi.spyOn(window, 'open').mockReturnValue(popup);
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('owner window transport', () => {
  it('opens synchronously and accepts one exact-origin, exact-window scalar result', async () => {
    const scan = scanInOwnerWindow(origin, ' trust ', corpus, controller.signal);
    expect(window.open).toHaveBeenCalledOnce();
    message({ protocol, type: 'ready' }, popup, 'https://foreign.example');
    message({ protocol, type: 'ready' }, window);
    expect(popup.postMessage).not.toHaveBeenCalled();
    message({ protocol, type: 'ready' });
    const [request, target] = vi.mocked(popup.postMessage).mock.calls[0];
    expect(target).toBe(origin);
    expect(parseOwnerScanRequest(request)).toMatchObject({ corpus, query: 'trust' });
    message({ protocol, type: 'result', requestId: requestId(), result });
    await expect(scan).resolves.toEqual(result);
    message({ protocol, type: 'ready' });
    expect(popup.postMessage).toHaveBeenCalledOnce();
    expect(popup.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ['wrong corpus', { ...result, corpus: { ...corpus, versionId: 'v2' } }],
    ['extra nested field', { ...result, corpus: { ...corpus, token: 'synthetic' } }],
    ['extra result field', { ...result, vectors: [1, 2] }],
    ['out-of-range', { ...result, scores: [0.1, 1.2] }],
    ['wrong count', { ...result, scores: [0.1] }],
    ['string score', { ...result, scores: [0.1, '0.2'] }],
    ['wrong query', { ...result, query: 'other' }],
    ['wrong scoring', { ...result, scoring: { algorithm: 'normalized', range: [0, 1] } }],
  ])('rejects %s without settling a graph', async (_label, invalid) => {
    const scan = scanInOwnerWindow(origin, 'trust', corpus, controller.signal);
    const rejected = expect(scan).rejects.toThrow();
    message({ protocol, type: 'ready' });
    message({ protocol, type: 'result', requestId: requestId(), result: invalid });
    await rejected;
    expect(popup.close).toHaveBeenCalledOnce();
  });

  it.each(['stale ID', 'duplicate ready', 'oversized', 'non-string', 'unknown field'])('rejects %s from the trusted window', async kind => {
    const scan = scanInOwnerWindow(origin, 'trust', corpus, controller.signal);
    const rejected = expect(scan).rejects.toThrow();
    message({ protocol, type: 'ready' });
    if (kind === 'stale ID') message({ protocol, type: 'result', requestId: crypto.randomUUID(), result });
    if (kind === 'duplicate ready') message({ protocol, type: 'ready' });
    if (kind === 'oversized') message(' '.repeat(MAX_SCAN_MESSAGE + 1));
    if (kind === 'non-string') window.dispatchEvent(new MessageEvent('message', { data: {}, source: popup, origin }));
    if (kind === 'unknown field') message({ protocol, type: 'error', requestId: requestId(), code: 'AUTH_REQUIRED', token: 'synthetic' });
    await rejected;
  });

  it.each(['blocked', 'closed', 'connection timeout', 'scan timeout', 'selection change', 'reader navigation'])('cleans up after %s', async kind => {
    if (kind === 'blocked') vi.mocked(window.open).mockReturnValue(null);
    const scan = scanInOwnerWindow(origin, 'trust', corpus, controller.signal);
    const rejected = expect(scan).rejects.toThrow(/blocked|closed|connect|timed out|cancelled/);
    if (kind === 'closed') { Object.assign(popup, { closed: true }); window.dispatchEvent(new Event('focus')); }
    if (kind === 'connection timeout') vi.advanceTimersByTime(30_000);
    if (kind === 'scan timeout') { message({ protocol, type: 'ready' }); vi.advanceTimersByTime(300_000); }
    if (kind === 'selection change') controller.abort();
    if (kind === 'reader navigation') window.dispatchEvent(new Event('pagehide'));
    await rejected;
    const count = vi.mocked(popup.postMessage).mock.calls.length;
    message({ protocol, type: 'ready' });
    expect(popup.postMessage).toHaveBeenCalledTimes(count);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects invalid request bounds before opening a window', () => {
    expect(() => scanInOwnerWindow(origin, 'x'.repeat(501), corpus, controller.signal)).toThrow(/query/);
    expect(window.open).not.toHaveBeenCalled();
  });
});
