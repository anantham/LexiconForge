import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import DiffPanel from './DiffPanel';
import { SettingsModalProvider } from './SettingsModalContext';
import type { AppSettings } from '../../types';
import type React from 'react';

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

const ctxDefaults = {
  currentSettings: baseSettings,
  handleSettingChange: vi.fn(),
  parameterSupport: {},
  setParameterSupport: vi.fn(),
  novelMetadata: null,
  handleNovelMetadataChange: vi.fn(),
};

const storeState = {
  currentChapterId: 'ch1',
  chapters: new Map([
    [
      'ch1',
      {
        translationResult: { translation: 'content', id: 't1' },
        content: 'raw',
        translationSettingsSnapshot: { provider: 'Gemini', model: 'm1', temperature: 0.4 },
      },
    ],
  ]),
  showNotification: vi.fn(),
};

vi.mock('../../store', () => ({
  useAppStore: (selector: any) =>
    typeof selector === 'function'
      ? selector(storeState)
      : storeState,
}));

const diffOpsMocks = vi.hoisted(() => ({
  deleteByChapter: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/db/operations', () => ({
  DiffOps: diffOpsMocks,
}));

const renderPanel = (value: Partial<typeof ctxDefaults> = {}) => {
  const ctx = { ...ctxDefaults, ...value };
  return render(
    <SettingsModalProvider value={ctx}>
      <DiffPanel />
    </SettingsModalProvider>
  );
};

describe('DiffPanel', () => {
beforeEach(() => {
    vi.clearAllMocks();
    storeState.showNotification = vi.fn();
    diffOpsMocks.deleteByChapter.mockResolvedValue(undefined);
  });

  it('toggles heatmap visibility via checkbox', async () => {
    const handleSettingChange = vi.fn();
    const user = userEvent.setup();
    renderPanel({ handleSettingChange });
    await user.click(screen.getByRole('checkbox', { name: /show semantic diff heatmap/i }));
    expect(handleSettingChange).toHaveBeenCalledWith('showDiffHeatmap', false);
  });

  it('invokes invalidate handler and shows success notice', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: /invalidate & re-run diff/i }));
    expect(diffOpsMocks.deleteByChapter).toHaveBeenCalledWith('ch1');
    expect(storeState.showNotification).toHaveBeenCalledWith(
      'Diff analysis refresh requested. Markers will update once the new analysis completes.',
      'success'
    );
  });
});
