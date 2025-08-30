
import { AppSettings } from '../types';
import prompts from '../config/prompts.json';
import { OpenAI } from 'openai';

// Basic logging for the service
const log = (message: string, ...args: any[]) => console.log(`[ExplanationService] ${message}`, ...args);
const warn = (message: string, ...args: any[]) => console.warn(`[ExplanationService] ${message}`, ...args);

export class ExplanationService {
  /**
   * Generates a footnote explaining a specific translation choice.
   */
  static async generateExplanationFootnote(
    originalContent: string,
    translatedContent: string,
    selectedText: string,
    settings: AppSettings
  ): Promise<string | null> {
    log('Generating explanation footnote for:', selectedText);

    try {
      // 1. Construct the prompt
      let prompt = prompts.explanationPrompt;
      prompt = prompt.replace('{{sourceLanguage}}', settings.sourceLanguage || 'the original language');
      prompt = prompt.replace('{{originalContent}}', originalContent);
      prompt = prompt.replace('{{translatedContent}}', translatedContent);
      prompt = prompt.replace('{{selectedText}}', selectedText);

      // 2. Configure the API call (using OpenAI-compatible for broad support)
      let apiKey: string | undefined;
      let baseURL: string | undefined;

      switch (settings.provider) {
        case 'OpenAI':
          apiKey = settings.apiKeyOpenAI || process.env.OPENAI_API_KEY;
          baseURL = 'https://api.openai.com/v1';
          break;
        case 'DeepSeek':
          apiKey = settings.apiKeyDeepSeek || process.env.DEEPSEEK_API_KEY;
          baseURL = 'https://api.deepseek.com/v1';
          break;
        case 'OpenRouter':
          apiKey = (settings as any).apiKeyOpenRouter || process.env.OPENROUTER_API_KEY;
          baseURL = 'https://openrouter.ai/api/v1';
          break;
        case 'Gemini':
            apiKey = settings.apiKeyGemini || process.env.GEMINI_API_KEY;
            // Note: Gemini uses a different SDK, this service currently uses OpenAI-compatible calls.
            // This will likely fail for Gemini until the service is updated to use the Gemini SDK.
            // For now, we fall back to OpenRouter if Gemini is selected.
            warn(`Gemini provider is not yet supported for explanations. Using OpenRouter as a fallback.`);
            apiKey = (settings as any).apiKeyOpenRouter || process.env.OPENROUTER_API_KEY;
            baseURL = 'https://openrouter.ai/api/v1';
            break;
        case 'Claude':
            apiKey = settings.apiKeyClaude || process.env.CLAUDE_API_KEY;
            warn(`Claude provider is not yet supported for explanations. Using OpenRouter as a fallback.`);
            apiKey = (settings as any).apiKeyOpenRouter || process.env.OPENROUTER_API_KEY;
            baseURL = 'https://openrouter.ai/api/v1';
            break;
        default:
          warn(`Unsupported provider for explanation: ${settings.provider}. Using OpenRouter as fallback.`);
          apiKey = (settings as any).apiKeyOpenRouter || process.env.OPENROUTER_API_KEY;
          baseURL = 'https://openrouter.ai/api/v1';
      }

      if (!apiKey) {
        throw new Error(`API key for ${settings.provider} is missing.`);
      }

      const client = new OpenAI({ apiKey, baseURL, dangerouslyAllowBrowser: true });

      // Use global settings.maxOutputTokens so explanation generation can utilize the global cap
      const maxOutput = Math.max(1, Math.min((settings.maxOutputTokens ?? 8192), 200000));
      const requestBody = {
        model: settings.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5, // Use a moderate temperature for factual but nuanced explanations
        max_tokens: maxOutput, // Use the full configured global cap
      };

      log('Sending explanation request to:', settings.model);
      console.log('Explanation request body:', requestBody);

      // 3. Make the API call
      const response = await client.chat.completions.create(requestBody);
      const footnoteText = response.choices[0]?.message?.content?.trim() || null;

      log('Received explanation footnote text:', footnoteText);
      console.log('Full explanation response:', response);

      return footnoteText;

    } catch (error) {
      console.error('Failed to generate explanation footnote:', error);
      return null; // Return null on error to prevent breaking the UI
    }
  }
}
