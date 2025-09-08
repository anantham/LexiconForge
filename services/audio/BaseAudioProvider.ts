/**
 * Base Audio Provider - Abstract class for audio generation providers
 * 
 * This defines the common interface that all audio providers (AceStep, DiffRhythm, etc.)
 * must implement, ensuring consistent behavior across different APIs.
 */

import type { AudioGenerationInput, GeneratedAudioResult, AudioTaskType, AudioProvider } from '../../types';

// Debug logging for audio providers
const providerDebugEnabled = (): boolean => {
  try {
    return typeof localStorage !== 'undefined' && (
      localStorage.getItem('LF_AUDIO_DEBUG') === '1' ||
      localStorage.getItem('LF_PROVIDER_DEBUG') === '1'
    );
  } catch { return false; }
};
const plog = (...args: any[]) => { 
  if (providerDebugEnabled()) console.log('[AudioProvider]', ...args); 
};

export interface AudioProviderCapabilities {
  supportedTaskTypes: AudioTaskType[];
  maxDuration?: number;
  minDuration?: number;
  fixedDurations?: Record<string, number>;
  costPerSecond?: number;
  costPerGeneration?: number;
}

export abstract class BaseAudioProvider {
  protected readonly provider: AudioProvider;
  protected readonly apiKey: string;
  protected readonly baseUrl: string;

  constructor(provider: AudioProvider, apiKey: string, baseUrl: string) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Generate audio from the given input
   */
  abstract generateAudio(
    input: AudioGenerationInput,
    taskType: AudioTaskType,
    abortSignal?: AbortSignal
  ): Promise<GeneratedAudioResult>;

  /**
   * Get the capabilities of this provider
   */
  abstract getCapabilities(): AudioProviderCapabilities;

  /**
   * Calculate the cost for generating audio with the given parameters
   */
  abstract calculateCost(taskType: AudioTaskType, duration?: number): number;

  /**
   * Validate that the input is compatible with the given task type
   */
  abstract validateInput(input: AudioGenerationInput, taskType: AudioTaskType): boolean;

  /**
   * Get the expected duration for a task type (for providers with fixed durations)
   */
  getDuration(taskType: AudioTaskType, requestedDuration?: number): number {
    const capabilities = this.getCapabilities();
    
    if (capabilities.fixedDurations && capabilities.fixedDurations[taskType]) {
      return capabilities.fixedDurations[taskType];
    }
    
    if (requestedDuration) {
      const max = capabilities.maxDuration ?? Infinity;
      const min = capabilities.minDuration ?? 1;
      return Math.max(min, Math.min(max, requestedDuration));
    }
    
    return capabilities.maxDuration ?? 60;
  }

  /**
   * Check if the provider supports the given task type
   */
  supportsTaskType(taskType: AudioTaskType): boolean {
    return this.getCapabilities().supportedTaskTypes.includes(taskType);
  }

  protected async makeRequest(
    endpoint: string, 
    payload: any, 
    abortSignal?: AbortSignal
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    plog(`📤 HTTP Request: ${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'MISSING',
      },
      payloadKeys: Object.keys(payload || {}),
      payloadSize: JSON.stringify(payload).length,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify(payload),
      signal: abortSignal,
    });

    plog(`📥 HTTP Response: ${response.status} ${response.statusText}`, {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      plog(`❌ HTTP Error Response:`, errorText);
      throw new Error(`Audio generation failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const jsonResponse = await response.json();
    plog(`📥 HTTP Response JSON:`, {
      keys: Object.keys(jsonResponse || {}),
      response: jsonResponse,
    });

    return jsonResponse;
  }

  protected async pollForResult(taskId: string, abortSignal?: AbortSignal): Promise<any> {
    const maxAttempts = 60; // 5 minutes max (5 second intervals)
    let attempts = 0;

    plog(`🔄 Starting polling for task: ${taskId} (max ${maxAttempts} attempts, 5s intervals)`);

    while (attempts < maxAttempts) {
      if (abortSignal?.aborted) {
        plog(`🚫 Polling aborted for task: ${taskId} at attempt ${attempts + 1}`);
        throw new DOMException('Aborted', 'AbortError');
      }

      const statusUrl = `${this.baseUrl}/api/v1/task/${taskId}`;
      plog(`🔍 Polling attempt ${attempts + 1}/${maxAttempts}: ${statusUrl}`);

      const statusResponse = await fetch(statusUrl, {
        headers: {
          'x-api-key': this.apiKey,
        },
        signal: abortSignal,
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        plog(`❌ Status check failed: ${statusResponse.status} ${statusResponse.statusText}`, errorText);
        throw new Error(`Failed to check task status: ${statusResponse.status}`);
      }

      const status = await statusResponse.json();
      
      plog(`📊 Task status:`, {
        attempt: attempts + 1,
        state: status.data?.status || status.state,
        progress: status.data?.progress || status.progress,
        hasResult: !!(status.data?.result || status.result),
        hasOutput: !!(status.data?.output || status.output),
        error: status.data?.error || status.error,
        fullStatus: status,
      });
      
      // Handle both direct result and nested data.result patterns
      const taskData = status.data || status;
      const taskResult = taskData.result || taskData;
      
      if (taskData.status === 'completed' && taskResult) {
        plog(`✅ Task completed successfully: ${taskId}`, {
          resultKeys: Object.keys(taskResult || {}),
          result: taskResult,
        });
        return taskResult;
      } else if (taskData.status === 'failed') {
        plog(`❌ Task failed: ${taskId}`, {
          error: status.error,
          fullStatus: status,
        });
        throw new Error(`Audio generation failed: ${taskData.error?.message || status.error || 'Unknown error'}`);
      }

      // Wait 5 seconds before next poll
      plog(`⏱️  Waiting 5 seconds before next poll (attempt ${attempts + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    plog(`⏰ Task timed out: ${taskId} (${attempts} attempts)`);
    throw new Error('Audio generation timed out');
  }
}