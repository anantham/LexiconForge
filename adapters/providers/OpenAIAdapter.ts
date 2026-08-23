import OpenAI from 'openai';
import type { TranslationProvider, TranslationRequest } from '../../services/translate/Translator';
import type { ChatRequest, ChatResponse, Provider, ProviderName } from './Provider';
import type { TranslationResult, AppSettings, HistoricalChapter, UsageMetrics } from '../../types';
import { recordParameterFailure, hasRecordedParameterFailure } from '../../services/capabilityService';
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
  getChatCompletionOptionalParameters,
  getChatCompletionRequestParameters,
  getChatCompletionTokenLimit,
} from '../../services/ai/openaiRequestParameters';
import { shouldRequestStructuredOutputs } from '../../services/ai/structuredOutputPolicy';
import { mergeOpenRouterRouting } from '../../services/openrouterRouting';

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

type OpenAIRequestMessage = {
  role: string;
  content?: unknown;
  [key: string]: unknown;
};

type OpenAIRequestOptions = {
  messages?: OpenAIRequestMessage[];
  provider?: Record<string, unknown>;
  response_format?: { type?: string; [key: string]: unknown };
  [key: string]: unknown;
};

type RequestAdaptation = 'advanced_parameters' | 'routing_requirement' | 'structured_output';
const ADVANCED_PARAMETERS = [
  'temperature',
  'top_p',
  'frequency_penalty',
  'presence_penalty',
  'seed',
] as const;

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
    await rateLimitService.acquireRequestSlot(settings.model, { signal: abortSignal });

    // Build request
    const requestOptions = await this.buildRequest(settings, title, content, history, fanTranslation);

    dlog('Making API request', { model: settings.model, provider: settings.provider });
    dlogFull('Full request body:', JSON.stringify(requestOptions, null, 2));

    const startTime = performance.now();
    let response: OpenAI.Chat.Completions.ChatCompletion;

    try {
      response = await this.createCompletionWithFallbacks(
        options => abortSignal
          ? client.chat.completions.create(options, { signal: abortSignal })
          : client.chat.completions.create(options),
        requestOptions,
        {
          model: settings.model,
          schema: getTranslationOnlyResponseJsonSchema(),
          allowAdvancedParameterFallback: true,
        }
      );
    } catch (error: unknown) {
      dlogFull('Full error response:', JSON.stringify(error, null, 2));
      const errorMessage = error instanceof Error ? error.message : String(error);

      await apiMetricsService.recordMetric({
        apiType: 'translation',
        provider: settings.provider,
        model: settings.model,
        costUsd: 0,
        tokens: { prompt: 0, completion: 0, total: 0 },
        chapterId,
        success: false,
        errorMessage: errorMessage || 'Unknown error',
      });

      throw error;
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
    await rateLimitService.acquireRequestSlot(model, { signal: input.abortSignal });

    const maxTokens = input.maxTokens ?? settings.maxOutputTokens ?? 16384;

    const temperature = validateAndClampParameter(
      input.temperature ?? settings.temperature ?? 0.2,
      'temperature'
    );
    let requestOptions: any = {
      model,
      messages,
      ...getChatCompletionRequestParameters(
        settings.provider,
        model,
        maxTokens,
        { temperature }
      ),
    };

    // Request construction is local and deterministic. OpenRouter model metadata remains
    // advisory UI data; it must not hold an ordinary paid request behind its retry budget.
    // A real provider rejection is handled once below and remembered for this session.
    const hasStructuredOutputs = Boolean(input.schema) &&
      shouldRequestStructuredOutputs(settings.provider, input.structuredOutputs ?? true) &&
      !hasRecordedParameterFailure(model, 'response_format');

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
        requestOptions.provider = mergeOpenRouterRouting(settings, 'text', {
          ...(rp ? { require_parameters: true } : {}),
          ...input.providerPreferences,
        });
      }
    } else {
      requestOptions = this.withJsonObjectResponse(requestOptions, input.schema);
      // OpenRouter routing is independent of response-format support.
      if (settings.provider === 'OpenRouter') {
        requestOptions.provider = mergeOpenRouterRouting(settings, 'text', input.providerPreferences);
      }
    }

    dlog('Making compiler API request', { model, provider: settings.provider });
    dlogFull('Full compiler request body:', JSON.stringify(requestOptions, null, 2));

    const startTime = performance.now();
    let response: OpenAI.Chat.Completions.ChatCompletion;

    try {
      response = await this.createCompletionWithFallbacks(
        options => input.abortSignal
          ? client.chat.completions.create(options, { signal: input.abortSignal })
          : client.chat.completions.create(options),
        requestOptions,
        { model, schema: input.schema, allowAdvancedParameterFallback: false }
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
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
    const hasStructuredOutputs = shouldRequestStructuredOutputs(settings.provider) &&
      !hasRecordedParameterFailure(settings.model, 'response_format');

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
      const targetsOpenAI = settings.provider === 'OpenAI' || needsOpenAIStrictSchema(settings.model);
      requestOptions.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'translation_response',
          schema: targetsOpenAI ? toOpenAIStrictSchema(schema) : schema,
          strict: true
        }
      };
      if (settings.provider === 'OpenRouter') {
        // Same learned-failure gate as chatJSON (codex review).
        if (hasRecordedParameterFailure(settings.model, 'require_parameters')) {
          dlog(`Omitting require_parameters for ${settings.model} (learned failure this session)`);
          requestOptions.provider = mergeOpenRouterRouting(settings, 'text');
        } else {
          requestOptions.provider = mergeOpenRouterRouting(settings, 'text', { require_parameters: true });
        }
      }
    } else {
      requestOptions.response_format = { type: 'json_object' };
      if (settings.provider === 'OpenRouter') {
        requestOptions.provider = mergeOpenRouterRouting(settings, 'text');
      }
      const schemaInjection = this.getJsonSchemaInstruction(schema);

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
    this.addSupportedParameters(requestOptions, settings);

    return requestOptions;
  }

  private addSupportedParameters(requestOptions: any, settings: AppSettings): void {
    const optionalParameters = getChatCompletionOptionalParameters(
      settings.provider,
      settings.model,
      {
        ...(settings.temperature !== appConfig.aiParameters.defaults.temperature
          ? { temperature: validateAndClampParameter(settings.temperature, 'temperature') }
          : {}),
        ...(settings.topP !== undefined && settings.topP !== appConfig.aiParameters.defaults.top_p
          ? { top_p: validateAndClampParameter(settings.topP, 'top_p') }
          : {}),
        ...(settings.frequencyPenalty !== undefined && settings.frequencyPenalty !== appConfig.aiParameters.defaults.frequency_penalty
          ? { frequency_penalty: validateAndClampParameter(settings.frequencyPenalty, 'frequency_penalty') }
          : {}),
        ...(settings.presencePenalty !== undefined && settings.presencePenalty !== appConfig.aiParameters.defaults.presence_penalty
          ? { presence_penalty: validateAndClampParameter(settings.presencePenalty, 'presence_penalty') }
          : {}),
        ...(settings.seed !== undefined && settings.seed !== null
          ? { seed: validateAndClampParameter(settings.seed, 'seed') }
          : {}),
      }
    );
    Object.assign(requestOptions, optionalParameters);

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
   * Execute one request while applying each safe request-shape adaptation at most once.
   * Adaptations are monotonic, so composed provider failures can progress without an
   * unbounded retry loop: advanced parameters -> routing requirement -> structured output.
   */
  private async createCompletionWithFallbacks<T extends OpenAIRequestOptions>(
    createCompletion: (_options: T) => Promise<OpenAI.Chat.Completions.ChatCompletion>,
    initialOptions: T,
    config: {
      model: string;
      schema?: unknown;
      allowAdvancedParameterFallback: boolean;
    }
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    let requestOptions = initialOptions;
    const applied = new Set<RequestAdaptation>();

    while (true) {
      try {
        return await createCompletion(requestOptions);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const normalizedMessage = message.toLowerCase();

        if (
          config.allowAdvancedParameterFallback &&
          !applied.has('advanced_parameters') &&
          this.isParameterError(error)
        ) {
          const retryOptions = this.withoutAdvancedParameters(requestOptions);
          if (retryOptions) {
            dlog('Parameter error detected, retrying without advanced parameters', normalizedMessage);
            ADVANCED_PARAMETERS.forEach(param => {
              if (normalizedMessage.includes(param)) {
                recordParameterFailure(config.model, param);
              }
            });
            applied.add('advanced_parameters');
            requestOptions = retryOptions;
            continue;
          }
        }

        const routingRetryOptions = !applied.has('routing_requirement') && this.isNoEndpointsError(message)
          ? this.withoutRequireParameters(requestOptions)
          : null;
        if (routingRetryOptions) {
          console.warn(
            `[OpenAI] OpenRouter found no endpoints for ${config.model} with require_parameters - retrying once ` +
            `WITHOUT require_parameters. The serving endpoint may silently ignore requested parameters on this retry.`
          );
          recordParameterFailure(config.model, 'require_parameters');
          applied.add('routing_requirement');
          requestOptions = routingRetryOptions;
          continue;
        }

        if (
          !applied.has('structured_output') &&
          requestOptions.response_format?.type === 'json_schema' &&
          this.isStructuredOutputError(message)
        ) {
          console.warn(
            `[OpenAI] ${config.model} rejected json_schema; retrying once with json_object and an explicit schema instruction.`
          );
          recordParameterFailure(config.model, 'response_format');
          applied.add('structured_output');
          requestOptions = this.withJsonObjectResponse(requestOptions, config.schema);
          continue;
        }

        throw error;
      }
    }
  }

  /**
   * True only for errors that retrying WITHOUT the advanced parameters can
   * actually fix — i.e. the error names one of the parameters that
   * withoutAdvancedParameters() removes. The previous predicate also matched
   * 'invalid_request_error' (OpenAI's type for essentially every 4xx),
   * 'max_tokens', and bare 'not supported' — none of which the retry
   * removes, so every context-length or schema failure burned a second,
   * materially identical API call under a "Parameter error detected" log.
   */
  private isParameterError(error: unknown): boolean {
    const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
    return ADVANCED_PARAMETERS.some((parameter) => message.includes(parameter));
  }
  private withoutAdvancedParameters<T extends OpenAIRequestOptions>(requestOptions: T): T | null {
    if (!ADVANCED_PARAMETERS.some(param => Object.prototype.hasOwnProperty.call(requestOptions, param))) {
      return null;
    }
    const cleaned = { ...requestOptions };
    ADVANCED_PARAMETERS.forEach(param => {
      delete cleaned[param];
    });
    return cleaned as T;
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

  private isStructuredOutputError(message: string): boolean {
    return /response[_ ]format|structured[_ ]outputs?|json[_ ]schema|schema.{0,40}not supported|not support.{0,40}schema/i.test(message || '');
  }

  private getJsonSchemaInstruction(schema: unknown): string {
    return `

Your response MUST be a single, valid JSON object that conforms to the following JSON schema:

${JSON.stringify(schema, null, 2)}`;
  }

  private withJsonObjectResponse<T extends OpenAIRequestOptions>(
    requestOptions: T,
    schema?: unknown
  ): T {
    const jsonObjectOptions = {
      ...requestOptions,
      response_format: { type: 'json_object' },
    } as T;
    const withoutRoutingRequirement = this.withoutRequireParameters(jsonObjectOptions) ?? jsonObjectOptions;
    if (!schema || !Array.isArray(withoutRoutingRequirement.messages)) {
      return withoutRoutingRequirement;
    }

    const marker = 'Your response MUST be a single, valid JSON object';
    const instruction = this.getJsonSchemaInstruction(schema);
    const messages = withoutRoutingRequirement.messages.map((message) => ({ ...message }));
    let targetIndex = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'system') {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex >= 0) {
      const content = String(messages[targetIndex].content ?? '');
      if (!content.includes(marker)) {
        messages[targetIndex].content = `${content}${instruction}`;
      }
    } else {
      messages.unshift({ role: 'system', content: instruction.trim() });
    }

    return { ...withoutRoutingRequirement, messages } as T;
  }

  /**
   * A copy of requestOptions with provider.require_parameters removed, or null when it was not
   * set — in which case a retry would rebuild the identical failing request and there is
   * nothing to adapt.
   */
  private withoutRequireParameters<T extends OpenAIRequestOptions>(requestOptions: T): T | null {
    const provider = requestOptions?.provider;
    if (!provider || provider.require_parameters === undefined) return null;
    const { require_parameters: _removed, ...rest } = provider;
    const cleaned = { ...requestOptions } as T;
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
