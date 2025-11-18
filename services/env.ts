type EnvRecord = Record<string, string | undefined>;
type EnvSource = EnvRecord | undefined;

const normalizeKey = (key: string): string => (key.startsWith('VITE_') ? key : `VITE_${key}`);

const readFromImportMeta = (key: string): string | undefined => {
  const env = import.meta.env as EnvRecord | undefined;
  return env ? env[normalizeKey(key)] ?? env[key] : undefined;
};

const readFromProcess = (key: string): string | undefined => {
  if (typeof process === 'undefined') {
    return undefined;
  }

  try {
    const env = process.env as EnvSource;
    return env ? env[normalizeKey(key)] ?? env[key] : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Retrieve an environment variable from the build/runtime context.
 * Works with both Vite's `import.meta.env` and traditional `process.env`.
 */
export const getEnvVar = (key: string): string | undefined => {
  return readFromImportMeta(key) ?? readFromProcess(key);
};

export const hasEnvVar = (key: string): boolean => getEnvVar(key) !== undefined;
