import OpenAI from 'openai';
import type { TranslationProvider, TranslationRequest } from '../../services/translate/Translator';
import type { TranslationResult, AppSettings, HistoricalChapter } from '../../types';
import { supportsStructuredOutputs, supportsParameters } from '../../services/capabilityService';
import { rateLimitService } from '../../services/rateLimitService';
import { calculateCost } from '../../services/aiService';
import prompts from '../../config/prompts.json';
import appConfig from '../../config/app.json';

// OpenAI Response Schema for structured outputs
const openaiResponseSchema = {
  "type": "object",
  "properties": {
    "translatedTitle": { "type": "string" },
    "translation": { "type": "string" },
    "footnotes": {
      "type": "array",
      "items": { "type": "string" }
    },
    "suggestedIllustrations": {
      "type": "array", 
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "placement": { "type": "string" }
        },
        "required": ["description", "placement"],
        "additionalProperties": false
      }
    },
    "proposal": {
      "type": "object",
      "properties": {
        "issue": { "type": "string" },
        "currentTranslation": { "type": "string" },
        "suggestedImprovement": { "type": "string" },
        "reasoning": { "type": "string" }
      },
      "required": ["issue", "currentTranslation", "suggestedImprovement", "reasoning"],
      "additionalProperties": false
    }
  },
  "required": ["translatedTitle", "translation", "footnotes", "suggestedIllustrations", "proposal"],
  "additionalProperties": false
};

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

// Fan translation context builder
const buildFanTranslationContext = (fanTranslation?: string | null): string => {
  if (!fanTranslation) return '';
  return `EXISTING FAN TRANSLATION (for reference):\n${fanTranslation}`;
};

// Debug logging
const dlog = (message: string, ...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[OpenAI] ${message}`, ...args);
  }
};

export class OpenAIAdapter implements TranslationProvider {
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const { title, content, settings, history, fanTranslation, abortSignal } = request;
    
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
        throw error;
      }
    }

    const endTime = performance.now();
    
    // Process response
    return this.processResponse(response, settings, startTime, endTime);
  }

  private getApiConfig(settings: AppSettings): { apiKey: string; baseURL: string } {
    let apiKey: string | undefined;
    let baseURL: string;

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
    let systemPrompt = replacePlaceholders(settings.systemPrompt, settings);

    if (!systemPrompt) {
      throw new Error('System prompt cannot be empty');
    }

    // Configure response format
    const requestOptions: any = { model: settings.model };
    
    if (hasStructuredOutputs) {
      requestOptions.response_format = { 
        type: 'json_schema', 
        json_schema: { 
          name: 'translation_response', 
          schema: openaiResponseSchema, 
          strict: true 
        } 
      };
      if (settings.provider === 'OpenRouter') {
        requestOptions.provider = { require_parameters: true };
      }
    } else {
      requestOptions.response_format = { type: 'json_object' };
      if (!systemPrompt.toLowerCase().includes('json')) {
        systemPrompt += '\n\nYour response must be a single, valid JSON object.';
      }
    }

    // Build messages
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add DeepSeek-specific system message if needed
    if (settings.provider === 'DeepSeek') {
      messages.push({ role: 'system', content: prompts.deepseekJsonSystemMessage });
    }
    
    messages.push({ role: 'system', content: systemPrompt });

    // Add history
    history.forEach(h => {
      if (h.originalTitle && h.originalContent && h.translatedContent) {
        messages.push({ 
          role: 'user', 
          content: `TITLE: ${h.originalTitle}\n\nCONTENT:\n${h.originalContent}` 
        });
        messages.push({ role: 'assistant', content: h.translatedContent });
      }
    });

    // Add current translation request
    const fanTranslationContext = buildFanTranslationContext(fanTranslation);
    const preface = prompts.translatePrefix + 
      (fanTranslation ? prompts.translateFanSuffix : '') + 
      prompts.translateInstruction;
    
    const finalUserContent = `${fanTranslationContext}${fanTranslationContext ? '\n\n' : ''}${preface}\n\n${prompts.translateTitleLabel}\n${title}\n\n${prompts.translateContentLabel}\n${content}`;
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
           error.message?.includes('not supported') ||
           error.status === 400;
  }

  private removeAdvancedParameters(requestOptions: any): any {
    const cleaned = { ...requestOptions };
    ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'seed'].forEach(param => {
      delete cleaned[param];
    });
    return cleaned;
  }

  private processResponse(
    response: OpenAI.Chat.Completions.ChatCompletion,
    settings: AppSettings,
    startTime: number,
    endTime: number
  ): TranslationResult {
    const responseText = response.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('Empty response from OpenAI API');
    }

    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${responseText.substring(0, 200)}...`);
    }

    // Calculate cost
    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const costUsd = calculateCost(settings.model, promptTokens, completionTokens);

    return {
      translatedTitle: parsedResponse.translatedTitle || '',
      translation: parsedResponse.translation || '',
      illustrations: parsedResponse.suggestedIllustrations || [],
      amendments: parsedResponse.proposal ? [parsedResponse.proposal] : [],
      costUsd,
      tokensUsed: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      },
      model: settings.model,
      provider: settings.provider,
      translationSettings: {
        provider: settings.provider,
        model: settings.model,
        temperature: settings.temperature,
        systemPrompt: settings.systemPrompt,
        promptId: settings.promptId,
        promptName: settings.promptName
      }
    };
  }
}