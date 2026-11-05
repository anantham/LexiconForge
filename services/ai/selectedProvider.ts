import '../../adapters/providers';
import { getProvider } from '../../adapters/providers/registry';
import type { ChatRequest, ChatResponse } from '../../adapters/providers/Provider';
import type { AppSettings } from '../../types';
import { getConfiguredApiKey } from './providerCredentials';

/** Reader features share the selected provider and never choose another recipient. */
export async function requestWithSelectedProvider(
  input: ChatRequest & { settings: AppSettings },
): Promise<ChatResponse> {
  const settings = { ...input.settings };
  const provider = getProvider(settings.provider);
  if (!getConfiguredApiKey(settings, settings.provider)) {
    throw new Error(`API key for ${settings.provider} is missing. Please add it in Settings.`);
  }
  return provider.chatJSON({ ...input, settings });
}
