import type { TranslationProvider } from '../../types';

const JSON_SCHEMA_PROVIDERS = new Set<TranslationProvider>([
  'OpenAI',
  'OpenRouter',
  'Gemini',
]);

/**
 * Request-time policy only. Remote model metadata remains useful for advisory UI,
 * but it must never delay an ordinary provider request. OpenRouter model variance
 * is handled by the adapter's bounded json_schema -> json_object fallback.
 */
export function shouldRequestStructuredOutputs(
  provider: TranslationProvider,
  requested = true
): boolean {
  return requested && JSON_SCHEMA_PROVIDERS.has(provider);
}
