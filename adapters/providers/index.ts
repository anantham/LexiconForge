// Provider adapters barrel file
export { OpenAIAdapter } from './OpenAIAdapter';
export { GeminiAdapter } from './GeminiAdapter';
export { ClaudeAdapter } from './ClaudeAdapter';

// Registry setup
import { translator } from '../../services/translate/Translator';
import { OpenAIAdapter } from './OpenAIAdapter';
import { GeminiAdapter } from './GeminiAdapter';
import { ClaudeAdapter } from './ClaudeAdapter';

// Register all providers
translator.registerProvider('OpenAI', new OpenAIAdapter());
translator.registerProvider('DeepSeek', new OpenAIAdapter()); // DeepSeek uses OpenAI-compatible API
translator.registerProvider('OpenRouter', new OpenAIAdapter()); // OpenRouter uses OpenAI-compatible API
translator.registerProvider('Gemini', new GeminiAdapter());
translator.registerProvider('Claude', new ClaudeAdapter());

// Initialize providers
export const initializeProviders = async () => {
  console.log('[Providers] All providers registered:', ['OpenAI', 'DeepSeek', 'OpenRouter', 'Gemini', 'Claude']);
};