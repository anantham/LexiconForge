import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TemplatePanel from './TemplatePanel';
import { SettingsModalProvider } from './SettingsModalContext';
import type { AppSettings } from '../../types';

const baseSettings: AppSettings = {
  provider: 'Gemini',
  model: 'gemini-2.5-pro',
  temperature: 0.5,
  contextDepth: 2,
  preloadCount: 0,
  fontSize: 16,
  fontStyle: 'serif',
  lineHeight: 1.6,
  systemPrompt: 'prompt',
  imageModel: 'none',
  showDiffHeatmap: true,
  maxSessionSize: 10,
};

const renderPanel = (overrides: Partial<AppSettings> = {}) => {
  const handleSettingChange = vi.fn();
  const ctx = {
    currentSettings: { ...baseSettings, ...overrides },
    handleSettingChange,
    parameterSupport: {},
    setParameterSupport: vi.fn(),
    novelMetadata: null,
    handleNovelMetadataChange: vi.fn(),
  };

  render(
    <SettingsModalProvider value={ctx}>
      <TemplatePanel />
    </SettingsModalProvider>
  );

  return { handleSettingChange };
};

describe('TemplatePanel', () => {
  it('updates gratitude message setting', async () => {
    const { handleSettingChange } = renderPanel();
    const textarea = screen.getByLabelText(/gratitude message/i);
    fireEvent.change(textarea, { target: { value: 'Thanks!' } });
    expect(handleSettingChange).toHaveBeenLastCalledWith('epubGratitudeMessage', 'Thanks!');
  });

  it('updates template footer', async () => {
    const { handleSettingChange } = renderPanel();
    const footerInput = screen.getByLabelText(/footer/i);
    fireEvent.change(footerInput, { target: { value: 'Happy reading' } });
    expect(handleSettingChange).toHaveBeenLastCalledWith('epubFooter', 'Happy reading');
  });
});
