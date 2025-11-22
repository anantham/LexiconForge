import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DisplayPanel from './DisplayPanel';
import { SettingsModalProvider, type SettingsModalContextValue } from './SettingsModalContext';
import type { AppSettings } from '../../types';

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
    parameterSupport: {},
    setParameterSupport: vi.fn(),
    novelMetadata: null,
    handleNovelMetadataChange: vi.fn(),
    ...overrides,
  };

  return render(
    <SettingsModalProvider value={ctx}>
      <DisplayPanel />
    </SettingsModalProvider>
  );
};

describe('DisplayPanel', () => {
  it('updates font size via handleSettingChange', () => {
    const handleSettingChange = vi.fn();
    renderPanel({ handleSettingChange });

    const slider = screen.getByLabelText(/font size/i);
    fireEvent.change(slider, { target: { value: '18' } });

    expect(handleSettingChange).toHaveBeenCalledWith('fontSize', expect.any(Number));
  });

  it('changes font style via dropdown', async () => {
    const handleSettingChange = vi.fn();
    renderPanel({ handleSettingChange });

    const select = screen.getByLabelText(/font style/i);
    await userEvent.selectOptions(select, 'sans');

    expect(handleSettingChange).toHaveBeenCalledWith('fontStyle', 'sans');
  });
});
