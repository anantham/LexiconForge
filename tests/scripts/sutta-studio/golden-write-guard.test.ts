// @vitest-environment node

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { guardGoldenOverwrite } from '../../../scripts/sutta-studio/lib/golden-write-guard';

describe('guardGoldenOverwrite (generate-*-golden clobber guard)', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'golden-guard-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('allows writing when the output file does not exist', () => {
    const result = guardGoldenOverwrite({
      outputPath: path.join(dir, 'new-golden.json'),
      argv: [],
    });
    expect(result.allowed).toBe(true);
  });

  it('REFUSES to overwrite an existing fixture without --force', () => {
    const outputPath = path.join(dir, 'golden.json');
    fs.writeFileSync(outputPath, JSON.stringify({ lexicographer: {} }));

    const result = guardGoldenOverwrite({ outputPath, argv: [] });

    expect(result.allowed).toBe(false);
    expect(result.message).toMatch(/REFUSING/);
    expect(result.message).toContain(outputPath);
    // The refusal must say what would be destroyed: at minimum the mtime.
    expect(result.message).toMatch(/last modified \d{4}-\d{2}-\d{2}T/);
  });

  it('names the curation markers present in the file it refuses to destroy', () => {
    const outputPath = path.join(dir, 'lexicographer-golden.json');
    fs.writeFileSync(
      outputPath,
      JSON.stringify({
        _acceptedSensesFrom: 'data/dpd/mn10',
        lexicographer: { 'phase-a': { senses: [{ wordId: 'w1', acceptedSenses: ['x'] }] } },
      }),
    );

    const result = guardGoldenOverwrite({ outputPath, argv: [] });

    expect(result.allowed).toBe(false);
    expect(result.message).toContain('acceptedSenses');
  });

  it('allows overwrite with --force, loudly', () => {
    const outputPath = path.join(dir, 'golden.json');
    fs.writeFileSync(outputPath, '{}');

    const result = guardGoldenOverwrite({ outputPath, argv: ['--force'] });

    expect(result.allowed).toBe(true);
    expect(result.message).toMatch(/OVERWRITING/);
  });
});
