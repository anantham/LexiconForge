// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findReportPacket, isSafeReportId } from '../../../scripts/lib/dev-report-paths';
import config, { suttaStudioReportsPlugin } from '../../../vite.config';
import type { ViteDevServer } from 'vite';

const temporary: string[] = [];
function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'report-paths-'));
  temporary.push(base);
  const root = path.join(base, 'reports');
  fs.mkdirSync(root);
  return { base, root };
}
afterEach(() => temporary.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));

describe('development report boundary', () => {
  it.each(['..', '.', '../private', '..\\private', 'C:\\private', '/tmp/private',
    'foo/bar', 'foo\\bar', '%2e%2e', '%252e%252e', 'foo%5cbar', 'run:stream',
    'NUL', 'COM1', 'foo.', 'foo ', 'foo\n', 'foo\r', '\u0000', 'x'.repeat(129)])(
    'rejects cross-platform path syntax %s', id => {
      expect(isSafeReportId(id)).toBe(false);
      expect(() => findReportPacket('/unused', id)).toThrow(/Invalid report ID/);
    }
  );

  it('finds current benchmark packets and direct fallback packets', () => {
    const { root } = fixture();
    const nested = path.join(root, '2026-10-02T11-00-00-000Z', 'outputs', 'gemini-3-flash');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, 'packet.json'), '{}');
    expect(findReportPacket(root, '2026-10-02T11-00-00-000Z')).toBe(fs.realpathSync(path.join(nested, 'packet.json')));
    const direct = path.join(root, 'test-run');
    fs.mkdirSync(direct);
    fs.writeFileSync(path.join(direct, 'packet.json'), '{}');
    expect(findReportPacket(root, 'test-run')).toBe(fs.realpathSync(path.join(direct, 'packet.json')));
    expect(findReportPacket(root, 'missing')).toBeNull();
  });

  it.each(['report', 'output', 'packet'])('rejects an outside %s symlink', kind => {
    const { base, root } = fixture();
    const outside = path.join(base, 'reports-private');
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'packet.json'), '{"private":true}');
    const report = path.join(root, 'test-run');
    if (kind === 'report') fs.symlinkSync(outside, report);
    else {
      fs.mkdirSync(report);
      if (kind === 'packet') fs.symlinkSync(path.join(outside, 'packet.json'), path.join(report, 'packet.json'));
      else {
        fs.mkdirSync(path.join(report, 'outputs'));
        fs.symlinkSync(outside, path.join(report, 'outputs', 'gemini-3-flash'));
      }
    }
    expect(() => findReportPacket(root, 'test-run')).toThrow(/outside/);
  });

  it('rejects encoded and Windows traversal at the middleware before reading any packet', () => {
    const { root } = fixture();
    type Middleware = (_req: { url: string }, _res: {
      writeHead: (_status: number, _headers: Record<string, string>) => void;
      end: (_body: string) => void;
    }, _next: () => void) => void;
    let middleware: Middleware | undefined;
    const plugin = suttaStudioReportsPlugin(root);
    const configure = plugin.configureServer;
    if (typeof configure !== 'function') throw new Error('Expected configureServer function');
    configure.call(plugin, { middlewares: { use: (handler: Middleware) => { middleware = handler; } } } as unknown as ViteDevServer);
    if (!middleware) throw new Error('Expected report middleware');
    for (const id of ['..\\private', '%2e%2e', '%2e%2e%5cprivate', 'C:%5cprivate']) {
      let status = 0;
      let body = '';
      middleware({ url: `/api/sutta-studio/reports/${id}/packet.json` }, {
        writeHead: value => { status = value; }, end: value => { body = value; },
      }, () => { throw new Error('Invalid report ID escaped to another middleware'); });
      expect(status).toBe(400);
      expect(JSON.parse(body)).toEqual({ error: 'Invalid report ID' });
    }
  });

  it('defaults development serving to loopback', () => {
    expect(config.server?.host).toBe('127.0.0.1');
  });
});
