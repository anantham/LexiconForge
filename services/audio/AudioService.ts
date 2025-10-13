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

export class AudioService {
  private providers = new Map<AudioProvider, BaseAudioProvider>();

  /**
   * Initialize the audio service with API keys from settings
   */
  initialize(settings: AppSettings) {
    const piApiKey = settings.apiKeyPiAPI || (process.env.PIAPI_API_KEY as any);
    
    if (!piApiKey) {
      console.warn('[AudioService] PiAPI key not found. Audio generation will not be available.');
      return;
    }

    // Initialize providers
    this.providers.set('ace-step', new AceStepProvider(piApiKey));
    this.providers.set('diffrhythm', new DiffRhythmProvider(piApiKey));

    debugLog('audio', 'summary', '[AudioService] Initialized with providers:', Array.from(this.providers.keys()));
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
    return appConfig.audioGeneration?.stylePresets || [];
  }

  /**
   * Get default settings for audio generation
   */
  getDefaults() {
    return appConfig.audioGeneration?.defaults || {
      provider: 'ace-step' as AudioProvider,
      taskType: 'txt2audio' as AudioTaskType,
      duration: 240,
      negativePrompt: 'noise, static, distortion',
      volume: 0.7,
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

    alog(`Generating audio with ${provider}:`, {
      taskType,
      stylePrompt: input.stylePrompt?.substring(0, 100) + '...',
      duration: input.duration,
      hasStyleAudio: !!input.styleAudio,
    });

    const result = await providerInstance.generateAudio(input, taskType, abortSignal);
    
    alog('Generation completed:', {
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