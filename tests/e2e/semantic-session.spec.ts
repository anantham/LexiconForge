import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';

// Real IndexedDB + production UI, with synthetic text and no private compute.
const chapters = [1, 2].map((chapterNumber) => ({
  stableId: `semantic-fixture-${chapterNumber}`,
  canonicalUrl: `lexiconforge://semantic-fixture/chapter/${chapterNumber}`,
  chapterNumber,
  title: `Chapter ${chapterNumber}`,
  content: `Synthetic chapter ${chapterNumber}.`,
  translations: [
    { version: 1, isActive: true, translatedTitle: `Chapter ${chapterNumber}`, translation: `Synthetic chapter ${chapterNumber}.`, provider: 'OpenRouter', model: 'synthetic-fixture' },
    { version: 2, isActive: false, translatedTitle: `Chapter ${chapterNumber}`, translation: `Alternative translation ${chapterNumber}.`, provider: 'OpenRouter', model: 'synthetic-fixture' },
  ],
}));
const contentHash = `sha256:${createHash('sha256').update(JSON.stringify({
  schema: 'lexiconforge-semantic-corpus-v1',
  chapters: chapters.map(({ chapterNumber, title, content }) => ({ chapterNumber, title, text: content })),
})).digest('hex')}`;
const corpus = { corpusId: 'semantic-fixture', versionId: 'v1', chapterCount: 2, contentHash };
const fixture = {
  metadata: { format: 'lexiconforge-session', version: '2.0', exportedAt: '2026-09-05T00:00:00Z' },
  novel: { id: corpus.corpusId, title: 'Semantic Fixture' },
  version: { versionId: corpus.versionId, displayName: 'Fixture', style: 'other', features: [] },
  chapters,
  settings: {},
  oscilloscope: {
    format: 'lexiconforge-oscilloscope', version: '1.0', corpus,
    threads: [{ threadId: 'tone:trust', label: 'Trust', category: 'tone', color: '#ef4444',
      values: [0.2, 0.7], totalChapters: 2, provenance: { origin: 'precomputed', method: 'synthetic-qa' } }],
    activeThreadIds: ['tone:trust'],
  },
};

test('exports a frozen graph, reimports offline, and invalidates changed text and books', async ({ page, context }) => {
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort());
  await page.goto('/');
  await page.waitForFunction(() => (window as any).useAppStore?.getState().isInitialized);
  await page.evaluate(async (payload) => {
    const store = (window as any).useAppStore;
    store.setState({ settings: { ...store.getState().settings, preloadCount: 0 } });
    store.getState().setViewMode('original');
    store.getState().openNovel('semantic-fixture', 'v1');
    await store.getState().importSessionData(payload);
    store.getState().setCurrentChapter([...store.getState().chapters.keys()][0]);
    store.getState().setViewMode('english');
  }, fixture);
  await expect(page.locator('.oscilloscope-panel')).toBeVisible();
  const exported = await page.evaluate(() => (window as any).useAppStore.getState().exportSessionData());
  const portable = JSON.parse(exported);
  expect(portable.oscilloscope).toEqual(fixture.oscilloscope);
  expect(portable.chapters[0]).toMatchObject({ novelId: corpus.corpusId, libraryVersionId: corpus.versionId });
  expect(JSON.stringify(portable.oscilloscope)).not.toMatch(/endpoint|baseUrl|vectors|token/i);

  await context.setOffline(true);
  await page.evaluate(async (payload) => {
    const store = (window as any).useAppStore;
    store.getState().setViewMode('original');
    store.getState().resetOscilloscope();
    await store.getState().importSessionData(payload);
    store.getState().setViewMode('english');
  }, exported);
  await expect(page.locator('.oscilloscope-panel')).toBeVisible();
  expect(await page.evaluate(() => (window as any).useAppStore.getState().threads.get('tone:trust').values)).toEqual([0.2, 0.7]);
  await expect(page.locator('[data-translation-content]')).toContainText('Synthetic chapter 1.');
  await page.locator('.oscilloscope-panel canvas').click();
  await expect(page.getByRole('button', { name: 'Threads', exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('offline-graph.png') });

  await page.evaluate(async () => {
    const store = (window as any).useAppStore;
    const ids = [...store.getState().chapters.keys()];
    store.getState().shelveActiveNovel();
    store.getState().openNovel('semantic-fixture', 'v1');
    for (const id of ids) await store.getState().loadChapterFromIDB(id);
    store.getState().setCurrentChapter(ids[0]);
    store.getState().setReaderReady();
  });
  await expect(page.locator('.oscilloscope-panel')).toBeVisible();
  expect(await page.evaluate(() => (window as any).useAppStore.getState().threads.get('tone:trust').values)).toEqual([0.2, 0.7]);

  await page.evaluate(async () => {
    const store = (window as any).useAppStore.getState();
    await store.setActiveTranslationVersion(store.currentChapterId, 2);
  });
  await expect(page.locator('[data-translation-content]')).toContainText('Alternative translation 1.');
  await expect(page.locator('.oscilloscope-panel')).toHaveCount(0);
  await page.evaluate(async (payload) => {
    const store = (window as any).useAppStore;
    await store.getState().importSessionData(payload);
    store.getState().openNovel('another-book', 'v1');
  }, exported);
  await expect(page.locator('.oscilloscope-panel')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).useAppStore.getState().corpusIdentity)).toBeNull();
});
