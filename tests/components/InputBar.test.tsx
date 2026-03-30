import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import InputBar from '../../components/InputBar';
import { ImportService } from '../../services/importService';

const storeState = vi.hoisted(() => ({
  handleFetch: vi.fn(),
  activeNovelId: 'orv' as string | null,
  openLibrary: vi.fn(),
  shelveActiveNovel: vi.fn(),
  setReaderLoading: vi.fn(),
  setReaderReady: vi.fn(),
  isLoading: { fetching: false },
  error: null as string | null,
  setError: vi.fn(),
  chapters: new Map(),
  currentChapterId: null as string | null,
}));

const useAppStoreMock = vi.hoisted(() => {
  const hook: any = vi.fn((selector?: (state: typeof storeState) => unknown) => {
    return selector ? selector(storeState) : storeState;
  });
  hook.getState = () => storeState;
  hook.setState = (update: any) => {
    const patch = typeof update === 'function' ? update(storeState) : update;
    Object.assign(storeState, patch);
    return storeState;
  };
  return hook;
});

vi.mock('../../store', () => ({
  useAppStore: useAppStoreMock,
}));

vi.mock('../../config/constants', () => ({
  SUPPORTED_WEBSITES_CONFIG: [
    {
      name: 'Example Site',
      domain: 'example.com',
      homeUrl: 'https://example.com',
      exampleUrl: 'https://example.com/chapter-1',
      category: 'test',
    },
  ],
}));

vi.mock('../../services/importService', () => ({
  ImportService: {
    streamImportFromUrl: vi.fn(),
    importFromFile: vi.fn(),
  },
}));

vi.mock('../../services/readerHydrationService', () => ({
  loadAllIntoStore: vi.fn().mockResolvedValue(null),
}));

describe('InputBar guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.handleFetch.mockReset();
    storeState.openLibrary.mockReset();
    storeState.shelveActiveNovel.mockReset();
    storeState.setReaderLoading.mockReset();
    storeState.setReaderReady.mockReset();
    storeState.setError.mockReset();
    storeState.activeNovelId = 'orv';
    storeState.error = null;
    storeState.chapters = new Map();
    storeState.currentChapterId = null;

    vi.mocked(ImportService.streamImportFromUrl).mockResolvedValue({} as any);
    vi.mocked(ImportService.importFromFile).mockResolvedValue({} as any);
  });

  it('shelves the active library novel before session JSON URL imports', async () => {
    render(<InputBar />);

    fireEvent.change(screen.getByPlaceholderText(/Paste chapter URL or session JSON file URL/i), {
      target: { value: 'https://example.com/session.json' },
    });
    fireEvent.click(screen.getByRole('button', { name: /fetch/i }));

    await waitFor(() => {
      expect(storeState.shelveActiveNovel).toHaveBeenCalledTimes(1);
    });

    expect(storeState.setReaderLoading).toHaveBeenCalledWith(null);
    expect(ImportService.streamImportFromUrl).toHaveBeenCalledWith(
      'https://example.com/session.json',
      expect.any(Function),
      expect.any(Function)
    );
    expect(storeState.shelveActiveNovel.mock.invocationCallOrder[0]).toBeLessThan(
      storeState.setReaderLoading.mock.invocationCallOrder[0]
    );
  });

  it('shelves the active library novel before local file imports', async () => {
    const { container } = render(<InputBar />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{"metadata":{"format":"lexiconforge-session"}}'], 'session.json', {
      type: 'application/json',
    });

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(storeState.shelveActiveNovel).toHaveBeenCalledTimes(1);
    });

    expect(storeState.setReaderLoading).toHaveBeenCalledWith(null);
    expect(ImportService.importFromFile).toHaveBeenCalledWith(file);
    expect(storeState.shelveActiveNovel.mock.invocationCallOrder[0]).toBeLessThan(
      storeState.setReaderLoading.mock.invocationCallOrder[0]
    );
  });

  it('shelves the active library novel before example-site fetches', async () => {
    render(<InputBar />);

    fireEvent.click(screen.getByRole('link', { name: 'Example Site' }));

    await waitFor(() => {
      expect(storeState.shelveActiveNovel).toHaveBeenCalledTimes(1);
    });

    expect(storeState.handleFetch).toHaveBeenCalledWith('https://example.com/chapter-1');
    expect(storeState.shelveActiveNovel.mock.invocationCallOrder[0]).toBeLessThan(
      storeState.handleFetch.mock.invocationCallOrder[0]
    );
  });
});
