# E2E Test Investigation Summary

**Date:** 2025-11-15
**Branch:** `claude/lexiconforge-technical-debt-analysis-011CUzBD65GCev4bZ5FAfUMh`
**Status:** Significant Progress - Multiple Issues Resolved

## Overview

This document summarizes the comprehensive investigation into E2E test failures in LexiconForge, documenting all issues discovered, fixes applied, and remaining work.

## Issues Discovered & Resolved

### ✅ 1. JSON Import Errors (RESOLVED)

**Problem:**
Modern Node/ESM requires import assertions for JSON modules. All JSON imports were failing with:
```
TypeError: Module "file:///home/user/LexiconForge/config/app.json" needs an import attribute of "type: json"
```

**Root Cause:**
- Vite 6.x enforces stricter ESM compliance
- JSON imports must use `with { type: 'json' }` syntax
- 21 files across the codebase had outdated import syntax

**Files Fixed:**
- `services/sessionManagementService.ts`
- `services/configService.ts`
- `services/ai/parameters.ts`
- `components/SettingsModal.tsx`
- `services/audio/AudioService.ts`
- `adapters/providers/OpenAIAdapter.ts`
- `adapters/providers/GeminiAdapter.ts`
- `services/diff/promptUtils.ts`
- `services/prompts.ts`
- `services/explanationService.ts`
- `services/translate/translationResponseSchema.ts`
- `services/illustrationService.ts`
- `services/claudeService.ts`
- `services/comparisonService.ts`
- `services/ai/providers/openai.ts`
- `services/ai/providers/gemini.ts`
- `config/constants.ts`

**Fix Applied:**
```typescript
// Before
import appConfig from '../config/app.json';
import prompts from '../config/prompts.json';

// After
import appConfig from '../config/app.json' with { type: 'json' };
import prompts from '../config/prompts.json' with { type: 'json' };
```

**Commit:** `01ae5a1` - "fix(e2e): resolve JSON import errors and improve test logging"

---

### ✅ 2. Markdown File Parsing Error (RESOLVED)

**Problem:**
```
SyntaxError: /home/user/LexiconForge/Features/Diff/colorExamples.md: Missing semicolon. (2:2)
  1 |
> 2 | As you will recieve some input like this
    |   ^
```

**Root Cause:**
- `tests/e2e/novel-library-flow.test.tsx` was a **Vitest** unit test
- It was located in `tests/e2e/` which is configured for **Playwright**
- Playwright tried to run it and failed parsing markdown imports
- The test imports React components which transitively import `colorExamples.md` via `services/diff/promptUtils.ts`

**Import Chain:**
```
novel-library-flow.test.tsx
  → components/NovelLibrary.tsx
    → services/diff/promptUtils.ts
      → Features/Diff/colorExamples.md?raw
```

**Fix Applied:**
Moved file from `tests/e2e/` to `tests/integration/` where Vitest tests belong

**Commit:** `79a22f5` - "fix(tests): resolve Markdown parsing error by moving misplaced test"

---

### ✅ 3. Test Structure Improvements (RESOLVED)

**Problem:**
- Tests were setting up event listeners AFTER page navigation
- This missed early console messages during initialization
- `page.reload()` calls caused frame detachment errors

**Fix Applied:**
1. Set up `page.on('console')` listeners BEFORE `page.goto()`
2. Removed all `page.reload()` calls
3. Tests now navigate fresh each time instead of reloading

**Example:**
```typescript
// BEFORE (broken)
test('should initialize', async ({ page }) => {
  await page.goto('/');
  page.on('console', msg => {  // ❌ Too late!
    consoleMessages.push(msg.text());
  });
});

// AFTER (fixed)
test('should initialize', async ({ page }) => {
  page.on('console', msg => {  // ✅ Before navigation
    consoleMessages.push(msg.text());
  });
  await page.goto('/');
});
```

---

### ✅ 4. Debug Logging Added (RESOLVED)

**Added comprehensive logging to track initialization:**

**`store/index.ts:237-460`:**
```typescript
initializeStore: async () => {
  console.log('[Store:init] initializeStore START');
  get().setInitialized(false);

  console.log('[Store:init] Loading settings...');
  get().loadSettings();
  console.log('[Store:init] Settings loaded');

  console.log('[Store:init] Loading prompt templates...');
  const { templates, activeTemplate } = await SessionManagementService.loadPromptTemplates();
  console.log('[Store:init] Prompt templates loaded, count:', templates.length);

  // ... more operations ...

  console.log('[Store:init] initializeStore complete - isInitialized true');
  get().setInitialized(true);
}
```

**`App.tsx:127-145`:**
```typescript
useEffect(() => {
  const init = async () => {
    try {
      console.log('[App] About to call initializeStore()');
      await initializeStore();
      console.log('[App] initializeStore() completed');
      // ... handle URL params ...
    } catch (error) {
      console.error('[App] Error during initialization:', error);
    }
  };
  init();
}, [initializeStore, handleNavigate]);
```

---

## Deep Root Cause Analysis

### deleteDatabase() Hang - The "Perfect Storm"

**Documented in:** `docs/E2E-DELETE-DATABASE-ROOT-CAUSE.md`

**Summary:**
The deleteDatabase() hang is NOT a bug - it's correct IndexedDB behavior when combined with React.StrictMode:

1. **React.StrictMode** (index.tsx:13)
   - Double-renders components in development mode
   - Each render calls `initializeStore()`
   - Opens 2+ database connections

2. **Async Transaction Lifecycle**
   - Readonly transactions commit asynchronously
   - No explicit commit() - relies on browser auto-commit
   - Timing varies by browser (10-50ms typical)

3. **Browser Spec Compliance**
   - `deleteDatabase()` must wait for ALL connections to close
   - Even after `dbInstance.close()`, transactions may still be committing
   - This is correct per IndexedDB specification

**Timeline Example:**
```
T+0ms:   page.goto('/') → React first render
T+10ms:  useEffect → initializeStore() → Connection 1 opens
T+40ms:  StrictMode second render → Connection 2 opens
T+60ms:  Transaction 1 auto-committing...
T+70ms:  test calls deleteDatabase()
T+71ms:  Browser waits for connections...
T+30000ms: Test timeout ❌
```

---

## Solution Strategies Documented

**File:** `tests/e2e/examples/indexeddb-test-strategies.spec.ts`

### Solution 1: Playwright Storage API (Recommended)
```typescript
test.use({
  storageState: undefined  // Fresh context per test
});

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await context.clearPermissions();
  await page.goto('/');
});
```

**Pros:** Built-in, no manual cleanup
**Cons:** May have subtle state sharing

### Solution 2: Fresh Context Per Test (Most Isolated)
```typescript
test('my test', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  // ... test code ...
  await context.close();
});
```

**Pros:** Complete isolation
**Cons:** Slower, more verbose

### Solution 3: Skip Fresh Install Tests (Pragmatic)
```typescript
test.skip('should initialize fresh database', () => {
  // Skip due to React.StrictMode + async transactions issue
  // See: docs/E2E-DELETE-DATABASE-ROOT-CAUSE.md
});
```

**Pros:** Fastest resolution
**Cons:** Reduced test coverage

### Solution 4: Production Mode Testing
Run tests against production build (no StrictMode)

**Pros:** Tests real deployment
**Cons:** Loses StrictMode safety checks

### Solution 5: Retry Logic with Exponential Backoff
Implement robust retry mechanism for deleteDatabase()

**Pros:** Most resilient
**Cons:** Complex, slow

---

## Current Test Status

### Tests Passing: 0/5 ❌

**All tests fail with:** "Initialization should complete successfully"

**Observed Behavior:**
- Page loads successfully (Vite connects, services initialize)
- Console shows: Telemetry, IndexedDB, ApiMetrics, DiffTriggerService all initialize
- **BUT:** `[Store:init]` and `[App]` logs never appear
- This means `initializeStore()` is not being called

**Services That Initialize:**
```
✅ [Telemetry] Initialized (session: 3905b250)
✅ [IndexedDB] Service loaded, window.testStableIdSchema() available
✅ [ApiMetrics] Service initialized
✅ [DiffTriggerService] Initialized and listening
```

**Missing Expected Logs:**
```
❌ [App] About to call initializeStore()
❌ [Store:init] initializeStore START
❌ [Store:init] Loading settings...
❌ [Store:init] initializeStore complete
```

---

## Remaining Issues

### 🔍 Issue 1: initializeStore() Not Being Called

**Hypothesis:**
- App component may not be rendering properly in test environment
- React.StrictMode or test environment differences
- Possible error preventing useEffect from running

**Next Steps:**
1. Check browser console in actual Playwright browser (not just captured logs)
2. Verify App component renders at all
3. Check if there's a React error boundary catching errors
4. Test in non-headless mode to see visual state

### 🔍 Issue 2: Page Crashes on Subsequent Navigation

**Error:** "page.goto: Page crashed"
**Test:** "Existing Database Upgrade › should handle database already at current version"
**Location:** Second navigation in same test

**This suggests:**
- First navigation works (creates database)
- Second navigation crashes the page
- Possible memory leak or state corruption

---

## Files Modified

### Core Fixes (21 files)
- 17 files: JSON import syntax updates
- 1 file: Test relocation
- 2 files: Debug logging additions
- 1 file: Test structure improvements

### Documentation Created
- `docs/E2E-DELETE-DATABASE-ROOT-CAUSE.md` (450+ lines)
- `docs/E2E-INVESTIGATION-SUMMARY.md` (this file)
- `tests/e2e/examples/indexeddb-test-strategies.spec.ts` (300+ lines)

---

## Commits

1. **`01ae5a1`** - "fix(e2e): resolve JSON import errors and improve test logging"
   - Fixed 21 JSON imports
   - Added debug logging
   - Improved test structure

2. **`79a22f5`** - "fix(tests): resolve Markdown parsing error by moving misplaced test"
   - Moved Vitest test to correct location
   - Resolved Playwright parsing error

---

## Recommendations

### Immediate Actions

1. **Investigate App Rendering**
   - Run tests in headed mode: `npx playwright test --headed`
   - Check if App component renders
   - Look for React errors in browser console

2. **Simplify Test Cases**
   - Start with minimal test that just checks page loads
   - Gradually add assertions
   - Identify exact failure point

3. **Consider Alternative Approach**
   - Use Solution 3 (Skip Tests) as temporary measure
   - Focus on integration tests instead of E2E for initialization
   - E2E tests for user flows, unit tests for initialization logic

### Long-term Strategy

1. **Reconsider Fresh Install E2E Tests**
   - These are particularly problematic due to StrictMode + deleteDatabase()
   - Consider testing initialization via unit/integration tests
   - Reserve E2E for actual user workflows

2. **Document Test Requirements**
   - When E2E tests need fresh state
   - When integration tests are sufficient
   - Clear guidelines for test placement

3. **Improve Test Infrastructure**
   - Custom test fixtures for database cleanup
   - Helper functions for common patterns
   - Better error reporting and debugging

---

## Success Metrics

✅ **Achieved:**
- Fixed critical build errors (JSON imports)
- Resolved test infrastructure errors (Markdown parsing)
- Comprehensive documentation of deleteDatabase() behavior
- Multiple solution strategies documented with examples
- Improved test structure and logging

⏳ **In Progress:**
- Getting tests to pass
- Understanding why App doesn't initialize in tests

❌ **Not Yet Started:**
- Implementing chosen solution strategy
- Verifying tests pass consistently
- Adding additional E2E coverage

---

## References

- [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [W3C IndexedDB Spec](https://w3c.github.io/IndexedDB/)
- [React StrictMode Documentation](https://react.dev/reference/react/StrictMode)
- [Playwright Testing Best Practices](https://playwright.dev/docs/best-practices)
- Internal: `docs/E2E-DELETE-DATABASE-ROOT-CAUSE.md`
- Internal: `tests/e2e/examples/indexeddb-test-strategies.spec.ts`
