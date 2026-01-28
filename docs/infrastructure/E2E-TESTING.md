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

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (visible browser)
npm run test:e2e:headed

# Run with debugger
npm run test:e2e:debug
```

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

1. **Always clear state** - Tests clear IndexedDB in `beforeEach` for isolation
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

- [ ] Add tests for translation operations
- [ ] Add tests for EPUB export
- [ ] Add visual regression testing
- [ ] Add performance benchmarks
- [ ] Add cross-browser testing (Firefox, WebKit)
