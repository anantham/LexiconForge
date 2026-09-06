import { test, expect, type Page } from '@playwright/test';

const navigate = (page: Page, path: string) => page.evaluate(pathname => {
  window.history.pushState(null, '', pathname);
  window.dispatchEvent(new PopStateEvent('popstate'));
}, path);

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  await page.route('**/*', route => new URL(route.request().url()).origin === origin
    ? route.continue()
    : route.abort());
});

test('the standalone index loads without the novel app or sutta datasets', async ({ page }) => {
  const scripts: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.resourceType() === 'script') scripts.push(request.url());
  });
  await page.goto('/gita');
  await expect(page.locator('h1')).toBeVisible();
  expect(scripts.filter(url => /MainApp|mn10|mn117|BenchmarkView/.test(url))).toEqual([]);

  await navigate(page, '/');
  await expect(page.getByRole('heading', { name: 'Lexicon Forge', exact: true })).toBeVisible();
  expect(scripts.some(url => url.includes('MainApp'))).toBe(true);
  expect(errors).toEqual([]);
});

test('late packet downloads cannot replace the current sutta after navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(/mn117/, async route => {
    await gate;
    await route.continue();
  });
  await page.goto('/sutta/demo?mode=read#word-1');
  const about = page.getByRole('button', { name: 'Expand About This Text panel' });
  await expect(about).toContainText('MN10');
  await expect(page).toHaveURL(/\/sutta\/mn10\?mode=read#word-1$/);

  const requested = page.waitForRequest(request => request.url().includes('mn117'));
  await navigate(page, '/sutta/mn117');
  await requested;
  await expect(page.getByText('Loading MN117…', { exact: true })).toBeVisible();
  await expect(about).toHaveCount(0);
  await navigate(page, '/sutta/mn10');
  await expect(about).toContainText('MN10');

  const downloaded = page.waitForResponse(response => response.url().includes('mn117'));
  release();
  await (await downloaded).finished();
  await expect(about).toContainText('MN10');
  await navigate(page, '/sutta/mn117');
  await expect(about).toContainText('MN117');
  expect(errors).toEqual([]);
});

test('a failed feature download offers recovery and leaves other routes usable', async ({ page }) => {
  await page.route(/GitaIndexPage/, route => route.abort('failed'));
  await page.goto('/gita');
  await expect(page.getByRole('alert')).toContainText('Unable to open this page:');
  await expect(page.getByRole('button', { name: 'Reload page' })).toBeVisible();
  await navigate(page, '/malayalam');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
