/**
 * Audio Service - Main service for managing audio generation
 * 
 * Handles provider selection, job management, and integration with the store.
 * Uses a factory pattern to create appropriate providers based on settings.
 */

import type { 
  AppSettings, 
  AudioProvider, 
  AudioTaskType, 
  AudioGenerationInput, 
  GeneratedAudioResult,
  AudioJob,
  AudioStylePreset
} from '../../types';
import { BaseAudioProvider } from './BaseAudioProvider';
import { AceStepProvider } from './AceStepProvider';
import { DiffRhythmProvider } from './DiffRhythmProvider';
import appConfig from '../../config/app.json';
import { debugLog } from '../../utils/debug';
import { getEnvVar } from '../env';

const AUDIO_PROVIDERS: readonly AudioProvider[] = ['ace-step', 'diffrhythm'] as const;
const AUDIO_TASK_TYPES: readonly AudioTaskType[] = ['txt2audio', 'audio2audio', 'txt2audio-base', 'txt2audio-full'] as const;
const STYLE_CATEGORIES: readonly AudioStylePreset['suitableFor'][number][] = [
  'action',
  'romance',
  'mystery',
  'peaceful',
  'dramatic',
  'ambient',
] as const;

const isAudioProvider = (value: string | undefined): value is AudioProvider =>
  typeof value === 'string' && (AUDIO_PROVIDERS as readonly string[]).includes(value);

const isAudioTaskType = (value: string | undefined): value is AudioTaskType =>
  typeof value === 'string' && (AUDIO_TASK_TYPES as readonly string[]).includes(value);

const normalizeSuitableFor = (candidates: unknown): AudioStylePreset['suitableFor'] => {
  if (!Array.isArray(candidates)) return [];
  return candidates
    .filter((candidate): candidate is string => typeof candidate === 'string')
    .map(candidate => candidate.trim())
    .filter((candidate): candidate is AudioStylePreset['suitableFor'][number] =>
      (STYLE_CATEGORIES as readonly string[]).includes(candidate)
    );
};

export class AudioService {
  private providers = new Map<AudioProvider, BaseAudioProvider>();
  private logSummary(message: string, details?: unknown) {
    debugLog('audio', 'summary', `[AudioService] ${message}`, details ?? {});
  }

  /**
   * Initialize the audio service with API keys from settings
   */
  initialize(settings: AppSettings) {
    const piApiKey = settings.apiKeyPiAPI || (getEnvVar('PIAPI_API_KEY') as any);
    
    if (!piApiKey) {
      console.warn('[AudioService] PiAPI key not found. Audio generation will not be available.');
      return;
    }

    // Initialize providers
    this.providers.set('ace-step', new AceStepProvider(piApiKey));
    this.providers.set('diffrhythm', new DiffRhythmProvider(piApiKey));

    this.logSummary('Initialized providers', { providers: Array.from(this.providers.keys()) });
  }

  /**
   * Get a provider instance
   */
  getProvider(provider: AudioProvider): BaseAudioProvider | null {
    return this.providers.get(provider) || null;
  }

  /**
   * Check if audio generation is available (has valid API key)
   */
  isAvailable(): boolean {
    return this.providers.size > 0;
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): AudioProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get style presets from config
   */
  getStylePresets(): AudioStylePreset[] {
    const presets = appConfig.audioGeneration?.stylePresets ?? [];
    return presets
      .map((preset: any): AudioStylePreset | null => {
        if (!isAudioProvider(preset?.provider)) return null;
        if (!isAudioTaskType(preset?.taskType)) return null;
        return {
          id: String(preset.id ?? ''),
          name: String(preset.name ?? ''),
          description: String(preset.description ?? ''),
          stylePrompt: String(preset.stylePrompt ?? ''),
          negativePrompt: typeof preset.negativePrompt === 'string' ? preset.negativePrompt : undefined,
          suitableFor: normalizeSuitableFor(preset.suitableFor),
          provider: preset.provider,
          taskType: preset.taskType,
        };
      })
      .filter((preset): preset is AudioStylePreset => Boolean(preset && preset.id && preset.stylePrompt));
  }

  /**
   * Get default settings for audio generation
   */
  getDefaults() {
    const rawDefaults = (appConfig.audioGeneration?.defaults ?? {}) as Partial<Record<string, unknown>>;
    const providerCandidate = typeof rawDefaults.provider === 'string' ? rawDefaults.provider : undefined;
    const taskTypeCandidate = typeof rawDefaults.taskType === 'string' ? rawDefaults.taskType : undefined;
    const provider = isAudioProvider(providerCandidate) ? providerCandidate : 'ace-step';
    const taskType = isAudioTaskType(taskTypeCandidate) ? taskTypeCandidate : 'txt2audio';
    return {
      provider,
      taskType,
      duration: typeof rawDefaults.duration === 'number' ? rawDefaults.duration : 240,
      negativePrompt: typeof rawDefaults.negativePrompt === 'string' ? rawDefaults.negativePrompt : 'noise, static, distortion',
      volume: typeof rawDefaults.volume === 'number' ? rawDefaults.volume : 0.7,
    };
  }

  /**
   * Generate audio using the specified provider and settings
   */
  async generateAudio(
    provider: AudioProvider,
    taskType: AudioTaskType,
    input: AudioGenerationInput,
    abortSignal?: AbortSignal
  ): Promise<GeneratedAudioResult> {
    const providerInstance = this.getProvider(provider);
    
    if (!providerInstance) {
      throw new Error(`Audio provider '${provider}' is not available`);
    }

    this.logSummary(`Generating audio with ${provider}`, {
      taskType,
      stylePrompt: input.stylePrompt?.substring(0, 100) + '...',
      duration: input.duration,
      hasStyleAudio: !!input.styleAudio,
    });

    const result = await providerInstance.generateAudio(input, taskType, abortSignal);
    
    this.logSummary('Generation completed', {
      provider: result.provider,
      duration: result.duration,
      cost: result.cost,
      requestTime: result.requestTime,
    });

    return result;
  }

  /**
   * Calculate cost for a generation without actually generating
   */
  calculateCost(provider: AudioProvider, taskType: AudioTaskType, duration?: number): number {
    const providerInstance = this.getProvider(provider);
    return providerInstance?.calculateCost(taskType, duration) || 0;
  }

  /**
   * Validate input for a specific provider and task type
   */
  validateInput(provider: AudioProvider, taskType: AudioTaskType, input: AudioGenerationInput): boolean {
    const providerInstance = this.getProvider(provider);
    return providerInstance?.validateInput(input, taskType) || false;
  }

  /**
   * Get supported task types for a provider
   */
  getSupportedTaskTypes(provider: AudioProvider): AudioTaskType[] {
    const providerInstance = this.getProvider(provider);
    return providerInstance?.getCapabilities().supportedTaskTypes || [];
  }

  /**
   * Get the expected duration for a task
   */
  getExpectedDuration(provider: AudioProvider, taskType: AudioTaskType, requestedDuration?: number): number {
    const providerInstance = this.getProvider(provider);
    return providerInstance?.getDuration(taskType, requestedDuration) || 60;
  }
}

// Singleton instance
export const audioService = new AudioService();
