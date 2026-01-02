import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AudioPanel from './AudioPanel';

const storeState = {
  selectedProvider: 'ace-step',
  setProvider: vi.fn(),
  selectedTaskType: 'txt2audio' as 'txt2audio' | 'audio2audio',
  setTaskType: vi.fn(),
  selectedPreset: null as string | null,
  setPreset: vi.fn(),
  volume: 0.5,
  setVolume: vi.fn(),
  getAvailablePresets: vi.fn(() => []),
  audioMetrics: { totalCost: 0, generationCount: 0, totalDuration: 0 },
  selectedStyleAudio: null as string | null,
  uploadedStyleAudio: null as File | null,
  setStyleAudio: vi.fn(),
  setUploadedStyleAudio: vi.fn(),
  setError: vi.fn(),
};

// Mock appStore with audio enabled to show full settings
const appStoreState = {
  settings: { enableAudio: true },
  updateSettings: vi.fn(),
};

vi.mock('../../hooks/useAudioPanelStore', () => ({
  useAudioPanelStore: () => storeState,
}));

vi.mock('../../store', () => ({
  useAppStore: (selector: (state: typeof appStoreState) => unknown) => selector(appStoreState),
}));

vi.mock('../../services/audio/OSTLibraryService', () => ({
  ostLibraryService: {
    getSamples: vi.fn().mockResolvedValue([{ id: '1', name: 'Sample', url: 'url', category: 'Calm' }]),
  },
}));

describe('AudioPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.selectedProvider = 'ace-step';
    storeState.selectedTaskType = 'txt2audio';
    storeState.selectedPreset = null;
    storeState.selectedStyleAudio = null;
    storeState.uploadedStyleAudio = null;
  });

  it('changes provider via dropdown', async () => {
    const user = userEvent.setup();
    render(<AudioPanel />);
    await user.selectOptions(screen.getByLabelText(/audio provider/i), 'diffrhythm');
    expect(storeState.setProvider).toHaveBeenCalledWith('diffrhythm');
  });

  it('validates uploaded file type when in audio2audio mode', async () => {
    const user = userEvent.setup();
    storeState.selectedTaskType = 'audio2audio';
    render(<AudioPanel />);
    const fileInput = screen.getByLabelText(/upload reference audio/i) as HTMLInputElement;
    const badFile = new File(['bad'], 'bad.txt', { type: 'text/plain' });
    Object.defineProperty(fileInput, 'files', { value: [badFile], writable: false });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(storeState.setError).toHaveBeenCalledWith('Please upload a valid audio file (MP3, WAV, OGG)');
  });
});
