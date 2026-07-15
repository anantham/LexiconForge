// @vitest-environment node

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildBenchIndex } from '../../../scripts/sutta-studio/benchmark';
import {
  assertBenchmarkRunComplete,
  readBenchmarkRunStatus,
} from '../../../scripts/sutta-studio/benchmark-run-status';

const roots: string[] = [];

async function makeRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lexiconforge-bench-status-'));
  roots.push(root);
  return root;
}

async function writeRun(root: string, timestamp: string, status?: string): Promise<string> {
  const runDir = path.join(root, timestamp);
  await fs.mkdir(runDir, { recursive: true });
  if (status) {
    await fs.writeFile(path.join(runDir, 'progress.json'), JSON.stringify({ status }), 'utf8');
  }
  return runDir;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('benchmark completion boundary', () => {
  it('indexes only complete runs and never selects a newer partial run as latest', async () => {
    const root = await makeRoot();
    const complete = await writeRun(root, '2026-07-15T10-00-00-000Z', 'complete');
    await writeRun(root, '2026-07-15T11-00-00-000Z', 'running');
    await writeRun(root, '2026-07-15T12-00-00-000Z');

    const outputs = path.join(complete, 'outputs');
    await fs.mkdir(outputs, { recursive: true });
    await fs.writeFile(
      path.join(outputs, 'skeleton-golden.json'),
      JSON.stringify({ segments: [{ pali: 'idha' }], phases: [{ id: 'phase-a' }] }),
      'utf8',
    );

    const index = await buildBenchIndex(root);

    expect(index.latestTimestamp).toBe('2026-07-15T10-00-00-000Z');
    expect(index.entries.map((entry) => entry.timestamp)).toEqual(['2026-07-15T10-00-00-000Z']);
  });

  it('rejects incomplete and malformed run receipts with actionable errors', async () => {
    const root = await makeRoot();
    const running = await writeRun(root, 'running-run', 'running');
    const malformed = await writeRun(root, 'malformed-run', 'future-status');
    const invalidJson = await writeRun(root, 'invalid-json-run');
    await fs.writeFile(path.join(invalidJson, 'progress.json'), '{not-json', 'utf8');

    await expect(assertBenchmarkRunComplete(running, 'publisher')).rejects.toThrow(
      'status is running; expected complete',
    );
    await expect(readBenchmarkRunStatus(malformed)).rejects.toThrow(
      'has invalid status "future-status"',
    );
    await expect(readBenchmarkRunStatus(invalidJson)).rejects.toThrow(
      'Invalid JSON',
    );
  });
});
