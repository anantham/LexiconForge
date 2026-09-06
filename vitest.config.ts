import { defineConfig, configDefaults } from 'vitest/config'
import { resolve } from 'path'
import { readFileSync } from 'node:fs'

// Coverage policy is the single source of truth (ADR CORE-013, PR-2).
// Validated by scripts/ci/validate-coverage-policy.mjs (verify:coverage-policy).
const policy = JSON.parse(readFileSync('config/coverage-policy.json', 'utf8'))
// Aggregate ('global') baselines are deliberately NOT fed into thresholds:
// with perFile:true Vitest compares them per-file, which cannot represent an
// accepted full-surface total that legitimately includes 0% islands. They get
// a separate report-parser once the CI baseline is accepted
// (docs/infrastructure/COVERAGE-BASELINE.md). Guard until then:
if (Object.values(policy.global ?? {}).some((v: number) => v > 0)) {
  throw new Error('coverage-policy: positive global floors need the aggregate enforcement mechanism (not yet built); keep them 0')
}
const perFileThresholds = Object.fromEntries(
  (policy.entries ?? []).map(e => [e.glob, { lines: e.lines, functions: e.functions }])
)

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: [
      ...configDefaults.exclude,
      'tests/e2e/**', // Playwright specs (run via `npm run test:e2e`)
      'issues/**/traces/**', // Playwright reproduction harnesses (issue-specific scripts)
      '**/.claude/**', // Agent git worktrees live under .claude/worktrees/ INSIDE the repo;
                       // without this the main checkout discovers their duplicate test copies,
                       // inflating counts and coverage. Match at any depth.
    ],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        perFile: policy.perFile === true,
        ...perFileThresholds,
      },
      reportOnFailure: true, // emit reports even when tests fail (env-class failures must not hide measurement)
      reporter: ['text', 'json', 'html'],
      include: policy.include,
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/.claude/**', // agent worktrees (see test.exclude above)
        '**/*.d.ts',
        '**/*.d.cts',
        // tsconfig-excluded broken modules cannot be instrumented
        'services/audio/storage/cache.ts',
        'services/audio/storage/opfs.ts',
        '**/*.config.*',
        '**/coverage/**',
        'chrome_extension/**',
      ],
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.')
    }
  }
})
