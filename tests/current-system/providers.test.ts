import { describe, it, expect } from 'vitest';
import { translator } from '../../services/translate/Translator';
import { initializeProviders } from '../../adapters/providers';
import { getRegisteredProviders } from '../../adapters/providers/registry';
import { createMockAppSettings } from '../utils/test-data';

describe('Provider registration', () => {
  it('registers every selectable provider in both live registries', async () => {
    await initializeProviders();

    const supportedProviders = new Set(['OpenAI', 'OpenRouter', 'DeepSeek', 'Gemini', 'Claude']);
    expect(new Set(translator.getRegisteredProviders())).toEqual(supportedProviders);
    expect(new Set(getRegisteredProviders())).toEqual(supportedProviders);

    await expect(translator.translate({
      title: 'Title',
      content: 'Content',
      settings: createMockAppSettings({
        provider: 'OpenAI',
        model: 'gpt-4o',
        apiKeyOpenAI: '',
      }),
      history: [],
    }, { maxRetries: 1 })).rejects.toThrow('OpenAI API key is missing');
  });
});
