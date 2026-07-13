import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/aiService', () => ({
  translateChapter: vi.fn(),
  validateApiKey: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  findByUrl: vi.fn().mockResolvedValue(null),
  getFeedback: vi.fn().mockResolvedValue([]),
  ensureActiveByStableId: vi.fn().mockResolvedValue(null),
  getVersionsByUrl: vi.fn().mockResolvedValue([]),
}));

// feedback.ts only touches the repository inside FeedbackOps methods, so stubbing it lets the
// mock below hand translationService the REAL converter — which is the point: this suite has to
// fail if translationService ever goes back to converting feedback records itself.
vi.mock('../../services/db/repositories/instances', () => ({ feedbackRepository: {} }));

vi.mock('../../services/db/operations', async () => {
  const { feedbackRecordToItem } = await vi.importActual<any>('../../services/db/operations/feedback');
  return {
    ChapterOps: { findByUrl: dbMocks.findByUrl },
    FeedbackOps: { get: dbMocks.getFeedback },
    TranslationOps: {
      ensureActiveByStableId: dbMocks.ensureActiveByStableId,
      getVersionsByUrl: dbMocks.getVersionsByUrl,
    },
    feedbackRecordToItem,
  };
});

vi.mock('../../utils/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}));

import { TranslationService } from '../../services/translationService';
import type { EnhancedChapter } from '../../services/stableIdService';

/** A chapter that resolves entirely from the in-memory map, so the walk never touches the DB. */
const mem = (n: number): EnhancedChapter => ({
  id: `stable-${n}`,
  title: `Chapter ${n}`,
  content: `Source ${n}`,
  chapterNumber: n,
  originalUrl: `https://example.com/ch-${n}`,
  canonicalUrl: `https://example.com/ch-${n}`,
  prevUrl: n > 1 ? `https://example.com/ch-${n - 1}` : null,
  nextUrl: `https://example.com/ch-${n + 1}`,
  translationResult: {
    translatedTitle: `Translated ${n}`,
    translation: `Translated body ${n}`,
    footnotes: [],
  },
} as unknown as EnhancedChapter);

describe('buildHistoryByPrevUrlChain', () => {
  it('returns prior chapters OLDEST first', async () => {
    // The walk follows prevUrl backward from the current chapter, so it collects newest-first.
    // Everything downstream expects oldest-first: the primary history path sorts ascending by
    // chapter number, and the prompt labels entry 1 "(OLDEST)". Returning the raw walk order fed
    // the model its prior chapters backwards on every fallback.
    const chapters = new Map<string, EnhancedChapter>();
    for (const n of [1, 2, 3, 4]) chapters.set(`stable-${n}`, mem(n));

    const current = mem(5);

    const history = await (TranslationService as any).buildHistoryByPrevUrlChain(
      current,
      3,
      chapters,
      false,
    );

    expect(history).toHaveLength(3);
    expect(history.map((h: any) => h.originalContent)).toEqual([
      'Source 2',
      'Source 3',
      'Source 4',
    ]);
  });

  it('resolves each prevUrl to the chapter AT that url, not a neighbour that links to it', async () => {
    // The in-memory lookup matched a url against [originalUrl, canonicalUrl, prevUrl, nextUrl].
    // Chapter 3's nextUrl IS chapter 4's url and chapter 3 comes first in insertion order, so a
    // lookup of chapter 4 returned chapter 3 — and the walk then continued from the wrong
    // chapter, skipping one. Every fixture here has nextUrl populated, which is the normal case.
    const chapters = new Map<string, EnhancedChapter>();
    for (const n of [1, 2, 3, 4]) chapters.set(`stable-${n}`, mem(n));

    const history = await (TranslationService as any).buildHistoryByPrevUrlChain(
      mem(5),
      2,
      chapters,
      false,
    );

    // Walking back from chapter 5 must yield 4 then 3 — contiguous, no gap.
    expect(history.map((h: any) => h.originalContent)).toEqual(['Source 3', 'Source 4']);
  });

  it("carries the user's feedback comment out of IndexedDB and into the history", async () => {
    // translationService used to convert IDB feedback records with a private copy of the mapping
    // that emitted `text` but not `comment` — and the prompt formatter reads `comment`. So the
    // guidance the user typed was dropped before it could ever influence a translation.
    // This drives the DB hydration branch through the REAL converter (see the mock above).
    dbMocks.findByUrl.mockResolvedValue({
      stableId: 'stable-4',
      title: 'Chapter 4',
      content: 'Source 4',
      chapterNumber: 4,
      canonicalUrl: 'https://example.com/ch-4',
      prevUrl: null,
    });
    dbMocks.ensureActiveByStableId.mockResolvedValue({
      translatedTitle: 'Translated 4',
      translation: 'Translated body 4',
      footnotes: [],
    });
    dbMocks.getFeedback.mockResolvedValue([{
      id: 'fb-1',
      chapterUrl: 'https://example.com/ch-4',
      type: 'negative',
      selection: 'the honorific',
      comment: 'Keep Japanese honorifics untranslated.',
      createdAt: new Date('2026-01-01').toISOString(),
    }]);

    const history = await (TranslationService as any).buildHistoryByPrevUrlChain(
      mem(5),
      1,
      new Map(), // nothing in memory, so the walk must hydrate from IndexedDB
      false,
    );

    expect(history).toHaveLength(1);
    expect(history[0].feedback[0].comment).toBe('Keep Japanese honorifics untranslated.');
  });
});
