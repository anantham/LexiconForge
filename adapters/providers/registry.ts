import type { Provider, ProviderName } from './Provider';

const providers = new Map<ProviderName, Provider>();

export function registerProvider(p: Provider) {
  providers.set(p.name, p);
}

export function getProvider(name: ProviderName): Provider {
  const p = providers.get(name);
  if (!p) throw new Error(`Provider not registered: ${name}`);
  return p;
}

export function getRegisteredProviders(): ProviderName[] {
  return Array.from(providers.keys());
}

