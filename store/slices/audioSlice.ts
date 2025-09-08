/**
 * Audio Slice - Manages audio generation and playback state
 * 
 * Handles:
 * - Audio generation jobs and queue
 * - Playback state and controls
 * - Provider settings and style presets
 * - Cost tracking and metrics
 * - Chapter-specific audio mapping
 */

import type { StateCreator } from 'zustand';
import type {
  AudioProvider,
  AudioTaskType,
  AudioJob,
  AudioJobStatus,
  AudioGenerationInput,
  PlaybackState,
  AudioMetrics,
  AudioStylePreset,
  AppSettings
} from '../../types';
import { audioService } from '../../services/audio/AudioService';
import { nanoid } from 'nanoid';

// Stable empty array to prevent re-renders in selectors
const EMPTY_AUDIO_LIST: readonly string[] = Object.freeze([]);

// Helper function to convert File to data URL
const convertFileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export interface AudioState {
  // Provider settings
  selectedProvider: AudioProvider;
  selectedTaskType: AudioTaskType;
  selectedPreset: string | null;
  
  // Style audio for audio2audio tasks
  selectedStyleAudio: string | null; // URL or OST sample ID
  uploadedStyleAudio: File | null; // Custom uploaded audio file
  
  // Generation state
  generationQueue: AudioJob[];
  activeJobs: Set<string>; // Job IDs currently being processed
  chapterAudioMap: Map<string, string[]>; // chapterId -> audioUrls
  
  // Playback state
  currentPlayback: PlaybackState | null;
  volume: number;
  
  // Metrics and history
  audioMetrics: AudioMetrics;
  
  // UI state
  isGenerating: boolean;
  showAudioControls: boolean;
}

export interface AudioActions {
  // Settings management
  setProvider: (provider: AudioProvider) => void;
  setTaskType: (taskType: AudioTaskType) => void;
  setPreset: (presetId: string | null) => void;
  setVolume: (volume: number) => void;
  
  // Style audio management
  setStyleAudio: (audioId: string | null) => void;
  setUploadedStyleAudio: (file: File | null) => void;
  
  // Generation management
  generateChapterAudio: (chapterId: string, content: string, abortSignal?: AbortSignal) => Promise<void>;
  cancelGeneration: (jobId: string) => void;
  clearAudioQueue: () => void;
  
  // Playback controls
  playAudio: (chapterId: string, audioUrl?: string) => void;
  pauseAudio: () => void;
  stopAudio: () => void;
  seekAudio: (time: number) => void;
  
  // UI controls
  toggleAudioControls: (show?: boolean) => void;
  
  // Utilities
  getChapterAudio: (chapterId: string) => string[];
  getAvailablePresets: () => AudioStylePreset[];
  calculateGenerationCost: (provider: AudioProvider, taskType: AudioTaskType, duration?: number) => number;
  
  // Initialization
  initializeAudioService: (settings: AppSettings) => void;
  generateContextualPrompt: (content: string) => Promise<string>;
}

export type AudioSlice = AudioState & AudioActions;

const createInitialAudioMetrics = (): AudioMetrics => ({
  totalCost: 0,
  totalDuration: 0,
  generationCount: 0,
  providerBreakdown: {
    'ace-step': { cost: 0, duration: 0, count: 0 },
    'diffrhythm': { cost: 0, duration: 0, count: 0 }
  }
});

export const createAudioSlice: StateCreator<AudioSlice> = (set, get) => ({
  // Initial state
  selectedProvider: 'ace-step',
  selectedTaskType: 'txt2audio',
  selectedPreset: null,
  selectedStyleAudio: null,
  uploadedStyleAudio: null,
  generationQueue: [],
  activeJobs: new Set(),
  chapterAudioMap: new Map(),
  currentPlayback: null,
  volume: 0.7,
  audioMetrics: createInitialAudioMetrics(),
  isGenerating: false,
  showAudioControls: false,

  // Actions
  setProvider: (provider: AudioProvider) => {
    set({ selectedProvider: provider });
    
    // Update task type to first supported type if current isn't supported
    const supportedTypes = audioService.getSupportedTaskTypes(provider);
    const currentTaskType = get().selectedTaskType;
    
    if (!supportedTypes.includes(currentTaskType) && supportedTypes.length > 0) {
      set({ selectedTaskType: supportedTypes[0] });
    }
  },

  setTaskType: (taskType: AudioTaskType) => {
    const provider = get().selectedProvider;
    const supportedTypes = audioService.getSupportedTaskTypes(provider);
    
    if (supportedTypes.includes(taskType)) {
      set({ selectedTaskType: taskType });
    }
  },

  setPreset: (presetId: string | null) => {
    set({ selectedPreset: presetId });
  },
  
  // Style audio management
  setStyleAudio: (audioId: string | null) => {
    set({ selectedStyleAudio: audioId });
  },
  
  setUploadedStyleAudio: (file: File | null) => {
    set({ uploadedStyleAudio: file });
    // Clear OST selection if uploading custom file
    if (file) {
      set({ selectedStyleAudio: null });
    }
  },

  setVolume: (volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    set({ volume: clampedVolume });
    
    // Update current audio if playing
    const playback = get().currentPlayback;
    if (playback) {
      const audioElements = document.querySelectorAll(`audio[src="${playback.audioUrl}"]`);
      audioElements.forEach((audio: any) => {
        audio.volume = clampedVolume;
      });
    }
  },

  generateContextualPrompt: async (content: string): Promise<string> => {
    // Basic content analysis for now
    const text = content.toLowerCase();
    
    if (text.includes('battle') || text.includes('fight') || text.includes('sword')) {
      return 'Epic orchestral battle music, intense percussion, brass fanfares, dramatic strings, 120 BPM';
    } else if (text.includes('peaceful') || text.includes('garden') || text.includes('quiet')) {
      return 'Peaceful ambient music, soft piano, gentle strings, nature sounds, 60 BPM';
    } else if (text.includes('mystery') || text.includes('dark') || text.includes('shadow')) {
      return 'Dark atmospheric music, minor key, subtle tension, mysterious ambience, 80 BPM';
    } else {
      return 'Cinematic background music, orchestral, moderate tempo, emotional depth, 90 BPM';
    }
  },

  generateChapterAudio: async (chapterId: string, content: string, abortSignal?: AbortSignal) => {
    if (!audioService.isAvailable()) {
      console.warn('[AudioSlice] Audio service not initialized');
      return;
    }

    const { selectedProvider, selectedTaskType, selectedPreset, selectedStyleAudio, uploadedStyleAudio } = get();
    
    // Get style preset or use default prompt
    const presets = audioService.getStylePresets();
    const preset = presets.find(p => p.id === selectedPreset);
    
    // Prepare style audio for audio2audio tasks
    let styleAudioUrl: string | undefined;
    if (selectedTaskType === 'audio2audio') {
      if (uploadedStyleAudio) {
        // Convert uploaded file to base64 or URL (for now, we'll use a placeholder)
        styleAudioUrl = await convertFileToDataURL(uploadedStyleAudio);
      } else if (selectedStyleAudio) {
        // Use OST library sample
        styleAudioUrl = selectedStyleAudio.startsWith('/') ? 
          `${window.location.origin}${selectedStyleAudio}` : selectedStyleAudio;
      }
    }
    
    // Analyze chapter content for contextual audio generation
    const input: AudioGenerationInput = {
      stylePrompt: preset?.stylePrompt || await get().generateContextualPrompt(content),
      negativePrompt: preset?.negativePrompt,
      lyrics: '[inst]', // Instrumental by default
      duration: audioService.getExpectedDuration(selectedProvider, selectedTaskType),
      styleAudio: styleAudioUrl,
    };

    // Create job
    const job: AudioJob = {
      id: nanoid(),
      chapterId,
      provider: selectedProvider,
      taskType: selectedTaskType,
      status: 'queued',
      input,
      createdAt: new Date().toISOString(),
    };

    // Add to queue and active jobs
    set(state => ({
      generationQueue: [...state.generationQueue, job],
      activeJobs: new Set([...state.activeJobs, job.id]),
      isGenerating: true,
    }));

    try {
      // Generate audio
      const result = await audioService.generateAudio(
        selectedProvider,
        selectedTaskType,
        input,
        abortSignal
      );

      // Update job with result
      const completedJob: AudioJob = {
        ...job,
        status: 'completed',
        result,
        completedAt: new Date().toISOString(),
      };

      // Update state
      set(state => {
        const newQueue = state.generationQueue.map(j => j.id === job.id ? completedJob : j);
        const newActiveJobs = new Set(state.activeJobs);
        newActiveJobs.delete(job.id);
        
        const currentAudio = state.chapterAudioMap.get(chapterId) ?? EMPTY_AUDIO_LIST;
        const newChapterAudioMap = new Map(state.chapterAudioMap);
        newChapterAudioMap.set(chapterId, [...currentAudio, result.audioUrl]);
        
        // Update metrics
        const newMetrics = { ...state.audioMetrics };
        newMetrics.totalCost += result.cost;
        newMetrics.totalDuration += result.duration;
        newMetrics.generationCount += 1;
        newMetrics.lastGenerated = new Date().toISOString();
        
        const providerStats = newMetrics.providerBreakdown[result.provider];
        providerStats.cost += result.cost;
        providerStats.duration += result.duration;
        providerStats.count += 1;

        return {
          generationQueue: newQueue,
          activeJobs: newActiveJobs,
          chapterAudioMap: newChapterAudioMap,
          audioMetrics: newMetrics,
          isGenerating: newActiveJobs.size > 0,
        };
      });

    } catch (error) {
      // Handle error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const failedJob: AudioJob = {
        ...job,
        status: 'failed',
        error: errorMessage,
        completedAt: new Date().toISOString(),
      };

      set(state => {
        const newQueue = state.generationQueue.map(j => j.id === job.id ? failedJob : j);
        const newActiveJobs = new Set(state.activeJobs);
        newActiveJobs.delete(job.id);

        return {
          generationQueue: newQueue,
          activeJobs: newActiveJobs,
          isGenerating: newActiveJobs.size > 0,
        };
      });

      throw error;
    }
  },

  cancelGeneration: (jobId: string) => {
    set(state => {
      const newQueue = state.generationQueue.map(job => 
        job.id === jobId && job.status !== 'completed' 
          ? { ...job, status: 'cancelled' as AudioJobStatus }
          : job
      );
      
      const newActiveJobs = new Set(state.activeJobs);
      newActiveJobs.delete(jobId);

      return {
        generationQueue: newQueue,
        activeJobs: newActiveJobs,
        isGenerating: newActiveJobs.size > 0,
      };
    });
  },

  clearAudioQueue: () => {
    set({ 
      generationQueue: [], 
      activeJobs: new Set(),
      isGenerating: false 
    });
  },

  playAudio: (chapterId: string, audioUrl?: string) => {
    const chapterAudio = get().chapterAudioMap.get(chapterId) ?? EMPTY_AUDIO_LIST;
    const urlToPlay = audioUrl || chapterAudio[chapterAudio.length - 1]; // Latest audio if not specified
    
    if (!urlToPlay) {
      console.warn('[AudioSlice] No audio available for chapter:', chapterId);
      return;
    }

    // Stop current playback
    get().stopAudio();

    // Create new playback state
    set({
      currentPlayback: {
        chapterId,
        audioUrl: urlToPlay,
        isPlaying: true,
        isPaused: false,
        currentTime: 0,
        duration: 0,
        volume: get().volume,
      },
      showAudioControls: true,
    });
  },

  pauseAudio: () => {
    set(state => state.currentPlayback ? {
      currentPlayback: {
        ...state.currentPlayback,
        isPlaying: false,
        isPaused: true,
      }
    } : {});
  },

  stopAudio: () => {
    set({ currentPlayback: null });
  },

  seekAudio: (time: number) => {
    set(state => state.currentPlayback ? {
      currentPlayback: {
        ...state.currentPlayback,
        currentTime: time,
      }
    } : {});
  },

  toggleAudioControls: (show?: boolean) => {
    set(state => ({ 
      showAudioControls: show !== undefined ? show : !state.showAudioControls 
    }));
  },

  getChapterAudio: (chapterId: string) => {
    return get().chapterAudioMap.get(chapterId) ?? EMPTY_AUDIO_LIST;
  },

  getAvailablePresets: () => {
    return audioService.getStylePresets();
  },

  calculateGenerationCost: (provider: AudioProvider, taskType: AudioTaskType, duration?: number) => {
    return audioService.calculateCost(provider, taskType, duration);
  },

  initializeAudioService: (settings: AppSettings) => {
    audioService.initialize(settings);
  },
});