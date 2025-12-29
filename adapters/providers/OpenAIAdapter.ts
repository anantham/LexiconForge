import OpenAI from 'openai';
import type { TranslationProvider, TranslationRequest } from '../../services/translate/Translator';
import type { TranslationResult, AppSettings, HistoricalChapter, UsageMetrics } from '../../types';
import { supportsStructuredOutputs, supportsParameters } from '../../services/capabilityService';
import { rateLimitService } from '../../services/rateLimitService';
import { calculateCost } from '../../services/aiService';
import prompts from '../../config/prompts.json';
import appConfig from '../../config/app.json';
import { buildFanTranslationContext, formatHistory } from '../../services/prompts';
import { getEnvVar } from '../../services/env';
import { getTranslationResponseJsonSchema } from '../../services/translate/translationResponseSchema';
import { getEffectiveSystemPrompt } from '../../utils/promptUtils';
import { getDefaultApiKey } from '../../services/defaultApiKeyService';
import { apiMetricsService } from '../../services/apiMetricsService';

// Parameter validation utility
const validateAndClampParameter = (value: any, paramName: string): any => {
  if (value === undefined || value === null) return value;
  
  const limits = appConfig.aiParameters.limits[paramName as keyof typeof appConfig.aiParameters.limits];
  if (!limits) return value;
  
  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numValue)) return value;
  
  const clamped = Math.max(limits.min, Math.min(limits.max, numValue));
  if (clamped !== numValue) {
    console.warn(`[OpenAI] Clamped ${paramName} from ${numValue} to ${clamped}`);
  }
  
  return clamped;
};

// Placeholder replacement utility
const replacePlaceholders = (template: string, settings: AppSettings): string => {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    return (settings as any)[key] || match;
  });
};

// Debug logging
const dlog = (message: string, ...args: any[]) => {
  try {
    const lvl = localStorage.getItem('LF_AI_DEBUG_LEVEL');
    if (lvl === 'summary' || lvl === 'full') {
      console.log(`[OpenAI] ${message}`, ...args);
    }
  } catch {}
};
const dlogFull = (message: string, ...args: any[]) => {
  try {
    const lvl = localStorage.getItem('LF_AI_DEBUG_LEVEL');
    if (lvl === 'full') {
      console.log(`[OpenAI] ${message}`, ...args);
    }
  } catch {}
};

export class OpenAIAdapter implements TranslationProvider {
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const { title, content, settings, history, fanTranslation, abortSignal, chapterId } = request;

    // Configure API client
    const apiConfig = this.getApiConfig(settings);
    const client = new OpenAI({
      apiKey: apiConfig.apiKey,
      baseURL: apiConfig.baseURL,
      dangerouslyAllowBrowser: true
    });

    // Check rate limits
    await rateLimitService.canMakeRequest(settings.model);

    // Build request
    const requestOptions = await this.buildRequest(settings, title, content, history, fanTranslation);

    dlog('Making API request', { model: settings.model, provider: settings.provider });
    dlogFull('Full request body:', JSON.stringify(requestOptions, null, 2));

    const startTime = performance.now();
    let response: OpenAI.Chat.Completions.ChatCompletion;

    try {
      // Make API call with abort signal
      response = await (abortSignal
        ? client.chat.completions.create(requestOptions, { signal: abortSignal })
        : client.chat.completions.create(requestOptions));

    } catch (error: any) {
      // Handle parameter errors by retrying without unsupported parameters
      if (this.isParameterError(error)) {
        dlog('Parameter error detected, retrying without advanced parameters');
        const simpleOptions = this.removeAdvancedParameters(requestOptions);
        response = await (abortSignal
          ? client.chat.completions.create(simpleOptions, { signal: abortSignal })
          : client.chat.completions.create(simpleOptions));
      } else {
        dlogFull('Full error response:', JSON.stringify(error, null, 2));

        // Record failed API call
        const endTime = performance.now();
        const promptTokens = 0; // Unknown on failure
        const completionTokens = 0;
        const costUsd = 0;

        await apiMetricsService.recordMetric({
          apiType: 'translation',
          provider: settings.provider,
          model: settings.model,
          costUsd,
          tokens: {
            prompt: promptTokens,
            completion: completionTokens,
            total: promptTokens + completionTokens,
          },
          chapterId,
          success: false,
          errorMessage: error.message || 'Unknown error',
        });

        throw error;
      }
    }

    const endTime = performance.now();

    // Process response
    dlogFull('Full response body:', JSON.stringify(response, null, 2));
    return this.processResponse(response, settings, startTime, endTime, chapterId);
  }

  private getApiConfig(settings: AppSettings): { apiKey: string; baseURL: string } {
    let apiKey: string | undefined;
    let baseURL: string;

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
        // Try user key first, then env var, then trial key
        apiKey = (settings as any).apiKeyOpenRouter || getEnvVar('OPENROUTER_API_KEY') || getDefaultApiKey() || undefined;
        console.log('[OpenRouter] API Key Priority Check:', {
          hasUserKey: !!(settings as any).apiKeyOpenRouter,
          hasEnvKey: !!getEnvVar('OPENROUTER_API_KEY'),
          hasTrialKey: !!getDefaultApiKey(),
          usingSource: (settings as any).apiKeyOpenRouter ? 'user_settings' :
                       getEnvVar('OPENROUTER_API_KEY') ? 'env_var' :
                       getDefaultApiKey() ? 'trial_key' : 'none',
          finalKeyAvailable: !!apiKey
        });
        baseURL = 'https://openrouter.ai/api/v1';
        break;
      default:
        throw new Error(`Unsupported provider: ${settings.provider}`);
    }

    if (!apiKey) {
      throw new Error(`${settings.provider} API key is missing. Please add it in settings.`);
    }

    return { apiKey, baseURL };
  }

  private async buildRequest(
    settings: AppSettings, 
    title: string, 
    content: string, 
    history: HistoricalChapter[], 
    fanTranslation?: string | null
  ): Promise<any> {
    const hasStructuredOutputs = await supportsStructuredOutputs(settings.provider, settings.model);

    // Get effective system prompt (strips Part A if amendments disabled)
    const enableAmendments = settings.enableAmendments ?? false;
    let systemPrompt = getEffectiveSystemPrompt(settings.systemPrompt, enableAmendments);
    systemPrompt = replacePlaceholders(systemPrompt, settings);

    if (!systemPrompt) {
      throw new Error('System prompt cannot be empty');
    }

    // Get conditional schema based on enableAmendments setting
    const schema = getTranslationResponseJsonSchema(enableAmendments);

    // Configure response format
    const requestOptions: any = { model: settings.model };

    if (hasStructuredOutputs) {
      requestOptions.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'translation_response',
          schema: schema,
          strict: true
        }
      };
      if (settings.provider === 'OpenRouter') {
        requestOptions.provider = { require_parameters: true };
      }
    } else {
      requestOptions.response_format = { type: 'json_object' };
      const schemaString = JSON.stringify(schema, null, 2);
      const schemaInjection = `

Your response MUST be a single, valid JSON object that conforms to the following JSON schema:

${schemaString}`;

      // Avoid duplicating the injection if the user's prompt already contains it
      if (!systemPrompt.includes('Your response MUST be a single, valid JSON object')) {
        systemPrompt += schemaInjection;
      }
    }

    // Build messages
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add DeepSeek-specific system message if needed
    if (settings.provider === 'DeepSeek') {
      messages.push({ role: 'system', content: prompts.deepseekJsonSystemMessage });
    }
    
    messages.push({ role: 'system', content: systemPrompt });

    const historyPrompt = history.length > 0 ? formatHistory(history).trim() : '';
    const includeFanTranslation = settings.includeFanTranslationInPrompt ?? true;
    const effectiveFanTranslation = includeFanTranslation ? (fanTranslation ?? null) : null;
    const fanTranslationContext = buildFanTranslationContext(effectiveFanTranslation).trim();
    const preface = (
      prompts.translatePrefix +
      (effectiveFanTranslation ? prompts.translateFanSuffix : '') +
      prompts.translateInstruction +
      prompts.translateTitleGuidance
    ).trim();

    const sections = [
      historyPrompt,
      fanTranslationContext,
      preface,
      `${prompts.translateTitleLabel}\n${title}`,
      `${prompts.translateContentLabel}\n${content}`,
    ].filter(Boolean);

    const finalUserContent = sections.join('\n\n');
    messages.push({ role: 'user', content: finalUserContent });

    requestOptions.messages = messages;

    // Add supported parameters
    await this.addSupportedParameters(requestOptions, settings);

    return requestOptions;
  }

  private async addSupportedParameters(requestOptions: any, settings: AppSettings): Promise<void> {
    // Check parameter support
    const [supportsTemperature, supportsTopP, supportsFreqPen, supportsPresPen, supportsSeed] = 
      await Promise.all([
        supportsParameters(settings.provider, settings.model, ['temperature']),
        supportsParameters(settings.provider, settings.model, ['top_p']),
        supportsParameters(settings.provider, settings.model, ['frequency_penalty']),
        supportsParameters(settings.provider, settings.model, ['presence_penalty']),
        supportsParameters(settings.provider, settings.model, ['seed'])
      ]);

    // Add parameters if supported and different from defaults
    if (supportsTemperature && settings.temperature !== appConfig.aiParameters.defaults.temperature) {
      requestOptions.temperature = validateAndClampParameter(settings.temperature, 'temperature');
    }
    if (supportsTopP && settings.topP !== undefined && settings.topP !== appConfig.aiParameters.defaults.top_p) {
      requestOptions.top_p = validateAndClampParameter(settings.topP, 'top_p');
    }
    if (supportsFreqPen && settings.frequencyPenalty !== undefined && settings.frequencyPenalty !== appConfig.aiParameters.defaults.frequency_penalty) {
      requestOptions.frequency_penalty = validateAndClampParameter(settings.frequencyPenalty, 'frequency_penalty');
    }
    if (supportsPresPen && settings.presencePenalty !== undefined && settings.presencePenalty !== appConfig.aiParameters.defaults.presence_penalty) {
      requestOptions.presence_penalty = validateAndClampParameter(settings.presencePenalty, 'presence_penalty');
    }
    if (supportsSeed && settings.seed !== undefined && settings.seed !== null) {
      requestOptions.seed = validateAndClampParameter(settings.seed, 'seed');
    }

    // Add max tokens
    if (settings.maxOutputTokens && settings.maxOutputTokens > 0) {
      const modelsThatUseMaxCompletionTokens = ['claude', 'gpt-5'];
      const useMaxCompletionTokens = modelsThatUseMaxCompletionTokens.some(p => settings.model.startsWith(p));
      
      if (useMaxCompletionTokens) {
        requestOptions.max_completion_tokens = settings.maxOutputTokens;
      } else {
        requestOptions.max_tokens = settings.maxOutputTokens;
      }
    }

    // Add OpenRouter headers if needed
    if (settings.provider === 'OpenRouter') {
      try {
        const extraHeaders: Record<string, string> = {};
        if (appConfig.openrouter?.referer) extraHeaders['HTTP-Referer'] = appConfig.openrouter.referer;
        if (appConfig.openrouter?.title) extraHeaders['X-Title'] = appConfig.openrouter.title;
        if (Object.keys(extraHeaders).length > 0) {
          requestOptions.extra_headers = extraHeaders;
        }
      } catch {
        // Config not found, continue without headers
      }
    }
  }

  private isParameterError(error: any): boolean {
    return error.message?.includes('temperature') || 
           error.message?.includes('top_p') ||
           error.message?.includes('frequency_penalty') ||
           error.message?.includes('presence_penalty') ||
           error.message?.includes('seed') ||
           error.message?.includes('not supported');
  }

  private removeAdvancedParameters(requestOptions: any): any {
    const cleaned = { ...requestOptions };
    ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'seed'].forEach(param => {
      delete cleaned[param];
    });
    return cleaned;
  }

  /**
   * Strip markdown code fences from response text
   * Handles cases where models wrap JSON in ```json ... ```
   */
  private stripMarkdownCodeFences(text: string): string {
    let cleaned = text.trim();

    // Remove opening fence with optional language identifier
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }

    // Remove closing fence
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }

    return cleaned.trim();
  }

  /**
   * Detect if JSON response appears truncated
   * Checks for unbalanced braces and missing closing structures
   */
  private seemsTruncated(text: string): boolean {
    const trimmed = text.trim();

    // Check if ends with complete JSON
    if (!trimmed.endsWith('}') && !trimmed.endsWith(']')) {
      dlog('Truncation detected: Response does not end with } or ]');
      return true;
    }

    // Check for balanced braces
    const openBraces = (trimmed.match(/{/g) || []).length;
    const closeBraces = (trimmed.match(/}/g) || []).length;

    if (openBraces !== closeBraces) {
      dlog('Truncation detected: Unbalanced braces', { openBraces, closeBraces });
      return true;
    }

    // Check for balanced brackets
    const openBrackets = (trimmed.match(/\[/g) || []).length;
    const closeBrackets = (trimmed.match(/\]/g) || []).length;

    if (openBrackets !== closeBrackets) {
      dlog('Truncation detected: Unbalanced brackets', { openBrackets, closeBrackets });
      return true;
    }

    return false;
  }

  /**
   * Extract first balanced JSON block from text
   * Handles cases where response has preamble or postamble text
   */
  private extractBalancedJson(text: string): string | null {
    const scan = (open: string, close: string): string | null => {
      let depth = 0;
      const start = text.indexOf(open);
      if (start === -1) return null;

      for (let i = start; i < text.length; i++) {
        if (text[i] === open) depth++;
        if (text[i] === close) depth--;
        if (depth === 0) {
          return text.substring(start, i + 1);
        }
      }
      return null;
    };

    // Try object notation first, then array notation
    return scan('{', '}') || scan('[', ']');
  }

  private async processResponse(
    response: OpenAI.Chat.Completions.ChatCompletion,
    settings: AppSettings,
    startTime: number,
    endTime: number,
    chapterId?: string
  ): Promise<TranslationResult> {
    const choice = response.choices?.[0];
    const finishReason = choice?.finish_reason || (choice as any)?.native_finish_reason || null;

    const responseText = choice?.message?.content;
    if (!responseText) {
      throw new Error('Empty response from API');
    }

    dlogFull('Raw response text:', responseText.substring(0, 500));

    // Check for truncation BEFORE parsing
    if (finishReason === 'length' || this.seemsTruncated(responseText)) {
      dlog('Response appears truncated', {
        finishReason,
        responseLength: responseText.length,
        endsWithBrace: responseText.trim().endsWith('}')
      });
      throw new Error('length_cap: Model hit token limit. Increase max_tokens or reduce output size.');
    }

    // Strip markdown code fences if present
    let cleanedText = this.stripMarkdownCodeFences(responseText);

    if (cleanedText !== responseText) {
      dlog('Stripped markdown code fences from response');
    }

    let parsedResponse: any;

    // Try direct parse first
    try {
      parsedResponse = JSON.parse(cleanedText);
      dlog('Successfully parsed JSON on first attempt');
    } catch (initialError) {
      dlog('Initial parse failed, attempting balanced JSON extraction');

      // Try extracting balanced JSON block
      const extracted = this.extractBalancedJson(cleanedText);

      if (extracted) {
        try {
          parsedResponse = JSON.parse(extracted);
          dlog('Successfully parsed JSON after extraction');
        } catch (extractError) {
          dlogFull('Extraction also failed. Cleaned text:', cleanedText.substring(0, 500));
          throw new Error(`Failed to parse JSON response after extraction: ${cleanedText.substring(0, 200)}...`);
        }
      } else {
        dlogFull('Could not extract balanced JSON. Original text:', responseText.substring(0, 500));
        throw new Error(`Failed to parse JSON response (no balanced JSON found): ${responseText.substring(0, 200)}...`);
      }
    }

    // Calculate cost and timing
    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const costUsd = await calculateCost(settings.model, promptTokens, completionTokens);
    const requestTime = (endTime - startTime) / 1000;

    const usageMetrics: UsageMetrics = {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimatedCost: costUsd,
        requestTime,
        provider: settings.provider,
        model: settings.model,
    };

    // Record successful API call in metrics
    await apiMetricsService.recordMetric({
      apiType: 'translation',
      provider: settings.provider,
      model: settings.model,
      costUsd,
      tokens: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens,
      },
      chapterId,
      success: true,
    });

    const result = {
      translatedTitle: parsedResponse.translatedTitle || '',
      translation: parsedResponse.translation || '',
      suggestedIllustrations: parsedResponse.suggestedIllustrations || [],
      proposal: parsedResponse.proposal || null,
      footnotes: parsedResponse.footnotes || [],
      usageMetrics: usageMetrics,
    };

    // ALWAYS log if translation is suspiciously short (< 100 chars) but we were charged
    if (result.translation.length < 100 && costUsd > 0.01) {
      console.warn('[OpenAI] ⚠️ SUSPICIOUS: Short translation but high cost!', {
        translationLength: result.translation.length,
        translationPreview: result.translation.substring(0, 50),
        cost: costUsd,
        model: settings.model,
        promptTokens,
        completionTokens,
        rawResponsePreview: responseText.substring(0, 500),
      });
    }

    return result;
  }
}
