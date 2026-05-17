import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import ChapterHeader from '../../../components/chapter/ChapterHeader';

const createProps = (): React.ComponentProps<typeof ChapterHeader> => ({
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

  it('renders a library button when provided and invokes it', () => {
    const props = createProps();
    props.onOpenLibrary = vi.fn();
    render(<ChapterHeader {...props} />);

    // Issue #10 (2026-05-15): label text "Library" replaced with home icon.
    // Query by aria-label instead of text.
    fireEvent.click(screen.getAllByLabelText('Return to library (home)')[0]);

    expect(props.onOpenLibrary).toHaveBeenCalledTimes(1);
  });

  // Issue #10 regression — library label → home icon. Verified to FAIL on
  // pre-fix code (where the button rendered the literal text "Library").
  describe('issue #10 — library label replaced by home icon', () => {
    it('does NOT render literal "Library" text in the library button', () => {
      const props = createProps();
      props.onOpenLibrary = vi.fn();
      render(<ChapterHeader {...props} />);
      const buttons = screen.getAllByLabelText('Return to library (home)');
      buttons.forEach((btn) => {
        expect(btn.textContent?.trim()).toBe('');
      });
    });

    it('renders an SVG home icon inside the library button', () => {
      const props = createProps();
      props.onOpenLibrary = vi.fn();
      render(<ChapterHeader {...props} />);
      const buttons = screen.getAllByLabelText('Return to library (home)');
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach((btn) => {
        const svg = btn.querySelector('svg');
        expect(svg).not.toBeNull();
        const path = svg?.querySelector('path');
        expect(path?.getAttribute('d')).toContain('M3 9.5');
      });
    });

    it('preserves the existing title tooltip for hover', () => {
      const props = createProps();
      props.onOpenLibrary = vi.fn();
      render(<ChapterHeader {...props} />);
      const buttons = screen.getAllByLabelText('Return to library (home)');
      buttons.forEach((btn) => {
        expect(btn.getAttribute('title')).toBe('Return to the novel library');
      });
    });
  });
});
