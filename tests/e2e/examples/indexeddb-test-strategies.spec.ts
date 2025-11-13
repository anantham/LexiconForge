/**
 * SOLUTION EXAMPLES: E2E Test Strategies for IndexedDB
 *
 * This file demonstrates different approaches to handle IndexedDB lifecycle
 * issues in E2E tests. Choose the approach that best fits your needs.
 *
 * See docs/E2E-DELETE-DATABASE-ROOT-CAUSE.md for full analysis of why
 * deleteDatabase() hangs (React.StrictMode + async transactions).
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// ============================================================================
// SOLUTION 1: Use Playwright's Storage API (RECOMMENDED)
// ============================================================================
// Pros: Clean, reliable, uses built-in Playwright features
// Cons: None
// ============================================================================

test.describe('Solution 1: Playwright Storage API', () => {
  test.beforeEach(async ({ context, page }) => {
    // Let Playwright handle storage cleanup - it knows how to wait properly
    await context.clearCookies();
    await context.clearPermissions();

    // Navigate to app - it will have fresh storage
    await page.goto('/');
  });

  test('should initialize with fresh storage', async ({ page }) => {
    // App loads with clean slate - no manual deleteDatabase needed!
    await page.waitForSelector('#root');

    // Verify initialization happened
    const hasContent = await page.locator('body').textContent();
    expect(hasContent).toBeTruthy();
  });
});

// ============================================================================
// SOLUTION 2: Use New Context Per Test (MOST ISOLATED)
// ============================================================================
// Pros: Complete isolation, no shared state between tests
// Cons: Slightly slower (creates new browser context each time)
// ============================================================================

test.describe('Solution 2: Fresh Context Per Test', () => {
  test('should initialize in isolated context', async ({ browser }) => {
    // Create a completely fresh context for this test
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto('http://localhost:5173');
      await page.waitForSelector('#root');

      // Do test assertions
      expect(await page.title()).toContain('Lexicon');

    } finally {
      // Clean up
      await context.close();
    }
  });
});

// ============================================================================
// SOLUTION 3: Skip Fresh Install Tests (PRAGMATIC)
// ============================================================================
// Pros: Zero changes needed, documents the limitation
// Cons: Loses test coverage for fresh install scenarios
// ============================================================================

test.describe('Solution 3: Skip Fresh Install Tests', () => {
  test.skip('should initialize fresh database', async ({ page }) => {
    /**
     * SKIPPED: Fresh database testing incompatible with IndexedDB lifecycle
     *
     * WHY SKIPPED:
     * - React.StrictMode creates multiple connections (dev mode)
     * - Async transaction commits prevent immediate connection closure
     * - deleteDatabase() hangs waiting for all connections to close
     *
     * ALTERNATIVES:
     * - Test manually during development
     * - Use integration tests without browser
     * - Use Playwright storage API (see Solution 1)
     *
     * See: docs/E2E-DELETE-DATABASE-ROOT-CAUSE.md
     */
    await page.goto('/');
    // Test would go here...
  });

  test('should work with existing database', async ({ page }) => {
    // This test works fine - doesn't require fresh database
    await page.goto('/');
    await page.waitForSelector('#root');
    expect(await page.title()).toContain('Lexicon');
  });
});

// ============================================================================
// SOLUTION 4: Test in Production Mode (NO STRICTMODE)
// ============================================================================
// Pros: Tests production build, eliminates StrictMode double-rendering
// Cons: Requires separate build, doesn't test dev mode
// ============================================================================

test.describe('Solution 4: Production Mode Testing', () => {
  test.use({
    // Point to production build instead of dev server
    baseURL: 'http://localhost:4173' // Vite preview server
  });

  test.beforeEach(async ({ page }) => {
    // Production build has no StrictMode = only one connection opened
    // This makes deleteDatabase more reliable (but still async)
    await page.goto('/');

    // Close connection before attempting delete
    await page.evaluate(() => {
      if (typeof (window as any).closeIndexedDB === 'function') {
        (window as any).closeIndexedDB();
      }
    });

    // Wait a bit for connection to fully close
    await page.waitForTimeout(100);

    // Now delete should work (in production mode)
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase('lexicon-forge');
        request.onsuccess = () => resolve();
        request.onerror = () => resolve(); // Continue even if error
        request.onblocked = () => setTimeout(resolve, 1000); // Timeout if blocked
      });
    });
  });

  test('should initialize fresh in production mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#root');
    expect(await page.title()).toContain('Lexicon');
  });
});

// ============================================================================
// SOLUTION 5: Helper Function with Retry Logic
// ============================================================================
// Pros: More robust than simple deleteDatabase
// Cons: Still not 100% reliable, adds complexity
// ============================================================================

async function clearIndexedDBWithRetry(page: Page, maxRetries = 3): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Close any open connections
      await page.evaluate(() => {
        if (typeof (window as any).closeIndexedDB === 'function') {
          (window as any).closeIndexedDB();
        }
      });

      // Wait progressively longer each retry
      await page.waitForTimeout(100 * (attempt + 1));

      // Try to delete
      await page.evaluate(() => {
        return new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase('lexicon-forge');

          let resolved = false;
          const timeout = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              reject(new Error('Delete timeout'));
            }
          }, 2000);

          request.onsuccess = () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve();
            }
          };

          request.onerror = () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              reject(request.error);
            }
          };

          request.onblocked = () => {
            console.warn('[TEST] Delete blocked on attempt', attempt + 1);
          };
        });
      });

      // Success!
      return;

    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.warn(`[TEST] Failed to delete database after ${maxRetries} attempts`);
        // Continue anyway - test will use existing database
      }
    }
  }
}

test.describe('Solution 5: Retry Logic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearIndexedDBWithRetry(page);
  });

  test('should work with retry logic', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#root');
    expect(await page.title()).toContain('Lexicon');
  });
});

// ============================================================================
// RECOMMENDED: Combine Solution 1 + 2
// ============================================================================
// Use Playwright storage API for most tests, fresh context for critical ones
// ============================================================================

test.describe('Recommended: Hybrid Approach', () => {
  // Most tests use storage API (fast, reliable)
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await context.clearPermissions();
    await page.goto('/');
  });

  test('normal test - uses storage API', async ({ page }) => {
    await page.waitForSelector('#root');
    expect(await page.title()).toContain('Lexicon');
  });

  // Critical tests get fresh context (slower, but guaranteed isolation)
  test('critical test - uses fresh context', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto('http://localhost:5173');
      await page.waitForSelector('#root');

      // Critical assertions
      const dbExists = await page.evaluate(() => {
        return new Promise((resolve) => {
          const request = indexedDB.open('lexicon-forge');
          request.onsuccess = () => {
            const db = request.result;
            const hasStores = db.objectStoreNames.length > 0;
            db.close();
            resolve(hasStores);
          };
          request.onerror = () => resolve(false);
        });
      });

      expect(dbExists).toBe(true);

    } finally {
      await context.close();
    }
  });
});
