import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, unlinkSync, realpathSync } from 'node:fs';
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

const writeCoverage = (files: string[]) => {
  writeFileSync(join(dir, 'coverage-final.json'), JSON.stringify(
    Object.fromEntries(files.map(file => [join(dir, file), { path: join(dir, file) }]))
  ));
};

const runValidator = () => spawnSync(process.execPath, [VALIDATOR], {
  cwd: dir,
  env: {
    ...process.env,
    COVERAGE_POLICY_PATH: join(dir, 'policy.json'),
    COVERAGE_REPORT_PATH: join(dir, 'coverage-final.json'),
  },
  stdio: 'pipe',
}).status ?? 1;

beforeAll(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), 'covpol-')));
  mkdirSync(join(dir, 'services'));
  mkdirSync(join(dir, 'components'));
  writeFileSync(join(dir, 'services/rateLimitService.ts'), 'export const rate = 1;');
  writeFileSync(join(dir, 'components/review.config.ts'), 'export const setting = 1;');
});

beforeEach(() => {
  writeCoverage(['services/rateLimitService.ts']);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('validate-coverage-policy — fail-closed contract', () => {
  it('accepts a well-formed policy with instrumented globs', () => {
    // The floor must match a measured file, including a file with zero coverage.
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

  describe('global (aggregate) floors', () => {
    // Istanbul file coverage with `covered` of `total` one-line statements hit,
    // plus one function hit or not, so the summed total is known exactly.
    const measuredFile = (file: string, covered: number, total: number) => {
      const path = join(dir, file);
      const statementMap = Object.fromEntries(Array.from({ length: total }, (_, i) => [
        String(i), { start: { line: i + 1, column: 0 }, end: { line: i + 1, column: 1 } },
      ]));
      const s = Object.fromEntries(Array.from({ length: total }, (_, i) => [String(i), i < covered ? 1 : 0]));
      const loc = { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } };
      return [path, {
        path, statementMap, s,
        fnMap: { 0: { name: 'f', decl: loc, loc, line: 1 } }, f: { 0: covered > 0 ? 1 : 0 },
        branchMap: {}, b: {},
      }] as const;
    };

    const writeMeasured = (...files: ReturnType<typeof measuredFile>[]) => {
      writeFileSync(join(dir, 'coverage-final.json'), JSON.stringify(Object.fromEntries(files)));
    };

    const policyWithGlobal = (global: Record<string, number>) => ({
      perFile: true,
      global,
      include: ['services/**'],
      entries: [{ glob: 'services/rateLimitService.ts', lines: 50, functions: 40 }],
    });

    it('passes when the summed total meets every floor', () => {
      // 6/10 + 0/10 = 30% lines across the whole surface, including a 0% file.
      writeMeasured(measuredFile('services/rateLimitService.ts', 6, 10), measuredFile('services/other.ts', 0, 10));
      writePolicy(policyWithGlobal({ lines: 30, statements: 30, functions: 50 }));
      expect(runValidator()).toBe(0);
    });

    it('fails when the summed total drops below a floor', () => {
      writeMeasured(measuredFile('services/rateLimitService.ts', 6, 10), measuredFile('services/other.ts', 0, 10));
      writePolicy(policyWithGlobal({ lines: 31 }));
      expect(runValidator()).toBe(1);
    });

    it('fails when the report has nothing to total for a positive floor', () => {
      writePolicy(policyWithGlobal({ branches: 10 }));
      writeMeasured(measuredFile('services/rateLimitService.ts', 6, 10));
      expect(runValidator()).toBe(1);
    });

    it.each([
      ['an unknown metric', { line: 10 }],
      ['a non-percentage', { lines: 150 }],
    ])('rejects %s', (_label, global) => {
      writeMeasured(measuredFile('services/rateLimitService.ts', 6, 10));
      writePolicy(policyWithGlobal(global));
      expect(runValidator()).toBe(1);
    });
  });

  it('rejects floors on files outside the measured report (silent no-op class)', () => {
    writeCoverage(['components/Measured.tsx', 'components/Other.tsx']);
    writePolicy({
      perFile: true,
      include: ['components/**'], // services/ NOT instrumented in this scope
      entries: [{ glob: 'services/rateLimitService.ts', lines: 50, functions: 40 }],
    });
    expect(runValidator()).toBe(1);
  });

  it('rejects an excluded configuration file even when it exists under an include root', () => {
    writeCoverage(['components/Measured.tsx', 'components/Other.tsx']);
    writePolicy({
      perFile: true,
      include: ['components/**'],
      entries: [{ glob: 'components/review.config.ts', lines: 90, functions: 90 }],
    });
    expect(runValidator()).toBe(1);
  });

  it.each(['missing', 'empty'])('rejects a %s measured report', (kind) => {
    writePolicy({
      perFile: true,
      include: ['services/**'],
      entries: [{ glob: 'services/rateLimitService.ts', lines: 50, functions: 40 }],
    });
    if (kind === 'missing') unlinkSync(join(dir, 'coverage-final.json'));
    else writeCoverage([]);
    expect(runValidator()).toBe(1);
  });

  it('uses Vitest glob semantics for root-level globstar and brace matches', () => {
    writePolicy({
      perFile: true,
      include: ['services/**'],
      entries: [
        { glob: 'services/**/*.ts', lines: 50, functions: 40 },
        { glob: 'services/{rateLimitService,unused}.ts', lines: 50, functions: 40 },
      ],
    });
    expect(runValidator()).toBe(0);
  });

});
