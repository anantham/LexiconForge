import { getEnvVar, hasEnvVar } from '../env';
import {
  getDefaultApiKey,
  getDefaultKeyStatus,
} from '../defaultApiKeyService';
import type { AppSettings } from '../../types';

const PROVIDER_ENV_MAP: Record<AppSettings['provider'], { env: string; label: string }> = {
  Gemini: { env: 'GEMINI_API_KEY', label: 'Google Gemini' },
  OpenAI: { env: 'OPENAI_API_KEY', label: 'OpenAI' },
  DeepSeek: { env: 'DEEPSEEK_API_KEY', label: 'DeepSeek' },
  OpenRouter: { env: 'OPENROUTER_API_KEY', label: 'OpenRouter' },
  Claude: { env: 'CLAUDE_API_KEY', label: 'Claude (Anthropic)' },
};

export const validateApiKey = (
  settings: AppSettings
): { isValid: boolean; errorMessage?: string } => {
  const providerMeta = PROVIDER_ENV_MAP[settings.provider as AppSettings['provider']];
  if (!providerMeta) {
    return { isValid: false, errorMessage: `Unknown provider: ${settings.provider}` };
  }

  let requiredApiKey: string | undefined;

  if (settings.provider === 'OpenRouter') {
    const userKey = (settings as any).apiKeyOpenRouter;
    const envVarKey = getEnvVar(providerMeta.env) as string | undefined;
    const trialKey = getDefaultApiKey();
    requiredApiKey = userKey || envVarKey || trialKey;

    console.log('[OpenRouter] API Key Priority Check:', {
      hasUserKey: !!userKey,
      hasEnvKey: !!envVarKey,
      hasTrialKey: !!trialKey,
      usingSource: userKey
        ? 'user_settings'
        : envVarKey
        ? 'environment_var'
        : trialKey
        ? 'trial_key'
        : 'none',
      finalKeyAvailable: !!requiredApiKey,
    });

    if (!userKey && !envVarKey && requiredApiKey) {
      const status = getDefaultKeyStatus();
      console.log(`[DefaultKey] Using trial key - ${status.remainingUses} requests remaining`);
    }
  } else {
    const keyProp = `apiKey${settings.provider}` as keyof AppSettings;
    requiredApiKey = (settings[keyProp] as string | undefined) || (getEnvVar(providerMeta.env) as string | undefined);
  }

  if (!requiredApiKey?.trim()) {
    console.error('[API Key Validation Failed]', {
      provider: providerMeta.label,
      hasSettingsKey: !!settings[`apiKey${settings.provider}` as keyof typeof settings],
      hasEnvKey: hasEnvVar(providerMeta.env),
    });

    return {
      isValid: false,
      errorMessage: buildProviderErrorMessage(settings.provider, providerMeta.label),
    };
  }

  return { isValid: true };
};

const buildProviderErrorMessage = (provider: AppSettings['provider'], providerLabel: string): string => {
  if (provider === 'OpenRouter') {
    const trialStatus = getDefaultKeyStatus();
    if (trialStatus.hasExceeded) {
      return `Trial limit reached (${trialStatus.usageCount}/10 free requests used).\n\nGet your own free OpenRouter API key at: https://openrouter.ai/keys\nOr request more trial credits at: https://t.me/everythingisrelative`;
    }
    return `${providerLabel} API key is missing. Add it in settings or .env file.\n\nGet your API key at: https://openrouter.ai/keys\nOr request free credits at: https://t.me/webnovels`;
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

  return `${providerLabel} API key is missing. Add it in settings or .env file.${helpMessage}`;
};
