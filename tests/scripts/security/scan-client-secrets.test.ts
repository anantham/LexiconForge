import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  scanClientArtifacts,
  scanText,
} from '../../../scripts/security/scan-client-secrets.mjs';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe('client artifact secret scanner', () => {
  it('detects provider-shaped credentials without returning the credential value', () => {
    const secret = `sk-${'a'.repeat(32)}`;
    const findings = scanText(`window.config = "${secret}"`, 'assets/app.js');

    expect(findings).toEqual([
      { file: 'assets/app.js', detector: 'provider-sk-token', offset: 17 },
    ]);
    expect(JSON.stringify(findings)).not.toContain(secret);
  });

  it('finds synthetic build canaries recursively', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'lf-secret-scan-'));
    tempDirectories.push(directory);
    await mkdir(path.join(directory, 'assets'));
    await writeFile(path.join(directory, 'assets', 'app.js'), 'const marker="LF_SECRET_CANARY_OPENAI";');

    await expect(scanClientArtifacts(directory, ['LF_SECRET_CANARY_OPENAI'])).resolves.toEqual([
      { file: path.join('assets', 'app.js'), detector: 'build-canary', offset: 14 },
    ]);
  });

  it('ignores ordinary build output', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'lf-secret-scan-'));
    tempDirectories.push(directory);
    await writeFile(path.join(directory, 'index.html'), '<main>LexiconForge</main>');

    await expect(scanClientArtifacts(directory, ['LF_SECRET_CANARY_OPENAI'])).resolves.toEqual([]);
  });
});
