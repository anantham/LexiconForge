import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages/messages';
import { AppSettings, HistoricalChapter, TranslationResult, UsageMetrics } from '../types';
import prompts from '../config/prompts.json';
import { calculateCost } from './aiService';
import { buildFanTranslationContext, formatHistory } from './prompts';
import { buildPreambleFromSettings } from './prompts/metadataPreamble';
import { getEnvVar } from './env';
import { getTranslationSystemPrompt } from '../utils/promptUtils';

// --- DEBUG UTILITIES ---
const aiDebugEnabled = (): boolean => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('LF_AI_DEBUG') === '1';
  } catch { return false; }
};
const dlog = (...args: any[]) => { if (aiDebugEnabled()) console.log(...args); };
const aiDebugFullEnabled = (): boolean => {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem('LF_AI_DEBUG_FULL') === '1'; } catch { return false; }
};
const dlogFull = (...args: any[]) => { if (aiDebugFullEnabled()) console.log(...args); };

// --- CLAUDE TRANSLATION SERVICE ---

/**
 * Translates content using Claude API with enhanced consistency techniques
 * Uses Anthropic's response prefilling for reliable JSON output
 */
export const translateWithClaude = async (
    title: string,
    content: string,
    settings: AppSettings,
    history: HistoricalChapter[],
    fanTranslation?: string | null,
    abortSignal?: AbortSignal
): Promise<TranslationResult> => {

    const apiKey = settings.apiKeyClaude || (getEnvVar('CLAUDE_API_KEY') as any);
    if (!apiKey) {
        throw new Error("Claude API key is missing. Please add it in the settings.");
    }

    const startTime = performance.now();
    const claude = new Anthropic({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
    });

    // Format history for Claude
    const historyPrompt = formatHistory(history);
    const includeFanTranslation = settings.includeFanTranslationInPrompt ?? false;
    const effectiveFanTranslation = includeFanTranslation ? (fanTranslation ?? null) : null;
    const fanTranslationContext = buildFanTranslationContext(effectiveFanTranslation);

    // Create comprehensive prompt with schema description
    const preface = prompts.translatePrefix + (effectiveFanTranslation ? prompts.translateFanSuffix : '') + prompts.translateInstruction + prompts.translateTitleGuidance;
    const preamble = buildPreambleFromSettings(settings);
    const translationPrompt = getTranslationSystemPrompt(settings.systemPrompt || '');
    const sys = ((translationPrompt || '') + '\n\n' + preamble)
      .replaceAll('{{targetLanguage}}', settings.targetLanguage || 'English')
      .replaceAll('{{targetLanguageVariant}}', settings.targetLanguage || 'English');
    const fullPrompt = `${sys}\n\n${historyPrompt}\n\n${fanTranslationContext}\n\n-----\n\n${preface}\n\n${prompts.translateTitleLabel}\n${title}\n\n${prompts.translateContentLabel}\n${content}

IMPORTANT: You must respond with valid JSON in exactly this format. Ensure all special characters (apostrophes, quotes, backslashes, newlines) are properly escaped in JSON strings:
{
  "translatedTitle": "${prompts.translatedTitleDescription.replace(/\"/g, '\\"')}",
  "translation": "Full translated chapter content using HTML formatting (<i>italics</i>, <b>bold</b> - never markdown). MUST include numbered markers [1], [2], [3] in the text for any footnotes. MUST include placement markers [ILLUSTRATION-1], [ILLUSTRATION-2], etc. in the text for any visual scenes you want illustrated. Every marker in this text must have a corresponding entry in the respective arrays below.",
  "footnotes": [
    {
      "marker": "[1]", 
      "text": "[TL Note:] or [Author's Note:] followed by footnote content"
    }
  ],
  "suggestedIllustrations": [
    {
      "placementMarker": "[ILLUSTRATION-1]",
      "imagePrompt": "Short human-facing caption for the illustration",
      "imagePlan": {
        "subject": "Primary subject of the illustration",
        "characters": ["Key character 1", "Key character 2"],
        "scene": "Environment and situation",
        "composition": "Framing and composition guidance",
        "camera": "Camera angle or perspective",
        "lighting": "Lighting and shadow treatment",
        "style": "Visual style guidance",
        "mood": "Atmosphere and emotional tone",
        "details": ["Secondary detail 1", "Secondary detail 2"],
        "mustKeep": ["Critical detail 1"],
        "avoid": ["Undesired feature 1"],
        "negativePrompt": ["Artifact to suppress"]
      }
    }
  ]
}

If there are no footnotes, use null or empty array for footnotes.
If there are no illustrations, use null or empty array for suggestedIllustrations.

CRITICAL JSON FORMATTING: Properly escape all special characters:
- Apostrophes: "don't" → "don\\'t"  
- Quotes: "she said \"hello\"" → "she said \\"hello\\""
- Backslashes: "path\\file" → "path\\\\file"
- Newlines: Use \\n instead of actual line breaks within JSON strings`;

    // Debug: what we're sending (sanitized)
    dlog('[Claude Debug] Request summary:', {
      model: settings.model,
      temperature: settings.temperature,
      clampedTemperature: Math.max(0, Math.min(1, settings.temperature)),
      historyChapters: history.length,
      fullPromptLength: fullPrompt.length,
      fullPromptPreview: fullPrompt.slice(0, 400)
    });
    
    const requestPayload: MessageCreateParamsNonStreaming = {
        model: settings.model,
        max_tokens: Math.max(1, Math.min((settings.maxOutputTokens ?? 16384), 200000)),
        temperature: Math.max(0, Math.min(1, settings.temperature)), // Clamp temperature to 0-1 range as UI max is 2
        messages: [
            {
                role: 'user',
                content: [{ type: 'text', text: fullPrompt }]
            },
            {
                // Response prefilling - starts the JSON structure for Claude
                role: 'assistant',
                content: [{ type: 'text', text: `{
  "translatedTitle": "` }]
            }
        ]
    };
    
    // Gated: Full request body
    dlogFull('[Claude Debug] Full request body:', JSON.stringify(requestPayload, null, 2));

    try {
        // Use Claude's message format with response prefilling for consistency.
        // Thread the abort signal into the SDK so a Translator timeout actually CANCELS the
        // in-flight request — otherwise the original call keeps running (and billing) while the
        // retry fires (review #3). The Anthropic SDK accepts { signal } as the request options.
        const response = await claude.messages.create(requestPayload, { signal: abortSignal });
        
        dlog('[Claude Debug] Raw API response:', JSON.stringify(response, null, 2));
        
        // Debug response structure
        dlog('[Claude Debug] Response structure:', {
          contentLength: response.content?.length || 0,
          contentTypes: response.content?.map(c => c.type) || [],
          stopReason: response.stop_reason,
          stopSequence: response.stop_sequence,
          model: response.model,
          role: response.role
        });

        const requestTime = (performance.now() - startTime) / 1000;
        
        // Extract usage metrics
        const usage = response.usage;
        const promptTokens = usage?.input_tokens ?? 0;
        const completionTokens = usage?.output_tokens ?? 0;
        const totalTokens = promptTokens + completionTokens;
        const estimatedCost = await calculateCost(settings.model, promptTokens, completionTokens);

        const usageMetrics: UsageMetrics = {
            totalTokens, 
            promptTokens, 
            completionTokens, 
            estimatedCost, 
            requestTime,
            provider: 'Claude', 
            model: settings.model
        };

        // Get the response content
        const responseContent = response.content[0];
        if (responseContent.type !== 'text') {
            throw new Error('Claude returned non-text response');
        }

        // Handle both complete JSON responses and prefilled partial responses
        let completeJsonText: string;
        const responseText = responseContent.text.trim();
        
        // Debug the actual response structure
        dlog('[Claude Debug] Raw response text preview:', responseText.substring(0, 200));
        
        if (responseText.startsWith('{')) {
            // Claude returned a complete JSON response (ignoring prefill)
            completeJsonText = responseText;
            dlog('[Claude Debug] Detected complete JSON response');
        } else if (responseText.includes('"translation":') && responseText.endsWith('}')) {
            // Claude returned partial response but it looks complete (missing opening brace)
            completeJsonText = '{"translatedTitle": "' + responseText;
            dlog('[Claude Debug] Detected partial response, completing JSON structure');
        } else {
            // Standard partial response from prefilling
            completeJsonText = '{"translatedTitle": "' + responseText;
            dlog('[Claude Debug] Standard prefilled response completion');
        }
        
        try {
            dlog('[Claude Debug] Attempting to parse JSON with length:', completeJsonText.length);
            const parsedJson = JSON.parse(completeJsonText);
            dlog('[Claude Debug] JSON parsing successful');
            
            // Validate required fields
            if (typeof parsedJson.translatedTitle !== 'string' || typeof parsedJson.translation !== 'string') {
                console.error('[Claude Debug] Invalid JSON structure:', {
                    hasTranslatedTitle: typeof parsedJson.translatedTitle,
                    hasTranslation: typeof parsedJson.translation,
                    keys: Object.keys(parsedJson)
                });
                throw new Error('Invalid JSON structure in Claude response.');
            }

            // Illustration/footnote marker reconciliation is NOT done here. It happens once,
            // for every provider, in Translator.sanitizeResult() — see services/ai/responseValidators.ts.
            dlog('[Claude Debug] Parsed result:', {
                translatedTitleLength: parsedJson.translatedTitle?.length || 0,
                rawTranslationLength: parsedJson.translation?.length || 0,
                footnotesCount: parsedJson.footnotes?.length || 0,
                illustrationsCount: parsedJson.suggestedIllustrations?.length || 0,
            });

            return {
                translatedTitle: parsedJson.translatedTitle,
                translation: parsedJson.translation,
                proposal: null,
                footnotes: parsedJson.footnotes || [],
                suggestedIllustrations: parsedJson.suggestedIllustrations || [],
                usageMetrics: usageMetrics,
            };
        } catch (parseError) {
            console.error('[Claude Debug] JSON parsing failed:', {
                error: parseError,
                originalResponseLength: responseText.length,
                originalResponsePreview: responseText.substring(0, 300),
                completeJsonLength: completeJsonText.length,
                completeJsonPreview: completeJsonText.substring(0, 300),
                startsWithBrace: responseText.startsWith('{'),
                endsWithBrace: responseText.endsWith('}'),
                hasTranslationKey: responseText.includes('"translation":'),
                hasUnescapedApostrophes: completeJsonText.includes("'"),
                errorLocation: parseError instanceof SyntaxError ? parseError.message : 'Unknown'
            });
            
            // Try to provide more helpful error message
            let errorMessage = "Claude returned a malformed response. Could not parse translation.";
            if (parseError instanceof SyntaxError) {
                errorMessage += ` JSON Syntax Error: ${parseError.message}`;
            }
            
            throw new Error(errorMessage);
        }
    } catch (error: any) {
        console.error(`[Claude Service] Translation failed:`, error);
        const message = error.message?.includes('API key') 
            ? 'Invalid Claude API key.' 
            : `Claude translation failed. ${error.message || ''}`;
        throw new Error(message);
    }
};
