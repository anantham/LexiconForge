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
 */

import { test, expect, Page } from '@playwright/test';

// Helper to clear IndexedDB for fresh install testing
async function clearIndexedDB(page: Page) {
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const dbs = ['lexicon-forge'];  // Match DB_NAME in indexeddb.ts
      let remaining = dbs.length;

      dbs.forEach(dbName => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = () => {
          console.log('[TEST] Deleted database:', dbName);
          remaining--;
          if (remaining === 0) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  });
}

test.describe('Fresh Install Initialization', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first to ensure context exists
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Clear database while page is loaded but before full initialization
    await clearIndexedDB(page);
  });

  test('should initialize successfully without schema drift errors', async ({ page }) => {
    const consoleMessages: string[] = [];
    const errorMessages: string[] = [];

    // Capture console logs
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

    // Reload to trigger fresh initialization
    await page.reload({ waitUntil: 'domcontentloaded' });

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
    await page.reload({ waitUntil: 'domcontentloaded' });

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

    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    await page.reload({ waitUntil: 'domcontentloaded' });

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

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Store:init]')) {
        consoleMessages.push(text);
        console.log('[TEST]:', text);
      }
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
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

    // Clear console and visit again
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[IndexedDB]') || text.includes('[Store:init]')) {
        consoleMessages.push(text);
      }
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
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
