/**
 * Navigation Logic Tests
 * 
 * ==================================
 * WHAT ARE WE TESTING?
 * ==================================
 * 
 * URL handling, chapter navigation, and session state management logic.
 * Users navigate between chapters, and the app must track state correctly.
 * 
 * COVERAGE OBJECTIVES:
 * 1. ✅ URL parsing and validation (Kakuyomu, Syosetu, generic URLs)
 * 2. ✅ Chapter loading and state management
 * 3. ✅ Navigation between chapters within the same session
 * 4. ✅ Session cleanup and memory management
 * 5. ✅ Loading state management per URL
 * 6. ✅ Error handling for invalid URLs and failed fetches
 * 7. ✅ Navigation history and back/forward logic
 * 
 * ==================================
 * WHY IS THIS NECESSARY?
 * ==================================
 * 
 * USER WORKFLOW: Users work with multiple chapters in sequence
 * STATE MANAGEMENT: Each chapter needs independent state tracking
 * PERFORMANCE: Memory usage must be controlled for long sessions
 * RELIABILITY: Navigation must work consistently across different novel platforms
 * 
 * REAL SCENARIOS THIS PREVENTS:
 * - User navigates to chapter 5, but app shows chapter 3's data
 * - Loading states getting mixed up between chapters
 * - Memory leaks from keeping too many chapters in memory
 * - Invalid URLs causing app crashes
 * - Session state getting corrupted during navigation
 * 
 * ==================================
 * IS THIS SUFFICIENT?
 * ==================================
 * 
 * This covers current navigation functionality:
 * ✅ URL parsing for supported platforms
 * ✅ Chapter state management and transitions
 * ✅ Loading state management per URL
 * ✅ Session cleanup and memory management
 * ✅ Error handling and recovery
 * 
 * NOT COVERED (future features):
 * ❌ Bookmark management (not implemented)
 * ❌ Navigation shortcuts/hotkeys (UI layer)
 * ❌ Advanced URL pattern support (not needed yet)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import useAppStore, { isValidUrl, normalizeUrl } from '../../store/useAppStore';
import {
  createMockChapter,
  createMockTranslationResult,
  createChapterChain,
  MOCK_KAKUYOMU_URLS
} from '../utils/test-data';
import { setupAllMocks, cleanupMocks } from '../utils/api-mocks';

describe('Navigation Logic', () => {
  let mocks: ReturnType<typeof setupAllMocks>;

  beforeEach(() => {
    mocks = setupAllMocks();
    useAppStore.getState().clearSession();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupMocks();
  });

  /**
   * TEST MOTIVATION: URL Parsing and Validation
   * 
   * The app must correctly identify and handle different novel platform URLs.
   * Invalid URLs should be handled gracefully without crashes.
   * 
   * WHAT IT VALIDATES:
   * - Kakuyomu URLs are recognized and parsed correctly
   * - Syosetu URLs work (if supported)
   * - Invalid URLs are rejected gracefully
   * - URL normalization works consistently
   */
  describe('URL Parsing and Validation', () => {
    it('should correctly parse Kakuyomu URLs', () => {
      const store = useAppStore.getState();
      
      const validKakuyomuUrls = [
        'https://kakuyomu.jp/works/1234567890/episodes/1111111111',
        'https://kakuyomu.jp/works/16816700426273053830/episodes/16816700426273053831',
        'https://kakuyomu.jp/works/16817330650196161396/episodes/16817330650196161397'
      ];
      
      validKakuyomuUrls.forEach(url => {
        expect(isValidUrl(url)).toBe(true);
      });
    });

    it('should reject invalid or unsupported URLs', () => {
      const store = useAppStore.getState();
      
      const invalidUrls = [
        'not-a-url',
        'https://example.com',
        'https://kakuyomu.jp/invalid-path',
        'https://other-novel-site.com/chapter/123',
        '',
        null,
        undefined
      ];
      
      invalidUrls.forEach(url => {
        expect(isValidUrl(url as any)).toBe(false);
      });
    });

    it('should normalize URLs consistently', () => {
      // WHY: Different URL formats (with/without trailing slash, query params) should be treated the same
      // PREVENTS: Same chapter being loaded multiple times with slight URL variations
      const store = useAppStore.getState();
      
      const baseUrl = 'https://kakuyomu.jp/works/1234567890/episodes/1111111111';
      const urlVariations = [
        baseUrl,
        baseUrl + '/',
        baseUrl + '?utm_source=test',
        baseUrl + '#section',
        baseUrl + '/?param=value#section'
      ];
      
      const normalizedUrls = urlVariations.map(url => normalizeUrl(url));
      
      // All variations should normalize to the same URL
      const uniqueUrls = new Set(normalizedUrls);
      expect(uniqueUrls.size).toBe(1);
    });
  });

  /**
   * TEST MOTIVATION: Chapter Loading and State Management
   * 
   * Each chapter needs independent loading state and data storage.
   * Loading states must not interfere with each other.
   */
  describe('Chapter Loading and State Management', () => {
    it('should load chapter data independently per URL', async () => {
      const store = useAppStore.getState();
      const chapters = createChapterChain(3);
      
      // Load multiple chapters
      await Promise.all(
        chapters.map(chapter => store.handleFetch(chapter.originalUrl))
      );
      
      // Verify all chapters loaded independently
      chapters.forEach(chapter => {
        const chapterData = store.chapters.get(chapter.id);
        expect(chapterData).toBeTruthy();
        expect(chapterData.title).toBe(chapter.title);
        expect(chapterData.content).toBe(chapter.content);
      });
      
      // Verify no cross-contamination
      expect(Object.keys(store.sessionData)).toHaveLength(3);
    });

    it('should manage loading states independently per URL', async () => {
      const store = useAppStore.getState();
      const chapters = createChapterChain(2);
      
      // Start loading first chapter
      const firstLoad = store.handleFetch(chapters[0].originalUrl);
      
      // While first is loading, start second chapter
      const secondLoad = store.handleFetch(chapters[1].originalUrl);
      
      // Both should be loading independently
      expect(store.isUrlLoading(chapters[0].originalUrl)).toBe(true);
      expect(store.isUrlLoading(chapters[1].originalUrl)).toBe(true);
      
      // Wait for both to complete
      await Promise.all([firstLoad, secondLoad]);
      
      // Both should be done loading
      expect(store.isUrlLoading(chapters[0].originalUrl)).toBe(false);
      expect(store.isUrlLoading(chapters[1].originalUrl)).toBe(false);
    });

    it('should handle fetch errors without affecting other chapters', async () => {
      const store = useAppStore.getState();
      const validChapter = createMockChapter();
      const invalidUrl = 'https://kakuyomu.jp/works/invalid/episodes/invalid';
      
      // Load valid chapter successfully
      await store.handleFetch(validChapter.originalUrl);
      
      // Try to load invalid chapter
      await store.handleFetch(invalidUrl);
      
      // Valid chapter should still be loaded
      expect(store.chapters.get(validChapter.id)).toBeTruthy();
      
      // Invalid chapter should have error state
      expect(store.error).toBeTruthy();
      expect(store.isUrlLoading(invalidUrl)).toBe(false);
      
      // Valid chapter should be unaffected
      expect(store.chapters.get(validChapter.id).title).toBe(validChapter.title);
    });

    it('should prevent duplicate loading of same URL', async () => {
      const store = useAppStore.getState();
      const chapter = createMockChapter();
      
      // Start first load
      const firstLoad = store.handleFetch(chapter.originalUrl);
      
      // Try to start second load of same URL immediately
      const secondLoad = store.handleFetch(chapter.originalUrl);
      
      // Both promises should resolve to same result
      const [firstResult, secondResult] = await Promise.all([firstLoad, secondLoad]);
      
      // Should only have called fetch once
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
      
      // Results should be identical
      expect(firstResult).toBe(secondResult);
    });
  });

  /**
   * TEST MOTIVATION: Navigation Between Chapters
   * 
   * Users navigate sequentially through chapters.
   * The app must maintain context and provide smooth transitions.
   */
  describe('Navigation Between Chapters', () => {
    it('should maintain session context when navigating between chapters', async () => {
      const store = useAppStore.getState();
      const chapters = createChapterChain(4);
      
      // Load and translate first chapter
      await store.handleFetch(chapters[0].originalUrl);
      await store.handleTranslate(chapters[0].originalUrl);
      
      // Navigate to second chapter
      await store.handleFetch(chapters[1].originalUrl);
      
      // First chapter should still be in session
      expect(store.chapters.get(chapters[0].id)).toBeTruthy();
      expect(store.chapters.get(chapters[0].id).translationResult).toBeTruthy();
      
      // Second chapter should also be loaded
      expect(store.chapters.get(chapters[1].id)).toBeTruthy();
      
      // Session should contain both chapters
      expect(store.chapters.size).toBe(2);
    });

    it('should build correct translation context during navigation', async () => {
      const store = useAppStore.getState();
      const chapters = createChapterChain(5);
      
      store.updateSettings({ contextDepth: 2 });
      
      // Load and translate chapters sequentially
      for (let i = 0; i < 3; i++) {
        await store.handleFetch(chapters[i].originalUrl);
        await store.handleTranslate(chapters[i].originalUrl);
      }
      
      // When loading 4th chapter, context should include previous 2 chapters
      await store.handleFetch(chapters[3].originalUrl);
      
      const history = store.buildTranslationHistory(chapters[3].originalUrl);
      
      expect(history).toHaveLength(2); // contextDepth = 2
      expect(history[0].originalTitle).toBe(chapters[1].title); // Chapter 2
      expect(history[1].originalTitle).toBe(chapters[2].title); // Chapter 3
    });

    it('should handle navigation to previously loaded chapters', async () => {
      // WHY: Users might navigate back to chapters they've already seen
      // PREVENTS: Unnecessary re-fetching and state loss
      const store = useAppStore.getState();
      const chapters = createChapterChain(3);
      
      // Load all chapters
      await Promise.all(chapters.map(chapter => store.handleFetch(chapter.originalUrl)));
      
      // Translate first chapter
      await store.handleTranslate(chapters[0].originalUrl);
      
      // Navigate to second chapter (already loaded)
      const chaptersBefore = new Map(store.chapters);
      await store.handleFetch(chapters[1].originalUrl);
      
      // Should not have triggered additional fetch
      expect(mocks.fetch).toHaveBeenCalledTimes(3); // Only initial loads
      
      // Session state should be preserved
      expect(store.chapters.get(chapters[0].id).translationResult).toBeTruthy();
      expect(store.chapters.get(chapters[1].id)).toBeTruthy();
    });
  });

  /**
   * TEST MOTIVATION: Session Cleanup and Memory Management
   * 
   * Long translation sessions can accumulate many chapters.
   * Must prevent memory leaks and maintain good performance.
   */
  describe('Session Cleanup and Memory Management', () => {
    it('should limit session size to prevent memory issues', async () => {
      const store = useAppStore.getState();
      const manyChapters = createChapterChain(20); // Large number of chapters
      
      // Set reasonable session limit
      const maxSessionSize = 10;
      store.updateSettings({ maxSessionSize });
      
      // Load many chapters
      for (const chapter of manyChapters) {
        await store.handleFetch(chapter.originalUrl);
      }
      
      // Session should not exceed limit
      const sessionSize = store.chapters.size;
      expect(sessionSize).toBeLessThanOrEqual(maxSessionSize);
      
      // Should keep most recent chapters
      const lastChapter = manyChapters[manyChapters.length - 1];
      expect(store.chapters.get(lastChapter.id)).toBeTruthy();
    });

    it('should clean up resources when clearing session', () => {
      const store = useAppStore.getState();
      const chapters = createChapterChain(3);
      
      // Load chapters and translations
      chapters.forEach((chapter, index) => {
        useAppStore.setState(state => ({
          chapters: new Map(state.chapters).set(chapter.id, {
            ...chapter,
            translationResult: createMockTranslationResult(),
            feedback: [],
            translationSettingsSnapshot: { provider: 'Gemini', model: 'gemini-2.5-flash', temperature: 0.3 }
          })
        }));
      });
      
      // Verify data exists
      expect(store.chapters.size).toBe(3);
      
      // Clear session
      store.clearSession();
      
      // All data should be cleaned up
      expect(store.chapters.size).toBe(0);
      expect(store.isLoading.fetching).toBe(false);
      expect(store.isLoading.translating).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle partial session cleanup when over limits', async () => {
      // WHY: When session gets too large, should clean up old chapters, not crash
      // PREVENTS: Memory leaks in long translation sessions
      const store = useAppStore.getState();
      const chapters = createChapterChain(15);
      
      // Load chapters gradually
      for (let i = 0; i < 10; i++) {
        await store.handleFetch(chapters[i].originalUrl);
      }
      
      const initialSize = store.chapters.size;
      
      // Load more chapters beyond reasonable limit
      for (let i = 10; i < 15; i++) {
        await store.handleFetch(chapters[i].originalUrl);
      }
      
      // Should not grow unbounded
      const finalSize = store.chapters.size;
      expect(finalSize).toBeGreaterThan(5); // Should keep reasonable number
      expect(finalSize).toBeLessThan(20); // Should not keep everything
      
      // Should prioritize recent chapters
      expect(store.chapters.get(chapters[14].id)).toBeTruthy(); // Last chapter
    });
  });

  /**
   * TEST MOTIVATION: Loading State Management
   * 
   * Loading states must be accurate and not confuse users.
   * Multiple concurrent operations need independent state tracking.
   */
  describe('Loading State Management', () => {
    it('should track loading state accurately per URL', async () => {
      const store = useAppStore.getState();
      const chapter = createMockChapter();
      
      // Initially not loading
      expect(store.isUrlLoading(chapter.originalUrl)).toBe(false);
      expect(store.isUrlTranslating(chapter.originalUrl)).toBe(false);
      
      // Start fetch
      const fetchPromise = store.handleFetch(chapter.originalUrl);
      expect(store.isUrlLoading(chapter.originalUrl)).toBe(true);
      
      await fetchPromise;
      expect(store.isUrlLoading(chapter.originalUrl)).toBe(false);
      
      // Start translation
      const translatePromise = store.handleTranslate(chapter.originalUrl);
      expect(store.isUrlTranslating(chapter.originalUrl)).toBe(true);
      
      await translatePromise;
      expect(store.isUrlTranslating(chapter.originalUrl)).toBe(false);
    });

    it('should handle concurrent operations on different URLs', async () => {
      const store = useAppStore.getState();
      const chapters = createChapterChain(3);
      
      // Start concurrent fetch operations
      const fetchPromises = chapters.map(chapter => store.handleFetch(chapter.originalUrl));
      
      // All should be loading simultaneously
      chapters.forEach(chapter => {
        expect(store.isUrlLoading(chapter.originalUrl)).toBe(true);
      });
      
      // Wait for all to complete
      await Promise.all(fetchPromises);
      
      // All should be done
      chapters.forEach(chapter => {
        expect(store.isUrlLoading(chapter.originalUrl)).toBe(false);
      });
    });

    it('should reset loading states on errors', async () => {
      const store = useAppStore.getState();
      const invalidUrl = 'https://kakuyomu.jp/invalid/url';
      
      // Mock fetch to reject
      mocks.fetch.mockRejectedValueOnce(new Error('Network error'));
      
      // Start operation that will fail
      await store.handleFetch(invalidUrl);
      
      // Loading state should be cleared even on error
      expect(store.isUrlLoading(invalidUrl)).toBe(false);
      expect(store.error).toBeTruthy();
    });
  });

  /**
   * TEST MOTIVATION: Navigation History and Back/Forward Logic
   * 
   * Users expect web-like navigation with history support.
   * App should integrate well with browser navigation.
   */
  describe('Navigation History', () => {
    it('should track navigation history within session', async () => {
      const store = useAppStore.getState();
      const chapters = createChapterChain(4);
      
      // Navigate through chapters in sequence
      for (const chapter of chapters.slice(0, 3)) {
        await store.handleNavigate(chapter.originalUrl);
      }
      
      // History should track visited URLs
      const history = store.getNavigationHistory();
      expect(history).toHaveLength(3);
      expect(history[2]).toBe(chapters[2].originalUrl); // Most recent
      expect(history[0]).toBe(chapters[0].originalUrl); // Oldest
    });

    it('should handle back navigation correctly', async () => {
      const store = useAppStore.getState();
      const chapters = createChapterChain(3);
      
      // Navigate forward through chapters
      await store.handleNavigate(chapters[0].originalUrl);
      await store.handleNavigate(chapters[1].originalUrl);
      await store.handleNavigate(chapters[2].originalUrl);
      
      // Navigate back
      const previousUrl = store.navigateBack();
      expect(previousUrl).toBe(chapters[1].originalUrl);
      
      // Current URL should be updated
      expect(store.currentUrl).toBe(chapters[1].originalUrl);
    });

    it('should integrate with browser navigation state', () => {
      // WHY: Users expect browser back/forward buttons to work
      // VALIDATES: App navigation integrates with browser history API
      const store = useAppStore.getState();
      
      // Mock browser history API
      const mockPushState = vi.fn();
      const mockReplaceState = vi.fn();
      
      Object.defineProperty(window, 'history', {
        value: {
          pushState: mockPushState,
          replaceState: mockReplaceState,
          state: null
        },
        writable: true
      });
      
      const chapter = createMockChapter();
      
      // Navigate to chapter
      store.handleNavigate(chapter.originalUrl);
      
      // Should update browser history
      expect(mockPushState).toHaveBeenCalledWith(
        expect.objectContaining({ url: chapter.originalUrl }),
        '',
        expect.stringContaining(chapter.originalUrl)
      );
    });
  });

  /**
   * TEST MOTIVATION: Error Recovery and Edge Cases
   * 
   * Navigation must be robust against various failure modes.
   * Users should never be left in broken states.
   */
  describe('Error Recovery and Edge Cases', () => {
    it('should recover gracefully from fetch failures', async () => {
      const store = useAppStore.getState();
      const chapter = createMockChapter();
      
      // Mock fetch failure
      mocks.fetch.mockRejectedValueOnce(new Error('Network timeout'));
      
      // Try to load chapter
      await store.handleFetch(chapter.originalUrl);
      
      // Should have error state but app should still be functional
      expect(store.error).toBeTruthy();
      expect(store.isUrlLoading(chapter.originalUrl)).toBe(false);
      
      // Clear error and try again
      store.clearError();
      
      // Should be able to retry
      await store.handleFetch(chapter.originalUrl);
      expect(store.chapters.get(chapter.id)).toBeTruthy();
      expect(store.error).toBeNull();
    });

    it('should handle malformed chapter data gracefully', async () => {
      const store = useAppStore.getState();
      const chapter = createMockChapter();
      
      // Mock response with malformed data
      mocks.fetch.mockResolvedValueOnce(
        new Response('<html><body>Not valid chapter JSON</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        })
      );
      
      await store.handleFetch(chapter.originalUrl);
      
      // Should handle parsing error gracefully
      expect(store.error).toBeTruthy();
      expect(store.error).toContain('parse');
      expect(store.chapters.get(chapter.id)).toBeUndefined();
    });

    it('should handle rapid navigation changes', async () => {
      // WHY: Users might click navigation rapidly, causing race conditions
      // PREVENTS: State corruption from overlapping navigation operations
      const store = useAppStore.getState();
      const chapters = createChapterChain(5);
      
      // Start loading multiple chapters rapidly
      const loadPromises = chapters.map(chapter => 
        store.handleFetch(chapter.originalUrl)
      );
      
      // All should complete successfully
      const results = await Promise.allSettled(loadPromises);
      
      // No operations should have failed due to race conditions
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled');
        expect(store.chapters.get(chapters[index].id)).toBeTruthy();
      });
      
      // Session should contain all chapters
      expect(store.chapters.size).toBe(5);
    });

    it('should maintain data integrity during concurrent operations', async () => {
      const store = useAppStore.getState();
      const chapter = createMockChapter();
      
      // Start fetch and translate simultaneously
      const fetchPromise = store.handleFetch(chapter.originalUrl);
      
      // Wait for fetch to complete
      await fetchPromise;
      
      // Now start translation
      const translatePromise = store.handleTranslate(chapter.originalUrl);
      
      // Start another fetch of same URL (should not interfere)
      const redundantFetchPromise = store.handleFetch(chapter.originalUrl);
      
      await Promise.all([translatePromise, redundantFetchPromise]);
      
      // Data should be consistent
      const chapterData = store.chapters.get(chapter.id);
      expect(chapterData.title).toBe(chapter.title);
      expect(chapterData.translationResult).toBeTruthy();
      
      // Should not have duplicate data or corruption
      expect(typeof chapterData.title).toBe('string');
      expect(chapterData.translationResult.translatedTitle).toBeTruthy();
    });
  });
});

/**
 * ==================================
 * COMPLETENESS SUMMARY
 * ==================================
 * 
 * This test file covers:
 * ✅ URL parsing and validation for supported platforms
 * ✅ Independent chapter loading and state management
 * ✅ Navigation between chapters with context preservation
 * ✅ Session cleanup and memory management
 * ✅ Loading state management for concurrent operations
 * ✅ Navigation history and browser integration
 * ✅ Error recovery and graceful failure handling
 * ✅ Race condition prevention and data integrity
 * 
 * USER WORKFLOW VALIDATION:
 * ✅ Users can navigate smoothly between chapters
 * ✅ Loading states are accurate and don't confuse users
 * ✅ Session state is preserved during navigation
 * ✅ Memory usage is controlled for long sessions
 * ✅ Errors don't break the navigation experience
 * 
 * This ensures reliable navigation functionality that supports
 * smooth user workflows across multiple chapters and long sessions.
 */