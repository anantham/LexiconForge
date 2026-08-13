import { describe, expect, it } from 'vitest';
import {
  getConfiguredApiKey,
  getOpenAICompatibleConfig,
  requireConfiguredApiKey,
} from '../../services/ai/providerCredentials';
import { createMockAppSettings } from '../utils/test-data';

describe('provider credentials', () => {
  it('reads and trims only the provider key stored in settings', () => {
    const settings = createMockAppSettings({
      apiKeyOpenAI: '  user-openai-key  ',
      apiKeyOpenRouter: 'user-openrouter-key',
    });

    expect(getConfiguredApiKey(settings, 'OpenAI')).toBe('user-openai-key');
    expect(getConfiguredApiKey(settings, 'OpenRouter')).toBe('user-openrouter-key');
    expect(getConfiguredApiKey(settings, 'Claude')).toBeUndefined();
  });

  it('rejects blank settings keys with an actionable Settings message', () => {
    const settings = createMockAppSettings({ apiKeyGemini: '   ' });

    expect(() => requireConfiguredApiKey(settings, 'Gemini')).toThrow(
      'Gemini API key is missing. Please add it in Settings.'
    );
  });

  it('returns the canonical OpenAI-compatible endpoint without another key pathway', () => {
    const settings = createMockAppSettings({ apiKeyDeepSeek: 'deepseek-user-key' });

    expect(getOpenAICompatibleConfig(settings, 'DeepSeek')).toEqual({
      apiKey: 'deepseek-user-key',
      baseURL: 'https://api.deepseek.com/v1',
    });
  });
});
