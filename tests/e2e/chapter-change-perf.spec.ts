import { test, expect, type Page } from '@playwright/test';

/**
 * Issue #9 closing gate: a cached chapter change must reach the reader within
 * CORE-006's `featureLoading: '< 500ms from trigger'` budget
 * (docs/adr/CORE-006-tree-shakeable-service-architecture.md), and must not
 * flood the console (at most 2 console.log lines per change).
 *
 * Seeds four translated chapters through the app's own session import (no
 * network, no provider), then times each Next click until the new chapter's
 * text is in the DOM and two frames have painted. Runs against the dev server,
 * without CPU throttling; see issues/09-chapter-change-perf-logging for the
 * throttled production-build probe.
 */
const SLO_MS = 500;
const MAX_LOG_LINES_PER_CHANGE = 2;

const text = (n: number) =>
  Array.from({ length: 80 }, (_, p) =>
    `Chapter ${n} text. Paragraph ${p + 1}. ` + 'A traveler reads a map beside the quiet river. '.repeat(8),
  ).join('<br><br>');

const chapterUrl = (n: number) => `lexiconforge://perf-fixture/chapter/${n}`;

const fixture = {
  metadata: { format: 'lexiconforge-session', version: '2.0', exportedAt: '2026-09-25T00:00:00Z' },
  novel: { id: 'perf-fixture', title: 'Perf Fixture' },
  novelId: 'perf-fixture',
  libraryVersionId: 'v1',
  version: { versionId: 'v1', displayName: 'Fixture', style: 'other', features: [] },
  settings: {},
  chapters: [1, 2, 3, 4].map((n) => ({
    stableId: `perf-${n}`,
    canonicalUrl: chapterUrl(n),
    chapterNumber: n,
    title: `Chapter ${n}`,
    content: `Raw chapter ${n}.`,
    prevUrl: n > 1 ? chapterUrl(n - 1) : null,
    nextUrl: n < 4 ? chapterUrl(n + 1) : null,
    translations: [{
      version: 1, isActive: true, translatedTitle: `Chapter ${n}`, translation: text(n),
      provider: 'OpenRouter', model: 'synthetic-fixture',
    }],
  })),
};

const seedReader = async (page: Page) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).useAppStore?.getState().isInitialized);
  await page.evaluate(async (payload) => {
    const store = (window as any).useAppStore;
    store.setState({ settings: { ...store.getState().settings, preloadCount: 0 } });
    store.getState().setViewMode('original');
    store.getState().openNovel('perf-fixture', 'v1');
    await store.getState().importSessionData(payload);
    store.getState().setCurrentChapter([...store.getState().chapters.keys()][0]);
    store.getState().setViewMode('english');
  }, fixture);
  await page.locator('[data-translation-content]').filter({ hasText: 'Chapter 1 text.' }).waitFor();
};

/**
 * Timestamp every console.log in the page, then wait until startup work
 * (repairs, migrations, the first mediator pass) has gone quiet, so late
 * startup logs cannot be attributed to a chapter change.
 */
const recordLogsAfterStartup = async (page: Page) => {
  await page.evaluate(() => {
    const logs: { at: number; text: string }[] = [];
    (window as any).__logs = logs;
    const original = console.log;
    console.log = (...args: unknown[]) => {
      logs.push({ at: performance.now(), text: String(args[0]).slice(0, 160) });
      original(...args);
    };
    (window as any).__lastLogAt = () => logs.at(-1)?.at ?? 0;
  });
  await page.waitForFunction(
    () => performance.now() - Math.max((window as any).__lastLogAt(), (window as any).__quietSince ??= performance.now()) > 1000,
    undefined,
    { timeout: 15_000, polling: 100 },
  );
};

/** Time from the Next click until `expected` is painted, and the logs emitted in between. */
const timeNextClick = async (page: Page, expected: string): Promise<{ ms: number; logs: string[] }> => {
  await page.evaluate((expected) => {
    const timing = { start: 0, done: 0 };
    (window as any).__chapterTiming = timing;
    document.addEventListener('click', () => { timing.start = performance.now(); }, { capture: true, once: true });
    const observer = new MutationObserver(() => {
      if (timing.start && document.querySelector('[data-translation-content]')?.textContent?.includes(expected)) {
        observer.disconnect();
        requestAnimationFrame(() => requestAnimationFrame(() => { timing.done = performance.now() - timing.start; }));
      }
    });
    observer.observe(document.querySelector('#root')!, { childList: true, subtree: true, characterData: true });
  }, expected);
  await page.getByRole('button', { name: 'Next →', exact: true }).first().click();
  await page.waitForFunction(() => (window as any).__chapterTiming.done > 0, undefined, { timeout: 10_000 });
  return page.evaluate(() => {
    const { start, done } = (window as any).__chapterTiming;
    const logs = ((window as any).__logs as { at: number; text: string }[])
      .filter((log) => log.at >= start && log.at <= start + done)
      .map((log) => log.text);
    return { ms: done, logs };
  });
};

test.describe('Chapter change latency (issue #9, CORE-006)', () => {
  test.describe.configure({ timeout: 60_000 });

  test(`a cached chapter change paints within ${SLO_MS}ms and logs at most ${MAX_LOG_LINES_PER_CHANGE} lines`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedReader(page);
    await recordLogsAfterStartup(page);

    const timings: number[] = [];
    const logsPerChange: number[] = [];
    const logTexts: string[] = [];
    for (const n of [2, 3, 4]) {
      const { ms, logs } = await timeNextClick(page, `Chapter ${n} text.`);
      timings.push(Math.round(ms));
      logsPerChange.push(logs.length);
      logTexts.push(...logs.map((text) => `ch${n}: ${text}`));
    }
    test.info().annotations.push({ type: 'console-logs-during-changes', description: logTexts.join(' | ') });

    test.info().annotations.push({ type: 'chapter-change-ms', description: timings.join(', ') });
    test.info().annotations.push({ type: 'console-log-lines-per-change', description: logsPerChange.join(', ') });
    console.log(`[issue-9] chapter change ms: ${timings.join(', ')}; console.log lines: ${logsPerChange.join(', ')}`);

    expect(errors).toEqual([]);
    for (const ms of timings) expect(ms).toBeLessThanOrEqual(SLO_MS);
    for (const lines of logsPerChange) expect(lines).toBeLessThanOrEqual(MAX_LOG_LINES_PER_CHANGE);
  });
});
