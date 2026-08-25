import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Red-tests for the coverage-policy validator (scripts/ci/validate-coverage-policy.mjs).
 * Fixtures exercise the fail-closed contract: malformed/empty policies and
 * unenforceable floors must exit 1, never silently pass.
 */
const VALIDATOR = join(__dirname, '..', '..', '..', 'scripts', 'ci', 'validate-coverage-policy.mjs');

let dir: string;

const writePolicy = (policy: unknown) => {
  writeFileSync(join(dir, 'policy.json'), JSON.stringify(policy));
};

const runValidator = () => {
  try {
    execFileSync(process.execPath, [VALIDATOR], {
      env: { ...process.env, COVERAGE_POLICY_PATH: join(dir, 'policy.json') },
      stdio: 'pipe',
    });
    return 0;
  } catch (e: any) {
    return e.status ?? 1;
  }
};

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'covpol-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const baseEntry = { glob: 'services/example.ts', lines: 50, functions: 40 };

describe('validate-coverage-policy — fail-closed contract', () => {
  it('accepts a well-formed policy with instrumented globs', () => {
    // services/** is an include root in the repo policy; a real file matches.
    writePolicy({
      perFile: true,
      global: { lines: 0 },
      include: ['services/**'],
      entries: [{ glob: 'services/rateLimitService.ts', lines: 50, functions: 40 }],
    });
    expect(runValidator()).toBe(0);
  });

  it('rejects an emptied entries array (fail-open guard)', () => {
    writePolicy({ perFile: true, entries: [] });
    expect(runValidator()).toBe(1);
  });

  it('rejects a deleted entries key', () => {
    writePolicy({ perFile: true });
    expect(runValidator()).toBe(1);
  });

  it('rejects positive global floors until aggregate enforcement exists', () => {
    writePolicy({
      perFile: true,
      global: { lines: 10 },
      include: ['services/**'],
      entries: [baseEntry],
    });
    expect(runValidator()).toBe(1);
  });

  it('rejects floors on files outside the instrumented set (silent no-op class)', () => {
    writePolicy({
      perFile: true,
      include: ['components/**'], // services/ NOT instrumented in this scope
      entries: [{ glob: 'services/rateLimitService.ts', lines: 50, functions: 40 }],
    });
    expect(runValidator()).toBe(1);
  });
});
