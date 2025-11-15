import { test, expect } from '@playwright/test';

test('simple page load and console dump', async ({ page }) => {
  const allMessages: string[] = [];
  const errors: string[] = [];

  // Capture ALL console output
  page.on('console', msg => {
    const text = msg.text();
    allMessages.push(`[${msg.type()}] ${text}`);
    console.log(`[${msg.type()}] ${text}`);
  });

  // Capture page errors
  page.on('pageerror', error => {
    const msg = `PAGE ERROR: ${error.message}\n${error.stack}`;
    errors.push(msg);
    console.error(msg);
  });

  // Capture request failures
  page.on('requestfailed', request => {
    const msg = `REQUEST FAILED: ${request.url()} - ${request.failure()?.errorText}`;
    errors.push(msg);
    console.error(msg);
  });

  console.log('\n=== NAVIGATING TO PAGE ===\n');

  try {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  } catch (e) {
    console.error('Navigation error:', e);
  }

  console.log('\n=== WAITING 5 SECONDS ===\n');
  await page.waitForTimeout(5000);

  console.log('\n=== FINAL STATE ===');
  console.log(`Total messages: ${allMessages.length}`);
  console.log(`Errors: ${errors.length}`);

  console.log('\n=== ALL CONSOLE MESSAGES ===');
  allMessages.forEach((msg, i) => {
    console.log(`${i + 1}. ${msg}`);
  });

  console.log('\n=== ALL ERRORS ===');
  errors.forEach((err, i) => {
    console.log(`${i + 1}. ${err}`);
  });

  // Check if page is still alive
  const title = await page.title();
  console.log(`\nPage title: ${title}`);

  // Try to evaluate something in the page context
  try {
    const hasRoot = await page.evaluate(() => {
      return {
        hasRoot: !!document.getElementById('root'),
        rootContent: document.getElementById('root')?.innerHTML.substring(0, 200),
        hasReact: typeof (window as any).React !== 'undefined',
        location: window.location.href
      };
    });
    console.log('\nPage evaluation result:', JSON.stringify(hasRoot, null, 2));
  } catch (e) {
    console.error('Failed to evaluate page:', e);
  }

  // This test always passes - it's just for debugging
  expect(true).toBe(true);
});
