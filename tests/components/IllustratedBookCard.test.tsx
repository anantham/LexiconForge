import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { NovelCard } from '../../components/NovelCard';
import { ILLUSTRATED_BOOK_ENTRIES, getIllustratedBook } from '../../services/library/illustratedBooks';

afterEach(cleanup);

describe('illustrated book on the library shelf', () => {
  it('opens the same-site comic as a keyboard-accessible link without prose import', () => {
    const onViewDetails = vi.fn(), onSelect = vi.fn();
    render(<NovelCard novel={ILLUSTRATED_BOOK_ENTRIES[0]} onViewDetails={onViewDetails} onSelect={onSelect} translatedCount={12} />);
    const link = screen.getByRole('link', { name: 'Read The Occasion' });
    expect(link).toHaveAttribute('href', '/comics/the-occasion/');
    const editorial = screen.getByRole('link', { name: 'Editorial companion for The Occasion' });
    expect(editorial).toHaveAttribute('href', '/comics/the-occasion/editorial/');
    expect(editorial.closest('a a')).toBeNull();
    expect(link.contains(editorial)).toBe(false);
    expect(screen.getByText('45 pages')).toBeInTheDocument();
    expect(screen.queryByText(/chapters/)).not.toBeInTheDocument();
    // Prevent navigation in the synthetic DOM; the real link is browser-tested.
    link.addEventListener('click', event => event.preventDefault());
    fireEvent.click(link);
    expect(onViewDetails).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('preserves prose details and uses only curated reader destinations', () => {
    const prose = { ...ILLUSTRATED_BOOK_ENTRIES[0], id: 'ordinary-novel', title: 'A novel' };
    const onViewDetails = vi.fn();
    render(<NovelCard novel={prose} onViewDetails={onViewDetails} />);
    fireEvent.click(screen.getByText('A novel'));
    expect(onViewDetails).toHaveBeenCalledWith(prose);
    expect(screen.getByText('45 chapters')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(getIllustratedBook('javascript:alert(1)')).toBeUndefined();
  });
});
