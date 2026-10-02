// All upstreams are synthetic streams; these tests make no network requests.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import https from 'node:https';
const require = createRequire(import.meta.url);
const { LIMITS, fetchBounded, createFetchProxy, validateUrl } = require('../../../services/scraping/serverFetchProxy.cjs');
const { createRequestBudget } = require('../../../services/scraping/requestBudget.cjs');
const URL = 'https://hetushu.com/book/1.html';

function mockTransport(steps: Array<{ status?: number; headers?: Record<string, string | undefined>; chunks?: Buffer[]; stall?: boolean; wait?: number }>) {
  const responses: any[] = [];
  const requests: any[] = [];
  const get = vi.fn((_url: string, _options: unknown, callback: (response: any) => void) => {
    const step = steps[Math.min(requests.length, steps.length - 1)];
    const request = Object.assign(new EventEmitter(), { destroy: vi.fn() });
    requests.push(request);
    const response = Object.assign(new EventEmitter(), {
      statusCode: step.status ?? 200, headers: step.headers ?? { 'content-type': 'text/html; charset=utf-8' },
      destroy: vi.fn(),
    });
    responses.push(response);
    const send = () => {
      callback(response);
      if (response.destroy.mock.calls.length || step.stall) return;
      for (const chunk of step.chunks ?? [Buffer.from('<article>normal source</article>')]) response.emit('data', chunk);
      response.emit('end');
    };
    if (step.wait) setTimeout(send, step.wait); else queueMicrotask(send);
    return request;
  });
  return { transport: { get }, get, requests, responses };
}
function reqRes(address = '192.0.2.1') {
  const req = { method: 'GET', query: { url: URL }, socket: { remoteAddress: address } };
  const res = { statusCode: 200, headers: {} as Record<string, string>, body: '',
    setHeader(name: string, value: string) { this.headers[name] = value; },
    end(body: string) { this.body = body; },
  };
  return { req, res };
}

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('proxy destinations and inert source representation', () => {
  it.each(['http://hetushu.com/a', 'ftp://hetushu.com/a', 'https://hetushu.com:444/a', 'https://user:pass@hetushu.com/a', 'https://evilhetushu.com/a'])('rejects %s before contacting upstream', (url) => {
    expect(() => validateUrl(url)).toThrow();
  });
  it('accepts explicit default HTTPS port and allowed subdomains', () => {
    expect(validateUrl('https://www.hetushu.com:443/a').href).toBe('https://www.hetushu.com/a');
  });
  it('API serves hostile markup as inert downloadable text while preserving scrape bytes', async () => {
    const payload = '<script>window.pwned=true</script><article>Source</article>';
    const upstream = mockTransport([{ chunks: [Buffer.from(payload)] }]);
    vi.spyOn(https, 'get').mockImplementation(upstream.get as any);
    const { default: handler } = await import('../../../api/fetch-proxy.js');
    const { req, res } = reqRes();
    await handler(req, res);
    expect(upstream.get).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(payload);
    expect(res.headers['Content-Type']).toBe('text/plain; charset=utf-8');
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.headers['Content-Security-Policy']).toContain("sandbox; default-src 'none'");
    expect(res.headers['Content-Disposition']).toContain('attachment');
    expect(res.headers['Cache-Control']).toBe('no-store');
  });
  it('preserves valid charset decoding', async () => {
    const upstream = mockTransport([{ headers: { 'content-type': 'text/html;charset=windows-1252' }, chunks: [Buffer.from([0x63, 0x61, 0x66, 0xe9])] }]);
    expect((await fetchBounded(URL, upstream)).text).toBe('café');
  });
  it('rejects repeated query parameters and disallowed hosts', async () => {
    const serve = createFetchProxy({ fetcher: vi.fn() });
    const { req, res } = reqRes();
    await serve(req, res, [URL, URL]); expect(res.statusCode).toBe(400);
    await serve(req, res, 'https://evil.com'); expect(res.statusCode).toBe(403);
  });
});

describe('upstream work boundaries', () => {
  it.each(['https://evil.com/a', 'http://169.254.169.254/a', 'https://hetushu.com:444/a', 'https://u:p@hetushu.com/a'])('revalidates redirect %s', async (location) => {
    const upstream = mockTransport([{ status: 302, headers: { location } }]);
    await expect(fetchBounded(URL, upstream)).rejects.toThrow();
    expect(upstream.get).toHaveBeenCalledOnce();
    expect(upstream.responses[0].destroy).toHaveBeenCalled();
  });
  it('follows bounded allowed redirects and closes each prior response', async () => {
    const upstream = mockTransport([{ status: 302, headers: { location: '/next' } }, {}]);
    expect((await fetchBounded(URL, upstream)).text).toContain('normal source');
    expect(upstream.get).toHaveBeenCalledTimes(2);
    expect(upstream.responses[0].destroy).toHaveBeenCalled();
  });
  it('stops redirect loops at the hop limit', async () => {
    const upstream = mockTransport([{ status: 302, headers: { location: URL } }]);
    await expect(fetchBounded(URL, upstream)).rejects.toThrow('redirect limit');
    expect(upstream.get).toHaveBeenCalledTimes(LIMITS.maxRedirects + 1);
  });
  it('rejects oversized declared bodies before collecting any chunks', async () => {
    const upstream = mockTransport([{ headers: { 'content-type': 'text/html', 'content-length': String(LIMITS.maxBytes + 1) } }]);
    await expect(fetchBounded(URL, upstream)).rejects.toThrow('byte limit');
    expect(upstream.responses[0].destroy).toHaveBeenCalled();
    expect(upstream.requests[0].destroy).toHaveBeenCalled();
  });
  it.each([{}, { 'content-length': '1' }])('counts actual streamed bytes with missing or lying headers %s', async (headers) => {
    const upstream = mockTransport([{ headers: { 'content-type': 'text/plain', ...headers }, chunks: [Buffer.alloc(8), Buffer.alloc(9)] }]);
    await expect(fetchBounded(URL, { ...upstream, limits: { ...LIMITS, maxBytes: 16 } })).rejects.toThrow('byte limit');
  });
  it('keeps an absolute deadline alive after headers and across redirects', async () => {
    vi.useFakeTimers();
    const upstream = mockTransport([{ status: 302, headers: { location: '/next' }, wait: 12 }, { stall: true }]);
    const result = fetchBounded(URL, { ...upstream, limits: { ...LIMITS, deadlineMs: 20 } });
    const rejection = expect(result).rejects.toThrow('deadline');
    await vi.advanceTimersByTimeAsync(20); await rejection;
    expect(upstream.get).toHaveBeenCalledTimes(2);
    expect(upstream.responses[1].destroy).toHaveBeenCalled();
    expect(upstream.requests[1].destroy).toHaveBeenCalled();
  });
  it.each([{ 'content-type': 'image/svg+xml' }, { 'content-type': 'text/html', 'content-encoding': 'gzip' }])('rejects unsupported representations %s', async (headers) => {
    await expect(fetchBounded(URL, mockTransport([{ headers }]))).rejects.toThrow();
  });
});

describe('proxy admission', () => {
  it('rejects excess caller concurrency before upstream work, then releases slots', async () => {
    let release!: (result: unknown) => void;
    const first = new Promise((resolve) => { release = resolve; });
    const fetcher = vi.fn().mockReturnValueOnce(first).mockResolvedValue({ text: 'ok', statusCode: 200 });
    const serve = createFetchProxy({ fetcher, budget: createRequestBudget({ maxCallerActive: 1 }) });
    const a = reqRes(), b = reqRes();
    const running = serve(a.req, a.res, URL);
    await serve(b.req, b.res, URL);
    expect(b.res.statusCode).toBe(429); expect(fetcher).toHaveBeenCalledOnce();
    release({ text: 'ok', statusCode: 200 }); await running;
    await serve(b.req, b.res, URL); expect(b.res.statusCode).toBe(200);
  });
  it('bounds global concurrency, caller rate, registry cardinality and expiration', () => {
    let now = 0;
    const budget = createRequestBudget({ maxActive: 1, perMinute: 1, maxCallers: 1, now: () => now });
    const a = reqRes('192.0.2.1').req, b = reqRes('192.0.2.2').req;
    const release = budget.acquire(a); expect(release).toBeTypeOf('function');
    expect(budget.acquire(b)).toBeNull(); release(); release();
    expect(budget.acquire(a)).toBeNull(); expect(budget.acquire(b)).toBeNull();
    now = 60_000;
    expect(budget.acquire(b)).toBeTypeOf('function');
  });
  it('releases work budget on fetch failure and returns no upstream error or URL', async () => {
    const serve = createFetchProxy({ fetcher: vi.fn().mockRejectedValue(new Error('private query token')), budget: createRequestBudget({ maxCallerActive: 1 }) });
    const { req, res } = reqRes();
    await serve(req, res, URL); await serve(req, res, URL);
    expect(res.statusCode).toBe(502); expect(res.body).not.toContain('private query');
  });
});
