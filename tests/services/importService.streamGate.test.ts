// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    getState: vi.fn(() => ({
      importSessionData: vi.fn().mockResolvedValue(undefined),
      setSessionProvenance: vi.fn(),
      setSessionVersion: vi.fn(),
      chapters: new Map(),
      currentChapterId: null,
    })),
    setState: vi.fn(),
  },
}));

vi.mock('../../services/db/operations/chapters', () => ({
  ChapterOps: { store: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../services/db/operations/translations', () => ({
  TranslationOps: {
    store: vi.fn().mockResolvedValue({ id: 't1', version: 1 }),
    setActiveByUrl: vi.fn().mockResolvedValue(undefined),
    getVersionsByStableId: vi.fn().mockResolvedValue([{ id: 't1', version: 1 }]),
  },
}));

vi.mock('../../services/db/operations', () => ({
  SettingsOps: {
    getKey: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/readerHydrationService', () => ({
  loadNovelIntoStore: vi.fn().mockResolvedValue('lf-library:test:ch1'),
  loadAllIntoStore: vi.fn().mockResolvedValue('lf-library:test:ch1'),
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

describe('streamImportFromUrl — first-chapters-ready gate', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponseOf(sessionWithOneChapter)));
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
});

describe('streamImportFromUrl — translation-loss telemetry (2026-07-28 race)', () => {
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
