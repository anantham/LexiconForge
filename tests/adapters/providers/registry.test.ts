import { describe, it, expect } from 'vitest';
import { registerProvider, getProvider, getRegisteredProviders } from '../../../adapters/providers/registry';
import type { Provider } from '../../../adapters/providers/Provider';

describe('Provider registry', () => {
  it('registers and retrieves providers', async () => {
    const dummy: Provider = {
      name: 'Claude',
      async chatJSON() { return { text: 'ok' }; }
    };
    registerProvider(dummy);
    expect(getRegisteredProviders()).toContain('Claude');
    const p = getProvider('Claude');
    const res = await p.chatJSON({ user: 'hi', model: 'm' });
    expect(res.text).toBe('ok');
  });

  it('throws for unknown providers', () => {
    expect(() => getProvider('Gemini')).toThrowError(/not registered/i);
  });
});
