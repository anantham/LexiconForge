// Provider adapters barrel file
export { OpenAIAdapter } from './OpenAIAdapter';
export { GeminiAdapter } from './GeminiAdapter';
export { ClaudeAdapter } from './ClaudeAdapter';

// Registry setup
import { translator } from '../../services/translate/Translator';
import { OpenAIAdapter } from './OpenAIAdapter';
import { GeminiAdapter } from './GeminiAdapter';
import { ClaudeAdapter } from './ClaudeAdapter';
import { registerProvider } from './registry';

const openRouterAdapter = new OpenAIAdapter('OpenRouter');
const deepSeekAdapter = new OpenAIAdapter('DeepSeek');
const geminiAdapter = new GeminiAdapter();
const claudeAdapter = new ClaudeAdapter();

// Register all providers
// Note: OpenAI provider is not registered - requires backend proxy to avoid CORS issues
translator.registerProvider('DeepSeek', deepSeekAdapter); // DeepSeek uses OpenAI-compatible API
translator.registerProvider('OpenRouter', openRouterAdapter); // OpenRouter uses OpenAI-compatible API
translator.registerProvider('Gemini', geminiAdapter);
translator.registerProvider('Claude', claudeAdapter);

// Register providers for generic chat usage (compiler, etc.)
registerProvider(openRouterAdapter);
registerProvider(deepSeekAdapter);
registerProvider(geminiAdapter);
registerProvider(claudeAdapter);

// Initialize providers
export const initializeProviders = async () => {
  console.log('[Providers] All providers registered:', ['DeepSeek', 'OpenRouter', 'Gemini', 'Claude']);
};
