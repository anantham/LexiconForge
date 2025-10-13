/**
 * Tests for Chapters Slice
 *
 * Tests memory diagnostics and chapter management functionality
 */

import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import { createChaptersSlice, type ChaptersSlice } from '../../store/slices/chaptersSlice';
import type { EnhancedChapter } from '../../services/stableIdService';

// Create a test store
const createTestStore = () => {
  return create<ChaptersSlice>()((...args) => createChaptersSlice(...args));
};

describe('chaptersSlice - getMemoryDiagnostics', () => {
  it('calculates memory diagnostics for chapters with mixed image storage strategies', () => {
    const store = createTestStore();

    // Create test chapters with different image storage patterns
    const chapter1: EnhancedChapter = {
      id: 'ch-1',
      chapterNumber: 1,
      title: 'Chapter 1',
      content: '<p>Short content</p>', // ~20 bytes
      translationResult: {
        translatedTitle: 'Capítulo 1',
        translatedContent: '<p>Contenido traducido</p>', // ~27 bytes
        footnotes: [],
        suggestedIllustrations: [
          {
            placementMarker: 'ILL-1',
            imagePrompt: 'A scene',
            generatedImage: {
              imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // ~150 bytes base64
              requestTime: 1.5,
              cost: 0.04
            }
          }
        ],
        provider: 'google',
        model: 'gemini-2.0-flash-exp',
        cost: 0.001,
        tokens: 1000,
        requestTime: 2.5
      },
      url: 'https://example.com/ch1',
      prevUrl: null,
      nextUrl: 'https://example.com/ch2'
    };

    const chapter2: EnhancedChapter = {
      id: 'ch-2',
      chapterNumber: 2,
      title: 'Chapter 2',
      content: '<p>Another chapter</p>',
      translationResult: {
        translatedTitle: 'Capítulo 2',
        translatedContent: '<p>Otro contenido</p>',
        footnotes: [],
        suggestedIllustrations: [
          {
            placementMarker: 'ILL-2',
            imagePrompt: 'Another scene',
            generatedImage: {
              imageData: '', // Empty - using cache key
              imageCacheKey: {
                chapterId: 'ch-2',
                placementMarker: 'ILL-2'
              },
              requestTime: 1.2,
              cost: 0.03
            }
          }
        ],
        provider: 'google',
        model: 'gemini-2.0-flash-exp',
        cost: 0.002,
        tokens: 1500,
        requestTime: 3.0
      },
      url: 'https://example.com/ch2',
      prevUrl: 'https://example.com/ch1',
      nextUrl: null
    };

    // Import chapters into store
    store.getState().importChapter(chapter1);
    store.getState().importChapter(chapter2);

    // Act: Get memory diagnostics
    const diagnostics = store.getState().getMemoryDiagnostics();

    // Assert: Basic counts
    expect(diagnostics.totalChapters).toBe(2);
    expect(diagnostics.chaptersWithTranslations).toBe(2);
    expect(diagnostics.chaptersWithImages).toBe(2);

    // Assert: Image storage breakdown
    expect(diagnostics.imagesInRAM).toBe(1); // chapter1 has base64
    expect(diagnostics.imagesInCache).toBe(1); // chapter2 uses cache key

    // Assert: RAM estimates (rough)
    expect(diagnostics.estimatedRAM.totalBytes).toBeGreaterThan(0);
    expect(diagnostics.estimatedRAM.chapterContentBytes).toBeGreaterThan(0);
    expect(diagnostics.estimatedRAM.base64ImageBytes).toBeGreaterThan(100); // chapter1's base64

    // Assert: Human-readable sizes (may be 0 for very small test data)
    expect(diagnostics.estimatedRAM.totalMB).toBeGreaterThanOrEqual(0);
    expect(typeof diagnostics.estimatedRAM.totalMB).toBe('number');

    // Assert: Warnings
    expect(diagnostics.warnings).toHaveLength(1); // Should warn about base64 in RAM
    expect(diagnostics.warnings[0]).toContain('legacy base64');

    // Assert: No warning for <50 chapters
    expect(diagnostics.warnings.some(w => w.includes('50 chapters'))).toBe(false);
  });

  it('warns when more than 50 chapters are loaded', () => {
    const store = createTestStore();

    // Create 55 chapters
    for (let i = 1; i <= 55; i++) {
      const chapter: EnhancedChapter = {
        id: `ch-${i}`,
        chapterNumber: i,
        title: `Chapter ${i}`,
        content: '<p>Content</p>',
        url: `https://example.com/ch${i}`,
        prevUrl: i > 1 ? `https://example.com/ch${i-1}` : null,
        nextUrl: i < 55 ? `https://example.com/ch${i+1}` : null
      };
      store.getState().importChapter(chapter);
    }

    // Act
    const diagnostics = store.getState().getMemoryDiagnostics();

    // Assert
    expect(diagnostics.totalChapters).toBe(55);
    expect(diagnostics.warnings.some(w => w.includes('50'))).toBe(true);
  });

  it('handles chapters without translations', () => {
    const store = createTestStore();

    const chapterNoTranslation: EnhancedChapter = {
      id: 'ch-no-trans',
      chapterNumber: 1,
      title: 'Untranslated',
      content: '<p>Original only</p>',
      url: 'https://example.com/ch1',
      prevUrl: null,
      nextUrl: null
    };

    store.getState().importChapter(chapterNoTranslation);

    // Act
    const diagnostics = store.getState().getMemoryDiagnostics();

    // Assert
    expect(diagnostics.totalChapters).toBe(1);
    expect(diagnostics.chaptersWithTranslations).toBe(0);
    expect(diagnostics.chaptersWithImages).toBe(0);
    expect(diagnostics.imagesInRAM).toBe(0);
    expect(diagnostics.imagesInCache).toBe(0);
  });
});
