import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages/messages';
import type { TranslationProvider, TranslationRequest } from '../../services/translate/Translator';
import type { ChatRequest, ChatResponse, Provider, ProviderName } from './Provider';
import type { TranslationResult } from '../../types';
import { calculateCost } from '../../services/aiService';
import { apiMetricsService } from '../../services/apiMetricsService';
import { translateWithClaude } from '../../services/claudeService';
import { getEnvVar } from '../../services/env';

/**
 * Claude provider adapter that bridges the new adapter pattern with the existing Claude service
 */
export class ClaudeAdapter implements TranslationProvider, Provider {
  name: ProviderName = 'Claude';

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    return translateWithClaude(
      request.title,
      request.content,
      request.settings,
      request.history,
      request.fanTranslation
    );
  }

  async chatJSON(input: ChatRequest): Promise<ChatResponse> {
    const settings = input.settings;
    if (!settings) {
      throw new Error('chatJSON requires settings');
    }

    const apiKey = settings.apiKeyClaude || (getEnvVar('CLAUDE_API_KEY') as any);
    if (!apiKey) {
      throw new Error('Claude API key is missing. Please add it in settings.');
    }

    if (input.abortSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const model = input.model || settings.model;
    const temperature = Math.max(0, Math.min(1, input.temperature ?? settings.temperature ?? 0.2));
    const maxTokens = Math.max(1, Math.min(input.maxTokens ?? settings.maxOutputTokens ?? 4000, 200000));

    const messages = input.messages?.length
      ? input.messages
      : [
          ...(input.system ? [{ role: 'system' as const, content: input.system }] : []),
          ...(input.user ? [{ role: 'user' as const, content: input.user }] : []),
        ];

    const systemMessage = messages.find((msg) => msg.role === 'system')?.content;
    const claudeMessages = messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: [{ type: 'text' as const, text: msg.content }],
      }));

    const requestPayload: MessageCreateParamsNonStreaming = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: claudeMessages,
      ...(systemMessage ? { system: systemMessage } : {}),
    };

    const startTime = performance.now();
    try {
      const claude = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      const response = await claude.messages.create(requestPayload);

      if (input.abortSignal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const responseContent = response.content[0];
      if (!responseContent || responseContent.type !== 'text') {
        throw new Error('Claude returned non-text response');
      }

      const responseText = responseContent.text || '';
      if (!responseText.trim()) {
        throw new Error('Empty response from Claude');
      }

      const promptTokens = response.usage?.input_tokens ?? 0;
      const completionTokens = response.usage?.output_tokens ?? 0;
      const totalTokens = promptTokens + completionTokens;
      let costUsd = 0;
      try {
        costUsd = await calculateCost(model, promptTokens, completionTokens);
      } catch (e) {
        console.warn('[Claude] Failed to calculate compiler cost:', e);
      }

      await apiMetricsService.recordMetric({
        apiType: input.apiType ?? 'sutta_studio',
        provider: settings.provider,
        model,
        costUsd,
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens,
        },
        chapterId: input.chapterId,
        success: true,
      });

      return {
        text: responseText,
        tokens: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
        costUsd,
        model,
        raw: response,
      };
    } catch (error: any) {
      await apiMetricsService.recordMetric({
        apiType: input.apiType ?? 'sutta_studio',
        provider: settings.provider,
        model,
        costUsd: 0,
        tokens: { prompt: 0, completion: 0, total: 0 },
        chapterId: input.chapterId,
        success: false,
        errorMessage: error.message || 'Unknown error',
      });
      throw error;
    } finally {
      void (performance.now() - startTime);
    }
  }
}
