import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { SectionTreePicker } from '../../../components/library/SectionTreePicker';
import type { ChapterIndexItem } from '../../../services/library/sectionGrouping';

afterEach(cleanup);

// A small slice: Gītā chapter 1 (two verses) and chapter 2 (three verses).
const chapters: ChapterIndexItem[] = [
  { chapterNumber: 1001, title: '1.1' },
  { chapterNumber: 1002, title: '1.2' },
  { chapterNumber: 2047, title: '2.47' },
  { chapterNumber: 2048, title: '2.48' },
  { chapterNumber: 2072, title: '2.72' },
];

describe('SectionTreePicker', () => {
  it('renders group headers with Gītā chapter names and verse counts, collapsed by default', () => {
    render(<SectionTreePicker chapters={chapters} onSelectVerse={vi.fn()} />);

    expect(screen.getByText('Chapter 1')).toBeInTheDocument();
    expect(screen.getByText('Chapter 2')).toBeInTheDocument();
    expect(screen.getByText('Sāṅkhya Yoga')).toBeInTheDocument();
    expect(screen.getByText('2 verses')).toBeInTheDocument(); // chapter 1
    expect(screen.getByText('3 verses')).toBeInTheDocument(); // chapter 2

    // Collapsed: the toggle reports not-expanded and verse rows are absent.
    const toggle = screen.getByRole('button', { name: /Chapter 2/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('2.47')).not.toBeInTheDocument();
  });

  it('expands a group to reveal its verses and updates aria-expanded', () => {
    render(<SectionTreePicker chapters={chapters} onSelectVerse={vi.fn()} />);

    const toggle = screen.getByRole('button', { name: /Chapter 2/ });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('2.47')).toBeInTheDocument();
    expect(screen.getByText('2.48')).toBeInTheDocument();
    expect(screen.getByText('2.72')).toBeInTheDocument();
    // Other group stays collapsed (lazy render).
    expect(screen.queryByText('1.1')).not.toBeInTheDocument();
  });

  it('invokes onSelectVerse with the encoded chapterNumber when a verse is clicked', () => {
    const onSelectVerse = vi.fn();
    render(<SectionTreePicker chapters={chapters} onSelectVerse={onSelectVerse} />);

    fireEvent.click(screen.getByRole('button', { name: /Chapter 2/ }));
    fireEvent.click(screen.getByText('2.47'));

    expect(onSelectVerse).toHaveBeenCalledTimes(1);
    expect(onSelectVerse).toHaveBeenCalledWith(2047);
  });

  it('opens a group at its first verse via the group play control', () => {
    const onSelectVerse = vi.fn();
    render(<SectionTreePicker chapters={chapters} onSelectVerse={onSelectVerse} />);

    // The "read from here" control is labeled with the first verse of the group.
    fireEvent.click(screen.getByRole('button', { name: /Read from verse 2\.47/ }));
    expect(onSelectVerse).toHaveBeenCalledWith(2047);
  });

  it('expand-all reveals every group, collapse-all hides them again', () => {
    render(<SectionTreePicker chapters={chapters} onSelectVerse={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /expand all/i }));
    expect(screen.getByText('1.1')).toBeInTheDocument();
    expect(screen.getByText('2.47')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /collapse all/i }));
    expect(screen.queryByText('1.1')).not.toBeInTheDocument();
    expect(screen.queryByText('2.47')).not.toBeInTheDocument();
  });

  it('honors defaultExpandedGroups', () => {
    render(
      <SectionTreePicker chapters={chapters} onSelectVerse={vi.fn()} defaultExpandedGroups={[1]} />,
    );
    expect(screen.getByText('1.1')).toBeInTheDocument();
    expect(screen.queryByText('2.47')).not.toBeInTheDocument();
  });

  it('renders nothing when the chapter list is empty', () => {
    const { container } = render(<SectionTreePicker chapters={[]} onSelectVerse={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
