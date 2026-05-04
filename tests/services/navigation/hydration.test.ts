/**
 * Regression test for issue #17 — `loadChapterFromIDB` must populate
 * chapter.feedback from IDB on hydration.
 *
 * Pre-fix: loadChapterFromIDB never called FeedbackOps.get; chapter.feedback
 * was always [] on hydration. Comments stored under that chapterUrl in IDB
 * were invisible to the reader UI.
 *
 * Post-fix: feedback records are loaded and converted to FeedbackItem shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks for the operations consumed by loadChapterFromIDB
const chapterOpsMock = vi.hoisted(() => ({
  getByStableId: vi.fn(),
}));
const translationOpsMock = vi.hoisted(() => ({
  ensureActiveByStableId: vi.fn().mockResolvedValue(null),
}));
const diffOpsMock = vi.hoisted(() => ({
  get: vi.fn(),
  findByHashes: vi.fn(),
}));
const feedbackOpsMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('../../../services/db/operations', () => ({
  ChapterOps: chapterOpsMock,
  TranslationOps: translationOpsMock,
  DiffOps: diffOpsMock,
  FeedbackOps: feedbackOpsMock,
  feedbackRecordToItem: (r: any) => ({
    id: r.id,
    text: r.comment,
    category: r.type,
    timestamp: new Date(r.createdAt).getTime(),
    chapterId: r.chapterUrl,
    selection: r.selection,
    type: r.type === 'positive' ? '👍' : r.type === 'negative' ? '👎' : '?',
    comment: r.comment,
  }),
}));

vi.mock('../../../services/db/index', () => ({
  getRepoForService: vi.fn(),
}));

vi.mock('../../../services/stableIdService', () => ({
  normalizeUrlAggressively: (s: string) => s,
  buildEnhancedChapter: (id: string, rec: any) => ({
    id,
    stableId: id,
    novelId: rec.novelId ?? null,
    libraryVersionId: rec.libraryVersionId ?? null,
    url: rec.url,
    title: rec.title || 'Untitled',
    content: rec.content || '',
    originalUrl: rec.originalUrl || rec.url || '',
    canonicalUrl: rec.canonicalUrl || rec.url || '',
    nextUrl: rec.nextUrl ?? null,
    prevUrl: rec.prevUrl ?? null,
    chapterNumber: rec.chapterNumber || 0,
    sourceUrls: [rec.url],
    importSource: { originalUrl: rec.url, importDate: new Date(), sourceFormat: 'json' },
    fanTranslation: null,
    suttaStudio: null,
    translationResult: null,
    feedback: [],
  }),
}));

vi.mock('../../../utils/memoryDiagnostics', () => ({
  memoryDetail: vi.fn(),
  memoryTimestamp: () => 0,
  memoryTiming: () => 0,
}));
vi.mock('../../../services/telemetryService', () => ({
  telemetryService: { capturePerformance: vi.fn() },
}));
vi.mock('../../../utils/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}));
vi.mock('../../../services/diff/hash', () => ({ computeDiffHash: () => 'h' }));
vi.mock('../../../services/diff/constants', () => ({ DIFF_ALGO_VERSION: 1 }));
vi.mock('../../../services/navigation/converters', () => ({
  adaptTranslationRecordToResult: vi.fn().mockReturnValue(null),
}));
vi.mock('../../../services/navigation/logging', () => ({
  slog: vi.fn(),
  swarn: vi.fn(),
}));

import { loadChapterFromIDB } from '../../../services/navigation/hydration';

describe('loadChapterFromIDB — feedback hydration (issue #17)', () => {
  const chapterId = 'stable-test-17';
  const chapterUrl = 'https://example.com/ch/17';

  beforeEach(() => {
    vi.clearAllMocks();
    chapterOpsMock.getByStableId.mockResolvedValue({
      url: chapterUrl,
      canonicalUrl: chapterUrl,
      title: 'Test Chapter',
      content: 'raw text',
      chapterNumber: 1,
      stableId: chapterId,
      novelId: null,
      libraryVersionId: null,
    });
  });

  it('loads feedback records from IDB into chapter.feedback', async () => {
    feedbackOpsMock.get.mockResolvedValue([
      {
        id: 'fb-1',
        chapterUrl,
        type: 'positive',
        selection: 'fox jumps',
        comment: 'I liked this',
        createdAt: '2026-04-01T12:00:00.000Z',
      },
      {
        id: 'fb-2',
        chapterUrl,
        type: 'suggestion',
        selection: 'lazy dog',
        comment: 'unclear referent',
        createdAt: '2026-04-02T12:00:00.000Z',
      },
    ]);

    const result = await loadChapterFromIDB(chapterId, vi.fn());

    expect(feedbackOpsMock.get).toHaveBeenCalledWith(chapterUrl);
    expect(result).not.toBeNull();
    expect(result!.feedback).toHaveLength(2);
    expect(result!.feedback[0].id).toBe('fb-1');
    expect(result!.feedback[0].selection).toBe('fox jumps');
    expect(result!.feedback[0].comment).toBe('I liked this');
    expect(result!.feedback[0].type).toBe('👍');
    expect(result!.feedback[1].type).toBe('?');
  });

  it('returns empty feedback when none exists in IDB', async () => {
    feedbackOpsMock.get.mockResolvedValue([]);

    const result = await loadChapterFromIDB(chapterId, vi.fn());

    expect(feedbackOpsMock.get).toHaveBeenCalledWith(chapterUrl);
    expect(result).not.toBeNull();
    expect(result!.feedback).toEqual([]);
  });

  it('does not throw when FeedbackOps.get rejects', async () => {
    feedbackOpsMock.get.mockRejectedValue(new Error('IDB transaction failed'));

    const result = await loadChapterFromIDB(chapterId, vi.fn());

    expect(result).not.toBeNull();
    expect(result!.feedback).toEqual([]);
  });
});
