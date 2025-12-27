import { test, expect } from '@playwright/test';

const testDiagnostics = process.env.LF_E2E_DIAGNOSTICS === '1' ? test : test.skip;

testDiagnostics('capture console logs on page load', async ({ page }) => {
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

  console.log('Navigating to baseURL / ...');

  try {
    await page.goto('/', {
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
