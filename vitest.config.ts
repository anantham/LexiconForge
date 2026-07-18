import { defineConfig, configDefaults } from 'vitest/config'
import { resolve } from 'path'

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
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/.claude/**', // agent worktrees (see test.exclude above)
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        // Exclude legacy/dead code to stop diluting coverage metrics
        'archive/**',
        'chrome_extension/**',
        '**/*.legacy.*',
        'workers/**', // Workers need separate test strategy
      ],
      // Per-file thresholds: prevent regression in well-tested modules
      // while allowing gradual improvement in others
      thresholds: {
        // High-quality modules (prevent regression)
        'services/aiService.ts': { lines: 40, functions: 40 },
        'components/diff/**': { lines: 95, functions: 95 },

        // Critical path (raise gradually)
        'components/ChapterView.tsx': { lines: 30, functions: 15 },
        'adapters/providers/OpenAIAdapter.ts': { lines: 50, functions: 40 },
        'adapters/providers/GeminiAdapter.ts': { lines: 50, functions: 40 },
        'adapters/providers/ClaudeAdapter.ts': { lines: 50, functions: 40 },

        // Services with good tests (maintain)
        'services/diff/DiffAnalysisService.ts': { lines: 70, functions: 60 },
        'services/HtmlSanitizer.ts': { lines: 80, functions: 80 },
        'services/HtmlRepairService.ts': { lines: 75, functions: 75 },
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.')
    }
  }
})
