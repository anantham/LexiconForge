import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../store';
import { createMockEnhancedChapter } from '../utils/test-data';

const bookshelfStateMock = vi.hoisted(() => ({
  upsertEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/bookshelfStateService', () => ({
  BookshelfStateService: bookshelfStateMock,
  BOOKSHELF_STATE_KEY: 'bookshelf-state',
}));

describe('bookshelf persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      appScreen: 'reader',
      activeNovelId: 'orv',
      activeVersionId: 'alice-v1',
      chapters: new Map([
        ['ch-5', createMockEnhancedChapter({ id: 'ch-5', novelId: 'orv', chapterNumber: 5 })],
        ['ch-7', createMockEnhancedChapter({ id: 'ch-7', novelId: 'orv', chapterNumber: 7 })],
      ]),
      currentChapterId: null,
      navigationHistory: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists the active bookmark immediately when shelving the active novel', async () => {
    useAppStore.setState({ currentChapterId: 'ch-5' });

    useAppStore.getState().shelveActiveNovel();
    await Promise.resolve();

    expect(bookshelfStateMock.upsertEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        novelId: 'orv',
        versionId: 'alice-v1',
        lastChapterId: 'ch-5',
        lastChapterNumber: 5,
      })
    );
    expect(useAppStore.getState().appScreen).toBe('library');
    expect(useAppStore.getState().activeNovelId).toBeNull();
    expect(useAppStore.getState().activeVersionId).toBeNull();
  });

  it('autosaves bookshelf position on chapter changes after the debounce window', async () => {
    vi.useFakeTimers();

    useAppStore.getState().setCurrentChapter('ch-7');
    await vi.advanceTimersByTimeAsync(2000);

    expect(bookshelfStateMock.upsertEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        novelId: 'orv',
        versionId: 'alice-v1',
        lastChapterId: 'ch-7',
        lastChapterNumber: 7,
      })
    );
  });
});
