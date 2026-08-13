import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAppSettings } from '../../utils/test-data';

const providerMocks = vi.hoisted(() => ({
  initializeProviders: vi.fn(),
  getProvider: vi.fn(),
}));

vi.mock('../../../adapters/providers', () => ({
  initializeProviders: providerMocks.initializeProviders,
}));

vi.mock('../../../adapters/providers/registry', () => ({
  getProvider: providerMocks.getProvider,
}));

import { resolveCompilerProvider } from '../../../services/sutta-studio/llm';

describe('resolveCompilerProvider', () => {
  beforeEach(() => {
    providerMocks.initializeProviders.mockReset().mockResolvedValue(undefined);
    providerMocks.getProvider.mockReset();
  });

  it('preserves a configured direct OpenAI provider and Settings snapshot', async () => {
    const provider = { name: 'OpenAI', chatJSON: vi.fn() };
    const settings = createMockAppSettings({
      provider: 'OpenAI',
      model: 'gpt-5-mini',
      apiKeyOpenAI: 'settings-openai-key',
      apiKeyOpenRouter: '',
    });
    providerMocks.getProvider.mockReturnValue(provider);

    const result = await resolveCompilerProvider(settings);

    expect(providerMocks.getProvider).toHaveBeenCalledOnce();
    expect(providerMocks.getProvider).toHaveBeenCalledWith('OpenAI');
    expect(result).toEqual({ provider, settings });
    expect(result.settings).toBe(settings);
  });

  it('fails loudly instead of changing provider or credential source', async () => {
    const settings = createMockAppSettings({ provider: 'OpenAI', model: 'gpt-5-mini' });
    providerMocks.getProvider.mockImplementation(() => {
      throw new Error('Provider not registered: OpenAI');
    });

    await expect(resolveCompilerProvider(settings)).rejects.toThrow(
      'Provider not registered: OpenAI'
    );
    expect(providerMocks.getProvider).toHaveBeenCalledOnce();
    expect(providerMocks.getProvider).not.toHaveBeenCalledWith('OpenRouter');
  });
});
