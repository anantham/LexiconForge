/**
 * Tests for BackgroundWorkBanner — Phase 2c of issue #19 / CORE-012.
 *
 * The banner surfaces in-flight translations for chapters the user is NOT
 * currently viewing. It hides itself when there's no background work, and
 * navigates to a chapter on click.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BackgroundWorkBanner from '../../components/BackgroundWorkBanner';

const setCurrentChapter = vi.fn();

const storeState: {
  pendingTranslations: Set<string>;
  currentChapterId: string | null;
  chapters: Map<string, { title?: string; translatedTitle?: string }>;
  setCurrentChapter: typeof setCurrentChapter;
} = {
  pendingTranslations: new Set(),
  currentChapterId: null,
  chapters: new Map(),
  setCurrentChapter,
};

vi.mock('../../store', () => ({
  useAppStore: vi.fn((selector) => (selector ? selector(storeState) : storeState)),
}));

describe('BackgroundWorkBanner', () => {
  beforeEach(() => {
    storeState.pendingTranslations = new Set();
    storeState.currentChapterId = null;
    storeState.chapters = new Map();
    setCurrentChapter.mockReset();
  });

  it('renders nothing when there are no pending translations', () => {
    const { container } = render(<BackgroundWorkBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the only pending translation is the current chapter', () => {
    storeState.pendingTranslations = new Set(['ch-1']);
    storeState.currentChapterId = 'ch-1';
    storeState.chapters = new Map([['ch-1', { title: 'Chapter 1' }]]);

    const { container } = render(<BackgroundWorkBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders when a translation is pending for a non-current chapter, preferring translatedTitle', () => {
    storeState.pendingTranslations = new Set(['ch-bg']);
    storeState.currentChapterId = 'ch-current';
    storeState.chapters = new Map([
      ['ch-bg', { translationResult: { translatedTitle: 'Background Chapter Title' } } as any],
      ['ch-current', { title: 'Current Chapter' }],
    ]);

    render(<BackgroundWorkBanner />);
    expect(screen.getByText(/Background Chapter Title/)).toBeInTheDocument();
  });

  it('shows "+N more" when multiple background translations are pending', () => {
    storeState.pendingTranslations = new Set(['ch-1', 'ch-2', 'ch-3']);
    storeState.currentChapterId = 'ch-current';
    storeState.chapters = new Map([
      ['ch-1', { title: 'Chapter 1' }],
      ['ch-2', { title: 'Chapter 2' }],
      ['ch-3', { title: 'Chapter 3' }],
    ]);

    render(<BackgroundWorkBanner />);
    expect(screen.getByText(/\+2 more/)).toBeInTheDocument();
  });

  it('clicking the banner navigates to the first background chapter', () => {
    storeState.pendingTranslations = new Set(['ch-bg']);
    storeState.currentChapterId = 'ch-current';
    storeState.chapters = new Map([['ch-bg', { title: 'BG Chapter' }]]);

    render(<BackgroundWorkBanner />);
    fireEvent.click(screen.getByRole('button'));
    expect(setCurrentChapter).toHaveBeenCalledWith('ch-bg');
  });

  it('falls back to chapter id when no title is available', () => {
    storeState.pendingTranslations = new Set(['mystery-id']);
    storeState.currentChapterId = 'ch-current';
    storeState.chapters = new Map();

    render(<BackgroundWorkBanner />);
    expect(screen.getByText(/mystery-id/)).toBeInTheDocument();
  });
});
