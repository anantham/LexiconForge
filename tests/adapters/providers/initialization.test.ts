import { describe, expect, it } from 'vitest';
import { initializeProviders } from '../../../adapters/providers';
import { getRegisteredProviders } from '../../../adapters/providers/registry';
import { translator } from '../../../services/translate/Translator';
import { createMockAppSettings } from '../../utils/test-data';

describe('provider initialization', () => {
  it('registers every selectable provider in both live registries', async () => {
    await initializeProviders();

    expect(getRegisteredProviders()).toEqual([
      'OpenAI',
      'OpenRouter',
      'DeepSeek',
      'Gemini',
      'Claude',
    ]);

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
