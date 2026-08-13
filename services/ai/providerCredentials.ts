import type { AppSettings } from '../../types';

export type ApiCredentialProvider = AppSettings['provider'] | 'PiAPI';
export type OpenAICompatibleProvider = Extract<
  AppSettings['provider'],
  'OpenAI' | 'DeepSeek' | 'OpenRouter'
>;

const API_KEY_FIELD = {
  Gemini: 'apiKeyGemini',
  OpenAI: 'apiKeyOpenAI',
  DeepSeek: 'apiKeyDeepSeek',
  OpenRouter: 'apiKeyOpenRouter',
  Claude: 'apiKeyClaude',
  PiAPI: 'apiKeyPiAPI',
} as const satisfies Record<ApiCredentialProvider, keyof AppSettings>;

const OPENAI_COMPATIBLE_BASE_URL = {
  OpenAI: 'https://api.openai.com/v1',
  DeepSeek: 'https://api.deepseek.com/v1',
  OpenRouter: 'https://openrouter.ai/api/v1',
} as const satisfies Record<OpenAICompatibleProvider, string>;

export function getConfiguredApiKey(
  settings: AppSettings,
  provider: ApiCredentialProvider
): string | undefined {
  const value = settings[API_KEY_FIELD[provider]];
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  return trimmed || undefined;
}

export function requireConfiguredApiKey(
  settings: AppSettings,
  provider: ApiCredentialProvider,
  context?: string
): string {
  const apiKey = getConfiguredApiKey(settings, provider);
  if (apiKey) return apiKey;

  const suffix = context ? ` ${context}` : '';
  throw new Error(`${provider} API key is missing${suffix}. Please add it in Settings.`);
}

export function getOpenAICompatibleConfig(
  settings: AppSettings,
  provider: OpenAICompatibleProvider
): { apiKey?: string; baseURL: string } {
  return {
    apiKey: getConfiguredApiKey(settings, provider),
    baseURL: OPENAI_COMPATIBLE_BASE_URL[provider],
  };
}
