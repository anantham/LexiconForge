
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

// --- DEBUG UTILITIES ---
const aiDebugEnabled = (): boolean => {
  try {
    // Enable by running: localStorage.setItem('LF_AI_DEBUG', '1') in DevTools
    return typeof localStorage !== 'undefined' && localStorage.getItem('LF_AI_DEBUG') === '1';
  } catch { return false; }
};
const dlog = (...args: any[]) => { if (aiDebugEnabled()) console.log(...args); };
const aiDebugFullEnabled = (): boolean => {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem('LF_AI_DEBUG_FULL') === '1'; } catch { return false; }
};
const dlogFull = (...args: any[]) => { if (aiDebugFullEnabled()) console.log(...args); };

// --- SHARED PROMPT LOGIC ---

const formatHistory = (history: HistoricalChapter[]): string => {
  if (history.length === 0) {
    return "No recent history available.";
  }
  return history.map((h, index) => {
    // Derive structured-output hints from the previous translated text
    const illuCount = (h.translatedContent.match(/\[ILLUSTRATION-\d+\]/g) || []).length;
    const footMarkerCount = (h.translatedContent.match(/\[(\d+)\]/g) || []).length;
    const feedbackCount = h.feedback?.length || 0;
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
           `== STRUCTURED OUTPUT SUMMARY ==\n` +
           `Illustration markers: ${illuCount}\n` +
           `Footnote markers: ${footMarkerCount}\n` +
           `Feedback items: ${feedbackCount}\n\n` +
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

  // Debug: what we're sending (sanitized)
  dlog('[Gemini Debug] Request summary:', {
    model: settings.model,
    temperature: settings.temperature,
    systemInstructionLength: settings.systemPrompt?.length ?? 0,
    historyChapters: history.length,
    fullPromptLength: fullPrompt.length,
    fullPromptPreview: fullPrompt.slice(0, 400)
  });

  // Revert to models.generateContent for compatibility with current SDK
  const baseRequest = {
    model: settings.model,
    contents: [{ role: 'user', parts: [{ text: fullPrompt }]}],
    // Per SDK: systemInstruction is top-level; generationConfig holds response settings
    systemInstruction: settings.systemPrompt,
    generationConfig: {
      temperature: settings.temperature,
      responseMimeType: 'application/json',
      responseSchema: geminiResponseSchema,
      maxOutputTokens: 2048,
    },
  } as const;

  // Gated: Full request body only when LF_AI_DEBUG_FULL is enabled
  dlogFull('[Gemini Debug] Full request body:', JSON.stringify(baseRequest, null, 2));

  let response: any;
  try {
    response = await (ai as any).models.generateContent(baseRequest);
  } catch (err) {
    console.error('[Gemini] Primary call failed, error:', err);
    throw err;
  }

  dlog('[Gemini Debug] Raw API response:', JSON.stringify(response, null, 2));

  // Add a defensive check to ensure the response is valid before proceeding.
  // The Gemini API might not throw on all errors (e.g., 500), but return a response with no valid candidates.
  if (!response?.candidates || response.candidates.length === 0) {
    console.error("[Gemini] API call returned invalid response structure. Full response:", JSON.stringify(response, null, 2));
    throw new Error("Translation failed: The API returned an empty or invalid response.");
  }

  // Additional check for content structure
  let candidate = response.candidates[0];
  dlog('[Gemini Debug] finishReason:', candidate?.finishReason);
  dlog('[Gemini Debug] safetyRatings:', JSON.stringify((candidate as any)?.safetyRatings || [], null, 2));
  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    console.warn('[Gemini] Empty candidate on first attempt — retrying without schema');
    // Retry without responseSchema and loosen mime type
    const fallbackReq = {
      ...baseRequest,
      generationConfig: {
        ...baseRequest.generationConfig,
        responseSchema: undefined,
        responseMimeType: 'application/json',
      },
    } as any;
    try {
      // Gated: Fallback request body
      dlogFull('[Gemini Debug] Fallback request body:', JSON.stringify(fallbackReq, null, 2));
      const retryResp = await (ai as any).models.generateContent(fallbackReq);
      if (retryResp?.candidates?.length) {
        candidate = retryResp.candidates[0];
        response = retryResp;
      }
    } catch (e) {
      console.error('[Gemini] Fallback call failed:', e);
    }

    if (!candidate?.content?.parts?.length) {
      console.error("[Gemini] API candidate missing content/parts after fallback. Candidate:", JSON.stringify(candidate || {}, null, 2));
      throw new Error(`empty_candidate: finishReason=${candidate?.finishReason ?? 'UNKNOWN'}`);
    }
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
  
  const joinParts = (cand: any): string => {
    const parts = cand?.content?.parts || [];
    return parts.map((p: any) => (p?.text ?? '')).join('');
  };

  const responseText = joinParts(response.candidates[0]).trim();
  dlog('[Gemini Debug] Response text length:', responseText.length);
  dlog('[Gemini Debug] Response text preview:', responseText.substring(0, 200) + '...');
  dlog('[Gemini Debug] Response text ends with:', responseText.slice(-50));

  const extractFirstBalancedJson = (text: string): string | null => {
    const scan = (open: string, close: string) => {
      let i = text.indexOf(open);
      while (i !== -1) {
        let depth = 0, inStr = false, esc = false;
        for (let j = i; j < text.length; j++) {
          const ch = text[j];
          if (inStr) {
            if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false;
          } else {
            if (ch === '"') inStr = true; else if (ch === open) depth++; else if (ch === close) { depth--; if (depth === 0) return text.slice(i, j + 1); }
          }
        }
        i = text.indexOf(open, i + 1);
      }
      return null;
    };
    return scan('{', '}') || scan('[', ']');
  };

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

      // Attempt to extract first balanced JSON block
      const jsonBlock = extractFirstBalancedJson(responseText);
      if (jsonBlock) {
        try {
          const parsedJson = JSON.parse(jsonBlock);
          if (typeof parsedJson.translatedTitle === 'string' && typeof parsedJson.translation === 'string') {
            const { translation: fixedTranslation, suggestedIllustrations: fixedIllustrations } = validateAndFixIllustrations(parsedJson.translation, parsedJson.suggestedIllustrations);
            return {
              translatedTitle: parsedJson.translatedTitle,
              translation: fixedTranslation,
              proposal: parsedJson.proposal ?? null,
              footnotes: parsedJson.footnotes ?? [],
              suggestedIllustrations: fixedIllustrations,
              usageMetrics: usageMetrics,
            };
          }
        } catch (e2) {
          console.error('[Gemini] JSON block parse failed:', e2);
        }
      }

      // Provide more specific error info then fail
      if (responseText.length === 0) throw new Error("Translation failed: API returned empty response text.");
      if (!responseText.includes('{')) throw new Error("Translation failed: API response is not JSON format.");
      if (!responseText.includes('translatedTitle')) throw new Error("Translation failed: API response appears to be truncated or incomplete.");

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
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    
    // DIAGNOSTIC: Validate system prompt
    console.log('[OpenAI DIAGNOSTIC] System prompt validation:', {
        exists: !!settings.systemPrompt,
        type: typeof settings.systemPrompt,
        length: settings.systemPrompt?.length || 0,
        isNull: settings.systemPrompt === null,
        isUndefined: settings.systemPrompt === undefined,
        preview: settings.systemPrompt?.slice(0, 50) + '...'
    });
    
    if (!settings.systemPrompt) {
        console.error('[OpenAI DIAGNOSTIC] System prompt is null/undefined!');
        throw new Error('System prompt cannot be empty for OpenAI translation');
    }
    
    messages.push({ role: 'system', content: settings.systemPrompt });
    
    // DIAGNOSTIC: Validate history
    console.log('[OpenAI DIAGNOSTIC] History validation:', {
        historyCount: history.length,
        historyExists: !!history
    });
    
    history.forEach((h, index) => {
        console.log(`[OpenAI DIAGNOSTIC] History[${index}]:`, {
            originalTitle: { exists: !!h.originalTitle, type: typeof h.originalTitle, isNull: h.originalTitle === null },
            originalContent: { exists: !!h.originalContent, type: typeof h.originalContent, isNull: h.originalContent === null, length: h.originalContent?.length || 0 },
            translatedContent: { exists: !!h.translatedContent, type: typeof h.translatedContent, isNull: h.translatedContent === null, length: h.translatedContent?.length || 0 }
        });
        
        if (h.originalTitle === null || h.originalContent === null || h.translatedContent === null) {
            console.error(`[OpenAI DIAGNOSTIC] History[${index}] has null content! Skipping...`);
            return; // Skip this history entry
        }
        
        const userContent = `TITLE: ${h.originalTitle}\n\nCONTENT:\n${h.originalContent}`;
        const assistantContent = h.translatedContent;
        
        console.log(`[OpenAI DIAGNOSTIC] Adding history[${index}] messages:`, {
            userContentLength: userContent.length,
            assistantContentLength: assistantContent.length,
            userContentIsNull: userContent === null,
            assistantContentIsNull: assistantContent === null
        });
        
        messages.push({ role: 'user', content: userContent });
        messages.push({ role: 'assistant', content: assistantContent });
    });
    
    // DIAGNOSTIC: Validate current chapter
    console.log('[OpenAI DIAGNOSTIC] Current chapter validation:', {
        title: { exists: !!title, type: typeof title, isNull: title === null, length: title?.length || 0 },
        content: { exists: !!content, type: typeof content, isNull: content === null, length: content?.length || 0 }
    });
    
    if (title === null || content === null) {
        console.error('[OpenAI DIAGNOSTIC] Current chapter has null title or content!');
        throw new Error('Chapter title and content cannot be null for OpenAI translation');
    }
    
    const finalUserContent = `Translate this new chapter:\n\nTITLE:\n${title}\n\nCONTENT:\n${content}`;
    console.log('[OpenAI DIAGNOSTIC] Final user message:', {
        contentLength: finalUserContent.length,
        isNull: finalUserContent === null
    });
    
    messages.push({ role: 'user', content: finalUserContent });
    
    // DIAGNOSTIC: Final message array validation
    console.log('[OpenAI DIAGNOSTIC] Final messages array validation:');
    messages.forEach((msg, index) => {
        console.log(`  Message[${index}]:`, {
            role: msg.role,
            contentExists: !!msg.content,
            contentType: typeof msg.content,
            contentIsNull: msg.content === null,
            contentIsUndefined: msg.content === undefined,
            contentLength: msg.content?.length || 0,
            contentPreview: typeof msg.content === 'string' ? msg.content.slice(0, 30) + '...' : msg.content
        });
        
        if (msg.content === null || msg.content === undefined) {
            console.error(`[OpenAI DIAGNOSTIC] MESSAGE[${index}] HAS NULL CONTENT!`, msg);
        }
    });

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

    dlog(`[OpenAI] Preparing request for model: ${settings.model}`);
    dlog(`[OpenAI] Using structured outputs: ${supportsStructuredOutputs}`);
    dlog(`[OpenAI] Temperature setting: ${settings.temperature}`);
    dlog(`[OpenAI] Message count: ${messages.length}`);
    
    // DIAGNOSTIC: Final pre-flight validation of request
    console.log('[OpenAI DIAGNOSTIC] PRE-FLIGHT CHECK - Final request validation:');
    console.log('  Model:', requestOptions.model);
    console.log('  Messages count:', requestOptions.messages?.length || 0);
    
    // Check each message in the final request
    requestOptions.messages?.forEach((msg: any, index: number) => {
        console.log(`  Message[${index}]:`, {
            role: msg.role,
            hasContent: msg.content !== null && msg.content !== undefined,
            contentType: typeof msg.content,
            contentLength: msg.content?.length || 0,
            isNull: msg.content === null,
            isUndefined: msg.content === undefined
        });
        
        if (msg.content === null || msg.content === undefined) {
            console.error(`[OpenAI DIAGNOSTIC] CRITICAL: Message[${index}] has ${msg.content === null ? 'NULL' : 'UNDEFINED'} content!`);
            console.error('Full message:', JSON.stringify(msg, null, 2));
        }
    });
    
    // TEMP: Always print the exact request body we send (like Gemini)
    try { console.log(`[${settings.provider} Debug] Full request body:`, JSON.stringify(requestOptions, null, 2)); } catch {}
    dlog(`[OpenAI] Request options:`, JSON.stringify(requestOptions, null, 2));

    // Proactive temperature compatibility check for newer models
    const skipTemperature = settings.model.startsWith('gpt-5') || 
                           settings.model.startsWith('gpt-4.1') ||
                           settings.model === 'gpt-5-chat-latest';
    
    if (skipTemperature) {
        console.warn(`[OpenAI] Skipping temperature setting for model ${settings.model} (known incompatibility)`);
        dlog(`[OpenAI] Model ${settings.model} does not support custom temperature, using default`);
    } else {
        requestOptions.temperature = settings.temperature;
        dlog(`[OpenAI] Using temperature ${settings.temperature} for model ${settings.model}`);
    }

    // Add temperature if the model supports it (some newer models only support default)
    let response: ChatCompletion;
    try {
        dlog(`[OpenAI] Attempt 1: Sending request ${skipTemperature ? 'without' : 'with'} temperature`);
        
        console.log('[OpenAI DIAGNOSTIC] ABOUT TO MAKE API CALL - Final sanity check completed');
        response = await openai.chat.completions.create(requestOptions);
        dlog(`[OpenAI] Attempt 1: Success! Response received`);
        
        // Full response logging
        dlog(`[${settings.provider} Debug] Raw API response:`, JSON.stringify(response, null, 2));
        dlog(`[OpenAI] Response structure:`, {
          choicesLength: response.choices?.length || 0,
          finishReason: response.choices?.[0]?.finish_reason,
          hasContent: !!response.choices?.[0]?.message?.content,
          contentLength: response.choices?.[0]?.message?.content?.length || 0,
          model: response.model,
          usage: response.usage
        });
        
        dlog(`[OpenAI] Raw response text:`, response.choices[0].message.content);
        dlog(`[OpenAI] Finish reason:`, response.choices[0].finish_reason);
    } catch (error: any) {
        console.error(`[OpenAI] Attempt 1 failed:`, error);
        dlog(`[OpenAI] Error status:`, error.status || 'unknown');
        dlog(`[OpenAI] Error message:`, error.message || 'unknown');
        dlog(`[OpenAI] Error response:`, error.response?.data || 'no response data');
        
        // If temperature fails, retry without it
        if (error.message?.includes('temperature') || error.message?.includes('not supported') || error.status === 400) {
            console.warn(`[OpenAI] Retrying without temperature setting for model ${settings.model}`);
            delete requestOptions.temperature;
            dlog(`[OpenAI] Attempt 2: Retry request options:`, JSON.stringify(requestOptions, null, 2));
            
            // DIAGNOSTIC: Re-validate request after temperature removal
            console.log('[OpenAI DIAGNOSTIC] RETRY ATTEMPT - Re-validating request after temperature removal:');
            requestOptions.messages?.forEach((msg: any, index: number) => {
                console.log(`  Retry Message[${index}]:`, {
                    role: msg.role,
                    hasContent: msg.content !== null && msg.content !== undefined,
                    contentType: typeof msg.content,
                    isNull: msg.content === null,
                    isUndefined: msg.content === undefined
                });
                
                if (msg.content === null || msg.content === undefined) {
                    console.error(`[OpenAI DIAGNOSTIC] RETRY CRITICAL: Message[${index}] STILL has ${msg.content === null ? 'NULL' : 'UNDEFINED'} content!`);
                }
            });
            
            try {
                console.log('[OpenAI DIAGNOSTIC] RETRY - About to make second API call');
                response = await openai.chat.completions.create(requestOptions);
                dlog(`[OpenAI] Attempt 2: Success! Response received`);
                
                // Full response logging for retry
                dlog(`[${settings.provider} Debug] Raw API response (retry):`, JSON.stringify(response, null, 2));
                
                dlog(`[OpenAI] Raw response text:`, response.choices[0].message.content);
                dlog(`[OpenAI] Finish reason:`, response.choices[0].finish_reason);
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
    dlog(`[OpenAI HTML Validation] Response contains <p> tags: ${containsPTags}`);
    dlog(`[OpenAI HTML Validation] Response contains * symbols: ${containsAsterisks}`);
    if (containsPTags) {
      const pTagMatches = responseText.match(/<\/?p[^>]*>/g);
      dlog(`[OpenAI HTML Validation] Found <p> tags:`, pTagMatches?.slice(0, 5));
    }
    if (containsAsterisks) {
      const asteriskMatches = responseText.match(/\*[^*]*\*/g);
      dlog(`[OpenAI HTML Validation] Found * patterns:`, asteriskMatches?.slice(0, 5));
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
            if (isRateLimitError) {
                if (attempt < maxRetries - 1) {
                    const delay = initialDelay * Math.pow(2, attempt);
                    console.warn(`[aiService] Rate limit hit for ${settings.provider}. Retrying in ${delay / 1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                } else {
                    // Last attempt, throw a normalized error
                    throw new Error(`rate_limit: Exceeded API rate limits for ${settings.provider} after ${maxRetries} attempts.`);
                }
            }
            // For other errors, just rethrow
            throw lastError;
        }
    }

    throw lastError ?? new Error(`An unknown error occurred during translation with ${settings.provider} after all retries.`);
};
