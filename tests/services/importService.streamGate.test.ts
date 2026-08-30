// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { chapterOpsMock, translationOpsMock } = vi.hoisted(() => ({
  chapterOpsMock: {
    store: vi.fn(),
  },
  translationOpsMock: {
    store: vi.fn(),
    setActiveByUrl: vi.fn(),
    getVersionsByStableId: vi.fn(),
  },
}));

const importStoreState = vi.hoisted(() => ({
  importSessionData: vi.fn().mockResolvedValue(undefined),
  setSessionProvenance: vi.fn(),
  setSessionVersion: vi.fn(),
  chapters: new Map<string, any>(),
  currentChapterId: null as string | null,
  navigationHistory: [] as string[],
  error: null as string | null,
}));

const hydrationMocks = vi.hoisted(() => ({
  loadNovelIntoStore: vi.fn().mockResolvedValue('lf-library:test:ch1'),
  loadAllIntoStore: vi.fn().mockResolvedValue('lf-library:test:ch1'),
}));

/**
 * Regression guard for the "Opening Reader…" hang (2026-07-28).
 *
 * On the library path, onFirstChaptersReady is the ONLY thing that moves the
 * screen from 'reader-loading' to 'reader'. The first-batch threshold compares
 * chaptersLoaded against min(metadata.chapterCount, 10) — the NOVEL's total
 * (Aithihyamala advertises 126), not the session's. A packaged session with a
 * single built chapter therefore never reached the threshold, the callback
 * never fired, and the user sat on a spinner forever over a fully hydrated
 * store. The fix fires the callback at stream end whenever chapters arrived.
 */

vi.mock('../../store', () => ({
  useAppStore: {
    getState: vi.fn(() => importStoreState),
    setState: vi.fn((update: any) => {
      const patch = typeof update === 'function' ? update(importStoreState) : update;
      Object.assign(importStoreState, patch);
    }),
  },
}));

vi.mock('../../services/db/operations/chapters', () => ({
  ChapterOps: chapterOpsMock,
}));

vi.mock('../../services/db/operations/translations', () => ({
  TranslationOps: translationOpsMock,
}));

vi.mock('../../services/db/operations', () => ({
  SettingsOps: {
    getKey: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/readerHydrationService', () => ({
  loadNovelIntoStore: hydrationMocks.loadNovelIntoStore,
  loadAllIntoStore: hydrationMocks.loadAllIntoStore,
}));

vi.mock('../../services/telemetryService', () => ({
  telemetryService: { capturePerformance: vi.fn() },
}));

import { ImportService } from '../../services/importService';

const sessionWithOneChapter = {
  metadata: {
    format: 'lexiconforge-session',
    version: '2.0',
    exportedAt: '2026-07-01T00:00:00Z',
    // The NOVEL's advertised size — far above the session's actual content.
    chapterCount: 126,
  },
  novel: { id: 'aithihyamala', title: 'Aithihyamala' },
  chapters: [
    {
      url: 'lexiconforge://aithihyamala/chapter/64',
      canonicalUrl: 'lexiconforge://aithihyamala/chapter/64',
      title: 'The Ammathiruvadi of Urakam',
      content: 'ഊരകത്ത് അമ്മതിരുവടി…',
      chapterNumber: 64,
      translations: [
        {
          translatedTitle: 'The Ammathiruvadi of Urakam',
          translation: '<p>How a goddess rode a palm-leaf umbrella…</p>',
          provider: 'Claude',
          model: 'claude-opus-4-8',
          isActive: true,
        },
      ],
    },
  ],
};

const streamResponseOf = (data: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  return {
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  } as unknown as Response;
};

beforeEach(() => {
  chapterOpsMock.store.mockReset().mockResolvedValue(undefined);
  importStoreState.chapters = new Map();
  importStoreState.currentChapterId = null;
  importStoreState.navigationHistory = [];
  importStoreState.error = null;
  hydrationMocks.loadNovelIntoStore.mockReset().mockResolvedValue('lf-library:test:ch1');
  hydrationMocks.loadAllIntoStore.mockReset().mockResolvedValue('lf-library:test:ch1');
});

describe('streamImportFromUrl — first-chapters-ready gate', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponseOf(sessionWithOneChapter)));
    translationOpsMock.store.mockReset().mockResolvedValue({ id: 't1', version: 1 });
    translationOpsMock.setActiveByUrl.mockReset().mockResolvedValue(undefined);
    translationOpsMock.getVersionsByStableId.mockReset().mockResolvedValue([]);
  });

  it('fires onFirstChaptersReady for a session SMALLER than the first-batch threshold', async () => {
    const onFirstChaptersReady = vi.fn();

    await ImportService.streamImportFromUrl(
      'https://example.com/session.json',
      undefined,
      onFirstChaptersReady,
      { registryNovelId: 'aithihyamala', registryVersionId: 'v1-opus-draft' }
    );

    // Pre-fix: never called (1 chapter < min(126, 10) threshold) — the reader
    // never opened and the user sat on "Opening Reader…" forever.
    expect(onFirstChaptersReady).toHaveBeenCalledTimes(1);
  });

  it('still fires exactly once for a session that DOES cross the threshold', async () => {
    const bigSession = {
      ...sessionWithOneChapter,
      metadata: { ...sessionWithOneChapter.metadata, chapterCount: 12 },
      chapters: Array.from({ length: 12 }, (_, i) => ({
        ...sessionWithOneChapter.chapters[0],
        url: `lexiconforge://aithihyamala/chapter/${i + 1}`,
        canonicalUrl: `lexiconforge://aithihyamala/chapter/${i + 1}`,
        chapterNumber: i + 1,
      })),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponseOf(bigSession)));

    const onFirstChaptersReady = vi.fn();
    await ImportService.streamImportFromUrl(
      'https://example.com/session.json',
      undefined,
      onFirstChaptersReady,
      { registryNovelId: 'aithihyamala', registryVersionId: 'v1-opus-draft' }
    );

    expect(onFirstChaptersReady).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire when the stream contained no chapters', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(streamResponseOf({ ...sessionWithOneChapter, chapters: [] }))
    );

    const onFirstChaptersReady = vi.fn();
    await ImportService.streamImportFromUrl(
      'https://example.com/session.json',
      undefined,
      onFirstChaptersReady,
      { registryNovelId: 'aithihyamala', registryVersionId: 'v1-opus-draft' }
    );

    expect(onFirstChaptersReady).not.toHaveBeenCalled();
  });

  it('awaits the first-ready callback before processing later chapters', async () => {
    const fiveChapterSession = {
      ...sessionWithOneChapter,
      metadata: { ...sessionWithOneChapter.metadata, chapterCount: 5 },
      chapters: Array.from({ length: 5 }, (_, index) => ({
        ...sessionWithOneChapter.chapters[0],
        url: `lexiconforge://aithihyamala/chapter/${index + 1}`,
        canonicalUrl: `lexiconforge://aithihyamala/chapter/${index + 1}`,
        chapterNumber: index + 1,
        translations: [],
      })),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponseOf(fiveChapterSession)));

    let releaseReady!: () => void;
    const readyGate = new Promise<void>((resolve) => {
      releaseReady = resolve;
    });
    let signalReadyStarted!: () => void;
    const readyStarted = new Promise<void>((resolve) => {
      signalReadyStarted = resolve;
    });
    const onFirstChaptersReady = vi.fn(() => {
      signalReadyStarted();
      return readyGate;
    });

    const importPromise = ImportService.streamImportFromUrl(
      'https://example.com/session.json',
      undefined,
      onFirstChaptersReady,
      { registryNovelId: 'aithihyamala', registryVersionId: 'v1-opus-draft' }
    );

    await readyStarted;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(chapterOpsMock.store).toHaveBeenCalledTimes(4);

    releaseReady();
    await importPromise;
    expect(chapterOpsMock.store).toHaveBeenCalledTimes(5);
  });

  it('remaps an open scoped chapter to its authoritative revision after final hydration', async () => {
    importStoreState.currentChapterId = 'chapter-64-stale';
    importStoreState.chapters = new Map([
      ['chapter-64-stale', {
        id: 'chapter-64-stale',
        novelId: 'aithihyamala',
        libraryVersionId: 'v1-opus-draft',
        chapterNumber: 64,
      }],
    ]);
    hydrationMocks.loadNovelIntoStore.mockImplementationOnce(async (_novelId, setState) => {
      setState({
        chapters: new Map([
          ['chapter-64-current', {
            id: 'chapter-64-current',
            novelId: 'aithihyamala',
            libraryVersionId: 'v1-opus-draft',
            chapterNumber: 64,
          }],
        ]),
        urlIndex: new Map(),
        rawUrlIndex: new Map(),
      });
      return 'chapter-64-current';
    });

    await ImportService.streamImportFromUrl(
      'https://example.com/session.json',
      undefined,
      undefined,
      { registryNovelId: 'aithihyamala', registryVersionId: 'v1-opus-draft' }
    );

    expect(importStoreState.currentChapterId).toBe('chapter-64-current');
  });
});

describe('streamImportFromUrl — translation-loss telemetry (2026-07-28 race)', () => {
  beforeEach(() => {
    translationOpsMock.store.mockReset().mockResolvedValue({ id: 't1', version: 1 });
    translationOpsMock.setActiveByUrl.mockReset().mockResolvedValue(undefined);
    translationOpsMock.getVersionsByStableId.mockReset().mockResolvedValue([]);
  });

  it('a failed translation store does NOT abort the import and is loudly accounted', async () => {
    const { TranslationOps } = await import('../../services/db/operations/translations');
    const { telemetryService } = await import('../../services/telemetryService');
    (TranslationOps.store as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('tx aborted'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponseOf(sessionWithOneChapter)));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const onFirstChaptersReady = vi.fn();
    await ImportService.streamImportFromUrl(
      'https://example.com/session.json',
      undefined,
      onFirstChaptersReady,
      { registryNovelId: 'aithihyamala', registryVersionId: 'v1-opus-draft' }
    );

    // Import survives (the chapter is still readable in original view)…
    expect(onFirstChaptersReady).toHaveBeenCalledTimes(1);
    // …but the loss is loud: console + a dedicated telemetry event.
    expect(consoleError.mock.calls.some(c => String(c[0]).includes('Translation store FAILED'))).toBe(true);
    const events = (telemetryService.capturePerformance as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(events).toContain('import:stream:translationStoreFailed');
    consoleError.mockRestore();
  });

  it('read-back verification flags a store that resolved without persisting', async () => {
    const { TranslationOps } = await import('../../services/db/operations/translations');
    const { telemetryService } = await import('../../services/telemetryService');
    // store() RESOLVES (the observed race: no error, no row)…
    (TranslationOps.store as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 't1', version: 1 });
    // …but the database holds nothing on read-back.
    (TranslationOps as any).getVersionsByStableId = vi.fn().mockResolvedValue([]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponseOf(sessionWithOneChapter)));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await ImportService.streamImportFromUrl(
      'https://example.com/session.json',
      undefined,
      undefined,
      { registryNovelId: 'aithihyamala', registryVersionId: 'v1-opus-draft' }
    );

    expect(consoleError.mock.calls.some(c => String(c[0]).includes('VERIFY mismatch'))).toBe(true);
    const events = (telemetryService.capturePerformance as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(events).toContain('import:stream:translationVerifyMissing');
    consoleError.mockRestore();
  });
});

describe('streamImportFromUrl — idempotent resume', () => {
  beforeEach(() => {
    translationOpsMock.store.mockReset().mockResolvedValue({ id: 'new', version: 2 });
    translationOpsMock.setActiveByUrl.mockReset().mockResolvedValue(undefined);
    translationOpsMock.getVersionsByStableId.mockReset().mockResolvedValue([
      {
        id: 'existing',
        version: 1,
        isActive: true,
        translatedTitle: 'The Ammathiruvadi of Urakam',
        translation: '<p>How a goddess rode a palm-leaf umbrella…</p>',
        provider: 'Claude',
        model: 'claude-opus-4-8',
        footnotes: [],
        suggestedIllustrations: [],
        proposal: null,
      },
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponseOf(sessionWithOneChapter)));
  });

  it('reuses an exact packaged translation instead of creating a duplicate version', async () => {
    await ImportService.streamImportFromUrl(
      'https://example.com/session.json',
      undefined,
      undefined,
      { registryNovelId: 'aithihyamala', registryVersionId: 'v1-opus-draft' }
    );

    expect(translationOpsMock.store).not.toHaveBeenCalled();
    expect(translationOpsMock.setActiveByUrl).toHaveBeenCalledWith(
      expect.stringContaining('lf-library:'),
      1
    );
  });

  it('consumes reused translations one-to-one when packaged versions have identical content', async () => {
    const identicalVersionsSession = {
      ...sessionWithOneChapter,
      chapters: [
        {
          ...sessionWithOneChapter.chapters[0],
          translations: [
            {
              ...sessionWithOneChapter.chapters[0].translations[0],
              version: 1,
              isActive: false,
            },
            {
              ...sessionWithOneChapter.chapters[0].translations[0],
              version: 2,
              isActive: true,
            },
          ],
        },
      ],
    };
    const existingVersion = {
      id: 'existing-v1',
      version: 1,
      isActive: true,
      translatedTitle: 'The Ammathiruvadi of Urakam',
      translation: '<p>How a goddess rode a palm-leaf umbrella…</p>',
      provider: 'Claude',
      model: 'claude-opus-4-8',
      footnotes: [],
      suggestedIllustrations: [],
      proposal: null,
    };
    const storedVersion = { ...existingVersion, id: 'new-v2', version: 2, isActive: false };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponseOf(identicalVersionsSession)));
    translationOpsMock.store.mockResolvedValue({ id: 'new-v2', version: 2 });
    translationOpsMock.getVersionsByStableId
      .mockReset()
      .mockResolvedValueOnce([existingVersion])
      .mockResolvedValueOnce([existingVersion, storedVersion]);

    await ImportService.streamImportFromUrl(
      'https://example.com/session.json',
      undefined,
      undefined,
      { registryNovelId: 'aithihyamala', registryVersionId: 'v1-opus-draft' }
    );

    expect(translationOpsMock.store).toHaveBeenCalledTimes(1);
    expect(translationOpsMock.setActiveByUrl).toHaveBeenCalledWith(
      expect.stringContaining('lf-library:'),
      2
    );
  });

  it('falls back to an unused exact-content row when local version numbers diverge', async () => {
    const versionedSession = {
      ...sessionWithOneChapter,
      chapters: [
        {
          ...sessionWithOneChapter.chapters[0],
          translations: [
            {
              ...sessionWithOneChapter.chapters[0].translations[0],
              version: 1,
              isActive: true,
            },
          ],
        },
      ],
    };
    const divergedExactVersion = {
      id: 'existing-local-v2',
      version: 2,
      isActive: false,
      translatedTitle: 'The Ammathiruvadi of Urakam',
      translation: '<p>How a goddess rode a palm-leaf umbrella…</p>',
      provider: 'Claude',
      model: 'claude-opus-4-8',
      footnotes: [],
      suggestedIllustrations: [],
      proposal: null,
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponseOf(versionedSession)));
    translationOpsMock.getVersionsByStableId.mockReset().mockResolvedValue([divergedExactVersion]);

    await ImportService.streamImportFromUrl(
      'https://example.com/session.json',
      undefined,
      undefined,
      { registryNovelId: 'aithihyamala', registryVersionId: 'v1-opus-draft' }
    );

    expect(translationOpsMock.store).not.toHaveBeenCalled();
    expect(translationOpsMock.setActiveByUrl).toHaveBeenCalledWith(
      expect.stringContaining('lf-library:'),
      2
    );
  });
});
