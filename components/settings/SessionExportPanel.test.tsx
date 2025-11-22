import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type React from 'react';
import SessionExportPanel from './SessionExportPanel';
import { SettingsModalProvider } from './SettingsModalContext';
import type { AppSettings } from '../../types';
import type { PublisherMetadata } from './types';

const showNotification = vi.fn();

vi.mock('../../hooks/useExportPanelStore', () => ({
  useExportPanelStore: () => ({ showNotification }),
}));

const exportServiceMocks = vi.hoisted(() => ({
  generateQuickExport: vi.fn().mockResolvedValue({ data: 'session' }),
  downloadJSON: vi.fn().mockResolvedValue(undefined),
  generateMetadataFile: vi.fn().mockResolvedValue({ id: 'novel-id' }),
  generatePublishExport: vi.fn().mockResolvedValue({ session: 'data' }),
  saveToDirectory: vi.fn().mockResolvedValue(undefined),
  updateRegistry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/exportService', () => ({
  ExportService: exportServiceMocks,
}));

const baseSettings: AppSettings = {
  provider: 'Gemini',
  model: 'gemini-2.5-pro',
  temperature: 0.5,
  contextDepth: 2,
  preloadCount: 0,
  fontSize: 16,
  fontStyle: 'serif',
  lineHeight: 1.5,
  systemPrompt: 'prompt',
  imageModel: 'none',
  showDiffHeatmap: true,
  maxSessionSize: 10,
};

const baseMetadata: PublisherMetadata = {
  title: 'Novel',
  author: 'Author',
  description: 'Description',
  chapterCount: 1,
  genres: [],
  originalLanguage: 'Korean',
  lastUpdated: '2024-01-01',
};

type SettingsModalProviderProps = React.ComponentProps<typeof SettingsModalProvider>;

const renderPanel = ({
  metadata,
  handleSettingChange = vi.fn(),
  onRequireMetadata = vi.fn(),
}: {
  metadata: PublisherMetadata | null;
  handleSettingChange?: SettingsModalProviderProps['value']['handleSettingChange'];
  onRequireMetadata?: () => void;
}) => {
  render(
    <SettingsModalProvider
      value={{
        currentSettings: baseSettings,
        handleSettingChange,
        parameterSupport: {},
        setParameterSupport: vi.fn(),
        novelMetadata: metadata,
        handleNovelMetadataChange: vi.fn(),
      }}
    >
      <SessionExportPanel onRequireMetadata={onRequireMetadata} />
    </SettingsModalProvider>
  );

  return { onRequireMetadata };
};

describe('SessionExportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs quick export when button clicked', async () => {
    const user = userEvent.setup();
    renderPanel({ metadata: baseMetadata });
    await user.click(screen.getByRole('button', { name: /quick export/i }));
    expect(exportServiceMocks.generateQuickExport).toHaveBeenCalled();
    expect(exportServiceMocks.downloadJSON).toHaveBeenCalledWith({ data: 'session' }, 'session.json');
  });

  it('requests metadata tab when publishing without metadata', async () => {
    const user = userEvent.setup();
    const { onRequireMetadata } = renderPanel({ metadata: null });
    await user.click(screen.getByRole('button', { name: /publish to library/i }));
    expect(onRequireMetadata).toHaveBeenCalled();
    expect(exportServiceMocks.generateMetadataFile).not.toHaveBeenCalled();
  });
});
