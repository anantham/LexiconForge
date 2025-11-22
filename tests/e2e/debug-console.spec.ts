import { test, expect } from '@playwright/test';

test('capture console logs on page load', async ({ page }) => {
  const logs: string[] = [];

  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });

  page.on('pageerror', error => {
    const text = `[PAGE ERROR] ${error.message}`;
    logs.push(text);
    console.log(text);
  });

  console.log('Navigating to http://localhost:5173/...');

  try {
    await page.goto('http://localhost:5173/', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
    console.log('Page loaded successfully');

    // Wait a bit for initialization
    await page.waitForTimeout(5000);

    console.log('\n=== All Console Logs ===');
    logs.forEach(log => console.log(log));

  } catch (error) {
    console.log('Navigation failed:', error);
    console.log('\n=== Console Logs Before Timeout ===');
    logs.forEach(log => console.log(log));
    throw error;
  }
});
