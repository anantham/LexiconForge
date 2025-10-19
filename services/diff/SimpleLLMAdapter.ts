/**
 * SimpleLLMAdapter - Adapter to provide SimpleLLMProvider interface for DiffAnalysisService
 *
 * This adapter uses the OpenAI SDK to call LLM APIs (including OpenRouter)
 * with a simplified interface for DiffAnalysisService.
 */

import OpenAI from 'openai';
import { getEnvVar } from '../env';
import { calculateCost } from '../aiService';

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
        let effectiveApiKey: string | undefined = apiKey;

        if (options.provider === 'OpenRouter') {
          baseURL = 'https://openrouter.ai/api/v1';
          if (!effectiveApiKey) {
            effectiveApiKey = getEnvVar('OPENROUTER_API_KEY');
          }
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
          temperature: options.temperature,
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

        return {
          translatedText: responseText,
          cost,
          model: response.model || options.model
        };
      } catch (error) {
        console.error(`🚨 [SimpleLLMAdapter] API call failed:`, error);
        throw error;
      }
    }
  };
}
