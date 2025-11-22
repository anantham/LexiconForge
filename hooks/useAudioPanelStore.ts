import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';

export const useAudioPanelStore = () =>
  useAppStore(
    useShallow((state) => ({
      selectedProvider: state.selectedProvider,
      setProvider: state.setProvider,
      selectedTaskType: state.selectedTaskType,
      setTaskType: state.setTaskType,
      selectedPreset: state.selectedPreset,
      setPreset: state.setPreset,
      volume: state.volume,
      setVolume: state.setVolume,
      getAvailablePresets: state.getAvailablePresets,
      audioMetrics: state.audioMetrics,
      selectedStyleAudio: state.selectedStyleAudio,
      uploadedStyleAudio: state.uploadedStyleAudio,
      setStyleAudio: state.setStyleAudio,
      setUploadedStyleAudio: state.setUploadedStyleAudio,
      setError: state.setError,
    }))
  );
