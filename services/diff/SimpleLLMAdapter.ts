import type { AppSettings } from '../../types';
import { requestWithSelectedProvider } from '../ai/selectedProvider';

interface SimpleLLMResponse {
  translatedText: string;
  cost?: number;
  model?: string;
}

interface SimpleLLMProvider {
  translate(_options: {
    text: string;
    systemPrompt: string;
    provider: string;
    model: string;
    temperature: number;
  }): Promise<SimpleLLMResponse>;
}

/** Bind each analysis to its current Settings recipient; never substitute a provider. */
export function createSimpleLLMAdapter(settings: AppSettings): SimpleLLMProvider {
  const snapshot = { ...settings };
  return {
    async translate(options): Promise<SimpleLLMResponse> {
      if (options.provider !== snapshot.provider) {
        throw new Error('Diff provider does not match the selected provider in Settings.');
      }
      if (options.model !== snapshot.model) {
        throw new Error('Diff model does not match the selected model in Settings.');
      }
      const response = await requestWithSelectedProvider({
        settings: snapshot,
        model: options.model,
        messages: [
          ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
          { role: 'user', content: options.text },
        ],
        temperature: options.temperature,
        apiType: 'diff_analysis',
      });
      return {
        translatedText: response.text,
        cost: response.costUsd,
        model: response.model || options.model,
      };
    },
  };
}
