// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import https from 'node:https';
import config from '../../../vite.config';

it('development proxy returns inert source through the shared runtime handler', async () => {
  const payload = '<script>globalThis.injected=true</script><article>chapter source</article>';
  const get = vi.spyOn(https, 'get').mockImplementation((_url: any, _opts: any, cb: any) => {
    const request = Object.assign(new EventEmitter(), { destroy: vi.fn() });
    queueMicrotask(() => {
      const upstream = Object.assign(new EventEmitter(), { statusCode: 200, headers: { 'content-type': 'text/html' }, destroy: vi.fn() });
      cb(upstream); upstream.emit('data', Buffer.from(payload)); upstream.emit('end');
    });
    return request as any;
  });
  try {
    let middleware: any;
    const plugin = (config.plugins as any[]).find((entry) => entry.name === 'local-fetch-proxy');
    plugin.configureServer({ middlewares: { use(fn: any) { middleware = fn; } } });
    let finished!: () => void;
    const done = new Promise<void>((resolve) => { finished = resolve; });
    const response = { statusCode: 200, headers: {} as Record<string, string>, body: '',
      setHeader(name: string, value: string) { this.headers[name] = value; },
      end(body: string) { this.body = body; finished(); },
    };
    middleware({ method: 'GET', url: '/api/fetch-proxy?url=https%3A%2F%2Fhetushu.com%2Fchapter', socket: { remoteAddress: '192.0.2.10' } }, response, vi.fn());
    await done;
    expect(get).toHaveBeenCalledOnce(); expect(response.body).toBe(payload);
    expect(response.headers['Content-Type']).toBe('text/plain; charset=utf-8');
    expect(response.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(response.headers['Content-Disposition']).toContain('attachment');
  } finally { get.mockRestore(); }
});

it('loads both safety plugins through Vite’s actual ESM config bundler', async () => {
  const { loadConfigFromFile } = await import('vite');
  const { resolve } = await import('node:path');
  const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, resolve(__dirname, '../../../vite.config.ts'));
  expect(loaded?.config.plugins?.map((entry: any) => entry.name)).toEqual([
    'local-fetch-proxy', 'sutta-studio-reports',
  ]);
  expect(loaded?.config.server?.host).toBe('127.0.0.1');
});
