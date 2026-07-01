/**
 * Canonical Sutta Studio LLM caller (Phase 3 of CONSOLIDATION.md).
 *
 * Single source of truth for the LLM transport used by the Sutta Studio
 * compiler — provider resolution, structured-output plumbing, pipeline-log
 * telemetry. The two legacy locations (services/suttaStudioLLM.ts and
 * services/compiler/llm.ts) are now thin re-export shims that forward here.
 *
 * Historical note (Phase 3): the two legacy files had drifted — the bench-side
 * file exposed CompilerLLMOptions/CompilerLLMResult types and a providerPreferences
 * pass-through that the compiler-side file lacked. Earlier task tracking marked
 * Phase 3 complete based on intent rather than scope; the 2026-05-16 doc audit
 * caught that and reopened the work. This module is the unified replacement.
 */
import type { AppSettings } from '../../types';
import type {
  ChatMessage,
  ChatResponse,
  Provider,
  ProviderName,
  ProviderPreferences,
} from '../../adapters/providers/Provider';
import { initializeProviders } from '../../adapters/providers';
import { getProvider } from '../../adapters/providers/registry';
import { aiDebugFullEnabled, dlog, dlogFull } from '../ai/debug';
import { logPipelineEvent } from '../suttaStudioPipelineLog';
import { withRetry } from '../../utils/retry';

/**
 * Retry only TRANSIENT transport failures (the DNS/connection blips that were
 * killing whole benchmark models — "fetch failed", ENOTFOUND, timeouts, 429/5xx).
 * Never retry an abort (deliberate cancel) or a genuine 4xx (bad slug/auth).
 */
const isRetryableLLM = (signal?: AbortSignal) => (e: unknown): boolean => {
  if (signal?.aborted) return false;
  if (e instanceof DOMException && e.name === 'AbortError') return false;
  const msg = ((e as any)?.message ?? '').toLowerCase();
  return /fetch failed|network|timeout|connection|enotfound|econnreset|econnrefused|socket|502|503|504|429|rate limit/.test(msg);
};

/** Per-call ceiling. A phase pass shouldn't take this long; a hung provider (kimi,
 *  gpt-oss have done this — no response, no error) would otherwise stall the whole
 *  benchmark since the circuit breaker only counts failures, not silent stalls. */
const LLM_CALL_TIMEOUT_MS = 90_000;

const combineSignals = (external: AbortSignal | undefined, timeout: AbortSignal): AbortSignal => {
  if (!external) return timeout;
  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  return typeof anyFn === 'function' ? anyFn([external, timeout]) : timeout;
};

const warn = (message: string, ...args: any[]) =>
  console.warn(`[SuttaStudioCompiler] ${message}`, ...args);

export type CompilerLLMOptions = {
  schemaName?: string;
  schema?: any;
  structuredOutputs?: boolean;
  meta?: { stage?: string; phaseId?: string; requestName?: string };
  /** OpenRouter provider routing preferences */
  providerPreferences?: ProviderPreferences;
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
    response = await withRetry(
      () => {
        const tc = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; tc.abort(); }, LLM_CALL_TIMEOUT_MS);
        return provider.chatJSON({
          settings: effectiveSettings,
          messages,
          temperature: 0.2,
          maxTokens,
          schema: options?.schema,
          schemaName: options?.schemaName,
          structuredOutputs: options?.structuredOutputs,
          abortSignal: combineSignals(signal, tc.signal),
          apiType: 'sutta_studio',
          providerPreferences: options?.providerPreferences,
        })
          .catch((e: any) => { if (timedOut) throw new Error(`llm call timeout after ${LLM_CALL_TIMEOUT_MS}ms`); throw e; })
          .finally(() => clearTimeout(timer));
      },
      {
        maxAttempts: 4,
        initialDelay: 2000,
        signal,
        isRetryable: isRetryableLLM(signal),
        onRetry: (attempt, delay, err) => {
          logPipelineEvent({
            level: 'warn',
            stage: options?.meta?.stage,
            phaseId: options?.meta?.phaseId,
            message: 'llm.retry',
            data: { attempt, delayMs: delay, error: (err as any)?.message || String(err) },
          });
        },
      },
    );
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
