import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChapterDropdown } from '../../../components/session-info/ChapterDropdown';

const { handleNavigateMock } = vi.hoisted(() => ({
  handleNavigateMock: vi.fn(),
}));

vi.mock('../../../store', () => ({
  useAppStore: vi.fn((selector: (state: any) => unknown) => selector({
    handleNavigate: handleNavigateMock,
    chapters: new Map(),
  })),
}));

vi.mock('../../../hooks/useChapterDropdownOptions', () => ({
  useChapterDropdownOptions: () => ({
    isLoading: false,
    isEmpty: false,
    options: [
      {
        stableId: 'ready-1',
        canonicalUrl: 'lexiconforge://novel/chapter/1',
        title: 'Chapter 1',
        chapterNumber: 1,
        hasTranslation: true,
        hasImages: false,
        displayLabel: 'Chapter 1',
        displayNumber: 1,
        availability: 'ready',
      },
      {
        stableId: 'virtual:novel:2',
        canonicalUrl: 'lexiconforge://novel/chapter/2',
        title: 'Chapter 2',
        chapterNumber: 2,
        hasTranslation: false,
        hasImages: false,
        displayLabel: 'Chapter 2',
        displayNumber: 2,
        availability: 'not-cached',
      },
      {
        stableId: 'virtual:novel:3',
        canonicalUrl: 'lexiconforge://novel/chapter/3',
        title: 'Chapter 3',
        chapterNumber: 3,
        hasTranslation: false,
        hasImages: false,
        displayLabel: 'Chapter 3',
        displayNumber: 3,
        availability: 'remote',
      },
    ],
  }),
}));

describe('ChapterDropdown availability', () => {
  it('keeps projected chapters visible but disables and labels them until cached', () => {
    render(<ChapterDropdown currentChapterId="ready-1" />);

    expect(screen.getByRole('option', { name: /Chapter 1/ })).toBeEnabled();
    expect(screen.getByRole('option', { name: /Chapter 2.*not cached yet/i })).toBeDisabled();
    expect(screen.getByRole('option', { name: /Chapter 3.*download on select/i })).toBeEnabled();
  });

  it('navigates to an enabled remote artifact identity', () => {
    render(<ChapterDropdown currentChapterId="ready-1" />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'virtual:novel:3' } });

    expect(handleNavigateMock).toHaveBeenCalledWith('lexiconforge://novel/chapter/3');
  });
});
