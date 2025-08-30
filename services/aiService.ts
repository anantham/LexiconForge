
import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import prompts from '../config/prompts.json';
import OpenAI from 'openai';
import { openrouterService } from './openrouterService';
import { supportsStructuredOutputs, supportsParameters } from './capabilityService';
import { rateLimitService } from './rateLimitService';
import { AppSettings, HistoricalChapter, TranslationResult, FeedbackItem, UsageMetrics } from '../types';
import { COSTS_PER_MILLION_TOKENS } from '../costs';
import appConfig from '../config/app.json';

// Parameter validation using config limits
const validateAndClampParameter = (value: any, paramName: string): any => {
  if (value === undefined || value === null) return value;
  
  const limits = appConfig.aiParameters.limits[paramName as keyof typeof appConfig.aiParameters.limits];
  if (!limits) return value;
  
  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numValue)) return value;
  
  const clamped = Math.max(limits.min, Math.min(limits.max, numValue));
  if (clamped !== numValue) {
    console.warn(`[Parameter Validation] Clamped ${paramName} from ${numValue} to ${clamped} (limits: ${limits.min}-${limits.max})`);
  }
  
  return clamped;
};
import { ChatCompletion } from 'openai/resources';
import { sanitizeHtml as sanitizeTranslationHTML } from './translate/HtmlSanitizer';

// --- API KEY VALIDATION ---

/**
 * Validates that the required API key exists for the current provider.
 * This should be called BEFORE attempting any translation to prevent
 * wasted resources and provide immediate user feedback.
 */
export const validateApiKey = (settings: AppSettings): { isValid: boolean; errorMessage?: string } => {
  let requiredApiKey: string | undefined;
  let providerName: string;
  const mask = (k: any) => {
    if (!k || typeof k !== 'string') return String(k ?? '');
    return '*'.repeat(Math.max(0, k.length - 4)) + k.slice(-4);
  };

  switch (settings.provider) {
    case 'Gemini':
      requiredApiKey = settings.apiKeyGemini || (process.env.GEMINI_API_KEY as any);
      dlog('[API Key Diagnostic][Gemini]', {
        hasSettingsKey: !!settings.apiKeyGemini,
        settingsKeyMasked: settings.apiKeyGemini ? mask(settings.apiKeyGemini) : null,
        hasEnvKey: !!process.env.GEMINI_API_KEY,
        envKeyMasked: process.env.GEMINI_API_KEY ? mask(process.env.GEMINI_API_KEY) : null,
      });
      providerName = 'Google Gemini';
      break;
    case 'OpenAI':
      requiredApiKey = settings.apiKeyOpenAI || (process.env.OPENAI_API_KEY as any);
      dlog('[API Key Diagnostic][OpenAI]', {
        hasSettingsKey: !!settings.apiKeyOpenAI,
        settingsKeyMasked: settings.apiKeyOpenAI ? mask(settings.apiKeyOpenAI) : null,
        hasEnvKey: !!process.env.OPENAI_API_KEY,
        envKeyMasked: process.env.OPENAI_API_KEY ? mask(process.env.OPENAI_API_KEY) : null,
      });
      providerName = 'OpenAI';
      break;
    case 'DeepSeek':
      requiredApiKey = settings.apiKeyDeepSeek || (process.env.DEEPSEEK_API_KEY as any);
      dlog('[API Key Diagnostic][DeepSeek]', {
        hasSettingsKey: !!settings.apiKeyDeepSeek,
        settingsKeyMasked: settings.apiKeyDeepSeek ? mask(settings.apiKeyDeepSeek) : null,
        hasEnvKey: !!process.env.DEEPSEEK_API_KEY,
        envKeyMasked: process.env.DEEPSEEK_API_KEY ? mask(process.env.DEEPSEEK_API_KEY) : null,
      });
      providerName = 'DeepSeek';
      break;
    case 'OpenRouter':
      requiredApiKey = (settings as any).apiKeyOpenRouter || (process.env.OPENROUTER_API_KEY as any);
      dlog('[API Key Diagnostic][OpenRouter]', {
        hasSettingsKey: !!(settings as any).apiKeyOpenRouter,
        settingsKeyMasked: (settings as any).apiKeyOpenRouter ? mask((settings as any).apiKeyOpenRouter) : null,
        hasEnvKey: !!process.env.OPENROUTER_API_KEY,
        envKeyMasked: process.env.OPENROUTER_API_KEY ? mask(process.env.OPENROUTER_API_KEY) : null,
      });
      providerName = 'OpenRouter';
      break;
    case 'Claude':
      requiredApiKey = settings.apiKeyClaude || (process.env.CLAUDE_API_KEY as any);
      dlog('[API Key Diagnostic][Claude]', {
        hasSettingsKey: !!settings.apiKeyClaude,
        settingsKeyMasked: settings.apiKeyClaude ? mask(settings.apiKeyClaude) : null,
        hasEnvKey: !!process.env.CLAUDE_API_KEY,
        envKeyMasked: process.env.CLAUDE_API_KEY ? mask(process.env.CLAUDE_API_KEY) : null,
      });
      providerName = 'Claude (Anthropic)';
      break;
    default:
      return { isValid: false, errorMessage: `Unknown provider: ${settings.provider}` };
  }

  if (!requiredApiKey?.trim()) {
    dlog('[API Key Diagnostic] Missing key', { provider: providerName });
    return { isValid: false, errorMessage: `${providerName} API key is missing. Add it in settings or .env file.` };
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

// Replace localization placeholders in the system prompt
function replacePlaceholders(input: string, settings: AppSettings): string {
  const lang = settings.targetLanguage || 'English';
  let s = input || '';
  s = s.replaceAll('{{targetLanguage}}', lang);
  // Backward-compat if any leftover template uses variant syntax
  s = s.replaceAll('{{targetLanguageVariant}}', lang);
  return s;
}

// Robust, string-aware balanced-JSON extractor
function extractBalancedJson(text: string): string {
  const start = text.indexOf('{');
  if (start < 0) throw new Error('no_json: No opening brace found.');
  let depth = 0;
  let i = start;
  let end = -1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      // Skip strings, handle escapes
      i++;
      while (i < text.length) {
        if (text[i] === '\\') i += 2; else if (text[i] === '"') { i++; break; } else i++;
      }
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
    i++;
  }
  if (end === -1) throw new Error('unbalanced_json: Truncated JSON payload.');
  return text.slice(start, end + 1);
}

// Normalize common scene break markers and stray tags in translation HTML
// sanitizeTranslationHTML is imported from services/translate/HtmlSanitizer

const buildFanTranslationContext = (fanTranslation: string | null): string => {
  if (!fanTranslation) return '';
  return `\n${prompts.fanRefHeader}\n\n${prompts.fanRefBullets}\n\n${prompts.fanRefImportant}\n\nFAN TRANSLATION REFERENCE:\n${fanTranslation}\n\n${prompts.fanRefEnd}\n`;
};

const formatHistory = (history: HistoricalChapter[]): string => {
  if (history.length === 0) {
    return prompts.historyNoRecent;
  }
  return history.map((h, index) => {
    // Derive structured-output hints from the previous translated text
    const illuCount = (h.translatedContent.match(/\[ILLUSTRATION-\d+\]/g) || []).length;
    const footMarkerCount = (h.footnotes || []).length;
    const feedbackCount = h.feedback?.length || 0;
    const feedbackStr = h.feedback.length > 0
        ? "Feedback on this chapter:\n" + h.feedback.map((f: FeedbackItem) => {
            const commentStr = f.comment ? ` (User comment: ${f.comment})` : '';
            return `- ${f.type} on: "${f.selection}"${commentStr}`;
        }).join('\n')
        : "No feedback was given on this chapter.";
    
    return `${prompts.historyHeaderTemplate.replace('{index}', String(index + 1))}\n\n` +
           `${prompts.historyOriginalHeader}\n` +
           `TITLE: ${h.originalTitle}\n` +
           `CONTENT:\n${h.originalContent}\n\n` +
           `${prompts.historyPreviousHeader}\n` +
           `TITLE: ${h.translatedTitle}\n` +
           `CONTENT:
${h.translatedContent}

` +           `${(h.footnotes && h.footnotes.length > 0) ? "FOOTNOTES:\n" + h.footnotes.map(f => `${f.marker}: ${f.text}`).join('\n') + "\n\n" : ""}` +           `${prompts.historyStructuredHeader}
` +
           `${prompts.historyIllustrationMarkersLabel} ${illuCount}\n` +
           `${prompts.historyFootnoteMarkersLabel} ${footMarkerCount}\n` +
           `${prompts.historyFeedbackCountLabel} ${feedbackCount}\n\n` +
           `${prompts.historyUserFeedbackHeader}\n` +
           `${feedbackStr}\n\n` +
           `--- END OF CONTEXT FOR PREVIOUS CHAPTER ${index + 1} ---`;
  }).join('\n\n');
};

// --- COST CALCULATION ---

export const calculateCost = async (model: string, promptTokens: number, completionTokens: number): Promise<number> => {
    // Validate input parameters
    if (promptTokens < 0 || completionTokens < 0) {
        throw new Error(`Invalid token counts: promptTokens=${promptTokens}, completionTokens=${completionTokens}. Token counts must be non-negative.`);
    }

    // NEW: Check for OpenRouter dynamic pricing first
    if (model.includes('/')) {
        let pricing = await openrouterService.getPricingForModel(model);
        // If pricing is not in cache, fetch all models and try again
        if (!pricing) {
            console.warn(`[Cost] Pricing for ${model} not found in cache. Fetching from OpenRouter...`);
            await openrouterService.fetchModels();
            pricing = await openrouterService.getPricingForModel(model);
        }

        if (pricing) {
            const promptCost = (typeof pricing.prompt === 'string' ? parseFloat(pricing.prompt) : pricing.prompt) || 0;
            const completionCost = (typeof pricing.completion === 'string' ? parseFloat(pricing.completion) : pricing.completion) || 0;
            
            // OpenRouter prices are per-token, not per-million
            const inputCost = promptTokens * promptCost;
            const outputCost = completionTokens * completionCost;
            return inputCost + outputCost;
        }
    }
    
    // FALLBACK: Use hardcoded price list
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

// Validate footnote markers in text vs. JSON footnotes and reconcile where safe
const validateAndFixFootnotes = (translation: string, footnotes: any[] | undefined, strictMode: 'append_missing' | 'fail' = 'append_missing'): { translation: string; footnotes: any[] } => {
    // Extract unique numeric markers from text in order of first appearance (exclude illustration markers)
    const allMatches = translation.match(/\[(\d+)\]/g) || [];
    const seenText = new Set<string>();
    const textMarkers: string[] = [];
    for (const m of allMatches) {
        if (/\[ILLUSTRATION-/i.test(m)) continue;
        if (!seenText.has(m)) { seenText.add(m); textMarkers.push(m); }
    }

    const jsonFootnotes = Array.isArray(footnotes) ? footnotes.slice() : [];
    const normalize = (m: string) => m.startsWith('[') ? m : `[${m.replace(/\[|\]/g, '')}]`;
    const jsonMarkersRaw = jsonFootnotes.map(fn => normalize(String(fn.marker || '')));
    const jsonMarkers = Array.from(new Set(jsonMarkersRaw));

    // Perfect set match (ignoring duplicates in text):
    if (textMarkers.length === jsonMarkers.length) {
        const tSet = new Set(textMarkers);
        const jSet = new Set(jsonMarkers);
        if (textMarkers.every(m => jSet.has(m)) && jsonMarkers.every(m => tSet.has(m))) {
            // Normalize markers in JSON to bracketed form
            const fixed = jsonFootnotes.map((fn) => ({ ...fn, marker: normalize(String(fn.marker || '')) }));
            return { translation, footnotes: fixed };
        }
        // Same cardinality but mismatched labels → remap JSON to the text set 1:1
        const textOnly = textMarkers.filter(m => !jSet.has(m));
        if (textOnly.length > 0) console.warn(`[FootnoteFix] Remapping ${textOnly.length} JSON footnotes to unmatched text markers`);
        const fixed = jsonFootnotes.map(fn => {
            const nm = normalize(String(fn.marker || ''));
            if (!tSet.has(nm) && textOnly.length > 0) {
                const use = textOnly.shift()!;
                return { ...fn, marker: use };
            }
            return { ...fn, marker: nm };
        });
        return { translation, footnotes: fixed };
    }

    // More JSON footnotes than unique markers in text → append missing markers at end of translation
    if (jsonMarkers.length > textMarkers.length) {
        if (strictMode === 'fail') {
            const errorMessage = `AI response validation failed: Extra footnotes without matching markers.\n- Text markers (unique): ${textMarkers.join(', ')}\n- JSON markers: ${jsonMarkers.join(', ')}`;
            console.error('[Footnote validation] strict mode fail on extra JSON footnotes');
            throw new Error(errorMessage);
        }
        const tSet = new Set(textMarkers);
        const extra = jsonMarkers.filter(m => !tSet.has(m));
        if (extra.length > 0) console.warn(`[FootnoteFix] Detected ${extra.length} footnotes without text markers; appending markers at end of translation`);
        let updated = translation.trim();
        for (const m of extra) updated += ` ${m}`;
        const fixed = jsonFootnotes.map(fn => ({ ...fn, marker: normalize(String(fn.marker || '')) }));
        return { translation: updated, footnotes: fixed };
    }

    // More unique markers in text than JSON footnotes → cannot auto-fix
    const errorMessage = `AI response validation failed: Missing footnotes for markers.\n- Text markers (unique): ${textMarkers.join(', ')}\n- JSON markers: ${jsonMarkers.join(', ')}\n\nRequires regeneration with matching footnotes.`;
    console.error('Footnote validation failed - insufficient footnotes:', { textMarkers, jsonMarkers });
    throw new Error(errorMessage);
};

// --- GEMINI PROVIDER ---

const geminiResponseSchema = {
    type: Type.OBJECT,
    properties: {
        translatedTitle: { type: Type.STRING, description: "The translated chapter title." },
        translation: { type: Type.STRING, description: prompts.translationHtmlRules },
        footnotes: {
          type: Type.ARRAY, nullable: true, description: prompts.footnotesDescription,
          items: {
            type: Type.OBJECT, properties: { marker: { type: Type.STRING, description: "" + prompts.footnoteMarkerDescription }, text: { type: Type.STRING, description: "" + prompts.footnoteTextDescription } }, required: ['marker', 'text']
          }
        },
        suggestedIllustrations: {
            type: Type.ARRAY, nullable: true, description: "" + prompts.illustrationsDescription,
            items: {
                type: Type.OBJECT, properties: { placementMarker: { type: Type.STRING, description: "" + prompts.illustrationPlacementMarkerDescription }, imagePrompt: { type: Type.STRING, description: "" + prompts.illustrationImagePromptDescription } }, required: ['placementMarker', 'imagePrompt']
            }
        },
        proposal: {
            type: Type.OBJECT, nullable: true, description: "" + prompts.proposalDescription,
            properties: { observation: { type: Type.STRING, description: "" + prompts.proposalObservationDescription }, currentRule: { type: Type.STRING, description: "" + prompts.proposalCurrentRuleDescription }, proposedChange: { type: Type.STRING, description: "" + prompts.proposalProposedChangeDescription }, reasoning: { type: Type.STRING, description: "" + prompts.proposalReasoningDescription } },
            required: ['observation', 'currentRule', 'proposedChange', 'reasoning'],
        }
    },
    required: ['translatedTitle', 'translation']
};

const translateWithGemini = async (title: string, content: string, settings: AppSettings, history: HistoricalChapter[], fanTranslation?: string | null, abortSignal?: AbortSignal): Promise<TranslationResult> => {
  const apiKey = settings.apiKeyGemini || (process.env.GEMINI_API_KEY as any);
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please add it in the settings.");
  }
  
  const startTime = performance.now();
  const ai = new GoogleGenAI({ apiKey });
  const historyPrompt = formatHistory(history);
  const fanTranslationContext = buildFanTranslationContext(fanTranslation);
  const preface = prompts.translatePrefix + (fanTranslation ? prompts.translateFanSuffix : '') + prompts.translateInstruction;
  const fullPrompt = `${historyPrompt}\n\n${fanTranslationContext}\n\n-----\n\n${preface}\n\n${prompts.translateTitleLabel}\n${title}\n\n${prompts.translateContentLabel}\n${content}`;

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
    systemInstruction: replacePlaceholders(settings.systemPrompt, settings),
    generationConfig: {
      temperature: settings.temperature,
      responseMimeType: 'application/json',
      responseSchema: geminiResponseSchema,
      maxOutputTokens: Math.max(1, Math.min((settings.maxOutputTokens ?? 2048), 32768)),
    },
  } as const;

  // Gated: Full request body only when LF_AI_DEBUG_FULL is enabled
  dlogFull('[Gemini Debug] Full request body:', JSON.stringify(baseRequest, null, 2));

  let response: any;
  try {
    // If the SDK does not support AbortSignal, perform a race so UI can recover immediately
    const call = (ai as any).models.generateContent(baseRequest);
    if (abortSignal) {
      response = await Promise.race([
        call,
        new Promise((_, reject) => abortSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }))
      ]);
    } else {
      response = await call;
    }
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
  const estimatedCost = await calculateCost(settings.model, promptTokens, completionTokens);
  
  // Track actual parameters that were sent to Gemini (for UI display)
  const actualParams: UsageMetrics['actualParams'] = {};
  if (settings.temperature !== appConfig.aiParameters.defaults.temperature) {
    actualParams.temperature = settings.temperature;
  }
  // Note: Gemini doesn't support the other OpenAI parameters, so we don't track them
  
  const usageMetrics: UsageMetrics = {
    totalTokens, promptTokens, completionTokens, estimatedCost, requestTime,
    provider: 'Gemini', model: settings.model,
    actualParams: Object.keys(actualParams).length > 0 ? actualParams : undefined
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
    
    // Primary validation: Check for expected schema
    let isCompliantSchema = typeof parsedJson.translatedTitle === 'string' && typeof parsedJson.translation === 'string';
    
    // Fallback schema detection: Check for common alternative field names
    let title: string | undefined;
    let translation: string | undefined;
    let isFallbackMode = false;
    
    if (isCompliantSchema) {
        title = parsedJson.translatedTitle;
        translation = parsedJson.translation;
    } else {
        // Attempt fallback field mapping
        title = parsedJson.title || parsedJson.translatedTitle || parsedJson.chapter_title;
        
        // Handle content field - might be string or array
        let contentRaw = parsedJson.content || parsedJson.translation || parsedJson.translated_content || parsedJson.body;
        if (Array.isArray(contentRaw)) {
            // Join array elements with line breaks
            translation = contentRaw.join('\n\n');
        } else if (typeof contentRaw === 'string') {
            translation = contentRaw;
        }
        
        if (typeof title === 'string' && typeof translation === 'string') {
            isFallbackMode = true;
            console.warn(`[Gemini] Schema non-compliance detected. Using fallback mode with fields: title="${title ? 'found' : 'missing'}", content="${translation ? 'found' : 'missing'}"`);
            console.warn(`[Gemini] Fallback mode: Will attempt to extract footnotes and illustrations from alternative formats.`);
        } else {
            // Neither schema works - this is a real error
            const availableFields = Object.keys(parsedJson).join(', ');
            throw new Error(`Invalid JSON structure in AI response. Expected 'translatedTitle'+'translation' or 'title'+'content', but found fields: ${availableFields}`);
        }
    }
    
    // Handle illustrations and footnotes based on compliance mode
    let fixedIllustrations: any[] = [];
    let fixedFootnotes: any[] = [];
    let fixedTranslation = translation;
    
    if (!isFallbackMode) {
        // Full schema compliance - process normally
        const { translation: fixedTranslation_1, suggestedIllustrations } = validateAndFixIllustrations(translation, parsedJson.suggestedIllustrations);
        const { translation: finalTranslation, footnotes } = validateAndFixFootnotes(
          fixedTranslation_1,
          parsedJson.footnotes,
          (settings.footnoteStrictMode as any) || 'append_missing'
        );
        fixedTranslation = finalTranslation;
        fixedIllustrations = suggestedIllustrations;
        fixedFootnotes = footnotes;
    } else {
        // Fallback mode - skip advanced processing, just ensure basic structure
        console.warn(`[Gemini] Fallback mode active: Skipping illustration and footnote processing`);
        // Still attempt to extract any basic illustrations/footnotes if they happen to exist
        try {
            fixedIllustrations = Array.isArray(parsedJson.suggestedIllustrations) ? parsedJson.suggestedIllustrations : [];
            fixedFootnotes = Array.isArray(parsedJson.footnotes) ? parsedJson.footnotes : [];
        } catch {
            // Ignore errors in fallback mode
        }
    }
    
    return {
        translatedTitle: title,
        translation: fixedTranslation,
        proposal: parsedJson.proposal ?? null,
        footnotes: fixedFootnotes ?? [],
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
          
          // Apply same fallback logic to extracted JSON block
          let isCompliantSchema = typeof parsedJson.translatedTitle === 'string' && typeof parsedJson.translation === 'string';
          let title: string | undefined;
          let translation: string | undefined;
          let isFallbackMode = false;
          
          if (isCompliantSchema) {
              title = parsedJson.translatedTitle;
              translation = parsedJson.translation;
          } else {
              title = parsedJson.title || parsedJson.translatedTitle || parsedJson.chapter_title;
              translation = parsedJson.content || parsedJson.translation || parsedJson.translated_content || parsedJson.body;
              
              if (typeof title === 'string' && typeof translation === 'string') {
                  isFallbackMode = true;
                  console.warn(`[Gemini Fallback] Using fallback mode with extracted JSON block`);
              } else {
                  return; // Continue to next fallback attempt
              }
          }
          
          // Handle illustrations and footnotes based on compliance mode
          let fixedIllustrations: any[] = [];
          let fixedFootnotes: any[] = [];
          let fixedTranslation = translation;
          
          if (!isFallbackMode) {
              const { translation: fixedTranslation_1, suggestedIllustrations } = validateAndFixIllustrations(translation, parsedJson.suggestedIllustrations);
              const { translation: finalTranslation, footnotes } = validateAndFixFootnotes(
                fixedTranslation_1,
                parsedJson.footnotes,
                (settings.footnoteStrictMode as any) || 'append_missing'
              );
              fixedTranslation = finalTranslation;
              fixedIllustrations = suggestedIllustrations;
              fixedFootnotes = footnotes;
          } else {
              console.warn(`[Gemini Fallback] Skipping advanced processing for extracted block`);
              try {
                  fixedIllustrations = Array.isArray(parsedJson.suggestedIllustrations) ? parsedJson.suggestedIllustrations : [];
                  fixedFootnotes = Array.isArray(parsedJson.footnotes) ? parsedJson.footnotes : [];
              } catch {}
          }
          
          return {
            translatedTitle: title,
            translation: fixedTranslation,
            proposal: parsedJson.proposal ?? null,
            footnotes: fixedFootnotes ?? [],
            suggestedIllustrations: fixedIllustrations,
            usageMetrics: usageMetrics,
          };
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
        "translation": { "type": "string", "description": "" + prompts.translationHtmlRules },
        "footnotes": {
            "type": ["array", "null"],
            "description": "" + prompts.footnotesDescription,
            "items": {
                "type": "object",
                "properties": {
                    "marker": {"type": "string", "description": "" + prompts.footnoteMarkerDescription},
                    "text": {"type": "string", "description": "" + prompts.footnoteTextDescription}
                },
                "required": ["marker", "text"],
                "additionalProperties": false
            }
        },
        "suggestedIllustrations": {
            "type": ["array", "null"],
            "description": "" + prompts.illustrationsDescription,
            "items": {
                "type": "object", 
                "properties": {
                    "placementMarker": {"type": "string", "description": "" + prompts.illustrationPlacementMarkerDescription},
                    "imagePrompt": {"type": "string", "description": "" + prompts.illustrationImagePromptDescription}
                },
                "required": ["placementMarker", "imagePrompt"],
                "additionalProperties": false
            }
        },
        "proposal": {
            "type": ["object", "null"],
            "description": "" + prompts.proposalDescription,
            "properties": {
                "observation": {"type": "string", "description": "" + prompts.proposalObservationDescription},
                "currentRule": {"type": "string", "description": "" + prompts.proposalCurrentRuleDescription},
                "proposedChange": {"type": "string", "description": "" + prompts.proposalProposedChangeDescription},
                "reasoning": {"type": "string", "description": "" + prompts.proposalReasoningDescription}
            },
            "required": ["observation", "currentRule", "proposedChange", "reasoning"],
            "additionalProperties": false
        }
    },
    "required": ["translatedTitle", "translation", "footnotes", "suggestedIllustrations", "proposal"],
    "additionalProperties": false
};

const translateWithOpenAI = async (title: string, content: string, settings: AppSettings, history: HistoricalChapter[], fanTranslation?: string | null, abortSignal?: AbortSignal): Promise<TranslationResult> => {
    let apiKey: string | undefined;
    let baseURL: string | undefined;

    if (settings.provider === 'OpenAI') {
        apiKey = settings.apiKeyOpenAI || (process.env.OPENAI_API_KEY as any);
        baseURL = 'https://api.openai.com/v1';
    } else if (settings.provider === 'DeepSeek') {
        apiKey = settings.apiKeyDeepSeek || (process.env.DEEPSEEK_API_KEY as any);
        baseURL = 'https://api.deepseek.com/v1';
    } else if (settings.provider === 'OpenRouter') {
        apiKey = (settings as any).apiKeyOpenRouter || (process.env.OPENROUTER_API_KEY as any);
        baseURL = 'https://openrouter.ai/api/v1';
    }

    // Diagnostics: where did the key come from, what base URL
    try {
      const src = settings.provider === 'OpenAI' ? (settings.apiKeyOpenAI ? 'settings' : (process.env.OPENAI_API_KEY ? '.env' : 'missing'))
        : settings.provider === 'DeepSeek' ? (settings.apiKeyDeepSeek ? 'settings' : (process.env.DEEPSEEK_API_KEY ? '.env' : 'missing'))
        : settings.provider === 'OpenRouter' ? ((settings as any).apiKeyOpenRouter ? 'settings' : (process.env.OPENROUTER_API_KEY ? '.env' : 'missing'))
        : 'settings';
      const masked = apiKey ? ('*'.repeat(Math.max(0, (apiKey as string).length - 4)) + (apiKey as string).slice(-4)) : 'null';
      dlog('[OpenAI/Compatible Diagnostic]', { provider: settings.provider, baseURL, keySource: src, keyMasked: masked, model: settings.model });
    } catch {}

    if (!apiKey) throw new Error(`${settings.provider} API key is missing. Please add it in the settings.`);

    const startTime = performance.now();
    const openai = new OpenAI({ apiKey, baseURL, dangerouslyAllowBrowser: true });
    
    // --- Refactored Request Building ---

    // 1. Prepare all request components and settings first.
    const isDeepSeek = settings.provider === 'DeepSeek';
    const hasStructuredOutputs = await supportsStructuredOutputs(settings.provider, settings.model);
    let systemPrompt = replacePlaceholders(settings.systemPrompt, settings);

    if (!settings.systemPrompt) {
        if (aiDebugEnabled()) console.error('[OpenAI DIAGNOSTIC] System prompt is null/undefined!');
        throw new Error('System prompt cannot be empty for OpenAI translation');
    }

    // Check rate limits before proceeding
    await rateLimitService.canMakeRequest(settings.model);
    
    const requestOptions: any = { model: settings.model };
    
    // Add supported parameters from expanded settings - now including temperature
    const parameterSupport = await Promise.all([
        supportsParameters(settings.provider, settings.model, ['temperature']),
        supportsParameters(settings.provider, settings.model, ['top_p']),
        supportsParameters(settings.provider, settings.model, ['frequency_penalty']),
        supportsParameters(settings.provider, settings.model, ['presence_penalty']),
        supportsParameters(settings.provider, settings.model, ['seed'])
    ]);
    
    const [supportsTemperature, supportsTopP, supportsFreqPen, supportsPresPen, supportsSeed] = parameterSupport;
    
    dlog(`[Parameter Detection] Model: ${settings.model}, Provider: ${settings.provider}`);
    dlog(`[Parameter Support] temp=${supportsTemperature}, top_p=${supportsTopP}, freq_pen=${supportsFreqPen}, pres_pen=${supportsPresPen}, seed=${supportsSeed}`);

    // 2. Set response_format and conditionally modify the system prompt.
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
        // For basic json_object mode, some models require the word "json" in the prompt.
        if (!systemPrompt.toLowerCase().includes('json')) {
            systemPrompt += `\n\nYour response must be a single, valid JSON object.`;
            dlog('[OpenAI] Injected JSON requirement into system prompt for json_object mode.');
        }
    }
    
    // 3. Now, build the final messages array with the (potentially modified) system prompt.
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (isDeepSeek) {
        messages.push({ role: 'system', content: prompts.deepseekJsonSystemMessage });
    }
    
    messages.push({ role: 'system', content: systemPrompt });

    history.forEach((h, index) => {
        if (h.originalTitle === null || h.originalContent === null || h.translatedContent === null) {
            if (aiDebugEnabled()) console.error(`[OpenAI DIAGNOSTIC] History[${index}] has null content! Skipping...`);
            return;
        }
        messages.push({ role: 'user', content: `TITLE: ${h.originalTitle}\n\nCONTENT:\n${h.originalContent}` });
        messages.push({ role: 'assistant', content: h.translatedContent });
    });

    if (title === null || content === null) {
        if (aiDebugEnabled()) console.error('[OpenAI DIAGNOSTIC] Current chapter has null title or content!');
        throw new Error('Chapter title and content cannot be null for OpenAI translation');
    }

    const fanTranslationContext = buildFanTranslationContext(fanTranslation);
    const preface = prompts.translatePrefix + (fanTranslation ? prompts.translateFanSuffix : '') + prompts.translateInstruction;
    const finalUserContent = `${fanTranslationContext}${fanTranslationContext ? '\n\n' : ''}${preface}\n\n${prompts.translateTitleLabel}\n${title}\n\n${prompts.translateContentLabel}\n${content}`;
    messages.push({ role: 'user', content: finalUserContent });

    // Add the now-finalized messages to the request
    requestOptions.messages = messages;

    // --- MODEL-SPECIFIC CAPABILITIES (API-Based) ---
    // Based on user feedback, gpt-5 and claude models require max_completion_tokens.
    const modelsThatUseMaxCompletionTokens = [
        'claude',
        'gpt-5'
    ];
    const useMaxCompletionTokens = modelsThatUseMaxCompletionTokens.some(p => settings.model.startsWith(p));

    // Apply API-detected parameters with validation
    if (supportsTemperature && settings.temperature !== appConfig.aiParameters.defaults.temperature) {
        const validatedTemp = validateAndClampParameter(settings.temperature, 'temperature');
        requestOptions.temperature = validatedTemp;
        dlog(`[Parameters] Added temperature=${validatedTemp}`);
    }
    
    // Apply expanded AI parameters if supported and configured with validation
    if (supportsTopP && settings.topP !== undefined && settings.topP !== appConfig.aiParameters.defaults.top_p) {
        const validatedTopP = validateAndClampParameter(settings.topP, 'top_p');
        requestOptions.top_p = validatedTopP;
        dlog(`[Parameters] Added top_p=${validatedTopP}`);
    }
    if (supportsFreqPen && settings.frequencyPenalty !== undefined && settings.frequencyPenalty !== appConfig.aiParameters.defaults.frequency_penalty) {
        const validatedFreqPen = validateAndClampParameter(settings.frequencyPenalty, 'frequency_penalty');
        requestOptions.frequency_penalty = validatedFreqPen;
        dlog(`[Parameters] Added frequency_penalty=${validatedFreqPen}`);
    }
    if (supportsPresPen && settings.presencePenalty !== undefined && settings.presencePenalty !== appConfig.aiParameters.defaults.presence_penalty) {
        const validatedPresPen = validateAndClampParameter(settings.presencePenalty, 'presence_penalty');
        requestOptions.presence_penalty = validatedPresPen;
        dlog(`[Parameters] Added presence_penalty=${validatedPresPen}`);
    }
    if (supportsSeed && settings.seed !== undefined && settings.seed !== null) {
        const validatedSeed = validateAndClampParameter(settings.seed, 'seed');
        requestOptions.seed = validatedSeed;
        dlog(`[Parameters] Added seed=${validatedSeed}`);
    }
    
    // Track actual parameters that were sent to API (for UI display)
    const actualParams: UsageMetrics['actualParams'] = {};
    if (requestOptions.temperature !== undefined) {
        actualParams.temperature = requestOptions.temperature;
    }
    if (requestOptions.top_p !== undefined) {
        actualParams.topP = requestOptions.top_p;
    }
    if (requestOptions.frequency_penalty !== undefined) {
        actualParams.frequencyPenalty = requestOptions.frequency_penalty;
    }
    if (requestOptions.presence_penalty !== undefined) {
        actualParams.presencePenalty = requestOptions.presence_penalty;
    }
    if (requestOptions.seed !== undefined) {
        actualParams.seed = requestOptions.seed;
    }
    if (settings.maxOutputTokens && settings.maxOutputTokens > 0) {
        // This logic is now applied to all providers that go through this function,
        // including OpenAI, OpenRouter, and DeepSeek, so we don't need the provider check.
        if (useMaxCompletionTokens) {
            requestOptions.max_completion_tokens = settings.maxOutputTokens;
        } else {
            requestOptions.max_tokens = settings.maxOutputTokens;
        }
    }

    // OpenRouter: pass optional headers for rankings from config
    if (settings.provider === 'OpenRouter') {
        try {
            const appConfig = await import('../config/app.json');
            const extraHeaders: Record<string, string> = {};
            if (appConfig.openrouter?.referer) extraHeaders['HTTP-Referer'] = appConfig.openrouter.referer;
            if (appConfig.openrouter?.title) extraHeaders['X-Title'] = appConfig.openrouter.title;
            if (Object.keys(extraHeaders).length > 0) {
                requestOptions.extra_headers = extraHeaders;
            }
        } catch (error) {
            // Config file not found or invalid, continue without headers
            dlog('[OpenRouter] Config file not found, skipping optional headers');
        }
    }

    dlog(`[OpenAI] Preparing request for model: ${settings.model}`);
    dlog(`[OpenAI] Provider: ${settings.provider}`);
    dlog(`[OpenAI] Using structured outputs: ${hasStructuredOutputs} (API-detected)`);
    dlog(`[OpenAI] Temperature setting: ${settings.temperature}`);
    dlog(`[OpenAI] Message count: ${messages.length}`);
    
    // DIAGNOSTIC: Final pre-flight validation of request
    dlog('[OpenAI DIAGNOSTIC] PRE-FLIGHT CHECK - Final request validation:');
    dlog('  Model:', requestOptions.model);
    dlog('  Messages count:', requestOptions.messages?.length || 0);
    
    // Check each message in the final request
    requestOptions.messages?.forEach((msg: any, index: number) => {
        dlog(`  Message[${index}]:`, {
            role: msg.role,
            hasContent: msg.content !== null && msg.content !== undefined,
            contentType: typeof msg.content,
            contentLength: msg.content?.length || 0,
            isNull: msg.content === null,
            isUndefined: msg.content === undefined
        });
        
        if (msg.content === null || msg.content === undefined) {
            if (aiDebugEnabled()) {
              console.error(`[OpenAI DIAGNOSTIC] CRITICAL: Message[${index}] has ${msg.content === null ? 'NULL' : 'UNDEFINED'} content!`);
              console.error('Full message:', JSON.stringify(msg, null, 2));
            }
        }
    });
    
    // TEMP: Always print the exact request body we send (like Gemini)
    try { dlogFull(`[${settings.provider} Debug] Full request body:`, JSON.stringify(requestOptions, null, 2)); } catch {}
    dlog(`[OpenAI] Request options:`, JSON.stringify(requestOptions, null, 2));

    

    // Add temperature if the model supports it (some newer models only support default)
    let response: ChatCompletion;
    try {
        dlog(`[OpenAI] Attempt 1: Sending request ${requestOptions.temperature !== undefined ? 'with' : 'without'} temperature`);
        
        dlog('[OpenAI DIAGNOSTIC] ABOUT TO MAKE API CALL - Final sanity check completed');
        if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
        // Pass AbortSignal via RequestOptions (second arg), not in payload
        response = await (abortSignal
          ? openai.chat.completions.create(requestOptions, { signal: abortSignal })
          : openai.chat.completions.create(requestOptions));
        dlog(`[OpenAI] Attempt 1: Success! Response received`);
        
        // Full response logging
        dlogFull(`[${settings.provider} Debug] Raw API response:`, JSON.stringify(response, null, 2));
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
        
        // If parameter error, retry with progressive parameter removal
        if (error.message?.includes('temperature') || error.message?.includes('top_p') || 
            error.message?.includes('frequency_penalty') || error.message?.includes('presence_penalty') ||
            error.message?.includes('seed') || error.message?.includes('not supported') || error.status === 400) {
            
            const originalParams = Object.keys(requestOptions).filter(k => 
                ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'seed'].includes(k)
            );
            
            if (aiDebugEnabled()) console.warn(`[OpenAI] Parameter error detected. Retrying without: ${originalParams.join(', ')} for model ${settings.model}`);
            
            // Remove all AI parameters for retry
            ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'seed'].forEach(param => {
                if (requestOptions[param] !== undefined) {
                    delete requestOptions[param];
                    dlog(`[Retry] Removed ${param} from request`);
                }
            });
            dlog(`[OpenAI] Attempt 2: Retry request options:`, JSON.stringify(requestOptions, null, 2));
            
            // DIAGNOSTIC: Re-validate request after parameter removal
            dlog('[OpenAI DIAGNOSTIC] RETRY ATTEMPT - Re-validating request after parameter removal:');
            requestOptions.messages?.forEach((msg: any, index: number) => {
                dlog(`  Retry Message[${index}]:`, {
                    role: msg.role,
                    hasContent: msg.content !== null && msg.content !== undefined,
                    contentType: typeof msg.content,
                    isNull: msg.content === null,
                    isUndefined: msg.content === undefined
                });
                
                if (msg.content === null || msg.content === undefined) {
                    if (aiDebugEnabled()) console.error(`[OpenAI DIAGNOSTIC] RETRY CRITICAL: Message[${index}] STILL has ${msg.content === null ? 'NULL' : 'UNDEFINED'} content!`);
                }
            });
            
            try {
                dlog('[OpenAI DIAGNOSTIC] RETRY - About to make second API call');
                if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
                response = await (abortSignal
                  ? openai.chat.completions.create(requestOptions, { signal: abortSignal })
                  : openai.chat.completions.create(requestOptions));
                dlog(`[OpenAI] Attempt 2: Success! Response received`);
                
                // Full response logging for retry
                dlogFull(`[${settings.provider} Debug] Raw API response (retry):`, JSON.stringify(response, null, 2));
                
                dlog(`[OpenAI] Raw response text:`, response.choices[0].message.content);
                dlog(`[OpenAI] Finish reason:`, response.choices[0].finish_reason);
            } catch (retryError: any) {
                console.error(`[OpenAI] Attempt 2 also failed:`, retryError);
                // Log the full JSON error response from the API if available
                if (retryError.response?.data) {
                    console.error('[OpenAI] Full JSON error response:', JSON.stringify(retryError.response.data, null, 2));
                }
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
    let estimatedCost = await calculateCost(settings.model, promptTokens, completionTokens);
    // If using OpenRouter, prefer dynamic per-token pricing from the cached catalogue
    if (settings.provider === 'OpenRouter') {
      try {
        const cache = await openrouterService.getCachedModels();
        const found = cache?.data?.find(m => m.id === settings.model);
        const pin = found?.pricing?.prompt;
        const pout = found?.pricing?.completion;
        const inRate = typeof pin === 'string' ? parseFloat(pin) : (typeof pin === 'number' ? pin : null);
        const outRate = typeof pout === 'string' ? parseFloat(pout) : (typeof pout === 'number' ? pout : null);
        if (inRate != null || outRate != null) {
          const inputCost = inRate != null ? (promptTokens * inRate) : 0;
          const outputCost = outRate != null ? (completionTokens * outRate) : 0;
          estimatedCost = inputCost + outputCost;
        }
      } catch {}
    }

    const usageMetrics: UsageMetrics = {
        totalTokens, promptTokens, completionTokens, estimatedCost, requestTime,
        provider: settings.provider, model: settings.model,
        actualParams: Object.keys(actualParams).length > 0 ? actualParams : undefined
    };

    const firstChoice = response.choices?.[0];
    const responseText = firstChoice?.message?.content || '';
    if (!responseText) {
      // Known DeepSeek behavior: may return empty content; signal clearly
      throw new Error('empty_content: Provider returned no message content.');
    }
    if (firstChoice?.finish_reason === 'length') {
      throw new Error('length_cap: Model hit token limit. Increase max_tokens or split the chapter.');
    }
    
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
        } catch (initialParseError: any) {
            if (initialParseError instanceof SyntaxError && initialParseError.message.includes('Unexpected end of JSON input')) {
                console.error(`[OpenAI] JSON Parse Error: Unexpected end of JSON input. Raw API response text:`);
                console.error(responseText);
            }
            console.warn(`[DeepSeek] Initial JSON parse failed. Attempting fallback extraction. Error: ${initialParseError.message}`);
            // Use robust balanced-brace extraction
            const jsonString = extractBalancedJson(responseText);
            console.log(`[DeepSeek] Extracted JSON substring. Original length: ${responseText.length}, Extracted length: ${jsonString.length}`);
            parsedJson = JSON.parse(jsonString);
        }

        // Primary validation: Check for expected schema
        let isCompliantSchema = typeof parsedJson.translatedTitle === 'string' && typeof parsedJson.translation === 'string';
        
        // Fallback schema detection: Check for common alternative field names
        let title: string | undefined;
        let translation: string | undefined;
        let isFallbackMode = false;
        
        if (isCompliantSchema) {
            title = parsedJson.translatedTitle;
            translation = parsedJson.translation;
        } else {
            // Attempt fallback field mapping
            title = parsedJson.title || parsedJson.translatedTitle || parsedJson.chapter_title;
            
            // Handle content field - might be string or array
            let contentRaw = parsedJson.content || parsedJson.translation || parsedJson.translated_content || parsedJson.body;
            if (Array.isArray(contentRaw)) {
                // Join array elements with line breaks
                translation = contentRaw.join('\n\n');
            } else if (typeof contentRaw === 'string') {
                translation = contentRaw;
            }
            
            if (typeof title === 'string' && typeof translation === 'string') {
                isFallbackMode = true;
                console.warn(`[${settings.provider}] Schema non-compliance detected. Using fallback mode with fields: title="${title ? 'found' : 'missing'}", content="${translation ? 'found' : 'missing'}"`);
                console.warn(`[${settings.provider}] Fallback mode: Will attempt to extract footnotes and illustrations from alternative formats.`);
            } else {
                // Neither schema works - this is a real error
                const availableFields = Object.keys(parsedJson).join(', ');
                throw new Error(`Invalid JSON structure in AI response. Expected 'translatedTitle'+'translation' or 'title'+'content', but found fields: ${availableFields}`);
            }
        }
        
        // Sanitize translation HTML for scene breaks and stray tags before validation
        const sanitized = sanitizeTranslationHTML(translation);
        
        // Handle illustrations and footnotes based on compliance mode
        let fixedIllustrations: any[] = [];
        let fixedFootnotes: any[] = [];
        let fixedTranslation = sanitized;
        
        if (!isFallbackMode) {
            // Full schema compliance - process normally
            const { translation: fixedTranslation_1, suggestedIllustrations } = validateAndFixIllustrations(sanitized, parsedJson.suggestedIllustrations);
            const { translation: finalTranslation, footnotes } = validateAndFixFootnotes(
              fixedTranslation_1,
              parsedJson.footnotes,
              (settings.footnoteStrictMode as any) || 'append_missing'
            );
            fixedTranslation = finalTranslation;
            fixedIllustrations = suggestedIllustrations;
            fixedFootnotes = footnotes;
        } else {
            // Fallback mode - attempt to extract from alternative formats
            console.warn(`[${settings.provider}] Fallback mode active: Attempting to extract footnotes and illustrations from alternative formats`);
            
            // Handle footnotes - might be object with numbered keys or array
            try {
                if (parsedJson.footnotes && typeof parsedJson.footnotes === 'object' && !Array.isArray(parsedJson.footnotes)) {
                    // Convert object footnotes to array format: {"1": "text", "2": "text"} → [{marker: "[1]", text: "text"}]
                    fixedFootnotes = Object.entries(parsedJson.footnotes).map(([key, text]) => ({
                        marker: `[${key}]`,
                        text: String(text)
                    }));
                    console.log(`[${settings.provider}] Converted ${fixedFootnotes.length} footnotes from object format`);
                } else if (Array.isArray(parsedJson.footnotes)) {
                    fixedFootnotes = parsedJson.footnotes;
                }
            } catch (e) {
                console.warn(`[${settings.provider}] Failed to process footnotes:`, e);
            }
            
            // Handle illustrations - might be single prompt or array format
            try {
                if (typeof parsedJson.illustration_prompt === 'string') {
                    // Convert single illustration prompt to array format
                    fixedIllustrations = [{
                        placementMarker: '[ILLUSTRATION-1]',
                        imagePrompt: parsedJson.illustration_prompt
                    }];
                    console.log(`[${settings.provider}] Converted single illustration prompt to array format`);
                } else if (Array.isArray(parsedJson.suggestedIllustrations)) {
                    fixedIllustrations = parsedJson.suggestedIllustrations;
                } else if (Array.isArray(parsedJson.illustrations)) {
                    fixedIllustrations = parsedJson.illustrations;
                }
            } catch (e) {
                console.warn(`[${settings.provider}] Failed to process illustrations:`, e);
            }
        }
        
        // Track last-used model for OpenRouter catalogue ordering
        try { if (settings.provider === 'OpenRouter') await openrouterService.setLastUsed(settings.model); } catch {}
        
        return {
            translatedTitle: title,
            translation: fixedTranslation,
            proposal: parsedJson.proposal ?? null,
            footnotes: fixedFootnotes ?? [],
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
  fanTranslation?: string | null,
  maxRetries: number = 3,
  initialDelay: number = 2000,
  abortSignal?: AbortSignal
): Promise<TranslationResult> => {
    // Initialize providers if not already done
    const { initializeProviders } = await import('../adapters/providers');
    await initializeProviders();
    
    // Use the new Translator with provider adapters
    const { translator } = await import('./translate/Translator');
    
    return translator.translate({
      title,
      content,
      settings,
      history,
      fanTranslation,
      abortSignal
    }, {
      maxRetries,
      initialDelay
    });
};
