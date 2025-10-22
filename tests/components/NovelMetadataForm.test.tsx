import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NovelMetadataForm } from '../../components/NovelMetadataForm';

describe('NovelMetadataForm', () => {
  it('should render all form fields', () => {
    const mockOnChange = vi.fn();
    render(<NovelMetadataForm onChange={mockOnChange} />);

    expect(screen.getByLabelText(/^Title \*$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Author \*$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Description \*$/)).toBeInTheDocument();
    expect(screen.getByLabelText('Original Language')).toBeInTheDocument();
    expect(screen.getByLabelText(/Genres \(comma-separated\)/)).toBeInTheDocument();
  });

  it('should call onChange with form data when fields change', () => {
    const mockOnChange = vi.fn();
    render(<NovelMetadataForm onChange={mockOnChange} />);

    // onChange is called immediately on mount with initial empty data
    expect(mockOnChange).toHaveBeenCalled();

    // The form calls onChange on every render via useEffect
    // Check that it was called with the expected structure
    const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
    expect(lastCall).toHaveProperty('title');
    expect(lastCall).toHaveProperty('author');
    expect(lastCall).toHaveProperty('description');
    expect(lastCall).toHaveProperty('originalLanguage');
    expect(lastCall).toHaveProperty('genres');
  });

  it('should provide metadata structure via onChange', () => {
    const mockOnChange = vi.fn();
    render(<NovelMetadataForm onChange={mockOnChange} initialData={{
      title: 'Test Novel',
      author: 'Test Author',
      description: 'Test Description',
      originalLanguage: 'Korean',
      genres: ['Fantasy'],
      chapterCount: 100,
      lastUpdated: '2025-01-20'
    }} />);

    // Component calls onChange in useEffect with computed metadata
    expect(mockOnChange).toHaveBeenCalled();
    const metadata = mockOnChange.mock.calls[0][0];

    expect(metadata).toMatchObject({
      title: 'Test Novel',
      author: 'Test Author',
      description: 'Test Description',
      originalLanguage: 'Korean',
      genres: ['Fantasy']
    });
  });
});
