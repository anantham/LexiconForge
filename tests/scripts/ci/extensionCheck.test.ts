import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Red-tests for the extension packaging gate (scripts/ci/extension-check.mjs).
 * Each case builds a fixture chrome_extension/ and asserts the gate EXITS 1
 * with the expected finding; the happy path asserts exit 0.
 */
const GATE = join(__dirname, '..', '..', '..', 'scripts', 'ci', 'extension-check.mjs');

let dir: string;

const VALID_MANIFEST = {
  manifest_version: 3,
  name: 't',
  version: '1.0',
  description: 'short',
  content_scripts: [{ matches: ['*://example.org/*'], js: ['content.js'] }],
};

const write = (manifest: unknown, files: Record<string, string> = {}) => {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest));
  writeFileSync(join(dir, 'content.js'), files['content.js'] ?? '// ok');
  for (const [f, c] of Object.entries(files)) {
    if (f !== 'content.js') writeFileSync(join(dir, f), c);
  }
};

const runGate = () => {
  try {
    execFileSync(process.execPath, [GATE], { env: { ...process.env, EXTENSION_ROOT: dir }, stdio: 'pipe' });
    return 0;
  } catch (e: any) {
    return e.status ?? 1;
  }
};

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'extgate-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('extension-check gate', () => {
  it('passes a valid minimal extension', () => {
    write(VALID_MANIFEST);
    expect(runGate()).toBe(0);
  });

  it('rejects descriptions over the 132-char Chrome limit', () => {
    write({ ...VALID_MANIFEST, description: 'x'.repeat(133) });
    expect(runGate()).toBe(1);
  });

  it('rejects references to missing files', () => {
    write({ ...VALID_MANIFEST, background: { service_worker: 'ghost.js' } }, {});
    expect(runGate()).toBe(1);
  });

  it('rejects dead-lane code references outside comments', () => {
    write(VALID_MANIFEST, { 'content.js': "chrome.runtime.sendMessage({action:'booktoki'});" });
    expect(runGate()).toBe(1);
  });

  it('allows dead-lane mentions inside provenance comments', () => {
    write(VALID_MANIFEST, { 'content.js': "// BookToki lane removed 2026-08-23\n// ok" });
    expect(runGate()).toBe(0);
  });
});
