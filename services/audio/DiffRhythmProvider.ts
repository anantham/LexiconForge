/**
 * DiffRhythm Provider - Implementation for PiAPI's DiffRhythm audio generation
 * 
 * Supports txt2audio-base (1.35 min) and txt2audio-full (4.45 min) task types.
 * Pricing: $0.02 per generation regardless of duration
 */

import { BaseAudioProvider, type AudioProviderCapabilities } from './BaseAudioProvider';
import type { AudioGenerationInput, GeneratedAudioResult, AudioTaskType } from '../../types';
import { apiMetricsService } from '../apiMetricsService';

// Debug logging for DiffRhythm provider
const diffDebugEnabled = (): boolean => {
  try {
    return typeof localStorage !== 'undefined' && (
      localStorage.getItem('LF_AUDIO_DEBUG') === '1' ||
      localStorage.getItem('LF_DIFF_DEBUG') === '1'
    );
  } catch { return false; }
};
const dlog = (...args: any[]) => { 
  if (diffDebugEnabled()) console.log('[DiffRhythm]', ...args); 
};

export class DiffRhythmProvider extends BaseAudioProvider {
  constructor(apiKey: string) {
    super('diffrhythm', apiKey, 'https://api.piapi.ai');
  }

  getCapabilities(): AudioProviderCapabilities {
    return {
      supportedTaskTypes: ['txt2audio-base', 'txt2audio-full'],
      fixedDurations: {
        'txt2audio-base': 81, // 1.35 minutes
        'txt2audio-full': 267, // 4.45 minutes
      },
      costPerGeneration: 0.02,
    };
  }

  calculateCost(taskType: AudioTaskType, duration?: number): number {
    const capabilities = this.getCapabilities();
    return capabilities.costPerGeneration || 0.02;
  }

  validateInput(input: AudioGenerationInput, taskType: AudioTaskType): boolean {
    if (!input.stylePrompt?.trim()) {
      return false;
    }

    return this.supportsTaskType(taskType);
  }

  async generateAudio(
    input: AudioGenerationInput,
    taskType: AudioTaskType,
    abortSignal?: AbortSignal
  ): Promise<GeneratedAudioResult> {
    dlog('Starting audio generation:', {
      taskType,
      stylePrompt: input.stylePrompt?.substring(0, 100) + '...',
      hasLyrics: !!input.lyrics,
      hasNegativePrompt: !!input.negativePrompt,
    });

    if (!this.validateInput(input, taskType)) {
      const error = 'Invalid input for DiffRhythm provider';
      dlog('❌ Validation failed:', error);
      throw new Error(error);
    }

    if (!this.supportsTaskType(taskType)) {
      const error = `DiffRhythm provider does not support task type: ${taskType}`;
      dlog('❌ Unsupported task type:', error);
      throw new Error(error);
    }

    const startTime = performance.now();
    const duration = this.getDuration(taskType);
    
    // Prepare the API payload
    const payload = {
      model: 'Qubico/diffrhythm',
      task_type: taskType,
      input: {
        style_prompt: input.stylePrompt,
        lyrics: input.lyrics || '[inst]', // Instrumental by default
      },
    };

    // Add negative prompt if provided
    if (input.negativePrompt) {
      (payload.input as any).negative_style_prompt = input.negativePrompt;
    }

    dlog('📤 Sending request to PiAPI:', {
      endpoint: '/api/v1/task',
      payload: {
        ...payload,
        input: {
          ...payload.input,
          style_prompt: payload.input.style_prompt?.substring(0, 100) + '...',
        }
      }
    });

    try {
      // Create the generation task
      const taskResponse = await this.makeRequest('/api/v1/task', payload, abortSignal);
      
      dlog('📥 Task creation response:', {
        task_id: taskResponse.data?.task_id,
        status: taskResponse.data?.status,
        message: taskResponse.message,
        code: taskResponse.code,
        fullResponse: taskResponse,
      });
      
      // PiAPI returns task_id nested in data object
      const taskId = taskResponse.data?.task_id;
      if (!taskId) {
        dlog('❌ No task_id in response.data, full response:', taskResponse);
        throw new Error('No task ID returned from DiffRhythm API');
      }

      dlog('🔄 Starting polling for task:', taskId);

      // Poll for completion
      const result = await this.pollForResult(taskId, abortSignal);
      
      dlog('📥 Final result:', {
        output_url: result.output?.audio_url,
        state: result.state,
        fullResult: result,
      });
      
      // PiAPI returns audio_url nested in output object
      const audioUrl = result.output?.audio_url;
      if (!audioUrl) {
        dlog('❌ No audio_url in result.output:', result);
        throw new Error('No output URL returned from DiffRhythm API');
      }

      const requestTime = (performance.now() - startTime) / 1000;
      const cost = this.calculateCost(taskType);

      const finalResult: GeneratedAudioResult = {
        audioUrl: audioUrl,
        duration: duration,
        requestTime: requestTime,
        cost: cost,
        provider: this.provider,
        taskType: taskType,
      };

      dlog('✅ Generation completed successfully:', {
        duration: finalResult.duration,
        requestTime: finalResult.requestTime,
        cost: finalResult.cost,
        audioUrl: finalResult.audioUrl.substring(0, 50) + '...',
      });

      // Record successful audio generation in metrics
      await apiMetricsService.recordMetric({
        apiType: 'audio',
        provider: 'PiAPI',
        model: 'Qubico/diffrhythm',
        costUsd: cost,
        duration: duration,
        chapterId: (input as any).chapterId,
        success: true,
      });

      return finalResult;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        dlog('🚫 Generation aborted by user');
        throw error;
      }

      dlog('❌ Generation error:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });

      // Record failed audio generation in metrics
      const duration = this.getDuration(taskType);
      await apiMetricsService.recordMetric({
        apiType: 'audio',
        provider: 'PiAPI',
        model: 'Qubico/diffrhythm',
        costUsd: 0,
        duration: duration,
        chapterId: (input as any).chapterId,
        success: false,
        errorMessage: error.message || 'Unknown error',
      });

      throw new Error(`DiffRhythm generation failed: ${error.message}`);
    }
  }
}
