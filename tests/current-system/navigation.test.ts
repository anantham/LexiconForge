import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from '../../store';
import { NavigationService } from '../../services/navigationService';
import type { EnhancedChapter } from '../../services/stableIdService';
import { createMockChapter, MOCK_KAKUYOMU_URLS } from '../utils/test-data';

const makeEnhancedChapter = (id: string, url: string): EnhancedChapter => ({
  ...createMockChapter({ originalUrl: url, nextUrl: null, prevUrl: null, title: `Chapter for ${id}` }),
  id,
  canonicalUrl: url,
  sourceUrls: [url],
  translationResult: null,
  feedback: [],
});

const resetStore = () => {
  useAppStore.setState({
    chapters: new Map(),
    novels: new Map(),
    currentChapterId: null,
    navigationHistory: [],
    urlIndex: new Map(),
    rawUrlIndex: new Map(),
    error: null,
    urlLoadingStates: {},
    isLoading: { fetching: false, translating: false },
  });
};

describe('Navigation fundamentals', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('URL validation', () => {
    it('accepts supported novel platforms', () => {
      expect(NavigationService.isValidUrl(MOCK_KAKUYOMU_URLS.chapter1)).toBe(true);
      expect(NavigationService.isValidUrl('https://kakuyomu.jp/works/123/episodes/456')).toBe(true);
    });

    it('rejects unsupported or malformed URLs', () => {
      const invalid = ['not-a-url', 'https://example.com', ''];
      for (const url of invalid) {
        expect(NavigationService.isValidUrl(url)).toBe(false);
      }
    });
  });

  describe('handleFetch behaviour', () => {
    it('persists fetched chapters and updates navigation state', async () => {
      const chapterId = 'ch-001';
      const chapterUrl = MOCK_KAKUYOMU_URLS.chapter1;
      const enhanced = makeEnhancedChapter(chapterId, chapterUrl);
      const chaptersMap = new Map<string, EnhancedChapter>([[chapterId, enhanced]]);
      const handleFetchSpy = vi.spyOn(NavigationService, 'handleFetch').mockResolvedValue({
        chapters: chaptersMap,
        currentChapterId: chapterId,
        urlIndex: new Map([[chapterUrl, chapterId]]),
        rawUrlIndex: new Map([[chapterUrl, chapterId]]),
        novels: new Map(),
      });
      vi.spyOn(NavigationService, 'updateBrowserHistory').mockImplementation(() => {});

      const result = await useAppStore.getState().handleFetch(chapterUrl);

      expect(result).toBe(chapterId);
      expect(handleFetchSpy).toHaveBeenCalledWith(chapterUrl);
      expect(useAppStore.getState().chapters.get(chapterId)).toMatchObject({ id: chapterId });
      expect(useAppStore.getState().currentChapterId).toBe(chapterId);
      expect(useAppStore.getState().navigationHistory).toContain(chapterId);
      expect(useAppStore.getState().error).toBeNull();
      expect(useAppStore.getState().isLoading.fetching).toBe(false);
    });

    it('records errors from NavigationService', async () => {
      vi.spyOn(NavigationService, 'handleFetch').mockResolvedValue({ error: 'Navigation failed' });

      const result = await useAppStore.getState().handleFetch('https://unsupported.example/');

      expect(result).toBeUndefined();
      expect(useAppStore.getState().error).toBe('Navigation failed');
      expect(useAppStore.getState().chapters.size).toBe(0);
    });

    it('ignores empty responses', async () => {
      vi.spyOn(NavigationService, 'handleFetch').mockResolvedValue({});

      const result = await useAppStore.getState().handleFetch(MOCK_KAKUYOMU_URLS.chapter2);

      expect(result).toBeUndefined();
      expect(useAppStore.getState().chapters.size).toBe(0);
      expect(useAppStore.getState().navigationHistory).toHaveLength(0);
    });
  });
});
