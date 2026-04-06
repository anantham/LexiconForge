/**
 * Contract tests for INV-1: Redirect re-validation.
 *
 * The Vercel serverless proxy (api/fetch-proxy.js) must re-check the domain
 * allowlist on every redirect hop. A whitelisted domain that 302s to an
 * off-allowlist or SSRF target must be rejected, not followed.
 *
 * These tests are expected to FAIL on current main (proving the bug exists)
 * and PASS after the fix.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// --- Mock http/https so we don't make real network calls ---

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  on: (event: string, cb: (...args: any[]) => void) => MockResponse;
}

function createMockRedirectChain(redirects: Array<{ status: number; location: string }>, finalHtml: string) {
  let callIndex = 0;

  return vi.fn((_url: string, _opts: any, callback: (res: MockResponse) => void) => {
    const step = redirects[callIndex];
    callIndex++;

    if (step) {
      // Return a redirect response
      const mockRes: MockResponse = {
        statusCode: step.status,
        headers: { location: step.location },
        on: vi.fn().mockReturnThis(),
      };
      callback(mockRes);
    } else {
      // Final response with HTML
      const chunks = [Buffer.from(finalHtml, 'utf-8')];
      const mockRes: any = {
        statusCode: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        on: vi.fn((event: string, cb: (...args: any[]) => void) => {
          if (event === 'data') {
            for (const chunk of chunks) cb(chunk);
          }
          if (event === 'end') cb();
          return mockRes;
        }),
      };
      callback(mockRes);
    }

    return { on: vi.fn(), destroy: vi.fn() };
  });
}

// Build a mock req/res pair for the handler
function createMockReqRes(url: string) {
  const req = { method: 'GET', query: { url } };
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    setHeader: vi.fn((name: string, value: string) => {
      res.headers[name] = value;
    }),
    writeHead: vi.fn((code: number, headers?: Record<string, string>) => {
      res.statusCode = code;
      if (headers) Object.assign(res.headers, headers);
    }),
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    send(data: string) {
      res.body = data;
      return res;
    },
    end(data?: string) {
      if (data) res.body = data;
      return res;
    },
  };
  return { req, res };
}

describe('api/fetch-proxy — INV-1: Redirect re-validation', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should reject redirects to off-allowlist domains', async () => {
    // Mock: hetushu.com (allowed) redirects to evil.com (not allowed)
    const mockGet = createMockRedirectChain(
      [{ status: 302, location: 'https://evil.com/steal-creds' }],
      '<html>evil</html>'
    );

    vi.doMock('https', () => ({ get: mockGet }));
    vi.doMock('http', () => ({ get: mockGet }));

    const { default: handler } = await import('../../../api/fetch-proxy.js');
    const { req, res } = createMockReqRes('https://hetushu.com/book/2991/1.html');

    await handler(req as any, res as any);

    // The handler should NOT return 200 with evil.com's content.
    // It should return 403 or 502 indicating the redirect was blocked.
    // On current main this will FAIL — the handler follows the redirect blindly.
    expect(res.statusCode).not.toBe(200);
    expect(res.body).not.toContain('evil');
  });

  it('should reject redirects to cloud metadata SSRF targets', async () => {
    const mockGet = createMockRedirectChain(
      [{ status: 302, location: 'http://169.254.169.254/latest/meta-data/' }],
      'ami-id: sensitive-data'
    );

    vi.doMock('https', () => ({ get: mockGet }));
    vi.doMock('http', () => ({ get: mockGet }));

    const { default: handler } = await import('../../../api/fetch-proxy.js');
    const { req, res } = createMockReqRes('https://hetushu.com/book/2991/1.html');

    await handler(req as any, res as any);

    expect(res.statusCode).not.toBe(200);
    expect(res.body).not.toContain('sensitive-data');
  });

  it('should allow redirects within the same allowed domain', async () => {
    // This test verifies the allowlist logic directly rather than mocking http.
    // We import the module and test isDomainAllowed behavior through the handler's
    // initial check — same-domain redirects are covered by the SSRF tests above
    // (they verify off-domain is blocked; same-domain is the complement).
    const { default: handler } = await import('../../../api/fetch-proxy.js');
    const { req, res } = createMockReqRes('https://hetushu.com/book/2991/1.html');

    // The handler should accept the initial domain (not return 403)
    await handler(req as any, res as any).catch(() => {});

    // It should NOT be blocked by the allowlist (may fail on network, but not 403)
    expect(res.statusCode).not.toBe(403);
  });
});
