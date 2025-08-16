
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
    case 'Claude':
      requiredApiKey = settings.apiKeyClaude || (typeof process !== 'undefined' ? process.env.CLAUDE_API_KEY : undefined);
      providerName = 'Claude (Anthropic)';
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

// --- ILLUSTRATION VALIDATION & AUTO-RECOVERY ---

const validateAndFixIllustrations = (translation: string, suggestedIllustrations: any[] | undefined): { translation: string; suggestedIllustrations: any[] } => {
    const textMarkers = translation.match(/\[ILLUSTRATION-\d+[A-Za-z]*\]/g) || [];
    const jsonIllustrations = suggestedIllustrations || [];
    const jsonMarkers = jsonIllustrations.map(item => item.placementMarker);

    // Case 1: Perfect match - no changes needed
    if (textMarkers.length === jsonMarkers.length) {
        const textMarkerSet = new Set(textMarkers);
        const jsonMarkerSet = new Set(jsonMarkers);
        
        if (textMarkers.every(marker => jsonMarkerSet.has(marker)) && 
            jsonMarkers.every(marker => textMarkerSet.has(marker))) {
            return { translation, suggestedIllustrations: jsonIllustrations };
        }
    }

    // Case 2: More JSON prompts than text markers - auto-insert missing markers
    if (jsonMarkers.length > textMarkers.length) {
        const textMarkerSet = new Set(textMarkers);
        const unmatchedPrompts = jsonIllustrations.filter(item => !textMarkerSet.has(item.placementMarker));
        
        let updatedTranslation = translation;
        for (const prompt of unmatchedPrompts) {
            // Insert marker at end of text before any final paragraph breaks
            updatedTranslation = updatedTranslation.trim() + ` ${prompt.placementMarker}`;
        }
        return { translation: updatedTranslation, suggestedIllustrations: jsonIllustrations };
    }

    // Case 3: More text markers than JSON prompts - this is unfixable
    if (textMarkers.length > jsonMarkers.length) {
        const textMarkerSet = new Set(textMarkers);
        const jsonMarkerSet = new Set(jsonMarkers);
        const orphanedMarkers = textMarkers.filter(marker => !jsonMarkerSet.has(marker));
        
        const errorMessage = `AI response validation failed: Cannot auto-fix - missing illustration prompts.\n- Text has ${textMarkers.length} markers but JSON only has ${jsonMarkers.length} prompts\n- Orphaned markers: ${orphanedMarkers.join(', ')}\n\nThis requires AI to regenerate with proper prompts for all markers.`;
        
        console.error('Illustration validation failed - insufficient prompts:', {
            textMarkers,
            jsonMarkers,
            orphanedMarkers
        });

        throw new Error(errorMessage);
    }

    // Case 4: Same count but mismatched markers - try to fix if possible  
    const textMarkerSet = new Set(textMarkers);
    const jsonMarkerSet = new Set(jsonMarkers);
    
    const textOnlyMarkers = textMarkers.filter(m => !jsonMarkerSet.has(m));
    const jsonOnlyMarkers = jsonMarkers.filter(m => !textMarkerSet.has(m));
    
    if (textOnlyMarkers.length === jsonOnlyMarkers.length) {
        console.log(`[IllustrationFix] Attempting marker reconciliation: ${textOnlyMarkers.length} mismatched pairs`);
        
        // Create a mapping from unmatched JSON markers to unmatched text markers
        const updatedIllustrations = jsonIllustrations.map(item => {
            if (!textMarkerSet.has(item.placementMarker) && textOnlyMarkers.length > 0) {
                const newMarker = textOnlyMarkers.shift()!; // Take the first unmatched text marker
                console.log(`[IllustrationFix] Remapped ${item.placementMarker} -> ${newMarker}`);
                return { ...item, placementMarker: newMarker };
            }
            return item;
        });
        
        console.log('[IllustrationFix] Marker reconciliation successful - saved translation');
        return { translation, suggestedIllustrations: updatedIllustrations };
    }
    
    // Case 5: Unfixable mismatch
    const errorMessage = `AI response validation failed: Complex illustration mismatch cannot be auto-fixed.\n- Text markers: ${textMarkers.join(', ')}\n- JSON markers: ${jsonMarkers.join(', ')}\n\nRequires AI regeneration with proper marker alignment.`;
    
    console.error('Illustration validation failed - complex mismatch:', {
        textMarkers,
        jsonMarkers,
        textOnlyMarkers,
        jsonOnlyMarkers
    });

    throw new Error(errorMessage);
};

// --- GEMINI PROVIDER ---

const geminiResponseSchema = {
    type: Type.OBJECT,
    properties: {
        translatedTitle: { type: Type.STRING, description: "The translated chapter title." },
        translation: { type: Type.STRING, description: "CRITICAL HTML FORMAT RULE: You are STRICTLY FORBIDDEN from using <p> tags or * symbols anywhere in this text. ONLY ALLOWED HTML TAGS: <i>text</i> for italics, <b>text</b> for bold, <br> for single line breaks, and <br><br> for paragraph breaks. Transform ALL paragraph breaks into <br><br>. Transform ALL italic emphasis into <i>text</i>. NO OTHER HTML TAGS PERMITTED. MUST include numbered markers [1], [2], [3] for footnotes and [ILLUSTRATION-1], [ILLUSTRATION-2] for visual scenes." },
        footnotes: {
          type: Type.ARRAY, nullable: true, description: "STRUCTURAL REQUIREMENT: Each footnote must correspond to a numbered marker [1], [2], [3] found in the translation text. Use format prefixes: '[TL Note:]' for translator commentary/cultural context, '[Author's Note:]' for original text explanations. If no markers exist in text, this must be null or empty array.",
          items: {
            type: Type.OBJECT, properties: { marker: { type: Type.STRING, description: "Exact marker from text: '[1]', '[2]', etc." }, text: { type: Type.STRING, description: "Footnote content with appropriate prefix: '[TL Note:]' or '[Author's Note:]'" } }, required: ['marker', 'text']
          }
        },
        suggestedIllustrations: {
            type: Type.ARRAY, nullable: true, description: "CRITICAL STRUCTURAL REQUIREMENT: Must contain exactly the same [ILLUSTRATION-X] markers found in the translation text. Each marker in the text requires a corresponding object here. If no [ILLUSTRATION-X] markers exist in the translation text, this must be null or empty array. This is validated strictly.",
            items: {
                type: Type.OBJECT, properties: { placementMarker: { type: Type.STRING, description: "Exact marker from text: '[ILLUSTRATION-1]', '[ILLUSTRATION-2]', etc." }, imagePrompt: { type: Type.STRING, description: "Detailed prompt for AI image generation describing the scene, mood, characters, and visual style" } }, required: ['placementMarker', 'imagePrompt']
            }
        },
        proposal: {
            type: Type.OBJECT, nullable: true, description: "Optional proposal to improve the user's system prompt based on translation challenges encountered. Only include if you genuinely believe a specific improvement would help future translations.",
            properties: { observation: { type: Type.STRING, description: "What translation challenge or feedback pattern triggered this proposal" }, currentRule: { type: Type.STRING, description: "Exact text from user's system prompt that could be improved" }, proposedChange: { type: Type.STRING, description: "Suggested replacement text with clear improvements" }, reasoning: { type: Type.STRING, description: "Why this change would improve translation quality" } },
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

  // console.log("[Gemini] Full API response:", JSON.stringify(response, null, 2)); // Commented out for brevity during debugging

  // Add a defensive check to ensure the response is valid before proceeding.
  // The Gemini API might not throw on all errors (e.g., 500), but return a response with no valid candidates.
  if (!response.candidates || response.candidates.length === 0) {
    console.error("[Gemini] API call returned invalid response structure. Full response:", JSON.stringify(response, null, 2));
    throw new Error("Translation failed: The API returned an empty or invalid response.");
  }

  // Additional check for content structure
  const candidate = response.candidates[0];
  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    console.error("[Gemini] API candidate missing content/parts. Candidate:", JSON.stringify(candidate, null, 2));
    throw new Error("Translation failed: The API response is missing content parts.");
  }

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
  
  const responseText = response.candidates[0].content.parts[0].text.trim();
  
  console.log("[Gemini Debug] Raw response text length:", responseText.length);
  console.log("[Gemini Debug] Response text preview:", responseText.substring(0, 200) + "...");
  console.log("[Gemini Debug] Response text ends with:", responseText.slice(-50));
  
  
  try {
    const parsedJson = JSON.parse(responseText);
    if (typeof parsedJson.translatedTitle !== 'string' || typeof parsedJson.translation !== 'string') {
        throw new Error('Invalid JSON structure in AI response.');
    }
    const { translation: fixedTranslation, suggestedIllustrations: fixedIllustrations } = validateAndFixIllustrations(parsedJson.translation, parsedJson.suggestedIllustrations);
    return {
        translatedTitle: parsedJson.translatedTitle,
        translation: fixedTranslation,
        proposal: parsedJson.proposal ?? null,
        footnotes: parsedJson.footnotes ?? [],
        suggestedIllustrations: fixedIllustrations,
        usageMetrics: usageMetrics,
    };
  } catch (e) {
      console.error("[Gemini] Failed to parse JSON response. Error:", e);
      console.error("[Gemini] Full response text (first 1000 chars):", responseText.substring(0, 1000));
      console.error("[Gemini] Response text ends with:", responseText.slice(-100));
      
      // Try to provide more specific error info
      if (responseText.length === 0) {
        throw new Error("Translation failed: API returned empty response text.");
      }
      if (!responseText.includes('{')) {
        throw new Error("Translation failed: API response is not JSON format.");
      }
      if (!responseText.includes('translatedTitle')) {
        throw new Error("Translation failed: API response appears to be truncated or incomplete.");
      }
      
      throw new Error(`Translation failed: AI returned malformed JSON. Error: ${e.message}`);
  }
};

// --- OPENAI / DEEPSEEK PROVIDER ---

// Define OpenAI Structured Output schema (different format from Gemini)
const openaiResponseSchema = {
    "type": "object",
    "properties": {
        "translatedTitle": {
            "type": "string",
            "description": "The translated chapter title."
        },
        "translation": {
            "type": "string", 
            "description": "CRITICAL HTML FORMAT RULE: You are STRICTLY FORBIDDEN from using <p> tags or * symbols anywhere in this text. ONLY ALLOWED HTML TAGS: <i>text</i> for italics, <b>text</b> for bold, <br> for single line breaks, and <br><br> for paragraph breaks. Transform ALL paragraph breaks into <br><br>. Transform ALL italic emphasis into <i>text</i>. NO OTHER HTML TAGS PERMITTED. MUST include numbered markers [1], [2], [3] for footnotes and [ILLUSTRATION-1], [ILLUSTRATION-2] for visual scenes."
        },
        "footnotes": {
            "type": ["array", "null"],
            "description": "STRUCTURAL REQUIREMENT: Each footnote must correspond to a numbered marker [1], [2], [3] found in the translation text. Use format prefixes: '[TL Note:]' for translator commentary/cultural context, '[Author's Note:]' for original text explanations. If no markers exist in text, this must be null or empty array.",
            "items": {
                "type": "object",
                "properties": {
                    "marker": {"type": "string", "description": "Exact marker from text: '[1]', '[2]', etc."},
                    "text": {"type": "string", "description": "Footnote content with appropriate prefix: '[TL Note:]' or '[Author's Note:]'"}
                },
                "required": ["marker", "text"],
                "additionalProperties": false
            }
        },
        "suggestedIllustrations": {
            "type": ["array", "null"],
            "description": "CRITICAL STRUCTURAL REQUIREMENT: Must contain exactly the same [ILLUSTRATION-X] markers found in the translation text. Each marker in the text requires a corresponding object here. If no [ILLUSTRATION-X] markers exist in the translation text, this must be null or empty array. This is validated strictly.",
            "items": {
                "type": "object", 
                "properties": {
                    "placementMarker": {"type": "string", "description": "Exact marker from text: '[ILLUSTRATION-1]', '[ILLUSTRATION-2]', etc."},
                    "imagePrompt": {"type": "string", "description": "Detailed prompt for AI image generation describing the scene, mood, characters, and visual style"}
                },
                "required": ["placementMarker", "imagePrompt"],
                "additionalProperties": false
            }
        },
        "proposal": {
            "type": ["object", "null"],
            "description": "Optional proposal to improve the user's system prompt based on translation challenges encountered. Only include if you genuinely believe a specific improvement would help future translations.",
            "properties": {
                "observation": {"type": "string", "description": "What translation challenge or feedback pattern triggered this proposal"},
                "currentRule": {"type": "string", "description": "Exact text from user's system prompt that could be improved"},
                "proposedChange": {"type": "string", "description": "Suggested replacement text with clear improvements"},
                "reasoning": {"type": "string", "description": "Why this change would improve translation quality"}
            },
            "required": ["observation", "currentRule", "proposedChange", "reasoning"],
            "additionalProperties": false
        }
    },
    "required": ["translatedTitle", "translation", "footnotes", "suggestedIllustrations", "proposal"],
    "additionalProperties": false
};

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
    
    // Clean system prompt without JSON schema instructions (schema is enforced natively)
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: settings.systemPrompt },
    ];
    
    history.forEach(h => {
        messages.push({ role: 'user', content: `TITLE: ${h.originalTitle}\n\nCONTENT:\n${h.originalContent}` });
        messages.push({ role: 'assistant', content: h.translatedContent });
    });
    
    messages.push({ role: 'user', content: `Translate this new chapter:\n\nTITLE:\n${title}\n\nCONTENT:\n${content}` });

    // Determine if model supports structured outputs
    const supportsStructuredOutputs = settings.provider === 'OpenAI' && (
        settings.model.startsWith('gpt-4o') || 
        settings.model.startsWith('gpt-5') ||
        settings.model.startsWith('gpt-4.1')
    );

    // Prepare the request options with native structured outputs
    const requestOptions: any = {
        model: settings.model,
        messages,
        response_format: supportsStructuredOutputs 
            ? { type: 'json_schema', json_schema: { name: 'translation_response', schema: openaiResponseSchema, strict: true }}
            : { type: 'json_object' } // Fallback to JSON mode for unsupported models
    };

    console.log(`[OpenAI] Preparing request for model: ${settings.model}`);
    console.log(`[OpenAI] Using structured outputs: ${supportsStructuredOutputs}`);
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
        console.log(`[OpenAI] Raw response text:`, response.choices[0].message.content); // Added log
        console.log(`[OpenAI] Finish reason:`, response.choices[0].finish_reason);
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
                console.log(`[OpenAI] Raw response text:`, response.choices[0].message.content); // Added log
                console.log(`[OpenAI] Finish reason:`, response.choices[0].finish_reason);
            } catch (retryError: any) {
                console.error(`[OpenAI] Attempt 2 also failed:`, retryError);
                throw retryError;
            }
        } else {
            throw error;
        }
    }

    // Handle structured output refusals
    if (response.choices[0].finish_reason === 'refused') {
        console.error('[OpenAI] Model refused to generate structured output');
        throw new Error('The AI model refused to generate the requested translation format. Please try again or adjust your system prompt.');
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
    
    // HTML VALIDATION DEBUGGING
    const containsPTags = responseText.includes('<p>') || responseText.includes('</p>');
    const containsAsterisks = responseText.includes('*');
    console.log(`[OpenAI HTML Validation] Response contains <p> tags: ${containsPTags}`);
    console.log(`[OpenAI HTML Validation] Response contains * symbols: ${containsAsterisks}`);
    if (containsPTags) {
      const pTagMatches = responseText.match(/<\/?p[^>]*>/g);
      console.log(`[OpenAI HTML Validation] Found <p> tags:`, pTagMatches?.slice(0, 5));
    }
    if (containsAsterisks) {
      const asteriskMatches = responseText.match(/\*[^*]*\*/g);
      console.log(`[OpenAI HTML Validation] Found * patterns:`, asteriskMatches?.slice(0, 5));
    }
    
    try {
        let parsedJson;
        try {
            // First, try to parse the response text directly
            parsedJson = JSON.parse(responseText);
        } catch (initialParseError) {
            console.warn(`[DeepSeek] Initial JSON parse failed. Attempting fallback extraction. Error: ${initialParseError.message}`);
            // If direct parse fails, attempt to extract the JSON part
            const jsonStartIndex = responseText.indexOf('{');
            const jsonEndIndex = responseText.lastIndexOf('}');

            let jsonString = responseText;
            if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
                jsonString = responseText.substring(jsonStartIndex, jsonEndIndex + 1);
                console.log(`[DeepSeek] Extracted JSON substring. Original length: ${responseText.length}, Extracted length: ${jsonString.length}`);
            } else {
                console.warn(`[DeepSeek] Could not find valid JSON boundaries in response for fallback. Re-throwing original error.`);
                throw initialParseError; // Re-throw if extraction is not possible
            }
            parsedJson = JSON.parse(jsonString); // Try parsing the extracted string
        }

        // With structured outputs, validation should be unnecessary, but keep for safety
        if (typeof parsedJson.translatedTitle !== 'string' || typeof parsedJson.translation !== 'string') {
            throw new Error('Invalid JSON structure in AI response.');
        }
        const { translation: fixedTranslation, suggestedIllustrations: fixedIllustrations } = validateAndFixIllustrations(parsedJson.translation, parsedJson.suggestedIllustrations);
        
        return {
            translatedTitle: parsedJson.translatedTitle,
            translation: fixedTranslation,
            proposal: parsedJson.proposal,
            footnotes: parsedJson.footnotes ?? [],
            suggestedIllustrations: fixedIllustrations,
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
    
    let translationFunction: (title: string, content: string, settings: AppSettings, history: HistoricalChapter[]) => Promise<TranslationResult>;
    
    switch (settings.provider) {
        case 'Gemini':
            translationFunction = translateWithGemini;
            break;
        case 'Claude':
            const { translateWithClaude } = await import('./claudeService');
            translationFunction = translateWithClaude;
            break;
        case 'OpenAI':
        case 'DeepSeek':
        default:
            translationFunction = translateWithOpenAI;
            break;
    }

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