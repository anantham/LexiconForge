import { GoogleGenerativeAI, GenerateContentResult, GenerateContentResponse } from '@google/generative-ai';
import type { TranslationProvider, TranslationRequest } from '../../services/translate/Translator';
import type { TranslationResult, AppSettings, HistoricalChapter } from '../../types';
import { rateLimitService } from '../../services/rateLimitService';
import { calculateCost } from '../../services/aiService';
import prompts from '../../config/prompts.json';
import { buildFanTranslationContext, formatHistory } from '../../services/prompts';
import { getEnvVar } from '../../services/env';
import { getTranslationResponseGeminiSchema } from '../../services/translate/translationResponseSchema';
import { getEffectiveSystemPrompt } from '../../utils/promptUtils';

// Placeholder replacement utility
const replacePlaceholders = (template: string, settings: AppSettings): string => {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    return (settings as any)[key] || match;
  });
};

// Debug logging
const getDebugLevel = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('LF_AI_DEBUG_LEVEL');
  } catch {
    return null;
  }
};

const shouldLogSummary = (): boolean => {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }
  const level = getDebugLevel();
  // Default to logging in development unless the level explicitly disables it
  return level === null || level === 'summary' || level === 'full';
};

const shouldLogFull = (): boolean => {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }
  const level = getDebugLevel();
  return level === 'full';
};

const dlog = (message: string, ...args: any[]) => {
  if (shouldLogSummary()) {
    console.log(`[Gemini] ${message}`, ...args);
  }
};

const dlogFull = (message: string, ...args: any[]) => {
  if (shouldLogFull()) {
    console.log(`[Gemini] ${message}`, ...args);
  }
};

export class GeminiAdapter implements TranslationProvider {
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const { title, content, settings, history, fanTranslation, abortSignal } = request;
    
    // Get API key
    const envKey = getEnvVar('GEMINI_API_KEY');
    const apiKey = settings.apiKeyGemini || envKey;
    const keySource = settings.apiKeyGemini ? 'settings' : envKey ? 'env' : 'missing';
    dlog(`Key source: ${keySource}, present: ${apiKey ? 'yes' : 'no'}, length: ${apiKey ? apiKey.length : 0}`);
    if (!apiKey) {
      throw new Error('Gemini API key is missing. Please add it in settings.');
    }

    // Check rate limits
    await rateLimitService.canMakeRequest(settings.model);

    // Initialize client
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: settings.model });

    // Build prompt
    const fullPrompt = this.buildPrompt(settings, title, content, history, fanTranslation);
    
      dlog('Making API request', { model: settings.model });

    const startTime = performance.now();
    let response: GenerateContentResult;

    try {
      // Get conditional schema based on enableAmendments setting
      const enableAmendments = settings.enableAmendments ?? false;
      const schema = getTranslationResponseGeminiSchema(enableAmendments);

      // Make API call
      response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: settings.temperature,
          maxOutputTokens: settings.maxOutputTokens || undefined,
          responseMimeType: 'application/json',
          responseSchema: schema
        },
      });

      // Handle abort signal manually (Gemini doesn't support native abort)
      if (abortSignal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

    } catch (error: any) {
      if (abortSignal?.aborted || error.name === 'AbortError') {
        throw new DOMException('Translation was aborted by user', 'AbortError');
      }
      throw error;
    }

    const endTime = performance.now();
    
    // Process response
    return this.processResponse(response, settings, startTime, endTime);
  }

  private buildPrompt(
    settings: AppSettings,
    title: string,
    content: string,
    history: HistoricalChapter[],
    fanTranslation?: string | null
  ): string {
    // Get effective system prompt (strips Part A if amendments disabled)
    const enableAmendments = settings.enableAmendments ?? false;
    let systemPrompt = getEffectiveSystemPrompt(settings.systemPrompt, enableAmendments);
    systemPrompt = replacePlaceholders(systemPrompt, settings);

    if (!systemPrompt) {
      throw new Error('System prompt cannot be empty');
    }

    // Ensure JSON requirement is in prompt
    if (!systemPrompt.toLowerCase().includes('json')) {
      systemPrompt += '\n\nYour response must be a single, valid JSON object.';
    }

    const historyPrompt = history.length > 0 ? formatHistory(history).trim() : '';
    const fanTranslationContext = buildFanTranslationContext(fanTranslation ?? null).trim();
    const preface = (
      prompts.translatePrefix +
      (fanTranslation ? prompts.translateFanSuffix : '') +
      prompts.translateInstruction +
      prompts.translateTitleGuidance
    ).trim();

    const sections = [
      systemPrompt.trim(),
      historyPrompt,
      fanTranslationContext,
      preface,
      `${prompts.translateTitleLabel}\n${title}`,
      `${prompts.translateContentLabel}\n${content}`,
    ].filter(Boolean);

    return sections.join('\n\n');
  }

  private async processResponse(
    response: GenerateContentResponse,
    settings: AppSettings,
    startTime: number,
    endTime: number
  ): Promise<TranslationResult> {
    const responseText = response.response.text();
    if (!responseText) {
      throw new Error('Empty response from Gemini API');
    }

    dlog('Raw response preview (first 500 chars):', responseText.slice(0, 500));

    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(responseText);
      dlog('Successfully parsed Gemini JSON response.');
    } catch (error) {
      dlog('JSON parse failed. Preview of raw response (first 800 chars):', responseText.slice(0, 800));
      dlogFull('JSON parse failed. Full raw response text:', responseText);
      throw new Error(`Failed to parse JSON response: ${responseText.substring(0, 200)}...`);
    }

    const safeArray = (value: any): any[] => Array.isArray(value) ? value : [];
    const safeFootnotes = safeArray(parsedResponse.footnotes);
    const safeIllustrations = safeArray(parsedResponse.suggestedIllustrations);

    // Extract token usage (Gemini provides this in different format)
    const promptTokens = response.response.usageMetadata?.promptTokenCount || 0;
    const completionTokens = response.response.usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = promptTokens + completionTokens;
    const costUsd = await calculateCost(settings.model, promptTokens, completionTokens);
    const requestTime = (endTime - startTime) / 1000;

    const usageMetrics = {
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost: costUsd,
      requestTime,
      provider: settings.provider,
      model: settings.model
    };

    const translationSettings = {
      provider: settings.provider,
      model: settings.model,
      temperature: settings.temperature,
      systemPrompt: settings.systemPrompt,
      promptId: settings.promptId,
      promptName: settings.promptName
    };

    return {
      translatedTitle: parsedResponse.translatedTitle || '',
      translation: parsedResponse.translation || '',
      footnotes: safeFootnotes,
      suggestedIllustrations: safeIllustrations,
      proposal: parsedResponse.proposal || null,
      usageMetrics,
      // Legacy fields for backwards compatibility with translator sanitization/tests
      illustrations: safeIllustrations,
      amendments: parsedResponse.proposal ? [parsedResponse.proposal] : [],
      costUsd,
      tokensUsed: {
        promptTokens,
        completionTokens,
        totalTokens
      },
      model: settings.model,
      provider: settings.provider,
      translationSettings
    };
  }
}
