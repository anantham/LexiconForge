import { describe, it, expect } from 'vitest';
import { translator } from '../../services/translate/Translator';
import { initializeProviders } from '../../adapters/providers';

describe('Provider registration', () => {
  it('registers all supported providers with the translator', async () => {
    await initializeProviders();
    const providers = new Set(translator.getRegisteredProviders());
    expect(providers).toEqual(new Set(['DeepSeek', 'OpenRouter', 'Gemini', 'Claude']));
  });
});
