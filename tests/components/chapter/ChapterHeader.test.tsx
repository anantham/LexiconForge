import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import ChapterHeader from '../../../components/chapter/ChapterHeader';

const createProps = () => ({
  title: 'Chapter 1',
  fontStyle: 'serif' as const,
  targetLanguageLabel: 'English',
  viewMode: 'english' as const,
  hasFanTranslation: true,
  sourceUrl: 'https://example.com',
  onToggleLanguage: vi.fn(),
  onNavigatePrev: vi.fn(),
  onNavigateNext: vi.fn(),
  prevDisabled: false,
  nextDisabled: false,
});

describe('ChapterHeader', () => {
  it('renders title, source link, and language toggle', () => {
    const props = createProps();
    render(<ChapterHeader {...props} />);
    expect(screen.getByText('Chapter 1')).toBeInTheDocument();
    expect(screen.getByText('Source')).toHaveAttribute('href', 'https://example.com');
    fireEvent.click(screen.getAllByText('Fan')[0]);
    expect(props.onToggleLanguage).toHaveBeenCalledWith('fan');
  });

  it('disables navigation buttons when requested', () => {
    const props = createProps();
    props.prevDisabled = true;
    props.nextDisabled = true;
    render(<ChapterHeader {...props} />);
    const prevButtons = screen.getAllByText(/prev/i);
    const nextButtons = screen.getAllByText(/next/i);
    prevButtons.forEach((btn) => expect(btn).toBeDisabled());
    nextButtons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it('renders both navigation sections', () => {
    const props = createProps();
    render(<ChapterHeader {...props} />);
    expect(screen.getAllByText(/Next/)).toHaveLength(2);
    expect(screen.getAllByText(/Prev/)).toHaveLength(2);
  });
});
