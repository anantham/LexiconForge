// ESLint baseline (P0.2 of the Jane Street house-style plan,
// docs/roadmaps/JANE-STREET-STYLE-RECON-2026-07-19.md).
//
// Philosophy: 'error' only for rules the codebase already satisfies or that catch
// real bug classes cheaply; 'warn' for the ratchets (existing-count-must-not-grow;
// promote to 'error' as directories are cleaned in P3). Type-aware linting
// (no-floating-promises, switch-exhaustiveness-check) is deliberately deferred to
// the P3 ratchet — projectService over 92k LOC is too slow for a default lint run.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'public/**',
      'data/**',
      'books/**',
      'reports/**',
      '.claude/**',
      'issues/**',
      '**/*.cjs',
      'api/**', // CJS Vercel functions, linted by deployment
      // These three were committed with newlines encoded as the LITERAL escape
      // `\n` (144 backslashes, zero real line breaks — the whole file is one
      // physical line). tsc tolerates it; the eslint TS parser rejects it as
      // "Invalid character". Pre-existing (commit b17f834), agent-untouched, and
      // out of P0 scope — normalizing them safely is a separate fix (a literal
      // `\n` inside a real string would flip to a newline). Tracked, not hidden.
      'services/audio/storage/cache.ts',
      'services/audio/storage/opfs.ts',
      'services/audio/storage/pinning.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Repo-wide baseline policy. The gate is "zero ERRORS"; all pre-existing
    // legacy violations are demoted to 'warn' (the debt ratchet — CI enforces
    // the warning count does not grow; P2/P3 promote rules back to 'error' as
    // each area is driven to zero). Nothing here is P0's target.
    rules: {
      // no-undef is a FALSE-POSITIVE class: TypeScript proves resolution in
      // .ts/.tsx (95% of the tree), and eslint's core rule knows neither TS
      // types nor the DOM/Node/extension globals the .js/.mjs files use. On, it
      // produced 337 phantom errors. Off is the typescript-eslint recommendation.
      'no-undef': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      // Demoted repo-wide (not just in the TS block) because it fires on mixed
      // file types; caughtErrors:'none' ignores unused `catch (e)` bindings.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'prefer-const': 'warn',
      'preserve-caught-error': 'warn',
      'no-async-promise-executor': 'warn',
      'no-extra-boolean-cast': 'warn',
      'no-empty': 'warn',
      'no-useless-escape': 'warn',
      'no-useless-assignment': 'warn',
      'no-irregular-whitespace': 'warn',
      'no-case-declarations': 'warn',
      'no-loss-of-precision': 'warn',
      'no-control-regex': 'warn',
      'no-fallthrough': 'warn',
      'no-cond-assign': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/no-unnecessary-type-constraint': 'warn',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Every react-hooks finding is pre-existing; warn for the baseline (the
      // ratchet), promote to error per-area in P2 when the store/component work
      // lands. The recommended flat config ships these 8 rules all at 'error'.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/use-memo': 'warn',
      // TS-only ratchets (the core-rule demotions live in the repo-wide block).
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      // The codebase intentionally uses namespace-style Ops objects and empty
      // placeholder interfaces in places; keep the noise down until P2 revisits.
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'tests/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  }
);
