import { beforeEach, expect, it, vi } from 'vitest';
import { useAppStore } from '../../store';
import { ChapterOps, ImportOps } from '../../services/db/operations';
import { getConnection } from '../../services/db/core/connection';
import { loadNovelIntoStore } from '../../services/readerHydrationService';
import { ExportService } from '../../services/exportService';
import { cacheOscilloscope, restoreCachedOscilloscope } from '../../services/semanticOscilloscopeCache';
import { computeSemanticCorpusIdentity, createSessionOscilloscope } from '../../services/semanticOscilloscopeSession';
import type { SessionData } from '../../types/session';

// Exercise the real import, hydration and export operations against fake-indexeddb's
// actual indexes. Mocked rendering records previously hid the lost version scope.
const fixture = async (id = 'book-a', versionId = 'v1'): Promise<SessionData> => {
  const session: SessionData = {
    metadata: { format: 'lexiconforge-session', version: '2.0', exportedAt: '2026-09-05T00:00:00Z' },
    novel: { id, title: id },
    version: { versionId, displayName: versionId, style: 'other', features: [] },
    chapters: [1, 2].map(chapterNumber => ({
      stableId: `chapter-${chapterNumber}`, canonicalUrl: `https://example.invalid/${id}/${chapterNumber}`,
      chapterNumber, title: `Chapter ${chapterNumber}`, content: `${id} ${versionId} source ${chapterNumber}`,
      translations: [{ version: 1, isActive: true, translation: `${id} ${versionId} translation ${chapterNumber}` }],
    })),
  };
  const corpus = await computeSemanticCorpusIdentity(session);
  session.oscilloscope = createSessionOscilloscope(corpus, new Map([['tone:trust', {
    threadId: 'tone:trust', category: 'tone', label: 'Trust', color: '#ef4444',
    values: [0.2, 0.7], totalChapters: 2, provenance: { origin: 'precomputed', method: 'synthetic' },
  }]]), new Set(['tone:trust']));
  return session;
};

beforeEach(async () => {
  const db = await getConnection();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(Array.from(db.objectStoreNames), 'readwrite');
    for (const name of Array.from(db.objectStoreNames)) tx.objectStore(name).clear();
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  useAppStore.getState().resetOscilloscope();
  useAppStore.setState({ viewMode: 'original', chapters: new Map(), activeNovelId: null, activeVersionId: null, currentChapterId: null });
});

it('round-trips an ordinary portable export without extra top-level scope fields', async () => {
  const session = await fixture();
  await useAppStore.getState().importSessionData(session);
  expect(await ChapterOps.getByNovelAndVersion('book-a', 'v1')).toHaveLength(2);
  expect(useAppStore.getState().corpusIdentity).toEqual(session.oscilloscope!.corpus);
  expect(useAppStore.getState().activeNovelId).toBe('book-a');
  expect(useAppStore.getState().activeVersionId).toBe('v1');
  const exported = await ExportService.generateQuickExport();
  expect(exported.oscilloscope).toEqual(session.oscilloscope);
  useAppStore.getState().resetOscilloscope();
  await useAppStore.getState().importSessionData(exported);
  expect(useAppStore.getState().threads.get('tone:trust')?.values).toEqual([0.2, 0.7]);
});

it.each([null, 'v1'])('restores a departed graph for library selection %s and rejects changed text', async (selection) => {
  const session = await fixture();
  // Streaming registry import stores a nullable library selection independently
  // of the concrete version named by the portable graph.
  await ImportOps.importFullSessionData({ ...session, novelId: 'book-a', libraryVersionId: selection });
  await loadNovelIntoStore('book-a', useAppStore.setState, { versionId: selection });
  useAppStore.setState({ activeNovelId: 'book-a', activeVersionId: selection });
  useAppStore.getState().loadSessionOscilloscope(session.oscilloscope!);
  expect(useAppStore.getState().chapters.size).toBe(2);
  cacheOscilloscope(useAppStore.getState());
  useAppStore.getState().resetOscilloscope();
  const restored = await restoreCachedOscilloscope(new AbortController().signal);
  expect(restored).toBe(true);
  expect(useAppStore.getState().threads.get('tone:trust')?.values).toEqual([0.2, 0.7]);
  const exported = await ExportService.generateQuickExport();
  expect(exported.oscilloscope).toEqual(session.oscilloscope);
  await useAppStore.getState().importSessionData(exported);
  expect(useAppStore.getState().threads.get('tone:trust')?.values).toEqual([0.2, 0.7]);

  useAppStore.getState().resetOscilloscope();
  useAppStore.setState({ activeVersionId: selection });
  await loadNovelIntoStore('book-a', useAppStore.setState, { versionId: selection });
  const chapter = [...useAppStore.getState().chapters.values()][0];
  useAppStore.getState().updateChapter(chapter.id, { fanTranslation: 'changed', translationResult: null });
  expect(await restoreCachedOscilloscope(new AbortController().signal)).toBe(false);
  expect(useAppStore.getState().threads.size).toBe(0);
  useAppStore.setState({ activeVersionId: 'v2' });
  expect(await restoreCachedOscilloscope(new AbortController().signal)).toBe(false);
});

it('scopes quick, publish and fork exports before loading translations from other cached books', async () => {
  const session = await fixture();
  for (const payload of [session, await fixture('book-b'), await fixture('book-a', 'v2')]) {
    await ImportOps.importFullSessionData({ ...payload, novelId: payload.novel.id, libraryVersionId: payload.version.versionId });
  }
  await loadNovelIntoStore('book-a', useAppStore.setState, { versionId: 'v1' });
  useAppStore.setState({ activeNovelId: 'book-a', activeVersionId: 'v1',
    sessionVersion: session.version,
    sessionProvenance: { originalCreator: { name: 'Fixture', versionId: 'v1', createdAt: '2026-09-05' }, contributors: [] },
  });
  useAppStore.getState().loadSessionOscilloscope(session.oscilloscope!);
  const quick = await ExportService.generateQuickExport();
  const published = await ExportService.generatePublishExport(
    { ...session.novel, author: 'Fixture', originalLanguage: 'English' },
    { ...session.version, translator: { name: 'Fixture' } },
  );
  const fork = await ExportService.generateForkExport({ ...session.version, versionId: 'fork-v1', translator: { name: 'Fixture' } });
  for (const exported of [quick, published, fork]) {
    expect(exported.chapters).toHaveLength(2);
    expect(exported.chapters.map(ch => ch.translations[0].translation)).toEqual(session.chapters.map(ch => ch.translations[0].translation));
  }
  expect(quick.oscilloscope).toEqual(session.oscilloscope);
  expect(published.oscilloscope).toEqual(session.oscilloscope);
  expect(fork.oscilloscope).toBeUndefined(); // A fork has a new corpus identity.
  expect(await ChapterOps.getAll()).toHaveLength(6);
});

it('invalidates chapter deletion and insertion only when they affect the loaded graph', async () => {
  const session = await fixture();
  await ImportOps.importFullSessionData({ ...session, novelId: 'book-a', libraryVersionId: 'v1' });
  await loadNovelIntoStore('book-a', useAppStore.setState, { versionId: 'v1' });
  useAppStore.setState({ activeNovelId: 'book-a', activeVersionId: 'v1' });
  useAppStore.getState().loadSessionOscilloscope(session.oscilloscope!);
  const chapter = [...useAppStore.getState().chapters.values()][0];
  useAppStore.getState().importChapter({ ...chapter, id: 'unrelated', novelId: 'book-b' });
  useAppStore.getState().removeChapter('unrelated');
  useAppStore.getState().removeChapter('missing');
  expect(useAppStore.getState().corpusIdentity).toEqual(session.oscilloscope!.corpus);
  useAppStore.getState().removeChapter(chapter.id);
  expect(useAppStore.getState().corpusIdentity).toBeNull();
  useAppStore.getState().loadSessionOscilloscope(session.oscilloscope!);
  useAppStore.getState().importChapter(chapter);
  expect(useAppStore.getState().corpusIdentity).toBeNull();
  useAppStore.getState().loadSessionOscilloscope(session.oscilloscope!);
  useAppStore.getState().clearAllChapters();
  expect(useAppStore.getState().corpusIdentity).toBeNull();
});

it.each([null, 'v1'])('retains every book in a full backup and restores its graph selection %s', async (selection) => {
  const session = await fixture();
  await ImportOps.importFullSessionData({ ...session, novelId: 'book-a', libraryVersionId: selection });
  const other = await fixture('book-b');
  other.chapters.forEach(chapter => { chapter.title = `Other book: ${chapter.title}`; });
  await ImportOps.importFullSessionData({ ...other, novelId: 'book-b', libraryVersionId: 'v1' });
  await loadNovelIntoStore('book-a', useAppStore.setState, { versionId: selection });
  useAppStore.setState({ activeNovelId: 'book-a', activeVersionId: selection });
  useAppStore.getState().loadSessionOscilloscope(session.oscilloscope!);
  const backup = JSON.parse(await useAppStore.getState().exportSessionData({ includeImages: false, includeTelemetry: false }));
  expect(backup.chapters).toHaveLength(4);
  expect(backup.oscilloscope).toEqual(session.oscilloscope);
  useAppStore.getState().resetOscilloscope();
  useAppStore.setState({ activeNovelId: 'book-b', activeVersionId: 'v1', chapters: new Map() });
  await useAppStore.getState().importSessionData(backup);
  expect(useAppStore.getState().chapters.size).toBe(4);
  expect(useAppStore.getState().activeNovelId).toBe('book-a');
  expect(useAppStore.getState().activeVersionId).toBe(selection);
  expect(useAppStore.getState().threads.get('tone:trust')?.values).toEqual([0.2, 0.7]);
});

it('finishes storing a delayed import without replacing a newer book selection', async () => {
  const session = await fixture();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const importFullSessionData = ImportOps.importFullSessionData;
  const delayed = vi.spyOn(ImportOps, 'importFullSessionData').mockImplementationOnce(async (...args) => {
    await gate;
    return importFullSessionData(...args);
  });
  try {
    useAppStore.getState().openNovel('book-a', 'v1');
    const importing = useAppStore.getState().importSessionData(session);
    useAppStore.getState().openNovel('book-b', 'v2');
    release();
    await importing;
    expect(await ChapterOps.getByNovelAndVersion('book-a', 'v1')).toHaveLength(2);
    expect(useAppStore.getState().activeNovelId).toBe('book-b');
    expect(useAppStore.getState().activeVersionId).toBe('v2');
    expect(useAppStore.getState().corpusIdentity).toBeNull();
  } finally {
    delayed.mockRestore();
  }
});

it('opens a readable chapter when a full backup has no frozen graph', async () => {
  await useAppStore.getState().importSessionData(await fixture());
  const backup = JSON.parse(await useAppStore.getState().exportSessionData({ includeImages: false, includeTelemetry: false }));
  delete backup.oscilloscope;
  useAppStore.getState().shelveActiveNovel();
  useAppStore.setState({ chapters: new Map(), currentChapterId: null });
  await useAppStore.getState().importSessionData(backup);
  const state = useAppStore.getState();
  expect(state.appScreen).toBe('reader');
  expect(state.chapters.get(state.currentChapterId!)?.chapterNumber).toBe(1);
  expect(state.corpusIdentity).toBeNull();
});
