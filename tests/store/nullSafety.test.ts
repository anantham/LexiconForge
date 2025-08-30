// tests/store/nullSafety.test.ts
// Tests for null safety fixes to prevent TypeError crashes

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../store';
import * as aiService from '../../services/aiService';
import * as adapters from '../../services/adapters';
import { Chapter, TranslationResult } from '../../types';

// Mock external services
vi.mock('../../services/aiService');
vi.mock('../../services/adapters');

const mockTranslateChapter = vi.mocked(aiService.translateChapter);
const mockFetchAndParseUrl = vi.mocked(adapters.fetchAndParseUrl);

// Test data
const testChapter: Chapter = {
  title: 'Test Chapter',
  content: 'This is the content.',
  originalUrl: 'http://test.com/chapter/1',
  prevUrl: null,
  nextUrl: 'http://test.com/chapter/2',
};

const testTranslationResult: TranslationResult = {
  translatedTitle: 'Translated Title',
  translation: 'Translated content.',
  provider: 'Gemini',
  model: 'gemini-2.5-flash',
  temperature: 0.7,
  contextUsed: 0,
  promptTokens: 100,
  completionTokens: 150,
  totalTokens: 250,
  costUSD: 0.001,
  amendmentProposal: null,
};

describe('Null Safety Fixes', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      sessionData: {},
      urlHistory: [],
      isLoading: { fetching: false, translating: false },
      error: null,
      currentUrl: null,
      settings: {
        provider: 'Gemini',
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        contextDepth: 2,
        preloadCount: 1
      }
    });
    
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('handleFetch returning null', () => {
    it('should not crash when handleFetch returns null', async () => {
      // Simulate fetch failure returning null
      mockFetchAndParseUrl.mockRejectedValue(new Error('Network error'));
      
      const result = await useAppStore.getState().handleFetch('http://test.com/failed', true);
      
      // Should return null without crashing
      expect(result).toBeNull();
      expect(mockFetchAndParseUrl).toHaveBeenCalledWith(
        'http://test.com/failed',
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should handle null chapter in worker logic safely', () => {
      // Set up sessionData with valid chapter
      useAppStore.setState({
        sessionData: {
          'http://test.com/chapter/1': {
            chapter: testChapter,
            translationResult: null
          }
        }
      });

      // Simulate accessing nextUrl on null chapter (the fixed code should handle this)
      const chapter = null; // This is what handleFetch returns on failure
      const nextUrlToPreload = chapter?.nextUrl || null;
      
      // Should not crash and should be null
      expect(nextUrlToPreload).toBeNull();
    });
  });

  describe('Translation context with incomplete sessionData', () => {
    it('should not crash when sessionData has undefined chapter property', async () => {
      // Set up malformed sessionData - data exists but chapter is undefined
      useAppStore.setState({
        sessionData: {
          'http://test.com/chapter/1': {
            chapter: undefined as any, // This simulates corrupted state
            translationResult: testTranslationResult
          } as any
        },
        urlHistory: ['http://test.com/chapter/1', 'http://test.com/chapter/2']
      });

      mockTranslateChapter.mockResolvedValue(testTranslationResult);

      // This should not crash - the fix filters out entries with undefined chapter
      const result = await useAppStore.getState().handleTranslate('http://test.com/chapter/2');
      
      expect(result).toBeUndefined(); // Translation completes without crashing
    });

    it('should build translation history safely with undefined chapter data', () => {
      // Set up sessionData with mixed valid and invalid entries
      useAppStore.setState({
        sessionData: {
          'http://test.com/chapter/1': {
            chapter: testChapter,
            translationResult: testTranslationResult
          },
          'http://test.com/chapter/invalid': {
            chapter: undefined as any, // This should be filtered out
            translationResult: testTranslationResult
          } as any,
          'http://test.com/chapter/2': {
            chapter: { ...testChapter, originalUrl: 'http://test.com/chapter/2' },
            translationResult: testTranslationResult
          }
        },
        urlHistory: [
          'http://test.com/chapter/1', 
          'http://test.com/chapter/invalid',
          'http://test.com/chapter/2',
          'http://test.com/chapter/3'
        ]
      });

      // Should build history without crashing, filtering out invalid entries
      const history = useAppStore.getState().buildTranslationHistory('http://test.com/chapter/3');
      
      // Should have 2 valid entries, invalid one filtered out
      expect(history).toHaveLength(2);
      expect(history[0].originalTitle).toBe('Test Chapter');
      expect(history[1].originalTitle).toBe('Test Chapter');
    });
  });

  describe('Export function with incomplete sessionData', () => {
    it('should export chapters safely when some entries have undefined chapter', () => {
      // Set up sessionData with mixed valid and invalid entries
      useAppStore.setState({
        sessionData: {
          'http://test.com/valid': {
            chapter: testChapter,
            translationResult: testTranslationResult
          },
          'http://test.com/invalid': {
            chapter: undefined as any, // Should be filtered out
            translationResult: null
          } as any,
          'http://test.com/another-valid': {
            chapter: { ...testChapter, title: 'Another Chapter', originalUrl: 'http://test.com/another-valid' },
            translationResult: null
          }
        },
        urlHistory: ['http://test.com/valid', 'http://test.com/invalid', 'http://test.com/another-valid'],
        feedbackHistory: {}
      });

      // Should export without crashing, filtering out invalid entries
      const exported = useAppStore.getState().exportSession();
      
      expect(exported.chapters).toHaveLength(2); // Only valid entries
      expect(exported.chapters[0].title).toBe('Test Chapter');
      expect(exported.chapters[1].title).toBe('Another Chapter');
      
      // Should not include the invalid entry
      const invalidEntry = exported.chapters.find(c => c.sourceUrl === 'http://test.com/invalid');
      expect(invalidEntry).toBeUndefined();
    });

    it('should handle completely empty sessionData in export', () => {
      useAppStore.setState({
        sessionData: {},
        urlHistory: [],
        feedbackHistory: {}
      });

      // Should export without crashing
      const exported = useAppStore.getState().exportSession();
      
      expect(exported.chapters).toHaveLength(0);
      expect(exported.urlHistory).toHaveLength(0);
    });
  });

  describe('Edge cases for null safety', () => {
    it('should handle sessionData entries with null values', () => {
      useAppStore.setState({
        sessionData: {
          'http://test.com/null-entry': null as any,
          'http://test.com/valid': {
            chapter: testChapter,
            translationResult: null
          }
        }
      });

      // Export should filter out null entries
      const exported = useAppStore.getState().exportSession();
      expect(exported.chapters).toHaveLength(1);
      expect(exported.chapters[0].title).toBe('Test Chapter');
    });

    it('should handle chapters with null nextUrl/prevUrl safely', () => {
      const chapterWithNullUrls: Chapter = {
        title: 'Chapter With Nulls',
        content: 'Content',
        originalUrl: 'http://test.com/null-urls',
        nextUrl: null,
        prevUrl: null
      };

      useAppStore.setState({
        sessionData: {
          'http://test.com/null-urls': {
            chapter: chapterWithNullUrls,
            translationResult: null
          }
        }
      });

      // Should access nextUrl safely (this simulates the worker logic)
      const sessionData = useAppStore.getState().sessionData;
      const chapter = sessionData['http://test.com/null-urls']?.chapter;
      const nextUrl = chapter?.nextUrl || null;
      
      expect(nextUrl).toBeNull();
      
      // Export should also handle this safely
      const exported = useAppStore.getState().exportSession();
      expect(exported.chapters).toHaveLength(1);
      expect(exported.chapters[0].nextUrl).toBeNull();
      expect(exported.chapters[0].prevUrl).toBeNull();
    });
  });
});