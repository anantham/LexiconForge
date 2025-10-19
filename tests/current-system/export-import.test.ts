import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from '../../store';
import type { EnhancedChapter } from '../../services/stableIdService';
import type { TranslationResult } from '../../types';
import { indexedDBService } from '../../services/indexeddb';
import { normalizeUrlAggressively } from '../../services/stableIdService';

const resetStore = () => {
  useAppStore.setState({
    chapters: new Map(),
    urlIndex: new Map(),
    rawUrlIndex: new Map(),
    navigationHistory: [],
    currentChapterId: null,
  });
};

const sampleChapter = (id: string, url: string): EnhancedChapter => ({
  id,
  title: `Title ${id}`,
  content: 'Translated content with <i>styling</i>.',
  originalUrl: url,
  canonicalUrl: url,
  nextUrl: null,
  prevUrl: null,
  sourceUrls: [url],
  fanTranslation: null,
  translationResult: {
    translatedTitle: `Translated ${id}`,
    translation: 'Translated content with <i>styling</i>.',
    proposal: null,
    footnotes: [],
    suggestedIllustrations: [],
    usageMetrics: {
      totalTokens: 1200,
      promptTokens: 700,
      completionTokens: 500,
      estimatedCost: 0.0009,
      requestTime: 3,
      provider: 'Gemini',
      model: 'gemini-2.5-flash',
    },
  } as TranslationResult,
  feedback: [],
});

describe('Session export/import', () => {
  beforeEach(() => {
    resetStore();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exportSessionData()', () => {
    it('serialises chapters in export JSON', async () => {
      const chapterId = 'stable-1';
      const url = 'https://example.com/chapters/1';
      const chapter = sampleChapter(chapterId, url);
      useAppStore.setState({
        chapters: new Map([[chapterId, chapter]]),
      });

      const json = await useAppStore.getState().exportSessionData();
      const snapshot = JSON.parse(json);

      expect(snapshot.chapters).toHaveLength(1);
      expect(snapshot.chapters[0].canonicalUrl).toBe(url);
      expect(snapshot.chapters[0].title).toBe(chapter.title);
      expect(snapshot.chapters[0].translations?.[0]?.translatedTitle).toBe('Translated stable-1');
    });

    it('returns empty chapter list when no chapters are loaded', async () => {
      const json = await useAppStore.getState().exportSessionData();
      const snapshot = JSON.parse(json);
      expect(Array.isArray(snapshot.chapters)).toBe(true);
      expect(snapshot.chapters).toHaveLength(0);
    });
  });

  describe('importSessionData()', () => {
    it('imports the full session format via IndexedDB', async () => {
      const importPayload = {
        metadata: { format: 'lexiconforge-full-1' },
      };
      const rendering = [
        {
          stableId: 'stable-1',
          url: 'https://example.com/chapters/1',
          chapterNumber: 1,
          data: {
            chapter: {
              title: 'Imported title',
              content: 'Imported content',
              nextUrl: null,
              prevUrl: null,
            },
            translationResult: sampleChapter('stable-1', 'https://example.com/chapters/1').translationResult,
          },
        },
      ];

      const importSpy = vi.spyOn(indexedDBService, 'importFullSessionData').mockResolvedValue();
      vi.spyOn(indexedDBService, 'getChaptersForReactRendering').mockResolvedValue(rendering as any);
      vi.spyOn(indexedDBService, 'getSetting').mockImplementation(async (key: string) => {
        if (key === 'navigation-history') return { stableIds: ['stable-1'] };
        if (key === 'lastActiveChapter') return { id: 'stable-1', url: rendering[0].url };
        return null;
      });

      await useAppStore.getState().importSessionData(importPayload);

      expect(importSpy).toHaveBeenCalledWith(importPayload);
      const state = useAppStore.getState();
      expect(state.chapters.size).toBe(1);
      expect(state.currentChapterId).toBe('stable-1');
      expect(state.navigationHistory).toContain('stable-1');
      const normalized = normalizeUrlAggressively(rendering[0].url)!;
      expect(state.urlIndex.get(normalized)).toBe('stable-1');
    });

    it('raises errors for malformed payloads', async () => {
      await expect(useAppStore.getState().importSessionData('not-json')).rejects.toThrow();
      expect(useAppStore.getState().error).toContain('Failed to import session');
    });
  });
});
