
import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import OpenAI from 'openai';
import { AppSettings, HistoricalChapter, TranslationResult, FeedbackItem, UsageMetrics } from '../types';
import { COSTS_PER_MILLION_TOKENS } from '../costs';
import { ChatCompletion } from 'openai/resources';

// --- API KEY VALIDATION ---

/**
 * Validates that the required API key exists for the current provider.
 * This should be called BEFORE attempting any translation to prevent
 * wasted resources and provide immediate user feedback.
 */
export const validateApiKey = (settings: AppSettings): { isValid: boolean; errorMessage?: string } => {
  let requiredApiKey: string | undefined;
  let providerName: string;

  switch (settings.provider) {
    case 'Gemini':
      requiredApiKey = settings.apiKeyGemini || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
      providerName = 'Google Gemini';
      break;
    case 'OpenAI':
      requiredApiKey = settings.apiKeyOpenAI || (typeof process !== 'undefined' ? process.env.OPENAI_API_KEY : undefined);
      providerName = 'OpenAI';
      break;
    case 'DeepSeek':
      requiredApiKey = settings.apiKeyDeepSeek || (typeof process !== 'undefined' ? process.env.DEEPSEEK_API_KEY : undefined);
      providerName = 'DeepSeek';
      break;
    default:
      return { isValid: false, errorMessage: `Unknown provider: ${settings.provider}` };
  }

  if (!requiredApiKey?.trim()) {
    return { 
      isValid: false, 
      errorMessage: `${providerName} API key is missing. Please add it in the settings.` 
    };
  }

  return { isValid: true };
};

// --- SHARED PROMPT LOGIC ---

const formatHistory = (history: HistoricalChapter[]): string => {
  if (history.length === 0) {
    return "No recent history available.";
  }
  return history.map((h, index) => {
    const feedbackStr = h.feedback.length > 0
        ? "Feedback on this chapter:\n" + h.feedback.map((f: FeedbackItem) => {
            const commentStr = f.comment ? ` (User comment: ${f.comment})` : '';
            return `- ${f.type} on: "${f.selection}"${commentStr}`;
        }).join('\n')
        : "No feedback was given on this chapter.";
    
    return `--- PREVIOUS CHAPTER CONTEXT ${index + 1} (OLDEST) ---\n\n` +
           `== ORIGINAL TEXT ==\n` +
           `TITLE: ${h.originalTitle}\n` +
           `CONTENT:\n${h.originalContent}\n\n` +
           `== PREVIOUS TRANSLATION ==\n` +
           `TITLE: ${h.translatedTitle}\n` +
           `CONTENT:\n${h.translatedContent}\n\n` +
           `== USER FEEDBACK ON THIS TRANSLATION ==\n` +
           `${feedbackStr}\n\n` +
           `--- END OF CONTEXT FOR PREVIOUS CHAPTER ${index + 1} ---`;
  }).join('\n\n');
};

// --- COST CALCULATION ---

export const calculateCost = (model: string, promptTokens: number, completionTokens: number): number => {
    // Validate input parameters
    if (promptTokens < 0 || completionTokens < 0) {
        throw new Error(`Invalid token counts: promptTokens=${promptTokens}, completionTokens=${completionTokens}. Token counts must be non-negative.`);
    }
    
    let modelCosts = COSTS_PER_MILLION_TOKENS[model];
    
    // If exact model not found, try stripping date suffix (e.g., gpt-5-mini-2025-08-07 -> gpt-5-mini)
    if (!modelCosts) {
        const baseModel = model.replace(/-\d{4}-\d{2}-\d{2}$/, '');
        modelCosts = COSTS_PER_MILLION_TOKENS[baseModel];
        if (modelCosts) {
            console.log(`[Cost] Using pricing for base model '${baseModel}' for '${model}'`);
        }
    }
    
    if (!modelCosts) {
        console.warn(`[Cost] No pricing information found for model: ${model}. Cost will be reported as 0.`);
        return 0;
    }
    const inputCost = (promptTokens / 1_000_000) * modelCosts.input;
    const outputCost = (completionTokens / 1_000_000) * modelCosts.output;
    return inputCost + outputCost;
}

// --- GEMINI PROVIDER ---

const geminiResponseSchema = {
    type: Type.OBJECT,
    properties: {
        translatedTitle: { type: Type.STRING, description: "The translated chapter title." },
        translation: { type: Type.STRING, description: "The full translated chapter content, with markers like [1] for footnotes and [ILLUSTRATION-X] for images." },
        footnotes: {
          type: Type.ARRAY, nullable: true, description: "Footnotes referenced in the text.",
          items: {
            type: Type.OBJECT, properties: { marker: { type: Type.STRING }, text: { type: Type.STRING } }, required: ['marker', 'text']
          }
        },
        suggestedIllustrations: {
            type: Type.ARRAY, nullable: true, description: "Suggested illustrations.",
            items: {
                type: Type.OBJECT, properties: { placementMarker: { type: Type.STRING }, imagePrompt: { type: Type.STRING } }, required: ['placementMarker', 'imagePrompt']
            }
        },
        proposal: {
            type: Type.OBJECT, nullable: true, description: "A proposal to amend the system prompt.",
            properties: { observation: { type: Type.STRING }, currentRule: { type: Type.STRING }, proposedChange: { type: Type.STRING }, reasoning: { type: Type.STRING } },
            required: ['observation', 'currentRule', 'proposedChange', 'reasoning'],
        }
    },
    required: ['translatedTitle', 'translation']
};

const translateWithGemini = async (title: string, content: string, settings: AppSettings, history: HistoricalChapter[]): Promise<TranslationResult> => {
  const apiKey = settings.apiKeyGemini || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined);
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please add it in the settings.");
  }
  
  const startTime = performance.now();
  const ai = new GoogleGenAI({ apiKey });
  const historyPrompt = formatHistory(history);
  const fullPrompt = `${historyPrompt}\n\n-----\n\nBased on the context from previous chapters, please translate the following new chapter:\n\nTITLE:\n${title}\n\nCONTENT:\n${content}`;

  const response: GenerateContentResponse = await ai.models.generateContent({
      model: settings.model,
      contents: fullPrompt,
      config: {
          systemInstruction: settings.systemPrompt,
          responseMimeType: "application/json",
          responseSchema: geminiResponseSchema,
          temperature: settings.temperature,
      }
  });

  const requestTime = (performance.now() - startTime) / 1000;
  
  const usage = response.usageMetadata;
  const promptTokens = usage?.promptTokenCount ?? 0;
  const completionTokens = usage?.candidatesTokenCount ?? 0;
  const totalTokens = promptTokens + completionTokens;
  const estimatedCost = calculateCost(settings.model, promptTokens, completionTokens);
  
  const usageMetrics: UsageMetrics = {
    totalTokens, promptTokens, completionTokens, estimatedCost, requestTime,
    provider: 'Gemini', model: settings.model
  };
  
  const responseText = response.text.trim();
  try {
    const parsedJson = JSON.parse(responseText);
    if (typeof parsedJson.translatedTitle !== 'string' || typeof parsedJson.translation !== 'string') {
        throw new Error('Invalid JSON structure in AI response.');
    }
    return {
        translatedTitle: parsedJson.translatedTitle,
        translation: parsedJson.translation,
        proposal: parsedJson.proposal ?? null,
        footnotes: parsedJson.footnotes ?? [],
        suggestedIllustrations: parsedJson.suggestedIllustrations ?? [],
        usageMetrics: usageMetrics,
    };
  } catch (e) {
      console.error("Failed to parse JSON response from Gemini:", responseText, e);
      throw new Error("AI returned a malformed response. Could not parse translation.");
  }
};

// --- OPENAI / DEEPSEEK PROVIDER ---

const translateWithOpenAI = async (title: string, content: string, settings: AppSettings, history: HistoricalChapter[]): Promise<TranslationResult> => {
    let apiKey: string | undefined;
    let baseURL: string | undefined;

    if (settings.provider === 'OpenAI') {
        apiKey = settings.apiKeyOpenAI || (typeof process !== 'undefined' ? process.env.OPENAI_API_KEY : undefined);
        baseURL = 'https://api.openai.com/v1';
    } else if (settings.provider === 'DeepSeek') {
        apiKey = settings.apiKeyDeepSeek || (typeof process !== 'undefined' ? process.env.DEEPSEEK_API_KEY : undefined);
        baseURL = 'https://api.deepseek.com/v1';
    }

    if (!apiKey) throw new Error(`${settings.provider} API key is missing. Please add it in the settings.`);

    const startTime = performance.now();
    const openai = new OpenAI({ apiKey, baseURL, dangerouslyAllowBrowser: true });
    
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: `${settings.systemPrompt}\n\nYou MUST respond with a JSON object that strictly adheres to the following JSON schema:\n${JSON.stringify(geminiResponseSchema, null, 2)}` },
    ];
    
    history.forEach(h => {
        messages.push({ role: 'user', content: `TITLE: ${h.originalTitle}\n\nCONTENT:\n${h.originalContent}` });
        messages.push({ role: 'assistant', content: h.translatedContent });
    });
    
    messages.push({ role: 'user', content: `Translate this new chapter:\n\nTITLE:\n${title}\n\nCONTENT:\n${content}` });

    // Prepare the request options
    const requestOptions: any = {
        model: settings.model,
        messages,
        response_format: { type: 'json_object' },
    };

    console.log(`[OpenAI] Preparing request for model: ${settings.model}`);
    console.log(`[OpenAI] Temperature setting: ${settings.temperature}`);
    console.log(`[OpenAI] Message count: ${messages.length}`);
    console.log(`[OpenAI] Request options:`, JSON.stringify(requestOptions, null, 2));

    // Add temperature if the model supports it (some newer models only support default)
    let response: ChatCompletion;
    try {
        requestOptions.temperature = settings.temperature;
        console.log(`[OpenAI] Attempt 1: Sending request with temperature ${settings.temperature}`);
        response = await openai.chat.completions.create(requestOptions);
        console.log(`[OpenAI] Attempt 1: Success! Response received`);
    } catch (error: any) {
        console.error(`[OpenAI] Attempt 1 failed:`, error);
        console.log(`[OpenAI] Error status:`, error.status || 'unknown');
        console.log(`[OpenAI] Error message:`, error.message || 'unknown');
        console.log(`[OpenAI] Error response:`, error.response?.data || 'no response data');
        
        // If temperature fails, retry without it
        if (error.message?.includes('temperature') || error.message?.includes('not supported') || error.status === 400) {
            console.warn(`[OpenAI] Retrying without temperature setting for model ${settings.model}`);
            delete requestOptions.temperature;
            console.log(`[OpenAI] Attempt 2: Retry request options:`, JSON.stringify(requestOptions, null, 2));
            
            try {
                response = await openai.chat.completions.create(requestOptions);
                console.log(`[OpenAI] Attempt 2: Success! Response received`);
            } catch (retryError: any) {
                console.error(`[OpenAI] Attempt 2 also failed:`, retryError);
                throw retryError;
            }
        } else {
            throw error;
        }
    }

    const requestTime = (performance.now() - startTime) / 1000;
    
    const usage = response.usage;
    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    const totalTokens = usage?.total_tokens ?? (promptTokens + completionTokens);
    const estimatedCost = calculateCost(settings.model, promptTokens, completionTokens);

    const usageMetrics: UsageMetrics = {
        totalTokens, promptTokens, completionTokens, estimatedCost, requestTime,
        provider: settings.provider, model: settings.model
    };

    const responseText = response.choices[0].message.content;
    if (!responseText) throw new Error("Received an empty response from the API.");
    
    try {
        const parsedJson = JSON.parse(responseText);
         if (typeof parsedJson.translatedTitle !== 'string' || typeof parsedJson.translation !== 'string') {
            throw new Error('Invalid JSON structure in AI response.');
        }
        return {
            translatedTitle: parsedJson.translatedTitle,
            translation: parsedJson.translation,
            proposal: parsedJson.proposal ?? null,
            footnotes: parsedJson.footnotes ?? [],
            suggestedIllustrations: parsedJson.suggestedIllustrations ?? [],
            usageMetrics: usageMetrics,
        };
    } catch (e) {
        console.error(`Failed to parse JSON response from ${settings.provider}:`, responseText, e);
        throw new Error("AI returned a malformed response. Could not parse translation.");
    }
};

// --- UNIFIED TRANSLATION ROUTER ---

export const translateChapter = async (
  title: string,
  content: string,
  settings: AppSettings,
  history: HistoricalChapter[],
  maxRetries: number = 3,
  initialDelay: number = 2000
): Promise<TranslationResult> => {
    let lastError: Error | null = null;
    
    const translationFunction = settings.provider === 'Gemini' ? translateWithGemini : translateWithOpenAI;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.log(`[aiService] Attempt ${attempt + 1}/${maxRetries} to translate with ${settings.provider} (${settings.model})...`);
            return await translationFunction(title, content, settings, history);
        } catch (e: any) {
            lastError = e;
            const isRateLimitError = e.message?.includes('429') || e.status === 429;
            if (isRateLimitError && attempt < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, attempt);
                console.warn(`[aiService] Rate limit hit for ${settings.provider}. Retrying in ${delay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw lastError;
        }
    }

    throw lastError ?? new Error(`An unknown error occurred during translation with ${settings.provider} after all retries.`);
};