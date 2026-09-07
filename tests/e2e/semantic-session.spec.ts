import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

// Real IndexedDB + production UI, with synthetic text and no private compute.
const chapters = [1, 2].map((chapterNumber) => ({
  stableId: `semantic-fixture-${chapterNumber}`,
  canonicalUrl: `lexiconforge://semantic-fixture/chapter/${chapterNumber}`,
  chapterNumber,
  title: `Selected corpus: chapter ${chapterNumber}`,
  content: `Synthetic chapter ${chapterNumber}.`,
  translations: [
    { version: 1, isActive: true, translatedTitle: `Selected corpus: chapter ${chapterNumber}`, translation: `Synthetic chapter ${chapterNumber}.`, provider: 'OpenRouter', model: 'synthetic-fixture' },
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
    // Full backup includes another book and another translation of this book.
    // Both have chapter 1 and sort before the selected v1 corpus.
    for (const [novelId, versionId] of [['a-other-book', 'v1'], ['semantic-fixture', 'v0']]) {
      await store.getState().importSessionData({ ...payload, oscilloscope: undefined,
        novel: { ...payload.novel, id: novelId }, version: { ...payload.version, versionId },
        chapters: payload.chapters.map(chapter => ({ ...chapter, title: `${novelId}/${versionId}: ${chapter.title}` })) });
    }
    store.getState().shelveActiveNovel();
    store.getState().setViewMode('english');
  }, fixture);
  // A pasted portable URL has no registry scope. Its parsed identity must govern
  // storage and reader selection even when unrelated books are already cached.
  await page.route('**/semantic-import-fixture.json', route => route.fulfill({ json: fixture }));
  await page.getByPlaceholder('Paste chapter URL or session JSON file URL to start reading...')
    .fill('http://127.0.0.1:5194/semantic-import-fixture.json');
  await page.getByRole('button', { name: '🔗 Fetch', exact: true }).click();
  await expect(page.locator('.oscilloscope-panel')).toBeVisible();
  expect(await page.evaluate(() => {
    const state = (window as any).useAppStore.getState();
    const chapter = state.chapters.get(state.currentChapterId);
    return [state.activeNovelId, state.activeVersionId, chapter.novelId, chapter.libraryVersionId];
  })).toEqual(['semantic-fixture', 'v1', 'semantic-fixture', 'v1']);
  const exported = await page.evaluate(() => (window as any).useAppStore.getState().exportSessionData());
  const portable = JSON.parse(exported);
  expect(portable.oscilloscope).toEqual(fixture.oscilloscope);
  expect(portable.chapters).toHaveLength(6);
  expect(portable.chapters).toContainEqual(expect.objectContaining({ novelId: corpus.corpusId, libraryVersionId: corpus.versionId }));
  expect(JSON.stringify(portable.oscilloscope)).not.toMatch(/"(?:endpoint|baseUrl|vectors|token)"\s*:/i);

  await page.getByRole('button', { name: 'Return to library (home)' }).click();
  await context.setOffline(true);
  // Use the actual upload UI; payload order must not determine the graph's titles.
  const backupPath = test.info().outputPath('frozen-backup.json');
  await writeFile(backupPath, JSON.stringify({ ...portable, chapters: [...portable.chapters].reverse() }));
  await page.locator('input[type="file"][accept=".json,application/json"]').setInputFiles(backupPath);
  await expect(page.locator('.oscilloscope-panel')).toBeVisible();
  expect(await page.evaluate(() => (window as any).useAppStore.getState().threads.get('tone:trust').values)).toEqual([0.2, 0.7]);
  await expect(page.locator('[data-translation-content]')).toContainText('Synthetic chapter 1.');
  expect(await page.evaluate(() => {
    const state = (window as any).useAppStore.getState();
    const chapter = state.chapters.get(state.currentChapterId);
    return [chapter.novelId, chapter.libraryVersionId, chapter.chapterNumber];
  })).toEqual(['semantic-fixture', 'v1', 1]);
  await page.locator('.oscilloscope-panel canvas').click();
  await expect(page.getByRole('button', { name: 'Threads', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const store = (window as any).useAppStore;
    // A previous import must not supply the current plot's chapter labels.
    (window as any).__oscilloscopeChapterTitles = { 1: 'Previous book title' };
    const chapter = [...store.getState().chapters.values()].find((chapter: any) =>
      chapter.novelId === 'semantic-fixture' && chapter.libraryVersionId === 'v1' && chapter.chapterNumber === 2) as any;
    store.getState().setCurrentChapter(chapter.id);
  });
  // Click chapter 1 in the expanded production plot, with all backup scopes cached.
  const plot = page.locator('.oscilloscope-panel .u-over');
  await plot.hover({ position: { x: 10, y: 10 } });
  await expect.poll(() => page.evaluate(() => (window as any).useAppStore.getState().hoveredChapter)).toBe(1);
  await expect(page.locator('.oscilloscope-tooltip > div').first()).toHaveText('Selected corpus: chapter 1');
  await plot.click({ position: { x: 10, y: 10 } });
  expect(await page.evaluate(() => {
    const state = (window as any).useAppStore.getState();
    const chapter = state.chapters.get(state.currentChapterId);
    return [chapter.novelId, chapter.libraryVersionId, chapter.chapterNumber];
  })).toEqual(['semantic-fixture', 'v1', 1]);
  await page.screenshot({ path: test.info().outputPath('offline-graph.png') });

  await page.evaluate(async () => {
    const store = (window as any).useAppStore;
    const ids = [...store.getState().chapters.values()]
      .filter((chapter: any) => chapter.novelId === 'semantic-fixture' && chapter.libraryVersionId === 'v1')
      .map((chapter: any) => chapter.id);
    store.getState().shelveActiveNovel();
    store.getState().openNovel('semantic-fixture', 'v1');
    for (const id of ids) await store.getState().loadChapterFromIDB(id);
    store.getState().setCurrentChapter(ids[0]);
    store.getState().setReaderReady();
  });
  await expect(page.locator('.oscilloscope-panel')).toBeVisible();
  expect(await page.evaluate(() => (window as any).useAppStore.getState().threads.get('tone:trust').values)).toEqual([0.2, 0.7]);

  await page.locator('.oscilloscope-panel canvas').click();
  await page.locator('.oscilloscope-panel .u-over').hover({ position: { x: 10, y: 10 } });
  await expect(page.locator('.oscilloscope-tooltip > div').first()).toHaveText('Selected corpus: chapter 1');

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


test('uses native fetch for capability and returns a scalar graph through a real popup', async ({ page, context }) => {
  // Synthetic owner wire fixture. Actual owner/CSRF middleware is a separate acceptance gate.
  const owner = 'https://owner.example';
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort());
  await page.route(`${owner}/api/lexiconforge/semantic-oscilloscope/capability?*`, route => route.fulfill({ json: {
    ok: true, protocol: 'lexiconforge-semantic-oscilloscope-v1', scanTransport: 'lf-owner-scan-v1', corpus, ready: true, reason: 'ready',
    vectorSpace: 'qwen3-embedding-8b:mrl-512:l2-v1', dimensions: 512,
    index: { ready: true, vectorCount: 2, createdAt: null },
  } }));
  await page.goto('/');
  const readerOrigin = new URL(page.url()).origin;
  await context.route(`${owner}/api/lexiconforge/semantic-oscilloscope/owner-window`, route => route.fulfill({
    contentType: 'text/html', body: `<title>Synthetic owner window</title><script>
      const reader = ${JSON.stringify(readerOrigin)};
      addEventListener('message', event => {
        if (event.origin !== reader || event.source !== opener) return;
        const request = JSON.parse(event.data);
        opener.postMessage(JSON.stringify({protocol: 'lf-owner-scan-v1', type: 'result', requestId: request.requestId,
          result: {ok: true, protocol: 'lexiconforge-semantic-oscilloscope-v1', corpus: request.corpus,
            query: request.query, scores: [0.31, 0.62], scoreSemantics: 'cosine-similarity-clipped-0-1',
            scoring: {algorithm: 'chapter-top-2-mean-cosine-v1', range: [0, 1]},
            vectorSpace: 'qwen3-embedding-8b:mrl-512:l2-v1', dimensions: 512}}), reader);
      });
      opener.postMessage(JSON.stringify({protocol: 'lf-owner-scan-v1', type: 'ready'}), reader);
    </script>`,
  }));
  await page.waitForFunction(() => (window as any).useAppStore?.getState().isInitialized);
  await page.evaluate(async ({ payload, owner }) => {
    const store = (window as any).useAppStore;
    await store.getState().importSessionData(payload);
    store.setState({ settings: { ...store.getState().settings, indrasNetBaseUrl: owner, preloadCount: 0 } });
  }, { payload: fixture, owner });
  await page.locator('.oscilloscope-panel canvas').click();
  await page.getByRole('button', { name: 'Threads', exact: true }).click();
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await page.getByPlaceholder('e.g. reluctant trust becoming intimacy').fill('trust');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  const popup = await popupPromise;
  await expect.poll(() => page.evaluate(() => (window as any).useAppStore.getState()
    .threads.get('custom:semantic:trust')?.values)).toEqual([0.31, 0.62]);
  expect(popup.isClosed()).toBe(true);
  const exported = await page.evaluate(() => (window as any).useAppStore.getState().exportSessionData());
  expect(JSON.stringify(JSON.parse(exported).oscilloscope)).not.toMatch(/"(?:endpoint|baseUrl|vectors|token)"\s*:/i);
  await page.getByRole('button', { name: 'Return to library (home)' }).click();
  await context.setOffline(true);
  const file = test.info().outputPath('scanned-graph.json');
  await writeFile(file, exported);
  await page.locator('input[type="file"][accept=".json,application/json"]').setInputFiles(file);
  await expect(page.locator('.oscilloscope-panel')).toBeVisible();
  expect(await page.evaluate(() => (window as any).useAppStore.getState()
    .threads.get('custom:semantic:trust').values)).toEqual([0.31, 0.62]);
});

const unavailableBackends = [
  { name: 'missing backend', status: 404, body: { detail: 'Not Found' }, reason: /HTTP 404/ },
  { name: 'owner admission required', status: 401, body: { detail: 'Owner access required' }, reason: /HTTP 401/ },
  { name: 'window not built', status: 503, body: { detail: 'Private scan window is not built' }, reason: /window is not built/ },
  { name: 'legacy ready backend', status: 200, body: {
    ok: true, protocol: 'lexiconforge-semantic-oscilloscope-v1', corpus, ready: true, reason: 'ready',
    vectorSpace: 'qwen3-embedding-8b:mrl-512:l2-v1', dimensions: 512,
    index: { ready: true, vectorCount: 2, createdAt: null },
  }, reason: /required scan window protocol/ },
];

for (const backend of unavailableBackends) {
  test(`preserves frozen custom graphs and reading with ${backend.name}`, async ({ page, context }) => {
    const owner = 'https://owner.example';
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue() : route.abort());
    await page.route(`${owner}/api/lexiconforge/semantic-oscilloscope/capability?*`, route =>
      route.fulfill({ status: backend.status, json: backend.body }));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).useAppStore?.getState().isInitialized);
    await page.evaluate(async ({ payload, owner }) => {
      const store = (window as any).useAppStore;
      await store.getState().importSessionData({ ...payload, oscilloscope: { ...payload.oscilloscope,
        threads: [{ ...payload.oscilloscope.threads[0], threadId: 'custom:frozen', category: 'custom' }],
        activeThreadIds: ['custom:frozen'],
      } });
      store.setState({ settings: { ...store.getState().settings, indrasNetBaseUrl: owner, preloadCount: 0 } });
    }, { payload: fixture, owner });
    await expect(page.locator('[data-translation-content]')).toContainText('Synthetic chapter 1.');
    await page.locator('.oscilloscope-panel canvas').click();
    await page.getByRole('button', { name: 'Threads', exact: true }).click();
    await expect(page.getByText(backend.reason)).toBeVisible();
    await page.getByRole('button', { name: /^Custom\s*\(1\)$/ }).click();
    await expect(page.getByRole('button', { name: /Trust.*2 ch/ })).toBeVisible();
    await expect(page.getByPlaceholder('e.g. reluctant trust becoming intimacy')).toHaveCount(0);
    const exported = JSON.parse(await page.evaluate(() => (window as any).useAppStore.getState().exportSessionData()));
    expect(exported.oscilloscope.threads[0].values).toEqual([0.2, 0.7]);
    expect(context.pages()).toHaveLength(1);
  });
}
