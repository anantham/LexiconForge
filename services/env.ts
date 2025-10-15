type EnvSource = Record<string, string | undefined> | undefined;

const normalizeKey = (key: string): string => (key.startsWith('VITE_') ? key : `VITE_${key}`);

const readFromImportMeta = (key: string): string | undefined => {
  try {
    const env = (typeof import.meta !== 'undefined' && (import.meta as any)?.env) as EnvSource;
    if (!env) return undefined;
    return env[normalizeKey(key)] ?? env[key];
  } catch {
    return undefined;
  }
};

const readFromProcess = (key: string): string | undefined => {
  try {
    const env = (typeof process !== 'undefined' && (process as any)?.env) as EnvSource;
    if (!env) return undefined;
    return env[normalizeKey(key)] ?? env[key];
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
