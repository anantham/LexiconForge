/**
 * Diagnostic E2E Test
 *
 * Purpose: Understand why initialization is failing in E2E tests
 * - Check if page loads at all
 * - Check if React renders
 * - Check if store initializes
 * - Check if IndexedDB opens
 */

import { test, expect } from '@playwright/test';

test.describe('Initialization Diagnostics', () => {
  test('Step 1: Page loads and React renders', async ({ page }) => {
    const logs: string[] = [];
    const errors: string[] = [];

    // Capture ALL console output
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      console.log('[BROWSER]:', text);
    });

    page.on('pageerror', error => {
      errors.push(error.message);
      console.log('[ERROR]:', error.message);
    });

    console.log('\n=== STEP 1: Navigation ===');
    await page.goto('http://localhost:5173/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    console.log('✓ Page navigation completed');

    // Wait for React to render
    await page.waitForTimeout(2000);

    // Check if root element exists
    const rootElement = await page.locator('#root').count();
    console.log(`Root element count: ${rootElement}`);
    expect(rootElement).toBeGreaterThan(0);

    // Check if there's any content
    const bodyText = await page.locator('body').textContent();
    console.log(`Body has content: ${bodyText ? bodyText.substring(0, 100) : 'EMPTY'}`);

    // Check for critical errors
    console.log(`\nErrors caught: ${errors.length}`);
    if (errors.length > 0) {
      errors.forEach(e => console.log('  -', e));
    }

    console.log(`\nConsole logs captured: ${logs.length}`);
  });

  test('Step 2: Store initialization begins', async ({ page }) => {
    const logs: string[] = [];

    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      if (text.includes('[Store') || text.includes('IndexedDB')) {
        console.log('[BROWSER]:', text);
      }
    });

    console.log('\n=== STEP 2: Store Initialization ===');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

    // Wait for initialization
    await page.waitForTimeout(5000);

    // Check for store initialization logs
    const storeInitLogs = logs.filter(log => log.includes('[Store:init]'));
    console.log(`Store:init logs found: ${storeInitLogs.length}`);
    storeInitLogs.forEach(log => console.log('  -', log));

    // Check for IndexedDB logs
    const dbLogs = logs.filter(log => log.includes('IndexedDB') || log.includes('[IndexedDB]'));
    console.log(`\nIndexedDB logs found: ${dbLogs.length}`);
    dbLogs.forEach(log => console.log('  -', log));

    // Report what we found
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total console logs: ${logs.length}`);
    console.log(`Store logs: ${storeInitLogs.length}`);
    console.log(`DB logs: ${dbLogs.length}`);
  });

  test('Step 3: IndexedDB database state', async ({ page }) => {
    console.log('\n=== STEP 3: IndexedDB Database State ===');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    // Check what databases exist
    const databases = await page.evaluate(async () => {
      if (!indexedDB.databases) {
        return 'indexedDB.databases() not supported';
      }
      const dbs = await indexedDB.databases();
      return dbs.map(db => ({ name: db.name, version: db.version }));
    });

    console.log('Databases found:', databases);

    // Try to open the database and check stores
    const dbInfo = await page.evaluate(() => {
      return new Promise((resolve) => {
        const dbName = 'lexicon-forge';
        const request = indexedDB.open(dbName);

        request.onerror = () => {
          resolve({ error: 'Failed to open database', errorMsg: request.error?.message });
        };

        request.onsuccess = () => {
          const db = request.result;
          const stores = Array.from(db.objectStoreNames);
          const version = db.version;
          db.close();
          resolve({ version, stores, storeCount: stores.length });
        };

        request.onupgradeneeded = (event: any) => {
          resolve({
            upgradeNeeded: true,
            oldVersion: event.oldVersion,
            newVersion: event.newVersion
          });
        };

        setTimeout(() => resolve({ timeout: true }), 3000);
      });
    });

    console.log('Database info:', JSON.stringify(dbInfo, null, 2));
  });

  test('Step 4: Wait for full initialization', async ({ page }) => {
    const logs: string[] = [];

    page.on('console', msg => {
      logs.push(msg.text());
    });

    console.log('\n=== STEP 4: Full Initialization Wait ===');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

    // Check for initialization spinner
    const hasSpinner = await page.locator('text=Initializing Session').count();
    console.log(`Initialization spinner visible: ${hasSpinner > 0}`);

    // Wait up to 15 seconds for initialization to complete
    let attempts = 0;
    let initComplete = false;

    while (attempts < 150) {
      const hasInitMsg = logs.some(msg =>
        msg.includes('[Store:init] initializeStore complete') &&
        msg.includes('isInitialized true')
      );

      if (hasInitMsg) {
        initComplete = true;
        console.log(`✓ Initialization completed after ${attempts * 100}ms`);
        break;
      }

      await page.waitForTimeout(100);
      attempts++;
    }

    console.log(`\n=== RESULTS ===`);
    console.log(`Initialization completed: ${initComplete}`);
    console.log(`Time waited: ${attempts * 100}ms`);
    console.log(`Total console logs: ${logs.length}`);

    // Show last 20 logs for context
    console.log('\n=== LAST 20 CONSOLE LOGS ===');
    logs.slice(-20).forEach(log => console.log('  ', log));
  });

  test('Step 5: Check for React StrictMode double-render', async ({ page }) => {
    const initCalls: string[] = [];

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('initializeStore – begin')) {
        initCalls.push(text);
        console.log('[INIT CALL]:', text);
      }
    });

    console.log('\n=== STEP 5: StrictMode Double-Render Check ===');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    console.log(`\ninitializeStore calls detected: ${initCalls.length}`);
    if (initCalls.length > 1) {
      console.log('⚠️  Multiple initialization calls detected (possible StrictMode)');
    } else if (initCalls.length === 1) {
      console.log('✓ Single initialization call');
    } else {
      console.log('❌ NO initialization calls detected!');
    }
  });
});
