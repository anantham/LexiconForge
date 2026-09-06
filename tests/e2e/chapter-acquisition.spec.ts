import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';

// Synthetic publication, real downloader/import/IndexedDB/reader. No model calls.
const base = 'https://chapter-qa.example';
const novelId = 'chapter-qa';
const chapters = [1, 2].map(chapterNumber => ({
  stableId: `qa-ch${chapterNumber}`, chapterNumber,
  canonicalUrl: `lexiconforge://${novelId}/chapter/${chapterNumber}`,
  title: `Chapter ${chapterNumber}`, content: `Original QA chapter ${chapterNumber}.`,
  fanTranslation: `Readable QA chapter ${chapterNumber}.`, translations: [],
}));
const artifacts = chapters.map(chapter => JSON.stringify({
  format: 'lexiconforge-chapter-artifact', version: '1.0', novelId, versionId: 'v1', chapter,
}));
const manifest = {
  format: 'lexiconforge-chapter-manifest', version: '1.0', novelId, versionId: 'v1',
  generatedAt: '2026-09-06T00:00:00Z', expectedChapterCount: 2, publishedChapterCount: 2,
  session: { url: `${base}/qa/session.json`, byteLength: 1, sha256: 'a'.repeat(64) },
  chapters: chapters.map((chapter, index) => ({
    chapterNumber: chapter.chapterNumber, stableId: chapter.stableId,
    canonicalUrl: chapter.canonicalUrl,
    artifact: {
      url: `${base}/qa/chapter-${chapter.chapterNumber}.json`,
      byteLength: Buffer.byteLength(artifacts[index]),
      sha256: createHash('sha256').update(artifacts[index]).digest('hex'),
    },
  })),
};
const metadata = {
  id: novelId, title: 'Chapter QA',
  metadata: {
    chapterCount: 2, originalLanguage: 'English', genres: [],
    description: 'Synthetic navigation QA', lastUpdated: '2026-09-06',
  },
  versions: [{
    versionId: 'v1', displayName: 'QA v1', translator: { name: 'QA' },
    sessionJsonUrl: manifest.session.url, chapterManifestUrl: `${base}/qa/manifest.json`,
    targetLanguage: 'English', style: 'other', features: [],
    chapterRange: { from: 1, to: 2 }, completionStatus: 'Complete', lastUpdated: '2026-09-06',
    stats: {
      fileSize: '1KB', content: { totalRawChapters: 2, totalTranslatedChapters: 2 },
      translation: { translationType: 'human', feedbackCount: 0 },
    },
  }],
};

for (const destination of ['another-book', 'another-version', 'library']) {
  test(`a completed chapter download cannot take over ${destination}`, async ({ page }) => {
    let release!: () => void;
    let requested!: () => void;
    const arrived = new Promise<void>(resolve => { requested = resolve; });
    const hold = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/*', async route => {
      const url = route.request().url();
      if (url.endsWith('/registry.json')) return route.fulfill({ json: {
        version: '1.0', lastUpdated: '2026-09-06',
        novels: [{ id: novelId, metadataUrl: `${base}/qa/metadata.json` }],
      } });
      if (url.endsWith('/qa/metadata.json')) return route.fulfill({ json: metadata });
      if (url.endsWith('/qa/manifest.json')) return route.fulfill({ json: manifest });
      if (url.endsWith('/qa/chapter-2.json')) {
        requested();
        await hold;
        return route.fulfill({ body: artifacts[1], contentType: 'application/json' });
      }
      if (new URL(url).hostname === '127.0.0.1') return route.continue();
      return route.abort();
    });
    await page.goto('/');
    await page.waitForFunction(() => (window as any).useAppStore?.getState().isInitialized);
    await page.evaluate(async ({ chapter, novelId }) => {
      const store = (window as any).useAppStore;
      store.setState({ settings: { ...store.getState().settings, preloadCount: 0 } });
      store.getState().setViewMode('original');
      await store.getState().importSessionData({
        metadata: { format: 'lexiconforge-session', version: '2.0' },
        novel: { id: novelId, title: 'Chapter QA' },
        version: { versionId: 'v1', displayName: 'QA v1' }, chapters: [chapter], settings: {},
      });
    }, { chapter: chapters[0], novelId });
    await expect(page.locator('#chapter-select')).toBeVisible();
    await expect(page.locator('option', { hasText: 'download on select' })).toHaveCount(1);
    // Keep the actual navigation promise so assertions run after every await,
    // including its post-import hydration, rather than passing before completion.
    const navigation = page.evaluate(url =>
      (window as any).useAppStore.getState().handleNavigate(url), chapters[1].canonicalUrl);
    await arrived;
    try {
      await page.evaluate(({ destination, novelId }) => {
        const store = (window as any).useAppStore;
        if (destination === 'library') store.getState().shelveActiveNovel();
        else store.getState().openNovel(destination === 'another-book' ? 'another-book' : novelId, 'v2');
      }, { destination, novelId });
      const snapshot = () => page.evaluate(() => {
        const state = (window as any).useAppStore.getState();
        return {
          novelId: state.activeNovelId, versionId: state.activeVersionId,
          chapterId: state.currentChapterId, screen: state.appScreen,
          chapters: [...state.chapters.keys()], history: state.navigationHistory,
          url: location.href,
        };
      });
      const before = await snapshot();
      release();
      await navigation;
      expect(await snapshot()).toEqual(before);
    } finally {
      release();
      await navigation;
    }
  });
}
