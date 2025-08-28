import Anthropic from '@anthropic-ai/sdk';
import { AppSettings, HistoricalChapter, TranslationResult, FeedbackItem, UsageMetrics } from '../types';
import prompts from '../config/prompts.json';
import { calculateCost } from './aiService';

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

// --- SHARED PROMPT LOGIC ---

const buildFanTranslationContext = (fanTranslation: string | null): string => {
  if (!fanTranslation) return '';
  return `\n${prompts.fanRefHeader}\n\n${prompts.fanRefBullets}\n\n${prompts.fanRefImportant}\n\nFAN TRANSLATION REFERENCE:\n${fanTranslation}\n\n${prompts.fanRefEnd}\n`;
};

const formatHistory = (history: HistoricalChapter[]): string => {
    if (history.length === 0) {
        return prompts.historyNoRecent;
    }
    return history.map((h, index) => {
        const feedbackStr = h.feedback.length > 0
            ? prompts.historyFeedbackOnThisChapter + "\n" + h.feedback.map((f: FeedbackItem) => {
                const commentStr = f.comment ? ` (User comment: ${f.comment})` : '';
                return `- ${f.type} on: "${f.selection}"${commentStr}`;
            }).join('\n')
            : prompts.historyNoFeedback;
        
        return `${prompts.historyHeaderTemplate.replace('{index}', String(index + 1))}\n\n` +
               `${prompts.historyOriginalHeader}\n` +
               `TITLE: ${h.originalTitle}\n` +
               `CONTENT:\n${h.originalContent}\n\n` +
               `${prompts.historyPreviousHeader}\n` +
               `TITLE: ${h.translatedTitle}\n` +
               `CONTENT:\n${h.translatedContent}\n\n` +
               `${prompts.historyUserFeedbackHeader}\n` +
               `${feedbackStr}\n\n` +
               `--- END OF CONTEXT FOR PREVIOUS CHAPTER ${index + 1} ---`;
    }).join('\n\n');
};

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
    fanTranslation?: string | null
): Promise<TranslationResult> => {

    const apiKey = settings.apiKeyClaude || (process.env.CLAUDE_API_KEY as any);
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
    const fanTranslationContext = buildFanTranslationContext(fanTranslation);
    
    // Create comprehensive prompt with schema description
    const preface = prompts.translatePrefix + (fanTranslation ? prompts.translateFanSuffix : '') + prompts.translateInstruction;
    const sys = (settings.systemPrompt || '')
      .replaceAll('{{targetLanguage}}', settings.targetLanguage || 'English')
      .replaceAll('{{targetLanguageVariant}}', settings.targetLanguage || 'English');
    const fullPrompt = `${sys}\n\n${historyPrompt}\n\n${fanTranslationContext}\n\n-----\n\n${preface}\n\n${prompts.translateTitleLabel}\n${title}\n\n${prompts.translateContentLabel}\n${content}

IMPORTANT: You must respond with valid JSON in exactly this format:
{
  "translatedTitle": "The translated chapter title",
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
      "imagePrompt": "Detailed prompt for AI image generation describing the scene, mood, characters, and visual style"
    }
  ],
  "proposal": {
    "observation": "What translation challenge or feedback pattern triggered this proposal",
    "currentRule": "Exact text from user's system prompt that could be improved",
    "proposedChange": "Suggested replacement text with clear improvements", 
    "reasoning": "Why this change would improve translation quality"
  }
}

If there are no footnotes, use null or empty array for footnotes.
If there are no illustrations, use null or empty array for suggestedIllustrations.
If there is no proposal, use null for proposal.`;

    // Debug: what we're sending (sanitized)
    dlog('[Claude Debug] Request summary:', {
      model: settings.model,
      temperature: settings.temperature,
      clampedTemperature: Math.max(0, Math.min(1, settings.temperature)),
      historyChapters: history.length,
      fullPromptLength: fullPrompt.length,
      fullPromptPreview: fullPrompt.slice(0, 400)
    });
    
    const requestPayload = {
        model: settings.model,
        max_tokens: Math.max(1, Math.min((settings.maxOutputTokens ?? 8192), 200000)),
        temperature: Math.max(0, Math.min(1, settings.temperature)), // Clamp temperature to 0-1 range as UI max is 2
        messages: [
            {
                role: 'user',
                content: fullPrompt
            },
            {
                // Response prefilling - starts the JSON structure for Claude
                role: 'assistant', 
                content: `{
  "translatedTitle": "`
            }
        ]
    };
    
    // Gated: Full request body
    dlogFull('[Claude Debug] Full request body:', JSON.stringify(requestPayload, null, 2));

    try {
        // Use Claude's message format with response prefilling for consistency
        const response = await claude.messages.create(requestPayload);
        
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
        const estimatedCost = calculateCost(settings.model, promptTokens, completionTokens);

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

        // Since we prefilled with '{"translatedTitle":', we need to complete the JSON
        const completeJsonText = '{"translatedTitle": "' + responseContent.text;
        
        try {
            const parsedJson = JSON.parse(completeJsonText);
            
            // Validate required fields
            if (typeof parsedJson.translatedTitle !== 'string' || typeof parsedJson.translation !== 'string') {
                throw new Error('Invalid JSON structure in Claude response.');
            }

            // Apply the same illustration validation as other providers
            // We need to import this locally to avoid circular imports
            const validateAndFixIllustrations = (translation: string, suggestedIllustrations: any[] | undefined): { translation: string; suggestedIllustrations: any[] } => {
                const textMarkers = translation.match(/\\[ILLUSTRATION-\\d+[A-Za-z]*\\]/g) || [];
                const jsonIllustrations = suggestedIllustrations || [];
                const jsonMarkers = jsonIllustrations.map(item => item.placementMarker);

                // Case 1: Perfect match - no changes needed
                if (textMarkers.length === jsonMarkers.length) {
                    const textMarkerSet = new Set(textMarkers);
                    const jsonMarkerSet = new Set(jsonMarkers);
                    
                    if (textMarkers.every(marker => jsonMarkerSet.has(marker)) && 
                        jsonMarkers.every(marker => textMarkerSet.has(marker))) {
                        console.log('[IllustrationFix] Perfect match - no changes needed');
                        return { translation, suggestedIllustrations: jsonIllustrations };
                    }
                }

                // Case 2: More JSON prompts than text markers - auto-insert missing markers
                if (jsonMarkers.length > textMarkers.length) {
                    const textMarkerSet = new Set(textMarkers);
                    const unmatchedPrompts = jsonIllustrations.filter(item => !textMarkerSet.has(item.placementMarker));
                    
                    console.log(`[IllustrationFix] Auto-recovery: ${unmatchedPrompts.length} unmatched prompts, inserting at end of text`);
                    
                    let updatedTranslation = translation;
                    for (const prompt of unmatchedPrompts) {
                        updatedTranslation = updatedTranslation.trim() + ` ${prompt.placementMarker}`;
                    }
                    
                    console.log('[IllustrationFix] Auto-recovery successful - saved translation with inserted markers');
                    return { translation: updatedTranslation, suggestedIllustrations: jsonIllustrations };
                }

                // For other cases, just return as-is (Claude service can be more lenient initially)
                return { translation, suggestedIllustrations: jsonIllustrations };
            };
            
            const { translation: fixedTranslation_1, suggestedIllustrations: fixedIllustrations } = 
                validateAndFixIllustrations(parsedJson.translation, parsedJson.suggestedIllustrations);

            // Basic footnote validator (align markers in text with JSON footnotes)
            const validateAndFixFootnotes = (translation: string, footnotes: any[] | undefined): { translation: string; footnotes: any[] } => {
                // Unique markers from text (first appearance), exclude illustrations
                const all = translation.match(/\[(\d+)\]/g) || [];
                const seen = new Set<string>();
                const textMarkers: string[] = [];
                for (const m of all) { if (/\[ILLUSTRATION-/i.test(m)) continue; if (!seen.has(m)) { seen.add(m); textMarkers.push(m); } }
                const jsonFootnotes = Array.isArray(footnotes) ? footnotes.slice() : [];
                const normalize = (m: string) => m.startsWith('[') ? m : `[${m.replace(/\[|\]/g, '')}]`;
                const jsonMarkersRaw = jsonFootnotes.map(fn => normalize(String(fn.marker || '')));
                const jsonMarkers = Array.from(new Set(jsonMarkersRaw));
                if (textMarkers.length === jsonMarkers.length) {
                    const tSet = new Set(textMarkers), jSet = new Set(jsonMarkers);
                    if (textMarkers.every(m => jSet.has(m)) && jsonMarkers.every(m => tSet.has(m))) {
                        const fixed = jsonFootnotes.map(fn => ({ ...fn, marker: normalize(String(fn.marker || '')) }));
                        return { translation, footnotes: fixed };
                    }
                    const textOnly = textMarkers.filter(m => !jSet.has(m));
                    if (textOnly.length > 0) console.warn(`[FootnoteFix] (Claude) Remapping ${textOnly.length} JSON footnotes to unmatched text markers`);
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
                if (jsonMarkers.length > textMarkers.length) {
                    const tSet = new Set(textMarkers);
                    const extra = jsonMarkers.filter(m => !tSet.has(m));
                    if (extra.length > 0) console.warn(`[FootnoteFix] (Claude) Detected ${extra.length} footnotes without text markers; appending markers at end of translation`);
                    let updated = translation.trim();
                    for (const m of extra) updated += ` ${m}`;
                    const fixed = jsonFootnotes.map(fn => ({ ...fn, marker: normalize(String(fn.marker || '')) }));
                    return { translation: updated, footnotes: fixed };
                }
                const errorMessage = `AI response validation failed: Missing footnotes for markers.\n- Text markers (unique): ${textMarkers.join(', ')}\n- JSON markers: ${jsonMarkers.join(', ')}\n\nRequires regeneration with matching footnotes.`;
                throw new Error(errorMessage);
            };

            const { translation: fixedTranslation, footnotes: fixedFootnotes } = validateAndFixFootnotes(fixedTranslation_1, parsedJson.footnotes, (settings as any).footnoteStrictMode || 'append_missing');

            return {
                translatedTitle: parsedJson.translatedTitle,
                translation: fixedTranslation,
                proposal: parsedJson.proposal || null,
                footnotes: fixedFootnotes || [],
                suggestedIllustrations: fixedIllustrations,
                usageMetrics: usageMetrics,
            };
        } catch (parseError) {
            console.error("Failed to parse JSON response from Claude:", completeJsonText, parseError);
            throw new Error("Claude returned a malformed response. Could not parse translation.");
        }
    } catch (error: any) {
        console.error(`[Claude Service] Translation failed:`, error);
        const message = error.message?.includes('API key') 
            ? 'Invalid Claude API key.' 
            : `Claude translation failed. ${error.message || ''}`;
        throw new Error(message);
    }
};
