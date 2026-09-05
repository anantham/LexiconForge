# E2E Testing with Playwright

## Overview

LexiconForge uses Playwright for end-to-end (E2E) browser automation testing, focusing on database initialization and critical user flows.

## Setup

### Installation

```bash
node --version # use Node 24.19.0 for the current verification baseline
npm ci
node node_modules/playwright/cli.js install chromium
```

### Configuration

- `playwright.config.ts` - Main Playwright configuration
- `tsconfig.playwright.json` - TypeScript configuration for E2E tests
- Tests are located in `tests/e2e/`

## Running Tests

```bash
# Run with Playwright-managed dev server (recommended)
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (visible browser)
npm run test:e2e:headed

# Run with debugger
npm run test:e2e:debug
```

## Isolated worktrees and production checks

Use one persistent worktree per branch, preferably beside the repository. Keep root
main and other agents' work untouched. `npm ci` uses the checked-in lock; do not install
new test packages merely to run the suite. If dependencies are deliberately shared
between worktrees, first verify identical lockfiles and do not modify that shared
installation. Git LFS needs writable repository metadata even for some status/diff
operations; preserve media and fix access instead of disabling tracked-file checks.

The default command owns a strict-port dev server and refuses to reuse an existing
listener. To check a production build, start its preview explicitly in one terminal:

```bash
node node_modules/vite/bin/vite.js build --outDir /tmp/lf-qa-dist
node node_modules/vite/bin/vite.js preview --outDir /tmp/lf-qa-dist --host 127.0.0.1 --port 5192 --strictPort
```

In another terminal, target that preview without starting a dev server:

```bash
LF_E2E_BASE_URL=http://127.0.0.1:5192 node node_modules/playwright/cli.js test tests/e2e/route-loading.spec.ts --workers=1 --retries=0
```

Use a fresh automated browser with synthetic session fixtures. The route-loading
suite blocks external requests; suites that need network or model access must be
identified separately. Reuse `tests/e2e/helpers/sessionHarness.ts` for supported
fresh/import flows; do not import a personal browser profile. Record the source SHA,
Node/browser versions, fixture size, fresh/warm state and exact command with results.

Failure traces are retained on the first failure, including zero-retry runs:

```bash
node node_modules/playwright/cli.js show-report
node node_modules/playwright/cli.js show-trace path/to/trace.zip
```

For latency investigation, measure the actual rendered chapter/translation after
its UI action. A heading alone does not establish readable text, full interaction
readiness or backend scan latency. Keep timing samples separate from deterministic
correctness assertions; do not add sleeps or retries to obtain green results.

## Test Suites

### Initialization Tests (`tests/e2e/initialization.spec.ts`)

Comprehensive tests for database initialization:

1. **Fresh Install Initialization** - Verifies app initializes correctly with empty IndexedDB
2. **Schema Verification** - Checks all required object stores are created
3. **Deadlock Detection** - Ensures no re-entrant database calls
4. **Prompt Template Initialization** - Verifies default templates are loaded
5. **Existing Database Upgrade** - Tests reload behavior with existing database

### ChapterView Tests

- `tests/e2e/chapterview-large.spec.ts` - Tests large chapter import flows
- `tests/e2e/chapterview-media.spec.ts` - Tests media (images, audio) in chapters

### Debug Tests (`tests/e2e/debug-console.spec.ts`)

Simple test for capturing and analyzing console logs during initialization.

### Diagnostic Tests (`tests/e2e/diagnostic.spec.ts`)

Diagnostic test suite for debugging initialization issues.

## Debug Logging

The app includes debug logging in the database layer (`services/db/`):

- `[DEBUG:openDatabase]` - Database opening sequence
- `[DEBUG:onsuccess]` - Successful database operations
- `[DEBUG:onupgradeneeded]` - Schema migration events

These logs are visible in:
- Browser DevTools console
- Playwright test output (when captured)
- Test videos/screenshots on failure

## Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

Reports include:
- Test execution timeline
- Screenshots on failure
- Video recordings
- Console logs
- Network activity

## Best Practices

1. **Isolate state** - Use fresh browser contexts; clear IndexedDB for fresh-install cases and retain it deliberately for warm-cache/reload checks.
2. **Wait for initialization** - Don't assert until app fully initializes
3. **Capture console logs** - Set up listeners before page navigation
4. **Use descriptive names** - Test names should explain what's being verified
5. **Include context in errors** - Show relevant logs when tests fail

## Architecture Notes

### Database Name
- Correct name: `'lexicon-forge'` (lowercase with hyphen)

### Wait Strategies
- Use `waitUntil: 'domcontentloaded'` for page.goto() and page.reload()
- Console messages may appear before 'load' event fires

Schema changes and missing coverage belong in the existing source/tests and the
Issues pickup queue; do not maintain a second schema inventory or a generic test
wishlist in this guide.
