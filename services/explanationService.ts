import { AppSettings } from '../types';
import prompts from '../config/prompts.json';
import { requestWithSelectedProvider } from './ai/selectedProvider';
import { debugLog } from '../utils/debug';

export class ExplanationService {
  /** Generates a footnote using only the reader's selected provider. */
  static async generateExplanationFootnote(
    originalContent: string,
    translatedContent: string,
    selectedText: string,
    settings: AppSettings
  ): Promise<string | null> {
    try {
      let prompt = prompts.explanationPrompt;
      prompt = prompt.replace('{{sourceLanguage}}', settings.sourceLanguage || 'the original language');
      prompt = prompt.replace('{{originalContent}}', originalContent);
      prompt = prompt.replace('{{translatedContent}}', translatedContent);
      prompt = prompt.replace('{{selectedText}}', selectedText);

      const maxOutput = Math.max(1, Math.min((settings.maxOutputTokens ?? 16384), 200000));
      const response = await requestWithSelectedProvider({
        settings,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: maxOutput,
        temperature: 0.5,
        responseFormat: 'text',
        apiType: 'explanation',
      });

      debugLog('translation', 'summary', '[ExplanationService] Explanation complete', {
        provider: settings.provider,
        model: settings.model,
        responseLength: response.text.length,
      });
      return response.text.trim() || null;
    } catch (error) {
      console.error('Failed to generate explanation footnote:', error);
      return null;
    }
  }
}
