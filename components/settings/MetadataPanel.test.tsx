import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MetadataPanel from './MetadataPanel';
import { SettingsModalProvider } from './SettingsModalContext';
import type { AppSettings } from '../../types';
import type { PublisherMetadata } from './types';

vi.mock('../NovelMetadataForm', () => ({
  NovelMetadataForm: ({ initialData, onChange }: any) => (
    <div>
      <div data-testid="initial-title">{initialData?.title ?? 'missing'}</div>
      <button onClick={() => onChange({ ...(initialData || {}), title: 'Updated Title' })}>Update</button>
    </div>
  ),
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

const renderPanel = (value: Partial<PublisherMetadata> = {}) => {
  const novelMetadata: PublisherMetadata = {
    description: 'desc',
    chapterCount: 1,
    genres: [],
    originalLanguage: 'Korean',
    lastUpdated: '2024-01-01',
    ...value,
  };

  const handleNovelMetadataChange = vi.fn();

  render(
    <SettingsModalProvider
      value={{
        currentSettings: baseSettings,
        handleSettingChange: vi.fn(),
        parameterSupport: {},
        setParameterSupport: vi.fn(),
        novelMetadata,
        handleNovelMetadataChange,
      }}
    >
      <MetadataPanel />
    </SettingsModalProvider>
  );

  return { handleNovelMetadataChange };
};

describe('MetadataPanel', () => {
  it('passes existing metadata to the form', () => {
    renderPanel({ title: 'Existing Title' });
    expect(screen.getByTestId('initial-title')).toHaveTextContent('Existing Title');
  });

  it('forwards changes via context handler', async () => {
    const user = userEvent.setup();
    const { handleNovelMetadataChange } = renderPanel({ title: 'Existing Title' });
    await user.click(screen.getByText('Update'));
    expect(handleNovelMetadataChange).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Updated Title' })
    );
  });
});
