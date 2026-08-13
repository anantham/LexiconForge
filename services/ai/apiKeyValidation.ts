import type { AppSettings } from '../../types';
import type { TelemetryFailureType } from '../../types/telemetry';
import { getConfiguredApiKey } from './providerCredentials';

const PROVIDER_LABELS: Record<AppSettings['provider'], string> = {
  Gemini: 'Google Gemini',
  OpenAI: 'OpenAI',
  DeepSeek: 'DeepSeek',
  OpenRouter: 'OpenRouter',
  Claude: 'Claude (Anthropic)',
};

export interface ApiKeyValidationResult {
  isValid: boolean;
  errorMessage?: string;
  failureType?: Extract<TelemetryFailureType, 'missing_api_key' | 'unknown'>;
}

export const validateApiKey = (
  settings: AppSettings
): ApiKeyValidationResult => {
  const providerLabel = PROVIDER_LABELS[settings.provider as AppSettings['provider']];
  if (!providerLabel) {
    return {
      isValid: false,
      errorMessage: `Unknown provider: ${settings.provider}`,
      failureType: 'unknown',
    };
  }

  const requiredApiKey = getConfiguredApiKey(settings, settings.provider);

  if (!requiredApiKey) {
    console.error('[API Key Validation Failed]', {
      provider: providerLabel,
      hasSettingsKey: !!settings[`apiKey${settings.provider}` as keyof typeof settings],
    });

    return {
      isValid: false,
      errorMessage: buildProviderErrorMessage(settings.provider, providerLabel),
      failureType: 'missing_api_key',
    };
  }

  return { isValid: true };
};

const buildProviderErrorMessage = (provider: AppSettings['provider'], providerLabel: string): string => {
  if (provider === 'OpenRouter') {
    return `${providerLabel} API key is missing. Add your own key in Settings.\n\nGet your API key at: https://openrouter.ai/keys`;
  }

  const helpLinks: Partial<Record<AppSettings['provider'], string>> = {
    Gemini: 'https://aistudio.google.com/app/apikey',
    OpenAI: 'https://platform.openai.com/api-keys',
    DeepSeek: 'https://platform.deepseek.com/api_keys',
    Claude: 'https://console.anthropic.com/settings/keys',
  };

  const helpMessage = helpLinks[provider]
    ? `\n\nGet your API key at: ${helpLinks[provider]}`
    : '';

  return `${providerLabel} API key is missing. Add your own key in Settings.${helpMessage}`;
};
