const GLOBAL_OVERRIDE_KEY = '__LF_DB_V2_OVERRIDE__';

const readProcessEnv = (name: string): string | undefined => {
  try {
    return typeof process !== 'undefined' ? (process.env?.[name] as string | undefined) : undefined;
  } catch {
    return undefined;
  }
};

const parseCsv = (value: string | undefined): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map(part => part.trim().toLowerCase())
    .filter(Boolean);
};

export const isModernDbEnabled = (domain: string): boolean => {
  const normalizedDomain = domain.toLowerCase();

  const forceAll = readProcessEnv('LF_FORCE_DB_V2');
  if (forceAll === '1' || forceAll === 'true') {
    return true;
  }

  const forceDomains = parseCsv(readProcessEnv('LF_FORCE_DB_V2_DOMAINS'));
  if (forceDomains.includes('all') || forceDomains.includes(normalizedDomain)) {
    return true;
  }

  const publicDomains = parseCsv(readProcessEnv('NEXT_PUBLIC_DB_V2_DOMAINS'));
  if (publicDomains.includes('all') || publicDomains.includes(normalizedDomain)) {
    return true;
  }

  if (typeof globalThis !== 'undefined') {
    const override = (globalThis as any)[GLOBAL_OVERRIDE_KEY];
    if (Array.isArray(override)) {
      const normalized = override.map((item: string) => item.toLowerCase());
      if (normalized.includes('all') || normalized.includes(normalizedDomain)) {
        return true;
      }
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const localValue = window.localStorage.getItem(`LF_DB_V2_${normalizedDomain.toUpperCase()}`);
      if (localValue != null) {
        return localValue === '1' || localValue === 'true';
      }
    } catch {
      // Ignore storage errors (e.g., private mode)
    }
  }

  return false;
};

export const __testSetModernDbOverride = (domains: string[] | 'all') => {
  if (typeof globalThis === 'undefined') return;
  (globalThis as any)[GLOBAL_OVERRIDE_KEY] = domains === 'all' ? ['all'] : domains;
};
