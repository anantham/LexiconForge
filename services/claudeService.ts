import Anthropic from '@anthropic-ai/sdk';
import { AppSettings, HistoricalChapter, TranslationResult, FeedbackItem, UsageMetrics } from '../types';
import { calculateCost } from './aiService';

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

// --- CLAUDE TRANSLATION SERVICE ---

/**
 * Translates content using Claude API with enhanced consistency techniques
 * Uses Anthropic's response prefilling for reliable JSON output
 */
export const translateWithClaude = async (
    title: string, 
    content: string, 
    settings: AppSettings, 
    history: HistoricalChapter[]
): Promise<TranslationResult> => {

    const apiKey = settings.apiKeyClaude || (typeof process !== 'undefined' ? process.env.CLAUDE_API_KEY : undefined);
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
    
    // Create comprehensive prompt with schema description
    const fullPrompt = `${settings.systemPrompt}

${historyPrompt}

-----

Based on the context from previous chapters, please translate the following new chapter:

TITLE:
${title}

CONTENT:
${content}

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

    try {
        // Use Claude's message format with response prefilling for consistency
        const response = await claude.messages.create({
            model: settings.model,
            max_tokens: 8192,
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
        const completeJsonText = '{
  "translatedTitle": "' + responseContent.text;
        
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
            
            const { translation: fixedTranslation, suggestedIllustrations: fixedIllustrations } = 
                validateAndFixIllustrations(parsedJson.translation, parsedJson.suggestedIllustrations);

            return {
                translatedTitle: parsedJson.translatedTitle,
                translation: fixedTranslation,
                proposal: parsedJson.proposal || null,
                footnotes: parsedJson.footnotes || [],
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