import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockChapter = {
  id: string;
  title: string;
  content: string;
  originalUrl: string;
  canonicalUrl: string;
  chapterNumber: number;
  translationResult: null;
};

type MockStoreState = {
  currentChapterId: string | null;
  appScreen: 'library' | 'reader-loading' | 'reader';
  viewMode: 'original' | 'fan' | 'english';
  isLoading: { fetching: boolean; translating: boolean };
  settings: { provider: string; model: string; temperature: number };
  isTranslationActive: (chapterId: string) => boolean;
  handleTranslate: (chapterId: string, origin?: 'auto_translate' | 'manual_translate') => Promise<void> | void;
  handleFetch: (url: string) => Promise<string | undefined>;
  amendmentProposals: any[];
  acceptProposal: (index: number) => void;
  rejectProposal: (index: number) => void;
  editAndAcceptProposal: (change: string, index: number) => void;
  showSettingsModal: boolean;
  setShowSettingsModal: (isOpen: boolean) => void;
  loadPromptTemplates: () => Promise<void>;
  getChapter: (chapterId: string) => MockChapter | null;
  hasTranslationSettingsChanged: (chapterId: string) => boolean;
  handleNavigate: (url: string) => Promise<void>;
  isInitialized: boolean;
  initializeStore: () => Promise<void>;
  chapters: Map<string, MockChapter>;
  pendingTranslations: Set<string>;
  hasImagesInProgress: () => boolean;
  preloadNextChapters: () => void;
};

let storeState: MockStoreState;

const createChapter = (id = 'ch-1'): MockChapter => ({
  id,
  title: 'Chapter 1',
  content: 'Content',
  originalUrl: `https://example.com/${id}`,
  canonicalUrl: `https://example.com/${id}`,
  chapterNumber: 1,
  translationResult: null,
});

const resetStoreState = () => {
  const chapters = new Map<string, MockChapter>();
  storeState = {
    currentChapterId: null,
    appScreen: 'library',
    viewMode: 'english',
    isLoading: { fetching: false, translating: false },
    settings: { provider: 'Gemini', model: 'gemini-2.5-flash', temperature: 0.7 },
    isTranslationActive: vi.fn(() => false),
    handleTranslate: vi.fn().mockResolvedValue(undefined),
    handleFetch: vi.fn().mockResolvedValue(undefined),
    amendmentProposals: [],
    acceptProposal: vi.fn(),
    rejectProposal: vi.fn(),
    editAndAcceptProposal: vi.fn(),
    showSettingsModal: false,
    setShowSettingsModal: vi.fn(),
    loadPromptTemplates: vi.fn().mockResolvedValue(undefined),
    getChapter: (chapterId: string) => chapters.get(chapterId) ?? null,
    hasTranslationSettingsChanged: vi.fn(() => false),
    handleNavigate: vi.fn().mockResolvedValue(undefined),
    isInitialized: true,
    initializeStore: vi.fn().mockResolvedValue(undefined),
    chapters,
    pendingTranslations: new Set<string>(),
    hasImagesInProgress: vi.fn(() => false),
    preloadNextChapters: vi.fn(),
  };
};

const useAppStoreMock = vi.fn((selector: (state: MockStoreState) => unknown) =>
  selector ? selector(storeState) : storeState
);
(useAppStoreMock as any).getState = () => storeState;

vi.mock('../../store', () => ({
  useAppStore: useAppStoreMock,
}));

vi.mock('../../components/InputBar', () => ({
  default: () => <div>InputBarMock</div>,
}));

vi.mock('../../components/ChapterView', () => ({
  default: () => <div>ChapterViewMock</div>,
}));

vi.mock('../../components/AmendmentModal', () => ({
  default: () => <div>AmendmentModalMock</div>,
}));

vi.mock('../../components/SessionInfo', () => ({
  default: () => <div>SessionInfoMock</div>,
}));

vi.mock('../../components/SettingsModal', () => ({
  default: () => <div>SettingsModalMock</div>,
}));

vi.mock('../../components/Loader', () => ({
  default: ({ text }: { text: string }) => <div>{text}</div>,
}));

vi.mock('../../components/MigrationRecovery', () => ({
  default: () => <div>MigrationRecoveryMock</div>,
}));

vi.mock('../../components/LandingPage', () => ({
  LandingPage: () => <div>LandingPageMock</div>,
}));

vi.mock('../../components/DefaultKeyBanner', () => ({
  DefaultKeyBanner: () => <div>DefaultKeyBannerMock</div>,
}));

vi.mock('../../services/aiService', () => ({
  validateApiKey: vi.fn(() => ({ isValid: true })),
}));

vi.mock('../../services/db/core/connection', () => ({
  prepareConnection: vi.fn().mockResolvedValue({ status: 'ok' }),
}));

vi.mock('../../services/db/core/versionGate', () => ({
  shouldBlockApp: vi.fn(() => false),
}));

vi.mock('../../services/diff/DiffTriggerService', () => ({}));

vi.mock('@vercel/analytics/react', () => ({
  Analytics: () => null,
}));

describe('MainApp appScreen integration', () => {
  beforeEach(() => {
    cleanup();
    resetStoreState();
    window.history.replaceState({}, '', '/app');
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the library even when chapters are already loaded if appScreen is library', async () => {
    const chapter = createChapter();
    storeState.chapters.set(chapter.id, chapter);
    storeState.currentChapterId = chapter.id;
    storeState.appScreen = 'library';

    const MainApp = (await import('../../MainApp')).default;
    render(<MainApp />);

    await waitFor(() => {
      expect(screen.getByText('LandingPageMock')).toBeInTheDocument();
    });

    expect(screen.queryByText('ChapterViewMock')).not.toBeInTheDocument();
  });

  it('shows a dedicated reader-loading state while the reader is hydrating', async () => {
    storeState.appScreen = 'reader-loading';

    const MainApp = (await import('../../MainApp')).default;
    render(<MainApp />);

    await waitFor(() => {
      expect(screen.getByText('Opening Reader...')).toBeInTheDocument();
    });
  });

  it('shows reader chrome only when appScreen is reader', async () => {
    const chapter = createChapter();
    storeState.chapters.set(chapter.id, chapter);
    storeState.currentChapterId = chapter.id;
    storeState.appScreen = 'reader';

    const MainApp = (await import('../../MainApp')).default;
    render(<MainApp />);

    await waitFor(() => {
      expect(screen.getByText('InputBarMock')).toBeInTheDocument();
    });

    expect(screen.getByText('SessionInfoMock')).toBeInTheDocument();
    expect(screen.getByText('ChapterViewMock')).toBeInTheDocument();
    expect(screen.queryByText('LandingPageMock')).not.toBeInTheDocument();
  });
});
