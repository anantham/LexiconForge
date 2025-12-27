import type { Page } from '@playwright/test';

const DEFAULT_DB_NAMES = ['lexicon-forge'];

export async function clearIndexedDB(page: Page, dbNames: string[] = DEFAULT_DB_NAMES): Promise<void> {
  await page.evaluate((names) => {
    return new Promise<void>((resolve, reject) => {
      let remaining = names.length;
      if (remaining === 0) {
        resolve();
        return;
      }

      names.forEach((dbName) => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = () => {
          console.log('[TEST] Deleted database:', dbName);
          remaining -= 1;
          if (remaining === 0) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }, dbNames);
}

export async function prepareFreshApp(
  page: Page,
  options: { appSettings?: Record<string, unknown> } = {}
): Promise<void> {
  if (options.appSettings) {
    await page.addInitScript((appSettings) => {
      localStorage.clear();
      localStorage.setItem('app-settings', JSON.stringify(appSettings));
    }, options.appSettings);
  }

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await clearIndexedDB(page);
  await page.reload({ waitUntil: 'domcontentloaded' });

  // App only renders InputBar after initialization completes.
  await page
    .locator('input[placeholder^="Paste chapter URL"]')
    .first()
    .waitFor({ state: 'visible' });
}

export async function importSessionFromFile(page: Page, payload: unknown, name = 'session.json'): Promise<void> {
  await page.setInputFiles('input[type="file"]', {
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload), 'utf-8'),
  });

  // Wait until ChapterView content is rendered (session imported + chapter selected).
  await page.locator('[data-translation-content]').first().waitFor({ state: 'visible' });
}

