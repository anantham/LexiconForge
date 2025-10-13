import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import type { TranslationProvider, TranslationRequest } from '../../services/translate/Translator';
import type { TranslationResult, AppSettings, HistoricalChapter } from '../../types';
import { rateLimitService } from '../../services/rateLimitService';
import { calculateCost } from '../../services/aiService';
import prompts from '../../config/prompts.json';

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
    console.log(`[Gemini] ${message}`, ...args);
  }
};

export class GeminiAdapter implements TranslationProvider {
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const { title, content, settings, history, fanTranslation, abortSignal } = request;
    
    // Get API key
    const apiKey = settings.apiKeyGemini || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key is missing. Please add it in settings.');
    }

    // Check rate limits
    await rateLimitService.canMakeRequest(settings.model);

    // Initialize client
    const genAI = new GoogleGenAI(apiKey);
    const model = genAI.getGenerativeModel({ model: settings.model });

    // Build prompt
    const fullPrompt = this.buildPrompt(settings, title, content, history, fanTranslation);
    
    dlog('Making API request', { model: settings.model });

    const startTime = performance.now();
    let response: GenerateContentResponse;

    try {
      // Make API call
      response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: settings.temperature,
          maxOutputTokens: settings.maxOutputTokens || undefined,
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
    let systemPrompt = replacePlaceholders(settings.systemPrompt, settings);
    
    if (!systemPrompt) {
      throw new Error('System prompt cannot be empty');
    }

    // Ensure JSON requirement is in prompt
    if (!systemPrompt.toLowerCase().includes('json')) {
      systemPrompt += '\n\nYour response must be a single, valid JSON object.';
    }

    let fullPrompt = systemPrompt + '\n\n';

    // Add history
    history.forEach((h, index) => {
      if (h.originalTitle && h.originalContent && h.translatedContent) {
        fullPrompt += `EXAMPLE ${index + 1}:\n`;
        fullPrompt += `INPUT TITLE: ${h.originalTitle}\n`;
        fullPrompt += `INPUT CONTENT: ${h.originalContent}\n`;
        fullPrompt += `OUTPUT: ${h.translatedContent}\n\n`;
      }
    });

    // Add current request
    const fanTranslationContext = buildFanTranslationContext(fanTranslation);
    const preface = prompts.translatePrefix + 
      (fanTranslation ? prompts.translateFanSuffix : '') + 
      prompts.translateInstruction +
      prompts.translateTitleGuidance;

    fullPrompt += `${fanTranslationContext}${fanTranslationContext ? '\n\n' : ''}${preface}\n\n`;
    fullPrompt += `${prompts.translateTitleLabel}\n${title}\n\n`;
    fullPrompt += `${prompts.translateContentLabel}\n${content}`;

    return fullPrompt;
  }

  private processResponse(
    response: GenerateContentResponse,
    settings: AppSettings,
    startTime: number,
    endTime: number
  ): TranslationResult {
    const responseText = response.response.text();
    if (!responseText) {
      throw new Error('Empty response from Gemini API');
    }

    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${responseText.substring(0, 200)}...`);
    }

    // Extract token usage (Gemini provides this in different format)
    const promptTokens = response.response.usageMetadata?.promptTokenCount || 0;
    const completionTokens = response.response.usageMetadata?.candidatesTokenCount || 0;
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
