import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Phone and iPad accessibility gate for the main reading flow.
 *
 * Every screen x device x colour scheme must have:
 *  - zero axe violations at WCAG 2.2 AA;
 *  - no horizontal page scroll;
 *  - no form field under 16px text (iOS Safari zooms into it and stays zoomed);
 *  - touch targets of at least 44px (Apple HIG), except where WCAG 2.5.8 allows
 *    smaller: links inside running text, and range sliders (spacing exception).
 *    A radio or checkbox counts its label as part of the target.
 *
 * Chromium emulates the devices (touch + viewport). Safari-only behaviour is
 * covered by the 16px rule rather than by a WebKit run.
 */
const DEVICES = {
  'phone portrait': { width: 390, height: 844 },
  'phone landscape': { width: 844, height: 390 },
  'iPad portrait': { width: 820, height: 1180 },
  'iPad landscape': { width: 1180, height: 820 },
} as const;

const MIN_TARGET_PX = 44;

const text = (n: number) =>
  Array.from({ length: 12 }, (_, p) => `Chapter ${n} text. Paragraph ${p + 1}. ` + 'A traveler reads a map beside the quiet river. '.repeat(6)).join('<br><br>');
const url = (n: number) => `lexiconforge://a11y-fixture/chapter/${n}`;
const fixture = {
  metadata: { format: 'lexiconforge-session', version: '2.0', exportedAt: '2026-09-25T00:00:00Z' },
  novel: { id: 'a11y-fixture', title: 'Accessibility Fixture' },
  novelId: 'a11y-fixture',
  libraryVersionId: 'v1',
  version: { versionId: 'v1', displayName: 'Fixture', style: 'other', features: [] },
  settings: {},
  chapters: [1, 2, 3].map((n) => ({
    stableId: `a11y-${n}`, canonicalUrl: url(n), chapterNumber: n, title: `Chapter ${n}`, content: `Raw chapter ${n}.`,
    prevUrl: n > 1 ? url(n - 1) : null, nextUrl: n < 3 ? url(n + 1) : null,
    translations: [1, 2].map((v) => ({
      version: v, isActive: v === 1, translatedTitle: `Chapter ${n}`, translation: text(n),
      provider: 'OpenRouter', model: 'synthetic-fixture',
    })),
  })),
};

const openLibrary = async (page: Page) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).useAppStore?.getState().isInitialized);
  await page.locator('input[placeholder^="Paste chapter URL"]').first().waitFor();
};

const openReader = async (page: Page) => {
  await openLibrary(page);
  await page.evaluate(async (payload) => {
    const store = (window as any).useAppStore;
    store.setState({ settings: { ...store.getState().settings, preloadCount: 0 } });
    store.getState().setViewMode('original');
    store.getState().openNovel('a11y-fixture', 'v1');
    await store.getState().importSessionData(payload);
    store.getState().setCurrentChapter([...store.getState().chapters.keys()][0]);
    store.getState().setViewMode('english');
  }, fixture);
  await page.locator('[data-translation-content]').filter({ hasText: 'Chapter 1 text.' }).waitFor();
};

const openSelectionActions = async (page: Page) => {
  await openReader(page);
  // Select the start of the first paragraph the way a long-press does.
  await page.evaluate(() => {
    const content = document.querySelector('[data-translation-content]')!;
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && (node.textContent || '').trim().length < 30) node = walker.nextNode();
    const range = document.createRange();
    range.setStart(node!, 0);
    range.setEnd(node!, 25);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    document.dispatchEvent(new Event('mouseup'));
  });
};

const openSettings = async (page: Page) => {
  await openReader(page);
  await page.getByRole('button', { name: 'Settings' }).first().click();
  await page.getByRole('dialog', { name: 'Settings' }).waitFor();
};

/** The phone version picker; returns false where the desktop dropdown is shown instead. */
const openVersionPicker = async (page: Page) => {
  if ((page.viewportSize()?.width ?? 0) >= 768) return false; // Tailwind md: desktop dropdown instead
  await openReader(page);
  // Versions load after the chapter renders.
  const trigger = page.locator('button[aria-haspopup="dialog"]').filter({ hasText: 'synthetic-fixture' }).first();
  await trigger.waitFor();
  await trigger.click();
  await page.getByRole('dialog', { name: 'Select Version' }).waitFor();
  return true;
};

const SCREENS: Record<string, (page: Page) => Promise<unknown>> = {
  library: openLibrary,
  reader: openReader,
  'selection actions': openSelectionActions,
  settings: openSettings,
  'version picker': openVersionPicker,
};

/** Layout facts axe does not check: page overflow, iOS zoom fields, touch target size. */
const measureTouchLayout = (page: Page, minTarget: number) =>
  page.evaluate((minTarget) => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const describe = (el: Element) => {
      const r = el.getBoundingClientRect();
      const name = (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.getAttribute('placeholder') || el.tagName)
        .trim().replace(/\s+/g, ' ').slice(0, 40);
      return `${name} (${Math.round(r.width)}x${Math.round(r.height)})`;
    };
    // WCAG 2.5.8 exceptions: links inside running text, and sliders (spacing).
    const labelMeetsMinimum = (el: Element) =>
      [...((el as HTMLInputElement).labels ?? [])].some((label) => {
        const r = label.getBoundingClientRect();
        return r.height >= minTarget && r.width >= minTarget;
      });
    const exempt = (el: Element) =>
      (el.tagName === 'A' && getComputedStyle(el).display === 'inline') ||
      (el as HTMLInputElement).type === 'range' ||
      (['radio', 'checkbox'].includes((el as HTMLInputElement).type) && labelMeetsMinimum(el));

    const targets = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button]')]
      .filter(visible)
      .filter((el) => !exempt(el));
    const undersized = targets
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return Math.round(r.height) < minTarget || Math.round(r.width) < minTarget;
      })
      .map(describe);
    const zoomingFields = [...document.querySelectorAll('input:not([type=range]):not([type=checkbox]):not([type=radio]), select, textarea')]
      .filter(visible)
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map(describe);
    return {
      horizontalOverflowPx: document.documentElement.scrollWidth - window.innerWidth,
      undersized,
      zoomingFields,
    };
  }, minTarget);

for (const scheme of ['light', 'dark'] as const) {
  for (const [device, viewport] of Object.entries(DEVICES)) {
    test.describe(`${device}, ${scheme}`, () => {
      test.use({ viewport, hasTouch: true, isMobile: device.startsWith('phone'), colorScheme: scheme });

      for (const [screen, open] of Object.entries(SCREENS)) {
        test(`${screen} is accessible`, async ({ page }) => {
          const shown = await open(page);
          test.skip(shown === false, 'not shown at this size');
          await page.waitForTimeout(400); // let the selection sheet / modal settle

          const axe = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
          const violations = axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
          expect(violations).toEqual([]);

          const layout = await measureTouchLayout(page, MIN_TARGET_PX);
          expect(layout.horizontalOverflowPx).toBeLessThanOrEqual(0);
          expect(layout.zoomingFields).toEqual([]);
          expect(layout.undersized).toEqual([]);
        });
      }
    });
  }
}
