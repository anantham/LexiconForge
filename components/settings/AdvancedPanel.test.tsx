import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdvancedPanel from './AdvancedPanel';
import { SettingsModalProvider, type SettingsModalContextValue } from './SettingsModalContext';
import type { AppSettings } from '../../types';

const mockStore = {
  getMemoryDiagnostics: vi.fn(),
};

const mockImageDiagnostics = vi.fn();
const mockReadPipelines = vi.fn();
const mockWritePipelines = vi.fn();
const mockLogConfig = vi.fn();

vi.mock('../../hooks/useAdvancedPanelStore', () => ({
  useAdvancedPanelStore: () => mockStore,
}));

vi.mock('../../services/db/operations', () => ({
  ImageOps: {
    getStorageDiagnostics: (...args: any[]) => mockImageDiagnostics(...args),
  },
}));

vi.mock('../../utils/debug', () => ({
  KNOWN_DEBUG_PIPELINES: [
    'indexeddb',
    'comparison',
    'worker',
    'audio',
    'translation',
    'image',
    'memory',
    'diff',
  ],
  getDebugPipelines: () => mockReadPipelines(),
  setDebugPipelines: (...args: any[]) => mockWritePipelines(...args),
  logCurrentDebugConfig: () => mockLogConfig(),
}));

const baseSettings: AppSettings = {
  contextDepth: 2,
  preloadCount: 0,
  fontSize: 16,
  fontStyle: 'serif',
  lineHeight: 1.8,
  systemPrompt: 'prompt',
  provider: 'Gemini',
  model: 'gemini-2.0-pro',
  imageModel: 'none',
  temperature: 0.8,
  topP: 0.9,
  frequencyPenalty: 0.2,
  presencePenalty: 0.1,
  seed: null,
  apiKeyGemini: '',
  apiKeyOpenAI: '',
  apiKeyDeepSeek: '',
  apiKeyClaude: '',
  apiKeyOpenRouter: '',
  apiKeyPiAPI: '',
  imageWidth: 1024,
  imageHeight: 1024,
  imageAspectRatio: '1:1',
  imageSizePreset: '1K',
  defaultNegativePrompt: '',
  defaultGuidanceScale: 7,
  exportOrder: 'number',
  includeTitlePage: true,
  includeStatsPage: true,
  epubGratitudeMessage: '',
  epubProjectDescription: '',
  epubFooter: null,
  maxSessionSize: 10,
  maxOutputTokens: 2000,
  retryMax: 2,
  retryInitialDelayMs: 1000,
  footnoteStrictMode: 'append_missing',
  enableHtmlRepair: true,
  enableAmendments: true,
  includeFanTranslationInPrompt: true,
  showDiffHeatmap: true,
  diffMarkerVisibility: {
    fan: true,
    rawLoss: true,
    rawGain: true,
    sensitivity: true,
    stylistic: true,
  },
  diffAnalysisPrompt: '',
};

const renderPanel = (overrides: Partial<SettingsModalContextValue> = {}) => {
  const ctx: SettingsModalContextValue = {
    currentSettings: baseSettings,
    handleSettingChange: vi.fn(),
    parameterSupport: {
      'Gemini:gemini-2.0-pro': {
        temperature: true,
        topP: true,
        frequencyPenalty: true,
        presencePenalty: true,
        seed: true,
      },
    },
    setParameterSupport: vi.fn(),
    novelMetadata: null,
    handleNovelMetadataChange: vi.fn(),
    ...overrides,
  };

  return render(
    <SettingsModalProvider value={ctx}>
      <AdvancedPanel />
    </SettingsModalProvider>
  );
};

const memoryDiagnostics = {
  totalChapters: 4,
  chaptersWithTranslations: 3,
  chaptersWithImages: 2,
  estimatedRAM: {
    totalMB: 12.3,
    chapterContentBytes: 1024 * 1024,
    base64ImageBytes: 512 * 1024,
  },
  imagesInCache: 2,
  imagesInRAM: 1,
  warnings: ['Too many chapters'],
};

describe('AdvancedPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('LF_AI_DEBUG_LEVEL', 'full');
    mockStore.getMemoryDiagnostics.mockReturnValue(memoryDiagnostics);
    mockReadPipelines.mockReturnValue([]);
    mockImageDiagnostics.mockResolvedValue({
      disk: {
        totalChapters: 10,
        totalTranslations: 6,
        totalImages: 4,
        imagesInCache: 3,
        imagesLegacy: 1,
      },
      quota: {
        usedMB: 100,
        quotaMB: 200,
        percentUsed: 50,
      },
    });
  });

  it('persists logging level changes', async () => {
    renderPanel();
    const select = screen.getAllByRole('combobox')[0];
    await userEvent.selectOptions(select, 'summary');

    expect(localStorage.getItem('LF_AI_DEBUG_LEVEL')).toBe('summary');
    expect(localStorage.getItem('LF_AI_DEBUG')).toBe('1');
    expect(localStorage.getItem('LF_AI_DEBUG_FULL')).toBeNull();
  });

  it('toggles verbose pipelines when developer options are shown', async () => {
    renderPanel();
    const toggleButton = screen.getByRole('button', { name: /show developer logging options/i });
    await userEvent.click(toggleButton);

    const comparisonCheckbox = screen.getByLabelText(/comparison workflow/i);
    await userEvent.click(comparisonCheckbox);

    expect(mockWritePipelines).toHaveBeenCalled();
    const lastCall = mockWritePipelines.mock.calls.pop();
    expect(lastCall?.[0]).not.toContain('comparison');
  });

  it('loads and displays diagnostics when expanded', async () => {
    renderPanel();
    const diagnosticsButton = screen.getByText(/memory & storage diagnostics/i, { selector: 'button' });
    await userEvent.click(diagnosticsButton);

    await waitFor(() => {
      expect(mockImageDiagnostics).toHaveBeenCalled();
    });

    expect(await screen.findByText(/total chapters/i)).toBeInTheDocument();
    expect(screen.getByText(/too many chapters/i)).toBeInTheDocument();
  });

  it('toggles amendment proposals via handleSettingChange', async () => {
    const handleSettingChange = vi.fn();
    renderPanel({ handleSettingChange });

    const toggle = screen.getByLabelText(/enable prompt amendment proposals/i);
    await userEvent.click(toggle);

    expect(handleSettingChange).toHaveBeenCalledWith('enableAmendments', false);
  });
});
