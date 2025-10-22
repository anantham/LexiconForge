/**
 * Ace Step Provider - Implementation for PiAPI's Ace Step audio generation
 * 
 * Supports both txt2audio and audio2audio task types with the Qubico/ace-step model.
 * Pricing: $0.0005 per second of generated audio
 */

import { BaseAudioProvider, type AudioProviderCapabilities } from './BaseAudioProvider';
import type { AudioGenerationInput, GeneratedAudioResult, AudioTaskType } from '../../types';
import { apiMetricsService } from '../apiMetricsService';

// Debug logging for AceStep provider
const aceDebugEnabled = (): boolean => {
  try {
    return typeof localStorage !== 'undefined' && (
      localStorage.getItem('LF_AUDIO_DEBUG') === '1' ||
      localStorage.getItem('LF_ACE_DEBUG') === '1'
    );
  } catch { return false; }
};
const alog = (...args: any[]) => { 
  if (aceDebugEnabled()) console.log('[AceStep]', ...args); 
};

export class AceStepProvider extends BaseAudioProvider {
  constructor(apiKey: string) {
    super('ace-step', apiKey, 'https://api.piapi.ai');
  }

  getCapabilities(): AudioProviderCapabilities {
    return {
      supportedTaskTypes: ['txt2audio', 'audio2audio'],
      maxDuration: 240,
      minDuration: 10,
      costPerSecond: 0.0005,
    };
  }

  calculateCost(taskType: AudioTaskType, duration = 240): number {
    const capabilities = this.getCapabilities();
    const actualDuration = this.getDuration(taskType, duration);
    return actualDuration * (capabilities.costPerSecond || 0);
  }

  validateInput(input: AudioGenerationInput, taskType: AudioTaskType): boolean {
    if (!input.stylePrompt?.trim()) {
      return false;
    }

    if (taskType === 'audio2audio' && !input.styleAudio) {
      return false;
    }

    const duration = input.duration || 240;
    const capabilities = this.getCapabilities();
    
    if (capabilities.minDuration && duration < capabilities.minDuration) {
      return false;
    }
    
    if (capabilities.maxDuration && duration > capabilities.maxDuration) {
      return false;
    }

    return true;
  }

  async generateAudio(
    input: AudioGenerationInput,
    taskType: AudioTaskType,
    abortSignal?: AbortSignal
  ): Promise<GeneratedAudioResult> {
    alog('Starting audio generation:', {
      taskType,
      stylePrompt: input.stylePrompt?.substring(0, 100) + '...',
      duration: input.duration,
      hasStyleAudio: !!input.styleAudio,
      hasNegativePrompt: !!input.negativePrompt,
    });

    if (!this.validateInput(input, taskType)) {
      const error = 'Invalid input for Ace Step provider';
      alog('❌ Validation failed:', error);
      throw new Error(error);
    }

    if (!this.supportsTaskType(taskType)) {
      const error = `Ace Step provider does not support task type: ${taskType}`;
      alog('❌ Unsupported task type:', error);
      throw new Error(error);
    }

    const startTime = performance.now();
    const duration = this.getDuration(taskType, input.duration);
    
    // Prepare the API payload
    const payload: any = {
      model: 'Qubico/ace-step',
      task_type: taskType,
      input: {
        style_prompt: input.stylePrompt,
        lyrics: input.lyrics || '[inst]', // Instrumental by default
        duration: duration,
      },
    };

    // Add negative prompt if provided
    if (input.negativePrompt) {
      payload.input.negative_style_prompt = input.negativePrompt;
    }

    // Add style audio for audio2audio tasks
    if (taskType === 'audio2audio' && input.styleAudio) {
      payload.input.style_audio = input.styleAudio;
    }

    alog('📤 Sending request to PiAPI:', {
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
      
      alog('📥 Task creation response:', {
        task_id: taskResponse.data?.task_id,
        status: taskResponse.data?.status,
        message: taskResponse.message,
        code: taskResponse.code,
        fullResponse: taskResponse,
      });
      
      // PiAPI returns task_id nested in data object
      const taskId = taskResponse.data?.task_id;
      if (!taskId) {
        alog('❌ No task_id in response.data, full response:', taskResponse);
        throw new Error('No task ID returned from Ace Step API');
      }

      alog('🔄 Starting polling for task:', taskId);
      
      // Poll for completion
      const result = await this.pollForResult(taskId, abortSignal);
      
      alog('📥 Final result:', {
        output_url: result.output?.audio_url,
        state: result.state,
        fullResult: result,
      });
      
      // PiAPI returns audio_url nested in output object
      const audioUrl = result.output?.audio_url;
      if (!audioUrl) {
        alog('❌ No audio_url in result.output:', result);
        throw new Error('No output URL returned from Ace Step API');
      }

      const requestTime = (performance.now() - startTime) / 1000;
      const cost = this.calculateCost(taskType, duration);

      const finalResult = {
        audioUrl: audioUrl,
        duration: duration,
        requestTime: requestTime,
        cost: cost,
        provider: 'ace-step',
        taskType: taskType,
      };

      alog('✅ Generation completed successfully:', {
        duration: finalResult.duration,
        requestTime: finalResult.requestTime,
        cost: finalResult.cost,
        audioUrl: finalResult.audioUrl.substring(0, 50) + '...',
      });

      // Record successful audio generation in metrics
      await apiMetricsService.recordMetric({
        apiType: 'audio',
        provider: 'PiAPI',
        model: 'Qubico/ace-step',
        costUsd: cost,
        duration: duration,
        chapterId: (input as any).chapterId, // Optional - may not always be present
        success: true,
      });

      return finalResult;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        alog('🚫 Generation aborted by user');
        throw error;
      }

      alog('❌ Generation error:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });

      // Record failed audio generation in metrics
      await apiMetricsService.recordMetric({
        apiType: 'audio',
        provider: 'PiAPI',
        model: 'Qubico/ace-step',
        costUsd: 0,
        duration: input.duration || 0,
        chapterId: (input as any).chapterId,
        success: false,
        errorMessage: error.message || 'Unknown error',
      });

      throw new Error(`Ace Step generation failed: ${error.message}`);
    }
  }
}