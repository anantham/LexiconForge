import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import PromptPanel from './PromptPanel';
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
  systemPrompt: 'default prompt',
  imageModel: 'none',
  showDiffHeatmap: true,
  maxSessionSize: 10,
};

const storeState = {
  promptTemplates: [
    { id: '1', name: 'Prompt A', content: 'A', description: 'desc', createdAt: new Date().toISOString(), lastUsed: null },
    { id: '2', name: 'Prompt B', content: 'B', description: '', createdAt: new Date().toISOString(), lastUsed: null },
  ],
  activePromptTemplate: { id: '1', name: 'Prompt A', content: 'A', createdAt: new Date().toISOString() },
  createPromptTemplate: vi.fn(),
  updatePromptTemplate: vi.fn(),
  deletePromptTemplate: vi.fn(),
  setActivePromptTemplate: vi.fn(),
  updateSettings: vi.fn(),
};

vi.mock('../../store', () => ({
  useAppStore: (selector: any) => selector(storeState),
}));

const renderPanel = (overrides: Partial<AppSettings> = {}) => {
  const ctxValue = {
    currentSettings: { ...baseSettings, ...overrides },
    handleSettingChange: vi.fn(),
    parameterSupport: {},
    setParameterSupport: vi.fn(),
    novelMetadata: null,
    handleNovelMetadataChange: vi.fn(),
  };

  return render(
    <SettingsModalProvider value={ctxValue}>
      <PromptPanel />
    </SettingsModalProvider>
  );
};

describe('PromptPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new prompt template', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /\+ create new/i }));
    await user.type(screen.getByPlaceholderText(/wuxia romance/i), 'New Template');
    await user.type(screen.getByPlaceholderText(/brief description/i), 'notes');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(storeState.createPromptTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Template', description: 'notes', content: 'default prompt' })
    );
  });

  it('selects a prompt and updates settings', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /^use$/i }));

    expect(storeState.setActivePromptTemplate).toHaveBeenCalledWith('2');
    expect(storeState.updateSettings).toHaveBeenCalledWith({ systemPrompt: 'B', activePromptId: '2' });
  });
});
