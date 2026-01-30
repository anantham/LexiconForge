import type { AppSettings } from '../types';
import type { ChatMessage, ChatResponse, Provider, ProviderName } from '../adapters/providers/Provider';
import { initializeProviders } from '../adapters/providers';
import { getProvider } from '../adapters/providers/registry';
import { aiDebugFullEnabled, dlog, dlogFull } from './ai/debug';
import { logPipelineEvent } from './suttaStudioPipelineLog';

const warn = (message: string, ...args: any[]) =>
  console.warn(`[SuttaStudioCompiler] ${message}`, ...args);

export type CompilerLLMOptions = {
  schemaName?: string;
  schema?: any;
  structuredOutputs?: boolean;
  meta?: { stage?: string; phaseId?: string; requestName?: string };
};

export type CompilerLLMResult = ChatResponse & {
  provider: string;
  model: string;
  durationMs: number;
};

export const resolveCompilerProvider = async (
  settings: AppSettings
): Promise<{ provider: Provider; settings: AppSettings }> => {
  await initializeProviders();
  const providerName = settings.provider === 'OpenAI' ? 'OpenRouter' : settings.provider;
  let provider: Provider;
  try {
    provider = getProvider(providerName as ProviderName);
  } catch (e) {
    warn(`Provider ${providerName} not registered for compiler; falling back to OpenRouter.`);
    provider = getProvider('OpenRouter');
  }

  const effectiveSettings =
    providerName === settings.provider
      ? settings
      : { ...settings, provider: providerName as AppSettings['provider'] };

  return { provider, settings: effectiveSettings };
};

export const callCompilerLLM = async (
  settings: AppSettings,
  messages: ChatMessage[],
  signal?: AbortSignal,
  maxTokens = 4000,
  options?: CompilerLLMOptions
): Promise<CompilerLLMResult> => {
  const { provider, settings: effectiveSettings } = await resolveCompilerProvider(settings);

  dlog('[SuttaStudioCompiler] LLM request params', {
    provider: effectiveSettings.provider,
    model: effectiveSettings.model,
    maxTokens,
    structuredOutputs: !!options?.schema && !!options?.structuredOutputs,
  });
  logPipelineEvent({
    level: 'info',
    stage: options?.meta?.stage,
    phaseId: options?.meta?.phaseId,
    message: 'llm.request',
    data: {
      requestName: options?.meta?.requestName,
      schemaName: options?.schemaName,
      provider: effectiveSettings.provider,
      model: effectiveSettings.model,
      maxTokens,
      messages,
      schema: options?.schema ?? null,
      structuredOutputs: options?.structuredOutputs ?? false,
    },
  });

  const start = performance.now();
  let response: ChatResponse;
  try {
    response = await provider.chatJSON({
      settings: effectiveSettings,
      messages,
      temperature: 0.2,
      maxTokens,
      schema: options?.schema,
      schemaName: options?.schemaName,
      structuredOutputs: options?.structuredOutputs,
      abortSignal: signal,
      apiType: 'sutta_studio',
    });
  } catch (e: any) {
    logPipelineEvent({
      level: 'error',
      stage: options?.meta?.stage,
      phaseId: options?.meta?.phaseId,
      message: 'llm.error',
      data: {
        requestName: options?.meta?.requestName,
        schemaName: options?.schemaName,
        provider: effectiveSettings.provider,
        model: effectiveSettings.model,
        error: e?.message || String(e),
        errorBody: e?.response?.data ?? e?.body ?? e?.cause ?? null,
        errorStack: e?.stack ?? null,
      },
    });
    throw e;
  }
  const durationMs = Math.max(0, Math.round(performance.now() - start));

  if (aiDebugFullEnabled()) {
    dlogFull('[SuttaStudioCompiler] Full response body:', JSON.stringify(response.raw ?? response, null, 2));
  }
  logPipelineEvent({
    level: 'info',
    stage: options?.meta?.stage,
    phaseId: options?.meta?.phaseId,
    message: 'llm.response',
    data: {
      requestName: options?.meta?.requestName,
      schemaName: options?.schemaName,
      durationMs,
      text: response.text,
      raw: response.raw ?? null,
    },
  });

  const content = response.text || '';
  if (!content.trim()) throw new Error('Empty compiler response.');

  return {
    ...response,
    text: content,
    durationMs,
    provider: effectiveSettings.provider,
    model: response.model ?? effectiveSettings.model,
  };
};

export const callCompilerLLMText = async (
  settings: AppSettings,
  messages: ChatMessage[],
  signal?: AbortSignal,
  maxTokens = 4000,
  options?: CompilerLLMOptions
): Promise<string> => {
  const result = await callCompilerLLM(settings, messages, signal, maxTokens, options);
  return result.text;
};
