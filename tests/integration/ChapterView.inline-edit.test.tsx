/**
 * ChapterView Flow #2 — Inline Edit (Vitest/jsdom)
 *
 * This test is intentionally scoped to the inline-edit UX and persistence wiring.
 * Layout/perf validations live in Playwright (real browser).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { create } from 'zustand';

type ChapterLike = {
  id: string;
  title: string;
  content: string;
  prevUrl: string | null;
  nextUrl: string | null;
  fanTranslation: string | null;
  translationResult: any;
  feedback: any[];
};

const makeSelection = (element: HTMLElement) => {
  const textNode = element.firstChild;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
    throw new Error('Expected target element to contain a text node for selection.');
  }

  const text = textNode.textContent || '';
  const range = document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, Math.min(5, text.length));

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

describe('ChapterView: Critical Flow #2 - Inline Edit', () => {
  beforeEach(() => {
    vi.resetModules();

    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        writable: true,
        value: vi.fn(),
      });
    }

    // Avoid pulling in the full audio slice for this flow test.
    vi.doMock('../../components/AudioPlayer', () => ({
      __esModule: true,
      default: () => null,
    }));

    // Ensure SelectionOverlay uses the touch sheet (no dependency on viewRef layout).
    vi.doMock('../../hooks/useIsTouch', () => ({
      useIsTouch: () => true,
    }));

    // Keep diffs deterministic: one marker so the gutter/pip UI is present.
    vi.doMock('../../hooks/useDiffMarkers', () => ({
      useDiffMarkers: () => ({
        loading: false,
        markers: [
          {
            chunkId: 'para-0-test',
            colors: ['blue'],
            reasons: ['fan-divergence'],
            explanations: ['Test marker'],
            aiRange: { start: 0, end: 10 },
            position: 0,
          },
        ],
      }),
    }));
    vi.doMock('../../hooks/useDiffNavigation', () => ({
      useDiffNavigation: () => ({
        currentIndex: 0,
        totalMarkers: 0,
        navigateToNext: vi.fn(),
        navigateToPrevious: vi.fn(),
      }),
    }));
  });

  it('edits a selected chunk and persists via TranslationPersistenceService', async () => {
    const showNotification = vi.fn();

    const persistUpdatedTranslation = vi.fn(async (_chapterId: string, result: any) => ({
      ...result,
      id: 'translation-1',
      version: 1,
      chapterUrl: 'https://example.com/ch1',
      stableId: _chapterId,
      isActive: true,
    }));

    vi.doMock('../../services/translationPersistenceService', () => ({
      TranslationPersistenceService: {
        persistUpdatedTranslation,
        createNewVersion: vi.fn(),
      },
    }));

    const chapter: ChapterLike = {
      id: 'ch-1',
      title: 'Mock Chapter',
      content: 'Raw content',
      prevUrl: null,
      nextUrl: null,
      fanTranslation: null,
      feedback: [],
      translationResult: {
        translatedTitle: 'Mock Chapter',
        translation: 'This is paragraph 1 of the translation.<br><br>This is paragraph 2 of the translation.',
        proposal: null,
        footnotes: [],
        suggestedIllustrations: [],
        usageMetrics: {
          totalTokens: 100,
          promptTokens: 60,
          completionTokens: 40,
          estimatedCost: 0.001,
          requestTime: 2,
          provider: 'Gemini',
          model: 'gemini-2.5-flash',
        },
      },
    };

    const updateChapterSpy = vi.fn();

    vi.doMock('../../store', () => {
      const useAppStore = create<any>((set, get) => ({
        currentChapterId: chapter.id,
        chapters: new Map([[chapter.id, chapter]]),
        urlIndex: new Map(),
        rawUrlIndex: new Map(),
        navigationHistory: [],

        viewMode: 'english',
        setViewMode: vi.fn(),

        settings: {
          provider: 'Gemini',
          model: 'gemini-2.5-flash',
          temperature: 0.7,
          systemPrompt: 'Test prompt',
          enableHtmlRepair: false,
          showDiffHeatmap: true,
          diffMarkerVisibility: {
            fan: true,
            rawLoss: true,
            rawGain: true,
            sensitivity: true,
            stylistic: true,
          },
          fontSize: 16,
          fontStyle: 'sans',
          lineHeight: 1.6,
        },

        activePromptTemplate: null,
        error: null,
        isLoading: { fetching: false, translating: false },
        hydratingChapters: {},
        imageGenerationMetrics: null,
        chapterAudioMap: new Map(),
        showNotification,

        handleNavigate: vi.fn(),
        handleRetranslateCurrent: vi.fn(),
        cancelTranslation: vi.fn(),
        isTranslationActive: () => false,
        shouldEnableRetranslation: () => false,
        activeTranslations: {},

        loadExistingImages: undefined,
        generateIllustrationForSelection: vi.fn(),

        updateChapter: (chapterId: string, patch: any) => {
          updateChapterSpy(chapterId, patch);
          set((state: any) => {
            const next = new Map(state.chapters);
            const existing = next.get(chapterId);
            next.set(chapterId, { ...existing, ...patch });
            return { chapters: next };
          });
        },
      }));

      return { useAppStore };
    });

    const ChapterView = (await import('../../components/ChapterView')).default;

    render(<ChapterView />);

    await waitFor(() => {
      const firstChunk = document.querySelector<HTMLElement>('span[data-lf-type="text"][data-lf-chunk]');
      expect(firstChunk).toBeTruthy();
    });

    const firstChunk = document.querySelector<HTMLElement>('span[data-lf-type="text"][data-lf-chunk]')!;
    makeSelection(firstChunk);

    // Update selection state used by SelectionOverlay.
    fireEvent.mouseUp(document);

    // Touch selection sheet should appear; click the edit button (✏️).
    await waitFor(() => {
      expect(screen.getByText('✏️')).toBeInTheDocument();
    });

    // Ensure selection still exists at click time for beginInlineEdit().
    makeSelection(firstChunk);
    fireEvent.click(screen.getByText('✏️'));

    // Inline edit should enable contentEditable and show the toolbar.
    const editable = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[contenteditable="true"]');
      expect(el).toBeTruthy();
      return el!;
    });

    // Mutate the DOM text (save reads innerText from the element).
    editable.innerText = 'Edited';

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(persistUpdatedTranslation).toHaveBeenCalledTimes(1);
      expect(updateChapterSpy).toHaveBeenCalledWith(
        chapter.id,
        expect.objectContaining({
          translationResult: expect.anything(),
          translationSettingsSnapshot: expect.anything(),
        })
      );
    });

    // Should not have shown selection validation warnings.
    expect(showNotification).not.toHaveBeenCalledWith(
      'Select text within the translation to edit.',
      expect.anything()
    );

    // After re-render, edited text should be present in the rendered translation.
    await waitFor(() => {
      expect(document.body.textContent).toContain('Edited');
    });
  });
});

