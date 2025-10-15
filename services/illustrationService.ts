import { AppSettings } from '../types';
import prompts from '../config/prompts.json';
import { OpenAI } from 'openai';
import { getEnvVar } from './env';

const log = (message: string, ...args: any[]) => console.log(`[IllustrationService] ${message}`, ...args);
const warn = (message: string, ...args: any[]) => console.warn(`[IllustrationService] ${message}`, ...args);

export class IllustrationService {
  static async generateIllustrationForSelection(
    selection: string,
    context: string,
    settings: AppSettings
  ): Promise<string | null> {
    log('Generating illustration prompt for:', selection);

    try {
      let prompt = prompts.imagePromptFromSelection;
      prompt = prompt.replace('{{context}}', context);
      prompt = prompt.replace('{{selection}}', selection);

      let apiKey: string | undefined;
      let baseURL: string | undefined;

      switch (settings.provider) {
        case 'OpenAI':
          apiKey = settings.apiKeyOpenAI || getEnvVar('OPENAI_API_KEY');
          baseURL = 'https://api.openai.com/v1';
          break;
        case 'DeepSeek':
          apiKey = settings.apiKeyDeepSeek || getEnvVar('DEEPSEEK_API_KEY');
          baseURL = 'https://api.deepseek.com/v1';
          break;
        case 'OpenRouter':
          apiKey = (settings as any).apiKeyOpenRouter || getEnvVar('OPENROUTER_API_KEY');
          baseURL = 'https://openrouter.ai/api/v1';
          break;
        default:
          warn(`Unsupported provider for illustration generation: ${settings.provider}. Using OpenRouter as fallback.`);
          apiKey = (settings as any).apiKeyOpenRouter || getEnvVar('OPENROUTER_API_KEY');
          baseURL = 'https://openrouter.ai/api/v1';
      }

      if (!apiKey) {
        throw new Error(`API key for ${settings.provider} is missing.`);
      }

      const client = new OpenAI({ apiKey, baseURL, dangerouslyAllowBrowser: true });

      // Use global maxOutputTokens from settings (fallback to 16384) and clamp to a safe upper bound.
      const maxOutput = Math.max(1, Math.min((settings.maxOutputTokens ?? 16384), 200000));

      // Defensive prompt trimming: if the prompt is extremely long, truncate the leading content
      // to ensure the model has room to generate output. Keep a marker so generation is aware.
      const MAX_PROMPT_CHARS = 20000;
      let finalPrompt = prompt;
      if (finalPrompt.length > MAX_PROMPT_CHARS) {
        console.warn('[IllustrationService] Prompt too long, truncating to last', MAX_PROMPT_CHARS, 'chars');
        finalPrompt = '[TRUNCATED]\n' + finalPrompt.slice(-MAX_PROMPT_CHARS);
      }

      const requestBody = {
        model: settings.model,
        messages: [{ role: 'user', content: finalPrompt }],
        temperature: 0.7, // Higher temperature for more creative prompts
        max_tokens: maxOutput,
      };

      // Log a concise summary of the request to help diagnose truncation issues
      try {
        console.log('[IllustrationService] Sending illustration prompt request summary:', {
          model: requestBody.model,
          promptLength: prompt.length,
          max_tokens: requestBody.max_tokens,
          temperature: requestBody.temperature,
        });
        // Also log a prompt snippet (first 2000 chars) so we can inspect potential truncation
        console.log('[IllustrationService] Prompt snippet (first 2000 chars):', prompt.slice(0, 2000));
      } catch {}

      log('Sending illustration prompt request to:', settings.model);

      const response = await client.chat.completions.create(requestBody);

      // Defensive: if the model returns an unexpected structure, log the whole response
      const rawContent = response?.choices?.[0]?.message?.content;
      const imagePrompt = rawContent ? String(rawContent).trim().replace(/"/g, '') : null;

      if (!imagePrompt) {
        // Log the full API response at debug level to help investigate silent failures
        console.warn('[IllustrationService] Received empty image prompt from model. Full response:', response);
        // Also surface finish reason and usage if available
        try {
          const choice = response?.choices?.[0] || {};
          const finish = choice.finish_reason || choice.native_finish_reason || null;
          console.warn('[IllustrationService] Model finish reason:', finish, 'usage:', response?.usage || null);
        } catch {}
        return null;
      }

      log('Received image prompt:', imagePrompt);

      return imagePrompt;

    } catch (error) {
      console.error('Failed to generate illustration prompt:', error);
      return null;
    }
  }
}
