import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import prompts from '@/config/prompts.json';
import appConfig from '@/config/app.json';
import { buildFanTranslationContext, formatHistory } from '@/services/prompts';
import { getEnvVar } from '@/services/env';
import type { AppSettings, HistoricalChapter, TranslationResult, UsageMetrics } from '@/types';
import { sanitizeHtml as sanitizeTranslationHTML } from '@/services/translate/HtmlSanitizer';
import { replacePlaceholders } from '../textUtils';
import { calculateCost } from '../cost';
import { dlog, dlogFull } from '../debug';
import { validateAndFixIllustrations, validateAndFixFootnotes } from '../responseValidators';

const geminiResponseSchema = {
  type: Type.OBJECT,
  properties: {
    translatedTitle: { type: Type.STRING, description: prompts.translatedTitleDescription },
    translation: { type: Type.STRING, description: prompts.translationHtmlRules },
    footnotes: {
      type: Type.ARRAY,
      nullable: true,
      description: prompts.footnotesDescription,
      items: {
        type: Type.OBJECT,
        properties: {
          marker: { type: Type.STRING, description: '' + prompts.footnoteMarkerDescription },
          text: { type: Type.STRING, description: '' + prompts.footnoteTextDescription },
        },
        required: ['marker', 'text'],
      },
    },
    suggestedIllustrations: {
      type: Type.ARRAY,
      nullable: true,
      description: '' + prompts.illustrationsDescription,
      items: {
        type: Type.OBJECT,
        properties: {
          placementMarker: {
            type: Type.STRING,
            description: '' + prompts.illustrationPlacementMarkerDescription,
          },
          imagePrompt: {
            type: Type.STRING,
            description: '' + prompts.illustrationImagePromptDescription,
          },
        },
        required: ['placementMarker', 'imagePrompt'],
      },
    },
    proposal: {
      type: Type.OBJECT,
      nullable: true,
      description: '' + prompts.proposalDescription,
      properties: {
        observation: { type: Type.STRING, description: '' + prompts.proposalObservationDescription },
        currentRule: { type: Type.STRING, description: '' + prompts.proposalCurrentRuleDescription },
        proposedChange: { type: Type.STRING, description: '' + prompts.proposalProposedChangeDescription },
        reasoning: { type: Type.STRING, description: '' + prompts.proposalReasoningDescription },
      },
      required: ['observation', 'currentRule', 'proposedChange', 'reasoning'],
    },
  },
  required: ['translatedTitle', 'translation'],
};

const extractFirstBalancedJson = (text: string): string | null => {
  const scan = (open: string, close: string) => {
    let i = text.indexOf(open);
    while (i !== -1) {
      let depth = 0;
      let inStr = false;
      let esc = false;
      for (let j = i; j < text.length; j++) {
        const ch = text[j];
        if (inStr) {
          if (esc) {
            esc = false;
          } else if (ch === '\\') {
            esc = true;
          } else if (ch === '"') {
            inStr = false;
          }
        } else {
          if (ch === '"') {
            inStr = true;
          } else if (ch === open) {
            depth++;
          } else if (ch === close) {
            depth--;
            if (depth === 0) {
              return text.slice(i, j + 1);
            }
          }
        }
      }
      i = text.indexOf(open, i + 1);
    }
    return null;
  };

  return scan('{', '}') || scan('[', ']');
};

const sanitiseTranslation = (translation: string) => {
  const trimmed = translation.trim();
  if (trimmed.length === 0) return trimmed;
  return sanitizeTranslationHTML(trimmed);
};

export const translateWithGemini = async (
  title: string,
  content: string,
  settings: AppSettings,
  history: HistoricalChapter[],
  fanTranslation?: string | null,
  abortSignal?: AbortSignal
): Promise<TranslationResult> => {
  const apiKey = settings.apiKeyGemini || (getEnvVar('GEMINI_API_KEY') as string | undefined);
  if (!apiKey) {
    throw new Error('Gemini API key is missing. Please add it in the settings.');
  }

  const startTime = performance.now();
  const ai = new GoogleGenAI({ apiKey });
  const historyPrompt = formatHistory(history);
  const fanTranslationContext = buildFanTranslationContext(fanTranslation);
  const preface =
    prompts.translatePrefix +
    (fanTranslation ? prompts.translateFanSuffix : '') +
    prompts.translateInstruction +
    prompts.translateTitleGuidance;
  const fullPrompt = `${historyPrompt}\n\n${fanTranslationContext}\n\n-----\n\n${preface}\n\n${prompts.translateTitleLabel}\n${title}\n\n${prompts.translateContentLabel}\n${content}`;

  dlog('[Gemini Debug] Request summary:', {
    model: settings.model,
    temperature: settings.temperature,
    systemInstructionLength: settings.systemPrompt?.length ?? 0,
    historyChapters: history.length,
    fullPromptLength: fullPrompt.length,
    fullPromptPreview: fullPrompt.slice(0, 400),
  });

  const baseRequest = {
    model: settings.model,
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    systemInstruction: replacePlaceholders(settings.systemPrompt, settings),
    generationConfig: {
      temperature: settings.temperature,
      responseMimeType: 'application/json',
      responseSchema: geminiResponseSchema,
      maxOutputTokens: Math.max(1, Math.min(settings.maxOutputTokens ?? 16384, 32768)),
    },
  } as const;

  dlogFull('[Gemini Debug] Full request body:', JSON.stringify(baseRequest, null, 2));

  let response: GenerateContentResponse;
  try {
    const call = (ai as any).models.generateContent(baseRequest);
    if (abortSignal) {
      response = (await Promise.race([
        call,
        new Promise((_, reject) =>
          abortSignal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true }
          )
        ),
      ])) as GenerateContentResponse;
    } else {
      response = await call;
    }
  } catch (err) {
    console.error('[Gemini] Primary call failed, error:', err);
    throw err;
  }

  dlog('[Gemini Debug] Raw API response:', JSON.stringify(response, null, 2));

  if (!response?.candidates || response.candidates.length === 0) {
    console.error('[Gemini] API call returned invalid response structure.', JSON.stringify(response));
    throw new Error('Translation failed: The API returned an empty or invalid response.');
  }

  let candidate = response.candidates[0];
  dlog('[Gemini Debug] finishReason:', candidate?.finishReason);
  dlog('[Gemini Debug] safetyRatings:', JSON.stringify((candidate as any)?.safetyRatings || [], null, 2));

  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    console.warn('[Gemini] Empty candidate on first attempt — retrying without schema');
    const fallbackReq = {
      ...baseRequest,
      generationConfig: {
        ...baseRequest.generationConfig,
        responseSchema: undefined,
        responseMimeType: 'application/json',
      },
    } as const;
    try {
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
      console.error('[Gemini] Candidate missing content after fallback.', JSON.stringify(candidate));
      throw new Error(`empty_candidate: finishReason=${candidate?.finishReason ?? 'UNKNOWN'}`);
    }
  }

  const requestTime = (performance.now() - startTime) / 1000;

  const usage = (response as any).usageMetadata;
  const promptTokens = usage?.promptTokenCount ?? 0;
  const completionTokens = usage?.candidatesTokenCount ?? 0;
  const totalTokens = promptTokens + completionTokens;
  const estimatedCost = await calculateCost(settings.model, promptTokens, completionTokens);

  const actualParams: UsageMetrics['actualParams'] = {};
  if (settings.temperature !== appConfig.aiParameters.defaults.temperature) {
    actualParams.temperature = settings.temperature;
  }

  const usageMetrics: UsageMetrics = {
    totalTokens,
    promptTokens,
    completionTokens,
    estimatedCost,
    requestTime,
    provider: 'Gemini',
    model: settings.model,
    actualParams: Object.keys(actualParams).length > 0 ? actualParams : undefined,
  };

  const joinParts = (cand: any): string => {
    const parts = cand?.content?.parts || [];
    return parts.map((p: any) => p?.text ?? '').join('');
  };

  const responseText = joinParts(candidate).trim();
  dlog('[Gemini Debug] Response text length:', responseText.length);
  dlog('[Gemini Debug] Response text preview:', responseText.substring(0, 200) + '...');
  dlog('[Gemini Debug] Response text ends with:', responseText.slice(-50));

  try {
    const parsedJson = JSON.parse(responseText);

    let title: string | undefined;
    let translation: string | undefined;
    let isFallbackMode = false;

    if (typeof parsedJson.translatedTitle === 'string' && typeof parsedJson.translation === 'string') {
      title = parsedJson.translatedTitle;
      translation = parsedJson.translation;
    } else {
      title = parsedJson.title || parsedJson.translatedTitle || parsedJson.chapter_title;
      const contentRaw =
        parsedJson.content || parsedJson.translation || parsedJson.translated_content || parsedJson.body;
      if (Array.isArray(contentRaw)) {
        translation = contentRaw.join('\n\n');
      } else if (typeof contentRaw === 'string') {
        translation = contentRaw;
      }
      if (title && translation) {
        isFallbackMode = true;
        console.warn(
          `[Gemini] Schema non-compliance detected. Using fallback mode with fields: title="${
            title ? 'found' : 'missing'
          }", content="${translation ? 'found' : 'missing'}"`
        );
      } else {
        const availableFields = Object.keys(parsedJson).join(', ');
        throw new Error(
          `Invalid JSON structure in AI response. Expected 'translatedTitle'+'translation' or 'title'+'content', but found fields: ${availableFields}`
        );
      }
    }

    let fixedIllustrations: any[] = [];
    let fixedFootnotes: any[] = [];
    let fixedTranslation = translation!;

    if (!isFallbackMode) {
      const illustrationResult = validateAndFixIllustrations(translation!, parsedJson.suggestedIllustrations);
      const footnoteResult = validateAndFixFootnotes(
        illustrationResult.translation,
        parsedJson.footnotes,
        (settings.footnoteStrictMode as any) || 'append_missing'
      );
      fixedIllustrations = illustrationResult.suggestedIllustrations;
      fixedFootnotes = footnoteResult.footnotes;
      fixedTranslation = footnoteResult.translation;
    } else {
      console.warn('[Gemini] Fallback mode active: Skipping advanced processing');
      try {
        fixedIllustrations = Array.isArray(parsedJson.suggestedIllustrations) ? parsedJson.suggestedIllustrations : [];
        fixedFootnotes = Array.isArray(parsedJson.footnotes) ? parsedJson.footnotes : [];
      } catch {
        // ignore
      }
    }

    const sanitized = sanitiseTranslation(fixedTranslation);

    return {
      translatedTitle: title || '',
      translation: sanitized,
      proposal: parsedJson.proposal ?? null,
      footnotes: fixedFootnotes ?? [],
      suggestedIllustrations: fixedIllustrations ?? [],
      usageMetrics,
    };
  } catch (e: any) {
    console.error('[Gemini] JSON parse failed, attempting fallback extraction. Error:', e);
    const extracted = extractFirstBalancedJson(responseText);
    if (extracted) {
      try {
        const parsedJson = JSON.parse(extracted);
        const sanitized = sanitiseTranslation(parsedJson.translation || '');
        return {
          translatedTitle: parsedJson.translatedTitle || parsedJson.title || '',
          translation: sanitized,
          proposal: parsedJson.proposal ?? null,
          footnotes: parsedJson.footnotes ?? [],
          suggestedIllustrations: parsedJson.suggestedIllustrations ?? [],
          usageMetrics,
        };
      } catch (e2) {
        console.error('[Gemini] JSON block parse failed:', e2);
      }
    }

    if (responseText.length === 0) throw new Error('Translation failed: API returned empty response text.');
    if (!responseText.includes('{')) throw new Error('Translation failed: API response is not JSON format.');
    if (!responseText.includes('translatedTitle'))
      throw new Error('Translation failed: API response appears to be truncated or incomplete.');

    throw new Error(`Translation failed: AI returned malformed JSON. Error: ${e.message}`);
  }
};
