import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NovelMetadataForm } from '../../components/NovelMetadataForm';

describe('NovelMetadataForm', () => {
  it('should render all form fields', () => {
    render(<NovelMetadataForm onSave={vi.fn()} />);

    expect(screen.getByLabelText(/^Title \*$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Author \*$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Description \*$/)).toBeInTheDocument();
    expect(screen.getByLabelText('Original Language')).toBeInTheDocument();
    expect(screen.getByLabelText(/Genres \(comma-separated\)/)).toBeInTheDocument();
  });

  it('should call onSave with form data', () => {
    const onSave = vi.fn();
    render(<NovelMetadataForm onSave={onSave} />);

    fireEvent.change(screen.getByLabelText(/^Title \*$/), { target: { value: 'Test Novel' } });
    fireEvent.change(screen.getByLabelText(/^Author \*$/), { target: { value: 'Test Author' } });
    fireEvent.change(screen.getByLabelText(/^Description \*$/), { target: { value: 'Test Description' } });
    fireEvent.click(screen.getByText('Save Metadata'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        author: 'Test Author',
        description: 'Test Description'
      })
    );
  });

  it('should validate required fields', () => {
    const onSave = vi.fn();
    render(<NovelMetadataForm onSave={onSave} />);

    fireEvent.click(screen.getByText('Save Metadata'));

    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
