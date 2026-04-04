import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const {
  importCustomTextMock,
  handleFetchMock,
  setErrorMock,
  importFromFileMock,
  streamImportFromUrlMock,
  fetchChaptersForReactRenderingMock,
} = vi.hoisted(() => ({
  importCustomTextMock: vi.fn(),
  handleFetchMock: vi.fn(),
  setErrorMock: vi.fn(),
  importFromFileMock: vi.fn(),
  streamImportFromUrlMock: vi.fn(),
  fetchChaptersForReactRenderingMock: vi.fn(),
}));

const storeState = {
  handleFetch: handleFetchMock,
  importCustomText: importCustomTextMock,
  isLoading: { fetching: false },
  error: null as string | null,
  setError: setErrorMock,
};

vi.mock('../../store', () => ({
  useAppStore: vi.fn((selector) => (selector ? selector(storeState) : storeState)),
}));

vi.mock('../../services/importService', () => ({
  ImportService: {
    importFromFile: importFromFileMock,
    streamImportFromUrl: streamImportFromUrlMock,
  },
}));

vi.mock('../../services/db/operations/rendering', () => ({
  fetchChaptersForReactRendering: fetchChaptersForReactRenderingMock,
}));

import InputBar from '../../components/InputBar';

describe('InputBar paste import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.error = null;
  });

  it('keeps pasted fields intact when custom text import fails', async () => {
    importCustomTextMock.mockResolvedValue(undefined);

    render(<InputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Paste Text' }));
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Custom Chapter' },
    });
    fireEvent.change(screen.getByLabelText('Source Language'), {
      target: { value: 'Chinese' },
    });
    fireEvent.change(screen.getByLabelText('Content'), {
      target: { value: 'Pasted chapter content' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Import Text' }));

    await waitFor(() => {
      expect(importCustomTextMock).toHaveBeenCalledWith(
        'Custom Chapter',
        'Pasted chapter content',
        'Chinese',
      );
    });

    expect(screen.getByLabelText('Title')).toHaveValue('Custom Chapter');
    expect(screen.getByLabelText('Source Language')).toHaveValue('Chinese');
    expect(screen.getByLabelText('Content')).toHaveValue('Pasted chapter content');
  });

  it('clears pasted fields after a successful custom text import', async () => {
    importCustomTextMock.mockResolvedValue('chapter-1');

    render(<InputBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Paste Text' }));
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Custom Chapter' },
    });
    fireEvent.change(screen.getByLabelText('Source Language'), {
      target: { value: 'Chinese' },
    });
    fireEvent.change(screen.getByLabelText('Content'), {
      target: { value: 'Pasted chapter content' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Import Text' }));

    await waitFor(() => {
      expect(importCustomTextMock).toHaveBeenCalledWith(
        'Custom Chapter',
        'Pasted chapter content',
        'Chinese',
      );
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toHaveValue('');
      expect(screen.getByLabelText('Source Language')).toHaveValue('');
      expect(screen.getByLabelText('Content')).toHaveValue('');
    });
  });
});
