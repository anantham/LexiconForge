/**
 * SimpleLLMAdapter - Adapter to provide SimpleLLMProvider interface for DiffAnalysisService
 *
 * This adapter uses the OpenAI SDK to call LLM APIs (including OpenRouter)
 * with a simplified interface for DiffAnalysisService.
 */

import OpenAI from 'openai';
import { calculateCost } from '../ai/cost';
import { apiMetricsService } from '../apiMetricsService';
import { getChatCompletionOptionalParameters } from '../ai/openaiRequestParameters';

interface SimpleLLMResponse {
  translatedText: string;
  cost?: number;
  model?: string;
}

interface SimpleLLMProvider {
  translate(options: {
    text: string;
    systemPrompt: string;
    provider: string;
    model: string;
    temperature: number;
  }): Promise<SimpleLLMResponse>;
}

/**
 * Create a SimpleLLMProvider that uses OpenAI SDK for API calls
 */
export function createSimpleLLMAdapter(apiKey?: string): SimpleLLMProvider {
  return {
    async translate(options): Promise<SimpleLLMResponse> {
      console.log(`🔌 [SimpleLLMAdapter] Calling ${options.provider} with model ${options.model}`);
      console.log(`🔌 [SimpleLLMAdapter] Temperature: ${options.temperature}`);
      console.log(`🔌 [SimpleLLMAdapter] Prompt length: ${options.text.length} chars`);

      try {
        // Get API configuration based on provider
        let baseURL: string;
        const effectiveApiKey = apiKey?.trim() || undefined;

        if (options.provider === 'OpenRouter') {
          baseURL = 'https://openrouter.ai/api/v1';
        } else {
          throw new Error(`Unsupported provider for SimpleLLMAdapter: ${options.provider}`);
        }

        if (!effectiveApiKey) {
          throw new Error(`${options.provider} API key is missing`);
        }

        // Create OpenAI client
        const client = new OpenAI({
          apiKey: effectiveApiKey,
          baseURL,
          dangerouslyAllowBrowser: true
        });

        console.log(`🔌 [SimpleLLMAdapter] Making API request to ${baseURL}`);

        // Make API call
        const response = await client.chat.completions.create({
          model: options.model,
          messages: [
            ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
            { role: 'user' as const, content: options.text }
          ],
          ...getChatCompletionOptionalParameters(
            options.provider,
            options.model,
            { temperature: options.temperature }
          ),
          response_format: { type: 'json_object' }
        });

        const responseText = response.choices[0]?.message?.content || '';

        console.log(`✅ [SimpleLLMAdapter] Response received (length: ${responseText.length} chars)`);

        // Calculate cost if usage is available
        let cost = 0;
        if (response.usage) {
          try {
            cost = await calculateCost(
              options.model,
              response.usage.prompt_tokens || 0,
              response.usage.completion_tokens || 0
            );
            console.log(`✅ [SimpleLLMAdapter] Cost: $${cost}, Model: ${response.model || options.model}`);
            console.log(`✅ [SimpleLLMAdapter] Tokens: ${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion`);
          } catch (e) {
            console.warn(`⚠️ [SimpleLLMAdapter] Failed to calculate cost:`, e);
          }
        }

        // Record successful diff analysis API call in metrics
        await apiMetricsService.recordMetric({
          apiType: 'diff_analysis',
          provider: options.provider,
          model: options.model,
          costUsd: cost,
          tokens: response.usage ? {
            prompt: response.usage.prompt_tokens || 0,
            completion: response.usage.completion_tokens || 0,
            total: (response.usage.prompt_tokens || 0) + (response.usage.completion_tokens || 0),
          } : undefined,
          success: true,
        });

        return {
          translatedText: responseText,
          cost,
          model: response.model || options.model
        };
      } catch (error) {
        console.error(`🚨 [SimpleLLMAdapter] API call failed:`, error);

        // Record failed diff analysis API call in metrics
        await apiMetricsService.recordMetric({
          apiType: 'diff_analysis',
          provider: options.provider,
          model: options.model,
          costUsd: 0,
          tokens: {
            prompt: 0,
            completion: 0,
            total: 0,
          },
          success: false,
          errorMessage: error.message || 'Unknown error',
        });

        throw error;
      }
    }
  };
}
