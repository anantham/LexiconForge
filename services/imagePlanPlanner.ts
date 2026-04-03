import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI, Type } from '@google/genai';
import OpenAI from 'openai';

import prompts from '../config/prompts.json';
import type { AppSettings, ImagePlan } from '../types';
import { supportsStructuredOutputs } from './capabilityService';
import { getDefaultApiKey } from './defaultApiKeyService';
import { getEnvVar } from './env';
import { extractBalancedJson, replacePlaceholders } from './ai/textUtils';
import { buildImagePlanFromCaption, normalizeImagePlan } from './imagePlanService';

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

const geminiPlannerResponseSchema = {
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
} as const;

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
      return {
        apiKey: settings.apiKeyOpenAI || getEnvVar('OPENAI_API_KEY'),
        baseURL: 'https://api.openai.com/v1',
      };
    case 'DeepSeek':
      return {
        apiKey: settings.apiKeyDeepSeek || getEnvVar('DEEPSEEK_API_KEY'),
        baseURL: 'https://api.deepseek.com/v1',
      };
    case 'OpenRouter':
      return {
        apiKey: settings.apiKeyOpenRouter || getEnvVar('OPENROUTER_API_KEY') || getDefaultApiKey() || undefined,
        baseURL: 'https://openrouter.ai/api/v1',
      };
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
  const supportsSchema = await supportsStructuredOutputs(settings.provider, settings.model);
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

  const requestBody: Record<string, unknown> = {
    model: settings.model,
    messages,
    temperature: PLANNER_TEMPERATURE,
    max_tokens: plannerMaxTokens(settings),
  };

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
    if (settings.provider === 'OpenRouter') {
      requestBody.provider = { require_parameters: true };
    }
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
      messages,
      temperature: PLANNER_TEMPERATURE,
      max_tokens: plannerMaxTokens(settings),
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
  const apiKey = request.settings.apiKeyGemini || getEnvVar('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('Gemini API key is missing for illustration planning.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const baseRequest = {
    model: request.settings.model,
    contents: [{ role: 'user', parts: [{ text: request.userPrompt }] }],
    systemInstruction: replacePlaceholders(prompts.imagePlanPlannerSystemPrompt, request.settings),
    generationConfig: {
      temperature: PLANNER_TEMPERATURE,
      responseMimeType: 'application/json',
      responseSchema: geminiPlannerResponseSchema,
      maxOutputTokens: plannerMaxTokens(request.settings),
    },
  } as const;

  try {
    const response = await (ai as any).models.generateContent(baseRequest);
    return parsePlannerJson(extractGeminiText(response), request.fallbackCaption);
  } catch (error) {
    console.warn('[ImagePlanPlanner] Gemini planner call failed, retrying without schema.', {
      model: request.settings.model,
      error,
    });

    const fallbackResponse = await (ai as any).models.generateContent({
      ...baseRequest,
      generationConfig: {
        ...baseRequest.generationConfig,
        responseSchema: undefined,
      },
    });

    return parsePlannerJson(extractGeminiText(fallbackResponse), request.fallbackCaption);
  }
};

const requestViaClaude = async (
  request: PlannerRequest
): Promise<PlannedIllustration> => {
  const apiKey = request.settings.apiKeyClaude || getEnvVar('CLAUDE_API_KEY');
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

export const generateImagePlanFromCaption = async (
  caption: string,
  settings: AppSettings,
  options?: { context?: string | null }
): Promise<PlannedIllustration> => {
  const fallbackCaption = cleanText(caption, 'Scene illustration');
  const userPrompt = prompts.imagePlanFromCaptionPrompt
    .replace('{{caption}}', fallbackCaption)
    .replace('{{context}}', buildPlanningContext(options?.context));

  try {
    return await requestPlannedIllustration({
      settings,
      userPrompt,
      fallbackCaption,
    });
  } catch (error) {
    const warning = error instanceof Error ? error.message : 'Planner request failed; using caption-derived fallback.';
    console.warn('[ImagePlanPlanner] Falling back to caption-derived plan.', {
      provider: settings.provider,
      model: settings.model,
      caption: fallbackCaption,
      error,
    });
    return buildFallbackPlan(fallbackCaption, warning);
  }
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

  return requestPlannedIllustration({
    settings,
    userPrompt,
    fallbackCaption,
  });
};
