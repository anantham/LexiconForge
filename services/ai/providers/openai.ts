import OpenAI from 'openai';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import prompts from '@/config/prompts.json';
import appConfig from '@/config/app.json';
import { buildFanTranslationContext, formatHistory } from '@/services/prompts';
import { getEnvVar } from '@/services/env';
import { rateLimitService } from '@/services/rateLimitService';
import { supportsStructuredOutputs, supportsParameters } from '@/services/capabilityService';
import { openrouterService } from '@/services/openrouterService';
import { buildPreambleFromSettings } from '@/services/prompts/metadataPreamble';
import type { AppSettings, HistoricalChapter, TranslationResult, UsageMetrics } from '@/types';
import { getDefaultApiKey } from '@/services/defaultApiKeyService';
import { dlog, dlogFull, aiDebugEnabled } from '../debug';
import { calculateCost } from '../cost';
import { validateAndClampParameter } from '../parameters';
import { replacePlaceholders, extractBalancedJson } from '../textUtils';
import { validateAndFixIllustrations, validateAndFixFootnotes } from '../responseValidators';

const openaiResponseSchema = {
  type: 'object',
  properties: {
    translatedTitle: {
      type: 'string',
      description: '' + prompts.translatedTitleDescription,
    },
    translation: { type: 'string', description: '' + prompts.translationHtmlRules },
    footnotes: {
      type: ['array', 'null'],
      description: '' + prompts.footnotesDescription,
      items: {
        type: 'object',
        properties: {
          marker: { type: 'string', description: '' + prompts.footnoteMarkerDescription },
          text: { type: 'string', description: '' + prompts.footnoteTextDescription },
        },
        required: ['marker', 'text'],
        additionalProperties: false,
      },
    },
    suggestedIllustrations: {
      type: ['array', 'null'],
      description: '' + prompts.illustrationsDescription,
      items: {
        type: 'object',
        properties: {
          placementMarker: {
            type: 'string',
            description: '' + prompts.illustrationPlacementMarkerDescription,
          },
          imagePrompt: {
            type: 'string',
            description: '' + prompts.illustrationImagePromptDescription,
          },
        },
        required: ['placementMarker', 'imagePrompt'],
        additionalProperties: false,
      },
    },
    proposal: {
      type: ['object', 'null'],
      description: '' + prompts.proposalDescription,
      properties: {
        observation: { type: 'string', description: '' + prompts.proposalObservationDescription },
        currentRule: { type: 'string', description: '' + prompts.proposalCurrentRuleDescription },
        proposedChange: { type: 'string', description: '' + prompts.proposalProposedChangeDescription },
        reasoning: { type: 'string', description: '' + prompts.proposalReasoningDescription },
      },
      required: ['observation', 'currentRule', 'proposedChange', 'reasoning'],
      additionalProperties: false,
    },
  },
  required: ['translatedTitle', 'translation', 'footnotes', 'suggestedIllustrations', 'proposal'],
  additionalProperties: false,
};

const normalizeHtml = (text: string) => text.trim();

const isParameterError = (error: any): boolean =>
  error?.message?.includes('temperature') ||
  error?.message?.includes('top_p') ||
  error?.message?.includes('frequency_penalty') ||
  error?.message?.includes('presence_penalty') ||
  error?.message?.includes('seed') ||
  error?.message?.includes('not supported');

const removeAdvancedParameters = (requestOptions: any): any => {
  const cleaned = { ...requestOptions };
  ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'seed'].forEach(param => {
    delete cleaned[param];
  });
  return cleaned;
};

const stripMarkdownCodeFences = (text: string): string => {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
};

const seemsTruncated = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed.endsWith('}') && !trimmed.endsWith(']')) {
    dlog('Truncation detected: Response does not end with } or ]');
    return true;
  }

  const openBraces = (trimmed.match(/{/g) || []).length;
  const closeBraces = (trimmed.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    dlog('Truncation detected: Unbalanced braces', { openBraces, closeBraces });
    return true;
  }

  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    dlog('Truncation detected: Unbalanced brackets', { openBrackets, closeBrackets });
    return true;
  }

  return false;
};

const resolveApiKey = (settings: AppSettings): { apiKey?: string; baseURL?: string } => {
  let apiKey: string | undefined;
  let baseURL: string | undefined;

  switch (settings.provider) {
    case 'OpenAI':
      apiKey = settings.apiKeyOpenAI || getEnvVar('OPENAI_API_KEY');
      baseURL = 'https://api.openai.com/v1';
      break;
    case 'DeepSeek':
      apiKey = settings.apiKeyDeepSeek || getEnvVar('DEEPSEEK_API_KEY');
      baseURL = 'https://api.deepseek.com/v1';
      break;
    case 'OpenRouter': {
      const userKey = (settings as any).apiKeyOpenRouter;
      const envKey = getEnvVar('OPENROUTER_API_KEY');
      const trialKey = getDefaultApiKey();
      apiKey = userKey || envKey || trialKey || undefined;
      baseURL = 'https://openrouter.ai/api/v1';
      console.log('[OpenRouter] API Key Priority Check:', {
        hasUserKey: !!userKey,
        hasEnvKey: !!envKey,
        hasTrialKey: !!trialKey,
        usingSource: userKey ? 'user_settings' : envKey ? 'env_var' : trialKey ? 'trial_key' : 'none',
        finalKeyAvailable: !!apiKey,
      });
      break;
    }
    default:
      throw new Error(`Unsupported provider: ${settings.provider}`);
  }

  return { apiKey, baseURL };
};

const trackActualParams = (requestOptions: any, settings: AppSettings): UsageMetrics['actualParams'] | undefined => {
  const actualParams: UsageMetrics['actualParams'] = {};
  if (requestOptions.temperature !== undefined) actualParams.temperature = requestOptions.temperature;
  if (requestOptions.top_p !== undefined) actualParams.topP = requestOptions.top_p;
  if (requestOptions.frequency_penalty !== undefined)
    actualParams.frequencyPenalty = requestOptions.frequency_penalty;
  if (requestOptions.presence_penalty !== undefined)
    actualParams.presencePenalty = requestOptions.presence_penalty;
  if (requestOptions.seed !== undefined) actualParams.seed = requestOptions.seed;
  if (settings.maxOutputTokens && settings.maxOutputTokens > 0) {
    actualParams.maxOutputTokens = settings.maxOutputTokens;
  }
  return Object.keys(actualParams).length > 0 ? actualParams : undefined;
};

export const translateWithOpenAI = async (
  title: string,
  content: string,
  settings: AppSettings,
  history: HistoricalChapter[],
  fanTranslation?: string | null,
  abortSignal?: AbortSignal
): Promise<TranslationResult> => {
  const { apiKey, baseURL } = resolveApiKey(settings);
  if (!apiKey) throw new Error(`${settings.provider} API key is missing. Please add it in the settings.`);

  const startTime = performance.now();
  const openai = new OpenAI({ apiKey, baseURL, dangerouslyAllowBrowser: true });

  if (!settings.systemPrompt) {
    if (aiDebugEnabled()) console.error('[OpenAI DIAGNOSTIC] System prompt is null/undefined!');
    throw new Error('System prompt cannot be empty for OpenAI translation');
  }

  await rateLimitService.canMakeRequest(settings.model);

  const hasStructuredOutputs = await supportsStructuredOutputs(settings.provider, settings.model);
  const preamble = buildPreambleFromSettings(settings);
  let systemPrompt = replacePlaceholders(`${settings.systemPrompt}\n\n${preamble}`, settings);

  const requestOptions: any = { model: settings.model };
  const parameterSupport = await Promise.all([
    supportsParameters(settings.provider, settings.model, ['temperature']),
    supportsParameters(settings.provider, settings.model, ['top_p']),
    supportsParameters(settings.provider, settings.model, ['frequency_penalty']),
    supportsParameters(settings.provider, settings.model, ['presence_penalty']),
    supportsParameters(settings.provider, settings.model, ['seed']),
  ]);

  const [supportsTemperature, supportsTopP, supportsFreqPen, supportsPresPen, supportsSeed] = parameterSupport;

  if (hasStructuredOutputs) {
    requestOptions.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'translation_response',
        schema: openaiResponseSchema,
        strict: true,
      },
    };
    if (settings.provider === 'OpenRouter') {
      requestOptions.provider = { require_parameters: true };
    }
  } else {
    requestOptions.response_format = { type: 'json_object' };
    if (!systemPrompt.toLowerCase().includes('json')) {
      systemPrompt += `\n\nYour response must be a single, valid JSON object.`;
      dlog('[OpenAI] Injected JSON requirement into system prompt for json_object mode.');
    }
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  if (settings.provider === 'DeepSeek') {
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
  const preface =
    prompts.translatePrefix +
    (fanTranslation ? prompts.translateFanSuffix : '') +
    prompts.translateInstruction +
    prompts.translateTitleGuidance;
  const finalUserContent = `${fanTranslationContext}${fanTranslationContext ? '\n\n' : ''}${preface}\n\n${
    prompts.translateTitleLabel
  }\n${title}\n\n${prompts.translateContentLabel}\n${content}`;
  messages.push({ role: 'user', content: finalUserContent });

  requestOptions.messages = messages;

  const modelsThatUseMaxCompletionTokens = ['claude', 'gpt-5'];
  const useMaxCompletionTokens = modelsThatUseMaxCompletionTokens.some(p => settings.model.startsWith(p));

  if (supportsTemperature && settings.temperature !== appConfig.aiParameters.defaults.temperature) {
    requestOptions.temperature = validateAndClampParameter(settings.temperature, 'temperature');
  }
  if (supportsTopP && settings.topP !== undefined && settings.topP !== appConfig.aiParameters.defaults.top_p) {
    requestOptions.top_p = validateAndClampParameter(settings.topP, 'top_p');
  }
  if (
    supportsFreqPen &&
    settings.frequencyPenalty !== undefined &&
    settings.frequencyPenalty !== appConfig.aiParameters.defaults.frequency_penalty
  ) {
    requestOptions.frequency_penalty = validateAndClampParameter(settings.frequencyPenalty, 'frequency_penalty');
  }
  if (
    supportsPresPen &&
    settings.presencePenalty !== undefined &&
    settings.presencePenalty !== appConfig.aiParameters.defaults.presence_penalty
  ) {
    requestOptions.presence_penalty = validateAndClampParameter(settings.presencePenalty, 'presence_penalty');
  }
  if (supportsSeed && settings.seed !== undefined && settings.seed !== null) {
    requestOptions.seed = validateAndClampParameter(settings.seed, 'seed');
  }

  if (settings.maxOutputTokens && settings.maxOutputTokens > 0) {
    if (useMaxCompletionTokens) {
      requestOptions.max_completion_tokens = settings.maxOutputTokens;
    } else {
      requestOptions.max_tokens = settings.maxOutputTokens;
    }
  }

  if (settings.provider === 'OpenRouter') {
    try {
      const config = await import('@/config/app.json');
      const extraHeaders: Record<string, string> = {};
      if (config.openrouter?.referer) extraHeaders['HTTP-Referer'] = config.openrouter.referer;
      if (config.openrouter?.title) extraHeaders['X-Title'] = config.openrouter.title;
      if (Object.keys(extraHeaders).length > 0) {
        requestOptions.extra_headers = extraHeaders;
      }
    } catch {
      dlog('[OpenRouter] Config file not found, skipping optional headers');
    }
  }

  dlog(`[OpenAI] Request options:`, JSON.stringify(requestOptions, null, 2));

  let response: ChatCompletion;
  try {
    if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
    response = await (abortSignal
      ? openai.chat.completions.create(requestOptions, { signal: abortSignal })
      : openai.chat.completions.create(requestOptions));
  } catch (error: any) {
    if (isParameterError(error)) {
      dlog('Parameter error detected, retrying without advanced parameters');
      const simpleOptions = removeAdvancedParameters(requestOptions);
      response = await (abortSignal
        ? openai.chat.completions.create(simpleOptions, { signal: abortSignal })
        : openai.chat.completions.create(simpleOptions));
    } else {
      throw error;
    }
  }

  const endTime = performance.now();

  dlogFull('[OpenAI] Full response body:', JSON.stringify(response, null, 2));

  const choice = response.choices?.[0];
  const finishReason = choice?.finish_reason || (choice as any)?.native_finish_reason || null;
  const responseText = choice?.message?.content;
  if (!responseText) {
    throw new Error('Empty response from API');
  }

  dlogFull('Raw response text:', responseText.substring(0, 500));

  if (finishReason === 'length' || seemsTruncated(responseText)) {
    throw new Error('length_cap: Model hit token limit. Increase max_tokens or reduce output size.');
  }

  const cleanedText = stripMarkdownCodeFences(responseText);
  let parsedResponse: any;

  try {
    parsedResponse = JSON.parse(cleanedText);
  } catch (initialError) {
    dlog('Initial parse failed, attempting balanced JSON extraction');
    const extracted = extractBalancedJson(cleanedText);
    if (extracted) {
      parsedResponse = JSON.parse(extracted);
    } else {
      throw new Error(`Failed to parse JSON response (no balanced JSON found): ${responseText.substring(0, 200)}...`);
    }
  }

  const promptTokens = response.usage?.prompt_tokens || 0;
  const completionTokens = response.usage?.completion_tokens || 0;
  const costUsd = await calculateCost(settings.model, promptTokens, completionTokens);
  const requestTime = (endTime - startTime) / 1000;

  const usageMetrics: UsageMetrics = {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCost: costUsd,
    requestTime,
    provider: settings.provider,
    model: settings.model,
    actualParams: trackActualParams(requestOptions, settings),
  };

  if (settings.provider === 'OpenRouter') {
    try {
      await openrouterService.setLastUsed(settings.model);
    } catch {
      // ignore
    }
  }

  const { translation: illustrationAdjusted, suggestedIllustrations } = validateAndFixIllustrations(
    parsedResponse.translation || '',
    parsedResponse.suggestedIllustrations
  );
  const { translation: footnoteAdjusted, footnotes } = validateAndFixFootnotes(
    illustrationAdjusted,
    parsedResponse.footnotes,
    (settings.footnoteStrictMode as any) || 'append_missing'
  );

  return {
    translatedTitle: parsedResponse.translatedTitle || '',
    translation: normalizeHtml(footnoteAdjusted),
    suggestedIllustrations: suggestedIllustrations || [],
    proposal: parsedResponse.proposal || null,
    footnotes: footnotes || [],
    usageMetrics,
  };
};
