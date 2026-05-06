/**
 * Tests for the ChapterDropdown translation-status indicator.
 *
 * Per user request from issue #19 conversation: "a small green dot or red dot
 * or something that lets me know which of the n next chapters have been
 * preloaded." Native <option> elements only support text, so we prefix with
 * ● for translated chapters and · for untranslated ones (placeholder for
 * vertical alignment).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChapterDropdown } from '../../components/session-info/ChapterDropdown';
import type { ChapterDropdownOption } from '../../hooks/useChapterDropdownOptions';

const handleNavigate = vi.fn();

const storeState = {
  handleNavigate,
  chapters: new Map(),
};

vi.mock('../../store', () => ({
  useAppStore: vi.fn((selector) => (selector ? selector(storeState) : storeState)),
}));

const mockHookResult = {
  options: [] as ChapterDropdownOption[],
  isLoading: false,
  isEmpty: false,
};

vi.mock('../../hooks/useChapterDropdownOptions', () => ({
  useChapterDropdownOptions: () => mockHookResult,
  buildChapterDisplayLabel: (title: string) => title,
}));

const makeOption = (overrides: Partial<ChapterDropdownOption>): ChapterDropdownOption => ({
  stableId: 'ch-stub',
  canonicalUrl: 'https://example.com/ch',
  title: 'Stub',
  translatedTitle: undefined,
  chapterNumber: 1,
  hasTranslation: false,
  hasImages: false,
  lastAccessed: undefined,
  lastTranslatedAt: undefined,
  displayLabel: 'Ch 1: Stub',
  displayNumber: 1,
  ...overrides,
});

describe('ChapterDropdown — translation-status indicator', () => {
  // textContent normalizes whitespace differently across React versions; assert
  // by prefix character and label substring rather than exact string equality.
  const startsWithDoneIndicator = (s: string | null) => !!s?.trim().startsWith('●');
  const startsWithRawIndicator = (s: string | null) => !!s?.trim().startsWith('·');

  it('prefixes translated chapters with ●', () => {
    mockHookResult.options = [
      makeOption({ stableId: 'ch-1', displayLabel: 'Ch 1: Done', hasTranslation: true }),
    ];
    mockHookResult.isLoading = false;
    mockHookResult.isEmpty = false;

    render(<ChapterDropdown currentChapterId="ch-1" />);
    const option = screen.getByRole('option') as HTMLOptionElement;
    expect(startsWithDoneIndicator(option.textContent)).toBe(true);
    expect(option.textContent).toContain('Ch 1: Done');
  });

  it('prefixes untranslated chapters with · (placeholder for alignment)', () => {
    mockHookResult.options = [
      makeOption({ stableId: 'ch-2', displayLabel: 'Ch 2: Raw', hasTranslation: false }),
    ];

    render(<ChapterDropdown currentChapterId="ch-2" />);
    const option = screen.getByRole('option') as HTMLOptionElement;
    expect(startsWithRawIndicator(option.textContent)).toBe(true);
    expect(option.textContent).toContain('Ch 2: Raw');
  });

  it('renders both indicator types in the same dropdown when chapters mix', () => {
    mockHookResult.options = [
      makeOption({ stableId: 'ch-1', displayLabel: 'Ch 1: Done', hasTranslation: true }),
      makeOption({ stableId: 'ch-2', displayLabel: 'Ch 2: Raw', hasTranslation: false }),
      makeOption({ stableId: 'ch-3', displayLabel: 'Ch 3: Done', hasTranslation: true }),
    ];

    render(<ChapterDropdown currentChapterId="ch-1" />);
    const options = screen.getAllByRole('option') as HTMLOptionElement[];
    expect(options).toHaveLength(3);
    expect(startsWithDoneIndicator(options[0].textContent)).toBe(true);
    expect(startsWithRawIndicator(options[1].textContent)).toBe(true);
    expect(startsWithDoneIndicator(options[2].textContent)).toBe(true);
  });

  it('renders loading state without options when isLoading=true', () => {
    mockHookResult.options = [];
    mockHookResult.isLoading = true;
    mockHookResult.isEmpty = false;

    render(<ChapterDropdown currentChapterId={null} />);
    expect(screen.getByText(/Loading chapters/i)).toBeInTheDocument();
    expect(screen.queryByRole('option')).toBeNull();
  });
});
