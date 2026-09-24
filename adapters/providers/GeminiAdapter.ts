import { FinishReason, GoogleGenAI, type GenerateContentConfig, type GenerateContentResponse } from '@google/genai';
import type { TranslationProvider, TranslationRequest } from '../../services/translate/Translator';
import type { ChatRequest, ChatResponse, Provider, ProviderName } from './Provider';
import type { TranslationResult, AppSettings, HistoricalChapter } from '../../types';
import { rateLimitService } from '../../services/rateLimitService';
import { calculateCost } from '../../services/ai/cost';
import { apiMetricsService } from '../../services/apiMetricsService';
import prompts from '../../config/prompts.json';
import { buildFanTranslationContext, formatHistory } from '../../services/prompts';
import { requireConfiguredApiKey } from '../../services/ai/providerCredentials';
import { getTranslationOnlyResponseJsonSchema } from '../../services/translate/translationResponseSchema';
import { getTranslationSystemPrompt } from '../../utils/promptUtils';
import { replacePlaceholders } from '../../services/ai/textUtils';

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

// Finish reasons whose (possibly partial) text must not be used — the rule the legacy
// @google/generative-ai SDK enforced in text(); @google/genai's `text` getter does not.
const BLOCKED_FINISH_REASONS: ReadonlySet<string> = new Set([
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.LANGUAGE,
]);

// Returns the response text, or throws naming why Gemini produced none usable.
const responseTextOrThrow = (result: GenerateContentResponse): string => {
  const finishReason = result.candidates?.[0]?.finishReason;
  if (finishReason && BLOCKED_FINISH_REASONS.has(finishReason)) {
    throw new Error(`Gemini response blocked (${finishReason})`);
  }
  const text = result.text;
  if (!text) {
    const reason = result.promptFeedback?.blockReason ?? finishReason;
    throw new Error(`Empty response from Gemini API${reason ? ` (${reason})` : ''}`);
  }
  return text;
};

export class GeminiAdapter implements TranslationProvider, Provider {
  name: ProviderName = 'Gemini';

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const { title, content, settings, history, fanTranslation, abortSignal } = request;
    
    // Get API key
    const apiKey = requireConfiguredApiKey(settings, 'Gemini');

    // Check rate limits
    await rateLimitService.acquireRequestSlot(settings.model, { signal: abortSignal });

    const ai = new GoogleGenAI({ apiKey });

    // Build prompt
    const fullPrompt = this.buildPrompt(settings, title, content, history, fanTranslation);
    
    dlog('Making API request', { model: settings.model });

    const startTime = performance.now();
    let result: GenerateContentResponse;

    try {
      // Pass the signal so a Translator timeout actually CANCELS the in-flight request (review #3);
      // otherwise the original keeps running while the retry fires.
      result = await ai.models.generateContent({
        model: settings.model,
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        config: {
          temperature: settings.temperature,
          maxOutputTokens: settings.maxOutputTokens || 16384,
          responseMimeType: 'application/json',
          responseSchema: getTranslationOnlyResponseJsonSchema(),
          abortSignal,
        },
      });

      // Belt-and-braces: if the signal fired without the SDK surfacing an AbortError, bail here.
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
    return this.processResponse(result, settings, startTime, endTime);
  }

  async chatJSON(input: ChatRequest): Promise<ChatResponse> {
    const settings = input.settings;
    if (!settings) {
      throw new Error('chatJSON requires settings');
    }

    const modelId = input.model || settings.model;
    const temperature = input.temperature ?? settings.temperature ?? 0.2;
    const maxTokens = input.maxTokens ?? settings.maxOutputTokens ?? 16384;

    const messages = input.messages?.length
      ? input.messages
      : [
          ...(input.system ? [{ role: 'system' as const, content: input.system }] : []),
          ...(input.user ? [{ role: 'user' as const, content: input.user }] : []),
        ];

    const prompt = messages
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');

    const apiKey = requireConfiguredApiKey(settings, 'Gemini');

    await rateLimitService.acquireRequestSlot(modelId, { signal: input.abortSignal });

    const ai = new GoogleGenAI({ apiKey });

    const startTime = performance.now();
    let result: GenerateContentResponse;
    try {
      const config: GenerateContentConfig = {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
        abortSignal: input.abortSignal,
      };
      if (input.schema && (input.structuredOutputs ?? true)) {
        config.responseSchema = input.schema;
      }

      result = await ai.models.generateContent({
        model: modelId,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config,
      });

      if (input.abortSignal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
    } catch (error: any) {
      if (input.abortSignal?.aborted || error.name === 'AbortError') {
        throw new DOMException('Translation was aborted by user', 'AbortError');
      }

      await apiMetricsService.recordMetric({
        apiType: input.apiType ?? 'sutta_studio',
        provider: settings.provider,
        model: modelId,
        costUsd: 0,
        tokens: { prompt: 0, completion: 0, total: 0 },
        chapterId: input.chapterId,
        success: false,
        errorMessage: error.message || 'Unknown error',
      });
      throw error;
    }

    const endTime = performance.now();
    const responseText = responseTextOrThrow(result);

    const promptTokens = result.usageMetadata?.promptTokenCount || 0;
    const completionTokens = result.usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = promptTokens + completionTokens;
    let costUsd = 0;
    try {
      costUsd = await calculateCost(modelId, promptTokens, completionTokens);
    } catch (e) {
      console.warn('[Gemini] Failed to calculate compiler cost:', e);
    }

    await apiMetricsService.recordMetric({
      apiType: input.apiType ?? 'sutta_studio',
      provider: settings.provider,
      model: modelId,
      costUsd,
      duration: (endTime - startTime) / 1000,
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
      model: modelId,
      raw: result,
    };
  }

  private buildPrompt(
    settings: AppSettings,
    title: string,
    content: string,
    history: HistoricalChapter[],
    fanTranslation?: string | null
  ): string {
    // Translation runs without the amendment protocol; proposals are generated separately.
    let systemPrompt = getTranslationSystemPrompt(settings.systemPrompt);
    systemPrompt = replacePlaceholders(systemPrompt, settings);

    if (!systemPrompt) {
      throw new Error('System prompt cannot be empty');
    }

    // Ensure JSON requirement is in prompt
    if (!systemPrompt.toLowerCase().includes('json')) {
      systemPrompt += '\n\nYour response must be a single, valid JSON object.';
    }

    const historyPrompt = history.length > 0 ? formatHistory(history).trim() : '';
    const includeFanTranslation = settings.includeFanTranslationInPrompt ?? false;
    const effectiveFanTranslation = includeFanTranslation ? (fanTranslation ?? null) : null;
    const fanTranslationContext = buildFanTranslationContext(effectiveFanTranslation).trim();
    const preface = (
      prompts.translatePrefix +
      (effectiveFanTranslation ? prompts.translateFanSuffix : '') +
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
    result: GenerateContentResponse,
    settings: AppSettings,
    startTime: number,
    endTime: number
  ): Promise<TranslationResult> {
    const responseText = responseTextOrThrow(result);

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
    const promptTokens = result.usageMetadata?.promptTokenCount || 0;
    const completionTokens = result.usageMetadata?.candidatesTokenCount || 0;
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
