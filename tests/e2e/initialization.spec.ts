/**
 * Initialization E2E Test
 *
 * Validates that the app successfully initializes on a fresh install without:
 * - Schema drift errors
 * - Initialization deadlocks
 * - Missing stores
 *
 * This test guards against regressions of the following fixes:
 * - 2025-11-12: createSchema removal (schema drift fix)
 * - 2025-11-12: Re-entrant openDatabase deadlock fix
 *
 * TESTING STRATEGY:
 * These tests use Playwright's built-in context isolation instead of manually
 * calling deleteDatabase(). Each test gets a fresh browser context which provides
 * clean storage without the connection lifecycle issues caused by React.StrictMode
 * double-rendering + async transaction commits.
 *
 * See: docs/E2E-DELETE-DATABASE-ROOT-CAUSE.md for full technical analysis
 * See: tests/e2e/examples/indexeddb-test-strategies.spec.ts for all solution options
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('Fresh Install Initialization', () => {
  // Note: These tests share storage state within the describe block
  // For true isolation, each test would need its own browser context

  test('should initialize successfully without schema drift errors', async ({ page }) => {
    const consoleMessages: string[] = [];
    const errorMessages: string[] = [];

    // Set up listeners BEFORE navigation
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(text);

      // Log to test output for debugging
      if (msg.type() === 'error' || text.includes('error') || text.includes('Error')) {
        console.log('[ERROR]:', text);
        errorMessages.push(text);
      } else if (text.includes('[Store:init]') || text.includes('[IndexedDB]')) {
        console.log('[LOG]:', text);
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      console.log('[PAGE ERROR]:', error.message);
      errorMessages.push(error.message);
    });

    // Navigate to trigger initialization (with listeners already set up)
    await page.goto('/');

    // Wait for initialization to complete by checking captured console messages
    let attempts = 0;
    while (attempts < 100) {
      if (consoleMessages.some(msg =>
        msg.includes('[Store:init] initializeStore complete') &&
        msg.includes('isInitialized true')
      )) {
        break;
      }
      await page.waitForTimeout(100);
      attempts++;
    }

    // Verify no schema drift errors
    const schemaDriftErrors = consoleMessages.filter(msg =>
      msg.includes('Schema drift detected') ||
      msg.includes('missing stores')
    );
    expect(schemaDriftErrors, 'Should not have schema drift errors').toHaveLength(0);

    // Verify no critical errors
    const criticalErrors = errorMessages.filter(msg =>
      msg.includes('IndexedDB') ||
      msg.includes('migration') ||
      msg.includes('schema')
    );
    expect(criticalErrors, 'Should not have critical IndexedDB errors').toHaveLength(0);

    // Verify initialization completed
    const initComplete = consoleMessages.some(msg =>
      msg.includes('[Store:init] initializeStore complete') &&
      msg.includes('isInitialized true')
    );
    if (!initComplete) {
      console.log('[DEBUG] Console messages count:', consoleMessages.length);
      console.log('[DEBUG] Messages with initializeStore:', consoleMessages.filter(m => m.includes('initializeStore')));
      console.log('[DEBUG] Messages with isInitialized:', consoleMessages.filter(m => m.includes('isInitialized')));
      console.log('[DEBUG] Last 10 messages:', consoleMessages.slice(-10));
    }
    expect(initComplete, 'Initialization should complete successfully').toBe(true);

    // Verify spinner disappeared
    const spinnerGone = await page.locator('text=Initializing Session').isHidden();
    expect(spinnerGone, 'Initialization spinner should disappear').toBe(true);
  });

  test('should create all required IndexedDB stores', async ({ page }) => {
    // Navigate to app
    await page.goto('/');

    // Wait for initialization
    await page.waitForTimeout(5000);

    // Check IndexedDB stores
    const stores = await page.evaluate(() => {
      return new Promise<string[]>((resolve, reject) => {
        const request = indexedDB.open('LexiconForge');
        request.onsuccess = () => {
          const db = request.result;
          const storeNames = Array.from(db.objectStoreNames);
          db.close();
          resolve(storeNames);
        };
        request.onerror = () => reject(request.error);
      });
    });

    // Verify all 10 required stores exist
    const requiredStores = [
      'chapters',
      'translations',
      'settings',
      'feedback',
      'prompt_templates',
      'url_mappings',
      'novels',
      'chapter_summaries',
      'amendment_logs',
      'diffResults'
    ];

    console.log('Found stores:', stores);
    console.log('Required stores:', requiredStores);

    for (const storeName of requiredStores) {
      expect(stores, `Store '${storeName}' should exist`).toContain(storeName);
    }

    expect(stores.length, 'Should have exactly 10 stores').toBe(10);
  });

  test('should not deadlock on initialization', async ({ page }) => {
    const consoleMessages: string[] = [];

    // Set up listener before navigation
    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    // Navigate to trigger initialization
    await page.goto('/');

    // Wait for initialization by checking console messages
    let attempts = 0;
    while (attempts < 150) { // 15 seconds
      if (consoleMessages.some(msg => msg.includes('[Store:init] initializeStore complete'))) {
        break;
      }
      await page.waitForTimeout(100);
      attempts++;
    }

    const initCompleted = consoleMessages.some(msg =>
      msg.includes('[Store:init] initializeStore complete')
    );
    expect(initCompleted, 'Initialization should complete within 15 seconds').toBe(true);

    // Verify we didn't get stuck in re-entrant call
    const reentrantCallPattern = consoleMessages.filter(msg =>
      msg.includes('openDatabase') &&
      msg.includes('already opening')
    );
    expect(reentrantCallPattern, 'Should not have re-entrant openDatabase calls').toHaveLength(0);
  });

  test('should initialize prompt templates', async ({ page }) => {
    const consoleMessages: string[] = [];

    // Set up listener before navigation
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Store:init]')) {
        consoleMessages.push(text);
        console.log('[TEST]:', text);
      }
    });

    // Navigate to trigger initialization
    await page.goto('/');
    await page.waitForTimeout(5000);

    // Check that prompt templates were loaded or initialized
    const promptTemplateLog = consoleMessages.find(msg =>
      msg.includes('prompt templates') ||
      msg.includes('Using existing prompt templates') ||
      msg.includes('Initialized prompt templates')
    );

    expect(promptTemplateLog, 'Prompt templates should be initialized').toBeDefined();
  });
});

test.describe('Existing Database Upgrade', () => {
  test('should handle database already at current version', async ({ page }) => {
    await page.goto('/');

    // First visit - creates database
    await page.waitForTimeout(5000);

    // Clear console and navigate again to test reinitialization
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[IndexedDB]') || text.includes('[Store:init]')) {
        consoleMessages.push(text);
      }
    });

    // Navigate again (context persists within this test)
    await page.goto('/');
    await page.waitForTimeout(5000);

    // Should not trigger schema drift on already-initialized DB
    const schemaDriftErrors = consoleMessages.filter(msg =>
      msg.includes('Schema drift') || msg.includes('missing stores')
    );
    expect(schemaDriftErrors, 'Should not have schema drift on reload').toHaveLength(0);

    // Should complete initialization
    const initComplete = consoleMessages.some(msg =>
      msg.includes('initializeStore complete')
    );
    expect(initComplete, 'Should complete initialization on reload').toBe(true);
  });
});
