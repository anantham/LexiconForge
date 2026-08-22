import { expect, test } from '@playwright/test';

test.use({
  viewport: { width: 412, height: 915 },
  hasTouch: true,
  isMobile: true,
});

test.describe('mobile selected-passage affordances', () => {
  test('introduces the long-press illustration gesture without overflowing', async ({ page }) => {
    await page.goto('/tests/fixtures/mobile-selection-preview.html?state=hint');

    const hint = page.getByTestId('mobile-selection-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('Long-press text, then choose Illustrate.');
    const box = await hint.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(412);
  });

  test('fits every labeled selection action within a Pixel-sized viewport', async ({ page }) => {
    await page.goto('/tests/fixtures/mobile-selection-preview.html?state=sheet');

    const sheet = page.getByRole('dialog', { name: 'Selected text actions' });
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId('selected-text-preview')).toContainText('Myth was being reborn');

    for (const name of ['Illustrate', 'Edit', 'Compare', 'Copy', 'Done']) {
      const action = page.getByRole('button', { name });
      await expect(action).toBeVisible();
      const box = await action.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(412);
    }

    const overflow = await sheet.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
