# E2E Testing with Playwright

## Overview

LexiconForge uses Playwright for end-to-end (E2E) browser automation testing, focusing on database initialization and critical user flows.

## Setup

### Installation

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

### Configuration

- `playwright.config.ts` - Main Playwright configuration
- `tsconfig.playwright.json` - TypeScript configuration for E2E tests
- Tests are located in `tests/e2e/`

## Running Tests

```bash
# Run with Playwright-managed dev server (recommended)
npm run test:e2e

# If you want to reuse an already-running dev server, start it on 5177:
# npm run dev -- --port 5177 --strictPort --host 127.0.0.1
# then run:
# Run all E2E tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (visible browser)
npm run test:e2e:headed

# Run with debugger
npm run test:e2e:debug
```

## Test Suites

### Initialization Tests (`tests/e2e/initialization.spec.ts`)

Comprehensive tests for database initialization to prevent regression of critical issues:

1. **Fresh Install Initialization** - Verifies app initializes correctly with empty IndexedDB
2. **Schema Verification** - Checks all 10 required object stores are created
3. **Deadlock Detection** - Ensures no re-entrant `openDatabase()` calls
4. **Prompt Template Initialization** - Verifies default templates are loaded
5. **Existing Database Upgrade** - Tests reload behavior with existing database

### Debug Tests (`tests/e2e/debug-console.spec.ts`)

Simple test for capturing and analyzing console logs during initialization. Useful for:
- Debugging test failures
- Understanding initialization sequence
- Verifying debug logging output

## Debug Logging

The app includes comprehensive debug logging throughout `services/indexeddb.ts`:

- `[DEBUG:openDatabase]` - Database opening sequence
- `[DEBUG:onsuccess]` - Successful database operations
- `[DEBUG:onupgradeneeded]` - Schema migration events
- `[DEBUG:verifySchema]` - Schema verification steps
- `[DEBUG:ensureChapterSummaries]` - Summary seeding process

These logs are visible in:
- Browser DevTools console
- Playwright test output (when captured)
- Test videos/screenshots on failure

## Current Status

### Working
- ✅ Playwright installation and configuration
- ✅ Debug logging throughout initialization
- ✅ Test infrastructure and scripts
- ✅ Debug console test passes
- ✅ Diagnostic test suite created (`tests/e2e/diagnostic.spec.ts`)

### Investigation Results (2025-11-13)

**Root Cause Identified**: Missing `adapters/repo/DiffResultsRepo.ts` file
- File was staged for deletion in git, breaking module imports
- Vite returned 500 Internal Server Error for all modules importing this file
- App never initialized because React components failed to load
- **Resolution**: Restored file with `git restore adapters/repo/DiffResultsRepo.ts`

**Diagnostic Findings**:
1. Page loads successfully, React renders `#root` element
2. Without DiffResultsRepo: Zero store initialization logs, empty page body
3. Vite errors prevented module graph from resolving
4. After restore: Server compiles cleanly with no errors

### Final Status (2025-11-13) ✅
**All 5 initialization tests passing!** (5/5 ✓)

1. ✅ should initialize successfully without schema drift errors (4.7s)
2. ✅ should create all required IndexedDB stores (9.6s) - All 10 stores created!
3. ✅ should not deadlock on initialization (4.7s)
4. ✅ should initialize prompt templates (9.5s)
5. ✅ should handle database already at current version (11.4s)

**Fixes Applied**:
- Restored missing `DiffResultsRepo.ts` file
- Fixed port configuration (dedicated 5177 for E2E)
- Fixed database name ('lexicon-forge' instead of 'LexiconForge')
- Updated test assertions to match actual log messages

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

1. **Always clear state** - Tests clear IndexedDB in `beforeEach` for isolation
2. **Wait for initialization** - Don't assert until app fully initializes
3. **Capture console logs** - Set up listeners before page navigation
4. **Use descriptive names** - Test names should explain what's being verified
5. **Include context in errors** - Show relevant logs when tests fail

## Architecture Notes

### Database Name
- Correct name: `'lexicon-forge'` (lowercase with hyphen)
- ⚠️ Common mistake: `'LexiconForge'` (this was a bug in initial tests)

### Wait Strategies
- Use `waitUntil: 'domcontentloaded'` for page.goto() and page.reload()
- Don't wait for 'load' event (can timeout if resources load slowly)
- Console messages may appear before 'load' event fires

### Store Names (10 required)
1. chapters
2. translations
3. settings
4. feedback
5. prompt_templates
6. url_mappings
7. novels
8. chapter_summaries
9. amendment_logs
10. diffResults

## Future Improvements

- [ ] Fix console message capture timing
- [ ] Add tests for user authentication flows
- [ ] Add tests for translation operations
- [ ] Add tests for EPUB export
- [ ] Add visual regression testing
- [ ] Add performance benchmarks
- [ ] Add cross-browser testing (Firefox, WebKit)
