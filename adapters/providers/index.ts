// Provider adapters barrel file
export { OpenAIAdapter } from './OpenAIAdapter';
export { GeminiAdapter } from './GeminiAdapter';
export { ClaudeAdapter } from './ClaudeAdapter';

// Registry setup
import { translator, type TranslationProvider } from '../../services/translate/Translator';
import { OpenAIAdapter } from './OpenAIAdapter';
import { GeminiAdapter } from './GeminiAdapter';
import { ClaudeAdapter } from './ClaudeAdapter';
import type { Provider } from './Provider';
import { registerProvider } from './registry';

type RegisteredProvider = Provider & TranslationProvider;

const providerAdapters: RegisteredProvider[] = [
  new OpenAIAdapter('OpenAI'),
  new OpenAIAdapter('OpenRouter'),
  new OpenAIAdapter('DeepSeek'),
  new GeminiAdapter(),
  new ClaudeAdapter(),
];

for (const adapter of providerAdapters) {
  translator.registerProvider(adapter.name, adapter);
  registerProvider(adapter);
}

const registeredProviderNames = providerAdapters.map((adapter) => adapter.name);

// Initialize providers
export const initializeProviders = async () => {
  console.log('[Providers] All providers registered:', registeredProviderNames);
};
