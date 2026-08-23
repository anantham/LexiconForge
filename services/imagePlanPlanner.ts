import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI, Type } from '@google/genai';
import type { GenerateContentParameters, Schema } from '@google/genai';
import OpenAI from 'openai';

import prompts from '../config/prompts.json';
import type { AppSettings, ImagePlan } from '../types';
import {
  getConfiguredApiKey,
  getOpenAICompatibleConfig,
} from './ai/providerCredentials';
import { extractBalancedJson, replacePlaceholders } from './ai/textUtils';
import { getChatCompletionRequestParameters } from './ai/openaiRequestParameters';
import { shouldRequestStructuredOutputs } from './ai/structuredOutputPolicy';
import { buildImagePlanFromCaption, normalizeImagePlan } from './imagePlanService';
import { buildOpenRouterRouting } from './openrouterRouting';

export interface PlannedIllustration {
  imagePrompt: string;
  imagePlan: ImagePlan;
  source: 'model' | 'fallback';
  warning?: string;
}

interface PlannerRequest {
  settings: AppSettings;
  userPrompt: string;
  fallbackCaption: string;
}

const PLANNER_TEMPERATURE = 0.4;
const MAX_CONTEXT_CHARS = 2400;
const MAX_PLANNER_TOKENS = 4096;

const plannerResponseSchema = {
  type: 'object',
  properties: {
    imagePrompt: {
      type: 'string',
      description: '' + prompts.illustrationImagePromptDescription,
    },
    imagePlan: {
      type: 'object',
      description: '' + prompts.illustrationImagePlanDescription,
      properties: {
        subject: { type: 'string', description: '' + prompts.illustrationPlanSubjectDescription },
        characters: {
          type: 'array',
          description: '' + prompts.illustrationPlanCharactersDescription,
          items: { type: 'string' },
        },
        scene: { type: 'string', description: '' + prompts.illustrationPlanSceneDescription },
        composition: { type: 'string', description: '' + prompts.illustrationPlanCompositionDescription },
        camera: { type: 'string', description: '' + prompts.illustrationPlanCameraDescription },
        lighting: { type: 'string', description: '' + prompts.illustrationPlanLightingDescription },
        style: { type: 'string', description: '' + prompts.illustrationPlanStyleDescription },
        mood: { type: 'string', description: '' + prompts.illustrationPlanMoodDescription },
        details: {
          type: 'array',
          description: '' + prompts.illustrationPlanDetailsDescription,
          items: { type: 'string' },
        },
        mustKeep: {
          type: 'array',
          description: '' + prompts.illustrationPlanMustKeepDescription,
          items: { type: 'string' },
        },
        avoid: {
          type: 'array',
          description: '' + prompts.illustrationPlanAvoidDescription,
          items: { type: 'string' },
        },
        negativePrompt: {
          type: 'array',
          description: '' + prompts.illustrationPlanNegativePromptDescription,
          items: { type: 'string' },
        },
      },
      required: ['subject', 'characters', 'scene', 'composition', 'camera', 'lighting', 'style', 'mood', 'details', 'mustKeep', 'avoid', 'negativePrompt'],
      additionalProperties: false,
    },
  },
  required: ['imagePrompt', 'imagePlan'],
  additionalProperties: false,
} as const;

// Typed as the SDK's Schema (not `as const`) so tsc verifies this is a shape the SDK's
// responseSchema field actually accepts — the cast that hid the inert-config bug is gone.
const geminiPlannerResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    imagePrompt: { type: Type.STRING, description: '' + prompts.illustrationImagePromptDescription },
    imagePlan: {
      type: Type.OBJECT,
      description: '' + prompts.illustrationImagePlanDescription,
      properties: {
        subject: { type: Type.STRING, description: '' + prompts.illustrationPlanSubjectDescription },
        characters: {
          type: Type.ARRAY,
          description: '' + prompts.illustrationPlanCharactersDescription,
          items: { type: Type.STRING },
        },
        scene: { type: Type.STRING, description: '' + prompts.illustrationPlanSceneDescription },
        composition: { type: Type.STRING, description: '' + prompts.illustrationPlanCompositionDescription },
        camera: { type: Type.STRING, description: '' + prompts.illustrationPlanCameraDescription },
        lighting: { type: Type.STRING, description: '' + prompts.illustrationPlanLightingDescription },
        style: { type: Type.STRING, description: '' + prompts.illustrationPlanStyleDescription },
        mood: { type: Type.STRING, description: '' + prompts.illustrationPlanMoodDescription },
        details: {
          type: Type.ARRAY,
          description: '' + prompts.illustrationPlanDetailsDescription,
          items: { type: Type.STRING },
        },
        mustKeep: {
          type: Type.ARRAY,
          description: '' + prompts.illustrationPlanMustKeepDescription,
          items: { type: Type.STRING },
        },
        avoid: {
          type: Type.ARRAY,
          description: '' + prompts.illustrationPlanAvoidDescription,
          items: { type: Type.STRING },
        },
        negativePrompt: {
          type: Type.ARRAY,
          description: '' + prompts.illustrationPlanNegativePromptDescription,
          items: { type: Type.STRING },
        },
      },
      required: ['subject', 'characters', 'scene', 'composition', 'camera', 'lighting', 'style', 'mood', 'details', 'mustKeep', 'avoid', 'negativePrompt'],
    },
  },
  required: ['imagePrompt', 'imagePlan'],
};

const cleanText = (value: string | null | undefined, fallback = ''): string => {
  const trimmed = value?.trim() || '';
  return trimmed || fallback;
};

const stripHtml = (text: string): string =>
  text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildPlanningContext = (context: string | null | undefined): string => {
  const normalized = cleanText(stripHtml(context || ''));
  return normalized.length > MAX_CONTEXT_CHARS
    ? `${normalized.slice(0, MAX_CONTEXT_CHARS)}…`
    : normalized || '';
};

const normalizePlannerPayload = (
  raw: unknown,
  fallbackCaption: string
): PlannedIllustration => {
  const payload = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const imagePrompt = cleanText(payload.imagePrompt as string | undefined, fallbackCaption || 'Scene illustration');
  const imagePlan = normalizeImagePlan(payload.imagePlan, imagePrompt || fallbackCaption);

  return {
    imagePrompt,
    imagePlan,
    source: 'model',
  };
};

const buildFallbackPlan = (caption: string, warning: string): PlannedIllustration => ({
  imagePrompt: cleanText(caption, 'Scene illustration'),
  imagePlan: buildImagePlanFromCaption(caption),
  source: 'fallback',
  warning,
});

const parsePlannerJson = (text: string, fallbackCaption: string): PlannedIllustration =>
  normalizePlannerPayload(JSON.parse(extractBalancedJson(text)), fallbackCaption);

const extractOpenAIText = (content: unknown): string => {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && (part as any).type === 'text' && typeof (part as any).text === 'string') {
        return (part as any).text;
      }
      return '';
    })
    .join('\n')
    .trim();
};

const extractGeminiText = (response: any): string => {
  if (typeof response?.text === 'string' && response.text.trim()) {
    return response.text.trim();
  }

  const parts = response?.candidates?.flatMap((candidate: any) => candidate?.content?.parts || []) || [];
  return parts
    .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
    .join('\n')
    .trim();
};

const extractClaudeText = (response: any): string =>
  (response?.content || [])
    .map((part: any) => (part?.type === 'text' ? part.text : ''))
    .join('\n')
    .trim();

const plannerMaxTokens = (settings: AppSettings): number =>
  Math.max(256, Math.min(settings.maxOutputTokens ?? 2048, MAX_PLANNER_TOKENS));

const resolveOpenAICompatibleCredentials = (settings: AppSettings): { apiKey?: string; baseURL?: string } => {
  switch (settings.provider) {
    case 'OpenAI':
    case 'DeepSeek':
    case 'OpenRouter':
      return getOpenAICompatibleConfig(settings, settings.provider);
    default:
      return {};
  }
};

const requestViaOpenAICompatible = async (
  request: PlannerRequest
): Promise<PlannedIllustration> => {
  const { settings, userPrompt, fallbackCaption } = request;
  const { apiKey, baseURL } = resolveOpenAICompatibleCredentials(settings);
  if (!apiKey || !baseURL) {
    throw new Error(`${settings.provider} API key is missing for illustration planning.`);
  }

  const client = new OpenAI({ apiKey, baseURL, dangerouslyAllowBrowser: true });
  const supportsSchema = shouldRequestStructuredOutputs(settings.provider);
  const requestParameters = getChatCompletionRequestParameters(
    settings.provider,
    settings.model,
    plannerMaxTokens(settings),
    { temperature: PLANNER_TEMPERATURE }
  );
  const messages = [
    {
      role: 'system' as const,
      content: replacePlaceholders(prompts.imagePlanPlannerSystemPrompt, settings),
    },
    {
      role: 'user' as const,
      content: userPrompt,
    },
  ];
  const schemaGuidedMessages = messages.map((message, index) => index === 0
    ? {
        ...message,
        content: `${message.content}\n\nReturn one JSON object matching this schema:\n${JSON.stringify(plannerResponseSchema, null, 2)}`,
      }
    : message);

  const requestBody: Record<string, unknown> = {
    model: settings.model,
    messages: supportsSchema ? messages : schemaGuidedMessages,
    ...requestParameters,
  };
  if (settings.provider === 'OpenRouter') {
    requestBody.provider = buildOpenRouterRouting(settings, 'text');
  }

  if (supportsSchema) {
    requestBody.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'illustration_plan',
        strict: true,
        schema: plannerResponseSchema,
      },
    };
  } else {
    requestBody.response_format = { type: 'json_object' };
  }

  try {
    const response = await client.chat.completions.create(requestBody as any);
    return parsePlannerJson(
      extractOpenAIText(response?.choices?.[0]?.message?.content),
      fallbackCaption
    );
  } catch (error) {
    console.warn('[ImagePlanPlanner] OpenAI-compatible planner call failed, retrying without response_format.', {
      provider: settings.provider,
      model: settings.model,
      error,
    });

    const fallbackResponse = await client.chat.completions.create({
      model: settings.model,
      messages: schemaGuidedMessages,
      ...requestParameters,
      ...(settings.provider === 'OpenRouter'
        ? { provider: buildOpenRouterRouting(settings, 'text') }
        : {}),
    });

    return parsePlannerJson(
      extractOpenAIText(fallbackResponse?.choices?.[0]?.message?.content),
      fallbackCaption
    );
  }
};

const requestViaGemini = async (
  request: PlannerRequest
): Promise<PlannedIllustration> => {
  const apiKey = getConfiguredApiKey(request.settings, 'Gemini');
  if (!apiKey) {
    throw new Error('Gemini API key is missing for illustration planning.');
  }

  const ai = new GoogleGenAI({ apiKey });
  // The @google/genai SDK wants { model, contents, config: {...} }. This used to pass
  // systemInstruction and a `generationConfig` at the TOP level behind an `(ai as any)` cast —
  // the SDK silently ignored both, so the planner ran with no system prompt, default
  // temperature, no JSON mime type and no schema (sibling imageService.ts generateImages call
  // had the correct { config } shape all along). Typed request, no cast: tsc now checks it.
  const baseRequest: GenerateContentParameters = {
    model: request.settings.model,
    contents: [{ role: 'user', parts: [{ text: request.userPrompt }] }],
    config: {
      systemInstruction: replacePlaceholders(prompts.imagePlanPlannerSystemPrompt, request.settings),
      temperature: PLANNER_TEMPERATURE,
      responseMimeType: 'application/json',
      responseSchema: geminiPlannerResponseSchema,
      maxOutputTokens: plannerMaxTokens(request.settings),
    },
  };

  try {
    const response = await ai.models.generateContent(baseRequest);
    return parsePlannerJson(extractGeminiText(response), request.fallbackCaption);
  } catch (error) {
    console.warn('[ImagePlanPlanner] Gemini planner call failed, retrying without schema.', {
      model: request.settings.model,
      error,
    });

    // The schema now actually reaches the SDK, so a schema rejection is a real failure mode
    // again: retry drops the responseSchema but keeps the system prompt and JSON mime type.
    const fallbackResponse = await ai.models.generateContent({
      ...baseRequest,
      config: {
        ...baseRequest.config,
        responseSchema: undefined,
      },
    });

    return parsePlannerJson(extractGeminiText(fallbackResponse), request.fallbackCaption);
  }
};

const requestViaClaude = async (
  request: PlannerRequest
): Promise<PlannedIllustration> => {
  const apiKey = getConfiguredApiKey(request.settings, 'Claude');
  if (!apiKey) {
    throw new Error('Claude API key is missing for illustration planning.');
  }

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const prompt = `${replacePlaceholders(prompts.imagePlanPlannerSystemPrompt, request.settings)}\n\n${request.userPrompt}`;
  const response = await client.messages.create({
    model: request.settings.model,
    max_tokens: plannerMaxTokens(request.settings),
    temperature: Math.max(0, Math.min(1, PLANNER_TEMPERATURE)),
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: prompt }],
      },
    ],
  });

  return parsePlannerJson(extractClaudeText(response), request.fallbackCaption);
};

const requestPlannedIllustration = async (
  request: PlannerRequest
): Promise<PlannedIllustration> => {
  switch (request.settings.provider) {
    case 'OpenAI':
    case 'DeepSeek':
    case 'OpenRouter':
      return requestViaOpenAICompatible(request);
    case 'Gemini':
      return requestViaGemini(request);
    case 'Claude':
      return requestViaClaude(request);
    default:
      throw new Error(`Unsupported provider for illustration planning: ${request.settings.provider}`);
  }
};

const requestPlannedIllustrationWithFallback = async (
  request: PlannerRequest
): Promise<PlannedIllustration> => {
  try {
    return await requestPlannedIllustration(request);
  } catch (error) {
    const warning = error instanceof Error ? error.message : 'Planner request failed; using caption-derived fallback.';
    console.warn('[ImagePlanPlanner] Falling back to caption-derived plan.', {
      provider: request.settings.provider,
      model: request.settings.model,
      caption: request.fallbackCaption,
      error,
    });
    return buildFallbackPlan(request.fallbackCaption, warning);
  }
};

export const generateImagePlanFromCaption = async (
  caption: string,
  settings: AppSettings,
  options?: { context?: string | null }
): Promise<PlannedIllustration> => {
  const fallbackCaption = cleanText(caption, 'Scene illustration');
  const userPrompt = prompts.imagePlanFromCaptionPrompt
    .replace('{{caption}}', fallbackCaption)
    .replace('{{context}}', buildPlanningContext(options?.context));

  return requestPlannedIllustrationWithFallback({
    settings,
    userPrompt,
    fallbackCaption,
  });
};

export const generateIllustrationFromSelection = async (
  selection: string,
  context: string,
  settings: AppSettings
): Promise<PlannedIllustration> => {
  const fallbackCaption = cleanText(selection, 'Scene illustration');
  const userPrompt = prompts.imagePromptFromSelection
    .replace('{{context}}', buildPlanningContext(context))
    .replace('{{selection}}', fallbackCaption);

  return requestPlannedIllustrationWithFallback({
    settings,
    userPrompt,
    fallbackCaption,
  });
};
