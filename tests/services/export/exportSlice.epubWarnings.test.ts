/**
 * exportEpub warning-surface tests.
 *
 * Two integrity fixes are red-proofed here:
 *
 * 1. Never-generated illustrations: an illustration with neither a cache key
 *    nor a legacy URL used to return null silently (the cache-MISS path warned,
 *    the never-GENERATED path did not), and the chapter builder then removed
 *    the placeholder — the image vanished from the EPUB without a trace in the
 *    export warning counter.
 *
 * 2. Packager warnings: generateEpub3WithJSZip collected structured warnings
 *    (missing title, invalid cover, XHTML parse errors) into a local array
 *    nobody consumed. They are now forwarded via options.onWarning into the
 *    same recordWarning counter + completion message.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/db/operations', () => ({
  SessionExportOps: { exportFullSession: vi.fn() },
  SettingsOps: { getKey: vi.fn() },
  TranslationOps: { getActiveByStableId: vi.fn() },
}));

vi.mock('../../../services/db/operations/rendering', () => ({
  fetchChaptersForReactRendering: vi.fn(),
}));

vi.mock('../../../services/epubService', () => ({
  generateEpub: vi.fn(),
  getDefaultTemplate: vi.fn(() => ({
    gratitudeMessage: 'g',
    projectDescription: 'p',
    githubUrl: 'u',
    additionalAcknowledgments: 'a',
    customFooter: ''
  })),
}));

import { createExportSlice, ExportProgress } from '../../../store/slices/exportSlice';
import { telemetryService } from '../../../services/telemetryService';
import { SettingsOps, TranslationOps } from '../../../services/db/operations';
import { fetchChaptersForReactRendering } from '../../../services/db/operations/rendering';
import { generateEpub } from '../../../services/epubService';

const mockedFetchChapters = vi.mocked(fetchChaptersForReactRendering);
const mockedGetActive = vi.mocked(TranslationOps.getActiveByStableId);
const mockedGetKey = vi.mocked(SettingsOps.getKey);
const mockedGenerateEpub = vi.mocked(generateEpub);

const buildHarness = () => {
  const progressLog: Array<ExportProgress | null> = [];
  const state: any = {
    settings: {
      provider: 'Gemini',
      model: 'gemini-2.5-flash',
      includeTitlePage: true,
      includeStatsPage: true
    },
    imageVersions: {},
    activeImageVersion: {},
    chapters: new Map(),
  };
  const set = (partial: any) =>
    Object.assign(state, typeof partial === 'function' ? partial(state) : partial);
  const get = () => state;
  Object.assign(state, createExportSlice(set as any, get as any, {} as any));
  // Record progress updates instead of writing through zustand
  state.setExportProgress = (progress: ExportProgress | null) => {
    progressLog.push(progress);
  };
  return { state, progressLog };
};

describe('exportEpub warning surfacing', () => {
  let captureWarning: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    captureWarning = vi.spyOn(telemetryService, 'captureWarning').mockImplementation(() => {});
    vi.spyOn(telemetryService, 'capturePerformance').mockImplementation(() => {});
    mockedGetKey.mockResolvedValue(null);
    mockedFetchChapters.mockResolvedValue([
      {
        stableId: 's1',
        id: 'c1',
        title: 'Chapter One',
        url: 'https://example.com/ch1',
        chapterNumber: 1,
      } as any,
    ]);
    mockedGenerateEpub.mockResolvedValue(undefined);
  });

  it('records an illustration-never-generated warning and counts it in the completion message', async () => {
    mockedGetActive.mockResolvedValue({
      translation: 'Some translated text with [ILLUSTRATION-1] marker.',
      translatedTitle: 'Chapter One (translated)',
      footnotes: [],
      // Neither imageCacheKey nor legacy url: the illustration was never generated
      suggestedIllustrations: [
        { placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'a dramatic scene' }
      ],
    } as any);

    const { state, progressLog } = buildHarness();
    await state.exportEpub();

    expect(captureWarning).toHaveBeenCalledWith(
      'export-epub',
      expect.stringContaining('never generated'),
      expect.objectContaining({
        type: 'illustration-never-generated',
        marker: '[ILLUSTRATION-1]',
        chapterStableId: 's1',
      })
    );

    const done = progressLog.find(p => p?.phase === 'done');
    expect(done?.message).toContain('1 warning');
  });

  it('a keyed cache MISS records image-cache-miss only — never-generated must not double-count (codex review)', async () => {
    mockedGetActive.mockResolvedValue({
      translation: 'Text with [ILLUSTRATION-1].',
      translatedTitle: 'Chapter One (translated)',
      footnotes: [],
      // HAS a cache key, but the blob lookup will miss and there is no legacy url.
      suggestedIllustrations: [
        { placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'scene', imageCacheKey: 'k1' }
      ],
    } as any);

    const { state, progressLog } = buildHarness();
    await state.exportEpub();

    const types = captureWarning.mock.calls.map((c) => (c[2] as any)?.type);
    expect(types).toContain('image-cache-miss');
    expect(types).not.toContain('illustration-never-generated');

    const done = progressLog.find(p => p?.phase === 'done');
    expect(done?.message).toContain('1 warning');
  });

  it('surfaces packager warnings from generateEpub via onWarning into the counter and message', async () => {
    mockedGetActive.mockResolvedValue({
      translation: 'Plain text, no illustrations.',
      translatedTitle: 'Chapter One (translated)',
      footnotes: [],
      suggestedIllustrations: [],
    } as any);
    mockedGenerateEpub.mockImplementation(async (options: any) => {
      // Simulate the packager reporting a structural problem
      options.onWarning?.({
        type: 'missing-title',
        message: 'EPUB package metadata is missing a title.'
      });
    });

    const { state, progressLog } = buildHarness();
    await state.exportEpub();

    expect(captureWarning).toHaveBeenCalledWith(
      'export-epub',
      'EPUB package metadata is missing a title.',
      expect.objectContaining({
        type: 'epub-package-warning',
        details: expect.objectContaining({ packagerType: 'missing-title' }),
      })
    );

    const done = progressLog.find(p => p?.phase === 'done');
    expect(done?.message).toContain('1 warning');
  });

  it('reports a clean completion message when nothing went wrong', async () => {
    mockedGetActive.mockResolvedValue({
      translation: 'Plain text.',
      translatedTitle: 'Chapter One (translated)',
      footnotes: [],
      suggestedIllustrations: [],
    } as any);

    const { state, progressLog } = buildHarness();
    await state.exportEpub();

    expect(captureWarning).not.toHaveBeenCalled();
    const done = progressLog.find(p => p?.phase === 'done');
    expect(done?.message).toBe('EPUB export complete!');
  });
});
