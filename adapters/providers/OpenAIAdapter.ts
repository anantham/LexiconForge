import OpenAI from 'openai';
import type { TranslationProvider, TranslationRequest } from '../../services/translate/Translator';
import type { ChatRequest, ChatResponse, Provider, ProviderName } from './Provider';
import type { TranslationResult, AppSettings, HistoricalChapter, UsageMetrics } from '../../types';
import { getStructuredOutputsSupport, supportsParameters, recordParameterFailure, hasRecordedParameterFailure } from '../../services/capabilityService';
import type { StructuredOutputsSupport } from '../../services/capabilityService';
import { rateLimitService } from '../../services/rateLimitService';
import { calculateCost } from '../../services/ai/cost';
import prompts from '../../config/prompts.json';
import appConfig from '../../config/app.json';
import { buildFanTranslationContext, formatHistory } from '../../services/prompts';
import { getOpenAICompatibleConfig } from '../../services/ai/providerCredentials';
import { getTranslationOnlyResponseJsonSchema } from '../../services/translate/translationResponseSchema';
import { getTranslationSystemPrompt } from '../../utils/promptUtils';
import { apiMetricsService } from '../../services/apiMetricsService';
import { extractBalancedJson, replacePlaceholders } from '../../services/ai/textUtils';
import { validateAndClampParameter } from '../../services/ai/parameters';
import { toOpenAIStrictSchema, needsOpenAIStrictSchema } from '../../services/ai/openaiStrictSchema';
import {
  getChatCompletionRequestParameters,
  getChatCompletionTemperature,
  getChatCompletionTokenLimit,
} from '../../services/ai/openaiRequestParameters';

// Debug logging
const dlog = (message: string, ...args: any[]) => {
  try {
    const lvl = localStorage.getItem('LF_AI_DEBUG_LEVEL');
    if (lvl === 'summary' || lvl === 'full') {
      console.log(`[OpenAI] ${message}`, ...args);
    }
  } catch {}
};
const dlogFull = (message: string, ...args: any[]) => {
  try {
    const lvl = localStorage.getItem('LF_AI_DEBUG_LEVEL');
    if (lvl === 'full') {
      console.log(`[OpenAI] ${message}`, ...args);
    }
  } catch {}
};

export class OpenAIAdapter implements TranslationProvider, Provider {
  name: ProviderName;

  constructor(providerName: ProviderName = 'OpenRouter') {
    this.name = providerName;
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const { title, content, settings, history, fanTranslation, abortSignal, chapterId } = request;

    // Configure API client
    const apiConfig = this.getApiConfig(settings);
    const client = new OpenAI({
      apiKey: apiConfig.apiKey,
      baseURL: apiConfig.baseURL,
      dangerouslyAllowBrowser: true
    });

    // Check rate limits
    await rateLimitService.acquireRequestSlot(settings.model);

    // Build request
    const requestOptions = await this.buildRequest(settings, title, content, history, fanTranslation);

    dlog('Making API request', { model: settings.model, provider: settings.provider });
    dlogFull('Full request body:', JSON.stringify(requestOptions, null, 2));

    const startTime = performance.now();
    let response: OpenAI.Chat.Completions.ChatCompletion;

    try {
      // Make API call with abort signal
      response = await (abortSignal
        ? client.chat.completions.create(requestOptions, { signal: abortSignal })
        : client.chat.completions.create(requestOptions));

    } catch (error: any) {
      // Handle parameter errors by retrying without unsupported parameters
      if (this.isParameterError(error)) {
        const errorMsg = (error.message || '').toLowerCase();
        dlog('Parameter error detected, retrying without advanced parameters', errorMsg);
        
        // Record which parameter failed so we don't try it again for this model
        ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'seed'].forEach(param => {
          if (errorMsg.includes(param)) {
            recordParameterFailure(settings.model, param);
          }
        });

        const simpleOptions = this.removeAdvancedParameters(requestOptions);
        response = await (abortSignal
          ? client.chat.completions.create(simpleOptions, { signal: abortSignal })
          : client.chat.completions.create(simpleOptions));
      } else {
        // Same "No endpoints found" class as chatJSON: OpenRouter's routing 404 names no
        // parameter, so isParameterError above can never match it. Retry once without
        // require_parameters when that's what filtered every endpoint out.
        const noEndpointsRetryOptions = this.isNoEndpointsError(error?.message || '')
          ? this.withoutRequireParameters(requestOptions)
          : null;
        if (noEndpointsRetryOptions) {
          console.warn(
            `[OpenAI] OpenRouter found no endpoints for ${settings.model} with require_parameters — retrying once ` +
            `WITHOUT require_parameters. The serving endpoint may silently ignore requested parameters on this retry.`
          );
          recordParameterFailure(settings.model, 'require_parameters');
          response = await (abortSignal
            ? client.chat.completions.create(noEndpointsRetryOptions, { signal: abortSignal })
            : client.chat.completions.create(noEndpointsRetryOptions));
        } else {
          dlogFull('Full error response:', JSON.stringify(error, null, 2));

          // Record failed API call
          const endTime = performance.now();
          const promptTokens = 0; // Unknown on failure
          const completionTokens = 0;
          const costUsd = 0;

          await apiMetricsService.recordMetric({
            apiType: 'translation',
            provider: settings.provider,
            model: settings.model,
            costUsd,
            tokens: {
              prompt: promptTokens,
              completion: completionTokens,
              total: promptTokens + completionTokens,
            },
            chapterId,
            success: false,
            errorMessage: error.message || 'Unknown error',
          });

          throw error;
        }
      }
    }

    const endTime = performance.now();

    // Process response
    dlogFull('Full response body:', JSON.stringify(response, null, 2));
    return this.processResponse(response, settings, startTime, endTime, chapterId, content.length);
  }

  async chatJSON(input: ChatRequest): Promise<ChatResponse> {
    const settings = input.settings;
    if (!settings) {
      throw new Error('chatJSON requires settings');
    }

    const model = input.model || settings.model;
    const messages = input.messages?.length
      ? input.messages
      : [
          ...(input.system ? [{ role: 'system' as const, content: input.system }] : []),
          ...(input.user ? [{ role: 'user' as const, content: input.user }] : []),
        ];

    if (!messages.length) {
      throw new Error('chatJSON requires at least one message');
    }

    // Configure API client
    const apiConfig = this.getApiConfig(settings);
    const client = new OpenAI({
      apiKey: apiConfig.apiKey,
      baseURL: apiConfig.baseURL,
      dangerouslyAllowBrowser: true
    });

    // Check rate limits
    await rateLimitService.acquireRequestSlot(model);

    const maxTokens = input.maxTokens ?? settings.maxOutputTokens ?? 16384;

    const temperature = validateAndClampParameter(
      input.temperature ?? settings.temperature ?? 0.2,
      'temperature'
    );
    const requestOptions: any = {
      model,
      messages,
      ...await getChatCompletionRequestParameters(
        settings.provider,
        model,
        maxTokens,
        temperature
      ),
    };

    // When the caller doesn't pin structuredOutputs, ask the capability service — with
    // provenance, because a `false` that came from a fetch failure (not metadata) means the
    // downgrade below is a guess against a paid request and must be logged (integrity item 1).
    let structuredSupport: StructuredOutputsSupport | null = null;
    let hasStructuredOutputs: boolean;
    if (!input.schema) {
      hasStructuredOutputs = false;
    } else if (input.structuredOutputs !== undefined) {
      hasStructuredOutputs = Boolean(input.structuredOutputs);
    } else {
      structuredSupport = await getStructuredOutputsSupport(settings.provider, model);
      hasStructuredOutputs = structuredSupport.supported;
    }

    if (hasStructuredOutputs && input.schema) {
      // OpenAI's strict json_schema validator speaks a stricter dialect
      // (every property required, additionalProperties:false, null-unions for
      // optionality; open maps like `ripples` are inexpressible and DROPPED).
      // Apply the transform only when the request actually targets OpenAI's
      // validator: the direct OpenAI provider, or an OpenRouter openai/* slug.
      // Previously only the benchmark applied this — the production compile
      // pipeline sent untransformed schemas.
      const targetsOpenAI = settings.provider === 'OpenAI' || needsOpenAIStrictSchema(model);
      requestOptions.response_format = {
        type: 'json_schema',
        json_schema: {
          name: input.schemaName || 'sutta_studio_response',
          schema: targetsOpenAI ? toOpenAIStrictSchema(input.schema) : input.schema,
          strict: true,
        },
      };
      if (settings.provider === 'OpenRouter') {
        // Honor the learned failure: once "No endpoints found" taught us this
        // model can't route with require_parameters, don't send it again.
        const rp = !hasRecordedParameterFailure(model, 'require_parameters');
        if (!rp) {
          dlog(`Omitting require_parameters for ${model} (learned failure this session)`);
        }
        requestOptions.provider = {
          ...(rp ? { require_parameters: true } : {}),
          ...input.providerPreferences,
        };
      }
    } else {
      // Downgrading to json_object is only legitimate when METADATA says the model lacks
      // structured outputs. When the capability answer was itself a failure-default, this paid
      // request is being silently weakened on a guess — log it, with the model id.
      if (input.schema && structuredSupport && structuredSupport.source !== 'metadata') {
        console.warn(
          `[OpenAI] Structured outputs DOWNGRADED to json_object for ${model}: the capability answer was a ` +
          `${structuredSupport.source === 'default-error' ? 'failure default (capability metadata fetch failed)' : 'miss default (model not in capability metadata)'}, not real metadata.`
        );
      }
      requestOptions.response_format = { type: 'json_object' };
      // Still apply provider preferences for non-structured outputs
      if (settings.provider === 'OpenRouter' && input.providerPreferences) {
        requestOptions.provider = { ...input.providerPreferences };
      }
    }

    dlog('Making compiler API request', { model, provider: settings.provider });
    dlogFull('Full compiler request body:', JSON.stringify(requestOptions, null, 2));

    const startTime = performance.now();
    let response: OpenAI.Chat.Completions.ChatCompletion;

    try {
      response = await (input.abortSignal
        ? client.chat.completions.create(requestOptions, { signal: input.abortSignal })
        : client.chat.completions.create(requestOptions));
    } catch (error: any) {
      const message = error?.message || String(error);
      // OpenRouter's real routing failure — 404 "No endpoints found that can handle the
      // requested parameters" — names NO parameter, so the per-parameter failure net can never
      // fire on it, and the structured-outputs fallback below rebuilds a request still carrying
      // the parameters the routing filter rejected. When require_parameters is present, retry
      // ONCE without it (bounded; a second failure propagates normally).
      const noEndpointsRetryOptions = this.isNoEndpointsError(message)
        ? this.withoutRequireParameters(requestOptions)
        : null;
      if (noEndpointsRetryOptions) {
        console.warn(
          `[OpenAI] OpenRouter found no endpoints for ${model} with require_parameters — retrying once WITHOUT ` +
          `require_parameters. The serving endpoint may silently ignore requested parameters (e.g. response_format) on this retry.`
        );
        recordParameterFailure(model, 'require_parameters');
        response = await (input.abortSignal
          ? client.chat.completions.create(noEndpointsRetryOptions, { signal: input.abortSignal })
          : client.chat.completions.create(noEndpointsRetryOptions));
      } else if (hasStructuredOutputs && /response_format|structured_outputs|not supported/i.test(message)) {
        dlog('Structured outputs not supported; retrying without schema.');
        const fallbackOptions = {
          ...requestOptions,
          response_format: { type: 'json_object' },
        };
        response = await (input.abortSignal
          ? client.chat.completions.create(fallbackOptions, { signal: input.abortSignal })
          : client.chat.completions.create(fallbackOptions));
      } else {
        dlogFull('Full compiler error response:', JSON.stringify(error, null, 2));
        await apiMetricsService.recordMetric({
          apiType: input.apiType ?? 'sutta_studio',
          provider: settings.provider,
          model,
          costUsd: 0,
          tokens: {
            prompt: 0,
            completion: 0,
            total: 0,
          },
          chapterId: input.chapterId,
          success: false,
          errorMessage: message || 'Unknown error',
        });
        throw error;
      }
    }

    const endTime = performance.now();
    dlogFull('Full compiler response body:', JSON.stringify(response, null, 2));

    const content = response.choices[0]?.message?.content || '';
    if (!content.trim()) {
      throw new Error('Empty compiler response.');
    }

    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;
    let costUsd = 0;
    try {
      costUsd = await calculateCost(model, promptTokens, completionTokens);
    } catch (e) {
      console.warn('[OpenAI] Failed to calculate compiler cost:', e);
    }

    await apiMetricsService.recordMetric({
      apiType: input.apiType ?? 'sutta_studio',
      provider: settings.provider,
      model,
      costUsd,
      duration: (endTime - startTime) / 1000,
      tokens: {
        prompt: promptTokens,
        completion: completionTokens,
        total: totalTokens,
      },
      chapterId: input.chapterId,
      success: true,
    });

    return {
      text: content,
      tokens: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
      costUsd,
      model: response.model || model,
      raw: response,
    };
  }

  private getApiConfig(settings: AppSettings): { apiKey: string; baseURL: string } {
    switch (settings.provider) {
      case 'OpenAI':
      case 'DeepSeek':
      case 'OpenRouter': {
        const { apiKey, baseURL } = getOpenAICompatibleConfig(settings, settings.provider);
        if (!apiKey) {
          throw new Error(`${settings.provider} API key is missing. Please add it in Settings.`);
        }
        return { apiKey, baseURL };
      }
      default:
        throw new Error(`Unsupported provider: ${settings.provider}`);
    }
  }

  private async buildRequest(
    settings: AppSettings, 
    title: string, 
    content: string, 
    history: HistoricalChapter[], 
    fanTranslation?: string | null
  ): Promise<any> {
    const structuredSupport = await getStructuredOutputsSupport(settings.provider, settings.model);
    const hasStructuredOutputs = structuredSupport.supported;

    // Translation runs without the amendment protocol; proposals are generated separately.
    let systemPrompt = getTranslationSystemPrompt(settings.systemPrompt);
    systemPrompt = replacePlaceholders(systemPrompt, settings);

    if (!systemPrompt) {
      throw new Error('System prompt cannot be empty');
    }

    const schema = getTranslationOnlyResponseJsonSchema();

    // Configure response format
    const requestOptions: any = { model: settings.model };

    if (hasStructuredOutputs) {
      requestOptions.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'translation_response',
          schema: schema,
          strict: true
        }
      };
      if (settings.provider === 'OpenRouter') {
        // Same learned-failure gate as chatJSON (codex review).
        if (hasRecordedParameterFailure(settings.model, 'require_parameters')) {
          dlog(`Omitting require_parameters for ${settings.model} (learned failure this session)`);
          requestOptions.provider = {};
        } else {
          requestOptions.provider = { require_parameters: true };
        }
      }
    } else {
      // A failure-default (fetch failed / model unknown) is not metadata: the paid translation
      // request is being downgraded to json_object on a guess — log it (integrity item 1).
      if (structuredSupport.source !== 'metadata') {
        console.warn(
          `[OpenAI] Structured outputs DOWNGRADED to json_object for ${settings.model}: the capability answer was a ` +
          `${structuredSupport.source === 'default-error' ? 'failure default (capability metadata fetch failed)' : 'miss default (model not in capability metadata)'}, not real metadata.`
        );
      }
      requestOptions.response_format = { type: 'json_object' };
      const schemaString = JSON.stringify(schema, null, 2);
      const schemaInjection = `

Your response MUST be a single, valid JSON object that conforms to the following JSON schema:

${schemaString}`;

      // Avoid duplicating the injection if the user's prompt already contains it
      if (!systemPrompt.includes('Your response MUST be a single, valid JSON object')) {
        systemPrompt += schemaInjection;
      }
    }

    // Build messages
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add DeepSeek-specific system message if needed
    if (settings.provider === 'DeepSeek') {
      messages.push({ role: 'system', content: prompts.deepseekJsonSystemMessage });
    }
    
    messages.push({ role: 'system', content: systemPrompt });

    const historyPrompt = history.length > 0 ? formatHistory(history).trim() : '';
    const includeFanTranslation = settings.includeFanTranslationInPrompt ?? false;
    const effectiveFanTranslation = includeFanTranslation ? (fanTranslation ?? null) : null;
    const fanTranslationContext = buildFanTranslationContext(effectiveFanTranslation).trim();
    const preface = (
      prompts.translatePrefix +
      (effectiveFanTranslation ? prompts.translateFanSuffix : '') +
      prompts.translateInstruction +
      prompts.translateTitleGuidance
    ).trim();

    const sections = [
      historyPrompt,
      fanTranslationContext,
      preface,
      `${prompts.translateTitleLabel}\n${title}`,
      `${prompts.translateContentLabel}\n${content}`,
    ].filter(Boolean);

    const finalUserContent = sections.join('\n\n');
    messages.push({ role: 'user', content: finalUserContent });

    requestOptions.messages = messages;

    // Add supported parameters
    await this.addSupportedParameters(requestOptions, settings);

    return requestOptions;
  }

  private async addSupportedParameters(requestOptions: any, settings: AppSettings): Promise<void> {
    // Check parameter support
    const requestedTemperature = settings.temperature !== appConfig.aiParameters.defaults.temperature
      ? validateAndClampParameter(settings.temperature, 'temperature')
      : undefined;
    const [temperatureParameters, supportsTopP, supportsFreqPen, supportsPresPen, supportsSeed] =
      await Promise.all([
        getChatCompletionTemperature(settings.provider, settings.model, requestedTemperature),
        supportsParameters(settings.provider, settings.model, ['top_p']),
        supportsParameters(settings.provider, settings.model, ['frequency_penalty']),
        supportsParameters(settings.provider, settings.model, ['presence_penalty']),
        supportsParameters(settings.provider, settings.model, ['seed'])
      ]);

    // Add parameters if supported and different from defaults
    Object.assign(requestOptions, temperatureParameters);
    if (supportsTopP && settings.topP !== undefined && settings.topP !== appConfig.aiParameters.defaults.top_p) {
      requestOptions.top_p = validateAndClampParameter(settings.topP, 'top_p');
    }
    if (supportsFreqPen && settings.frequencyPenalty !== undefined && settings.frequencyPenalty !== appConfig.aiParameters.defaults.frequency_penalty) {
      requestOptions.frequency_penalty = validateAndClampParameter(settings.frequencyPenalty, 'frequency_penalty');
    }
    if (supportsPresPen && settings.presencePenalty !== undefined && settings.presencePenalty !== appConfig.aiParameters.defaults.presence_penalty) {
      requestOptions.presence_penalty = validateAndClampParameter(settings.presencePenalty, 'presence_penalty');
    }
    if (supportsSeed && settings.seed !== undefined && settings.seed !== null) {
      requestOptions.seed = validateAndClampParameter(settings.seed, 'seed');
    }

    // Add max tokens — always send a value to avoid API-default truncation.
    // OpenRouter in particular returns short responses when max_tokens is omitted.
    const effectiveMaxTokens = (settings.maxOutputTokens && settings.maxOutputTokens > 0)
      ? settings.maxOutputTokens
      : 16384; // sensible default matching Claude adapter
    Object.assign(
      requestOptions,
      getChatCompletionTokenLimit(settings.model, effectiveMaxTokens)
    );

    // Add OpenRouter headers if needed
    if (settings.provider === 'OpenRouter') {
      try {
        const extraHeaders: Record<string, string> = {};
        if (appConfig.openrouter?.referer) extraHeaders['HTTP-Referer'] = appConfig.openrouter.referer;
        if (appConfig.openrouter?.title) extraHeaders['X-Title'] = appConfig.openrouter.title;
        if (Object.keys(extraHeaders).length > 0) {
          requestOptions.extra_headers = extraHeaders;
        }
      } catch {
        // Config not found, continue without headers
      }
    }
  }

  /**
   * True only for errors that retrying WITHOUT the advanced parameters can
   * actually fix — i.e. the error names one of the parameters that
   * removeAdvancedParameters() removes. The previous predicate also matched
   * 'invalid_request_error' (OpenAI's type for essentially every 4xx),
   * 'max_tokens', and bare 'not supported' — none of which the retry
   * removes, so every context-length or schema failure burned a second,
   * materially identical API call under a "Parameter error detected" log.
   */
  private isParameterError(error: any): boolean {
    const message = (error.message || '').toLowerCase();
    const removable = ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'seed'];
    return removable.some((p) => message.includes(p));
  }
  private removeAdvancedParameters(requestOptions: any): any {
    const cleaned = { ...requestOptions };
    ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'seed'].forEach(param => {
      delete cleaned[param];
    });
    return cleaned;
  }

  /**
   * OpenRouter's routing failure — 404 "No endpoints found that can handle the requested
   * parameters" — names NO individual parameter, so isParameterError()/recordParameterFailure's
   * per-parameter net can never fire on OpenRouter's REAL failure shape. It gets its own
   * message-class detector.
   */
  private isNoEndpointsError(message: string): boolean {
    return /no endpoints found/i.test(message || '');
  }

  /**
   * A copy of requestOptions with provider.require_parameters removed, or null when it was not
   * set — in which case a retry would rebuild the identical failing request and there is
   * nothing to adapt.
   */
  private withoutRequireParameters(requestOptions: any): any | null {
    const provider = requestOptions?.provider;
    if (!provider || provider.require_parameters === undefined) return null;
    const { require_parameters: _removed, ...rest } = provider;
    const cleaned = { ...requestOptions };
    if (Object.keys(rest).length > 0) cleaned.provider = rest;
    else delete cleaned.provider;
    return cleaned;
  }

  /**
   * Strip markdown code fences from response text
   * Handles cases where models wrap JSON in ```json ... ```
   */
  private stripMarkdownCodeFences(text: string): string {
    let cleaned = text.trim();

    // Remove opening fence with optional language identifier
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }

    // Remove closing fence
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }

    return cleaned.trim();
  }

  /**
   * Detect if JSON response appears truncated
   * Checks for unbalanced braces and missing closing structures
   */
  /**
   * Remove JSON string literals, leaving only the structural skeleton.
   *
   * Brace/bracket counting MUST ignore string contents. The translated prose is itself a JSON
   * string and routinely contains brackets — footnote markers like `[1]`, illustration markers
   * like `[ILLUSTRATION-2]`, or a lone `[` in dialogue. Counting those made a complete response
   * look unbalanced.
   *
   * A genuinely truncated response is still caught: it ends mid-string, so the unterminated
   * literal swallows the remaining text and the closing braces go missing from the skeleton.
   */
  private jsonSkeleton(text: string): string {
    let out = '';
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '"') {
        i++;
        while (i < text.length) {
          if (text[i] === '\\') { i += 2; continue; }
          if (text[i] === '"') { i++; break; }
          i++;
        }
        continue;
      }
      out += ch;
      i++;
    }
    return out;
  }

  /**
   * Detect if a JSON response appears truncated.
   *
   * Call this with FENCE-STRIPPED text: a ```json-wrapped response does not end with `}`, and
   * treating that as truncation threw `length_cap`, which sent a perfectly good translation
   * into the chunked-retry path and billed the model a second time for nothing.
   */
  private seemsTruncated(text: string): boolean {
    const trimmed = text.trim();

    if (!trimmed.endsWith('}') && !trimmed.endsWith(']')) {
      dlog('Truncation detected: Response does not end with } or ]');
      return true;
    }

    const skeleton = this.jsonSkeleton(trimmed);
    const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

    const openBraces = count(skeleton, '{');
    const closeBraces = count(skeleton, '}');
    if (openBraces !== closeBraces) {
      dlog('Truncation detected: Unbalanced braces', { openBraces, closeBraces });
      return true;
    }

    const openBrackets = count(skeleton, '[');
    const closeBrackets = count(skeleton, ']');
    if (openBrackets !== closeBrackets) {
      dlog('Truncation detected: Unbalanced brackets', { openBrackets, closeBrackets });
      return true;
    }

    return false;
  }

  /**
   * Extract the first balanced JSON object from text that may carry a preamble/postamble.
   *
   * Delegates to the shared scanner. The local copy this replaced decided a quote was escaped
   * by looking at the previous character, so a string ending in an escaped backslash (`"...\\"`)
   * had its own closing quote read as escaped, and the scan ran past the end of the object.
   */
  private extractBalancedJson(text: string): string | null {
    try {
      return extractBalancedJson(text);
    } catch {
      return null;
    }
  }

  private async processResponse(
    response: OpenAI.Chat.Completions.ChatCompletion,
    settings: AppSettings,
    startTime: number,
    endTime: number,
    chapterId?: string,
    sourceLength?: number
  ): Promise<TranslationResult> {
    const choice = response.choices?.[0];
    const finishReason = choice?.finish_reason || (choice as any)?.native_finish_reason || null;

    const responseText = choice?.message?.content;

    // Cost and timing are computed up-front, from response.usage. The provider bills for this
    // call whether or not we can parse it, so every exit below records a metric — a
    // billed-but-unparseable response that recorded nothing was spend the budget gate could
    // not see (TECH-DEBT P1.4).
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
    };

    const recordMetric = (success: boolean) => apiMetricsService.recordMetric({
      apiType: 'translation',
      provider: settings.provider,
      model: settings.model,
      costUsd,
      duration: requestTime,
      tokens: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens,
      },
      chapterId,
      success,
    });

    const failWith = async (message: string): Promise<never> => {
      await recordMetric(false);
      throw new Error(message);
    };

    // An empty response was still billed (usage tokens are present), so record the spend before
    // failing — a thrown-before-recording empty response was invisible to the budget ledger
    // (TECH-DEBT P1.4). Explicit record-then-throw (not failWith) so TS narrows responseText to
    // a string for the code below.
    if (!responseText) {
      await recordMetric(false);
      throw new Error('Empty response from API');
    }

    dlogFull('Raw response text:', responseText.substring(0, 500));

    // Strip fences BEFORE the truncation check: a ```json-wrapped response does not end with
    // `}`, and reading that as truncation would throw length_cap and trigger a chunked re-bill.
    const cleanedText = this.stripMarkdownCodeFences(responseText);

    if (cleanedText !== responseText) {
      dlog('Stripped markdown code fences from response');
    }

    if (finishReason === 'length' || this.seemsTruncated(cleanedText)) {
      dlog('Response appears truncated', {
        finishReason,
        responseLength: responseText.length,
        endsWithBrace: cleanedText.trim().endsWith('}')
      });
      await failWith('length_cap: Model hit token limit. Increase max_tokens or reduce output size.');
    }

    let parsedResponse: any;

    // Try direct parse first
    try {
      parsedResponse = JSON.parse(cleanedText);
      dlog('Successfully parsed JSON on first attempt');
    } catch (initialError) {
      dlog('Initial parse failed, attempting balanced JSON extraction');

      // Try extracting balanced JSON block
      const extracted = this.extractBalancedJson(cleanedText);

      if (extracted) {
        try {
          parsedResponse = JSON.parse(extracted);
          dlog('Successfully parsed JSON after extraction');
        } catch (extractError) {
          dlogFull('Extraction also failed. Cleaned text:', cleanedText.substring(0, 500));
          await failWith(`Failed to parse JSON response after extraction: ${cleanedText.substring(0, 200)}...`);
        }
      } else {
        dlogFull('Could not extract balanced JSON. Original text:', responseText.substring(0, 500));
        await failWith(`Failed to parse JSON response (no balanced JSON found): ${responseText.substring(0, 200)}...`);
      }
    }

    await recordMetric(true);

    const result = {
      translatedTitle: parsedResponse.translatedTitle || '',
      translation: parsedResponse.translation || '',
      suggestedIllustrations: parsedResponse.suggestedIllustrations || [],
      proposal: parsedResponse.proposal || null,
      footnotes: parsedResponse.footnotes || [],
      usageMetrics: usageMetrics,
    };

    // Log if translation is suspiciously short (< 100 chars) but we were charged
    // anything at all (costUsd > 0 — cheap models are where truncation is most
    // common, so a "high cost" threshold would hide exactly the cases we want).
    if (result.translation.length < 100 && costUsd > 0) {
      console.error('[OpenAI] ⚠️ SUSPICIOUS: Short translation but we were charged!', {
        translationLength: result.translation.length,
        translationPreview: result.translation.substring(0, 50),
        cost: costUsd,
        model: settings.model,
        promptTokens,
        completionTokens,
        rawResponsePreview: responseText.substring(0, 500),
        parsedResponseKeys: Object.keys(parsedResponse),
        parsedTranslationType: typeof parsedResponse.translation,
        fullParsedResponse: JSON.stringify(parsedResponse).substring(0, 1000),
      });
    }

    // If translation is critically short (< 20 chars), throw to prevent storing
    // garbage — REGARDLESS of cost (a $0-metered response can still be corrupt).
    // Gated on SOURCE length: a title-only or one-line chapter can validly
    // translate to under 20 chars, and throwing there discards a billed
    // result (codex review of the integrity branch caught this). When the
    // source length is unknown (direct/test calls), the throw stands.
    if (result.translation.length < 20 && (sourceLength === undefined || sourceLength >= 100)) {
      throw new Error(
        `Translation response appears corrupted or truncated. ` +
        `Got only ${result.translation.length} chars: "${result.translation}". ` +
        `Raw response preview: ${responseText.substring(0, 200)}...`
      );
    }

    return result;
  }
}
