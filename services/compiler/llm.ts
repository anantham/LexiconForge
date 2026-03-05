import { dlog, dlogFull, aiDebugFullEnabled } from '../ai/debug';
import type { AppSettings } from '../../types';
import type { ChatMessage, ProviderName } from '../../adapters/providers/Provider';
import { initializeProviders } from '../../adapters/providers';
import { getProvider } from '../../adapters/providers/registry';
import { logPipelineEvent } from '../suttaStudioPipelineLog';

const warn = (message: string, ...args: any[]) =>
  console.warn(`[SuttaStudioCompiler] ${message}`, ...args);

export const resolveCompilerProvider = async (
  settings: AppSettings
): Promise<{ provider: { chatJSON: (input: any) => Promise<{ text: string; raw?: unknown }> }; settings: AppSettings }> => {
  await initializeProviders();
  const providerName = settings.provider === 'OpenAI' ? 'OpenRouter' : settings.provider;
  let provider;
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
  options?: {
    schemaName?: string;
    schema?: any;
    structuredOutputs?: boolean;
    meta?: { stage?: string; phaseId?: string; requestName?: string };
  }
): Promise<string> => {
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
  let response: { text: string; raw?: unknown };
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
  return content;
};
