type EnvRecord = Record<string, string | undefined>;
type EnvSource = EnvRecord | undefined;

const readPublicDbBackend = (): string | undefined => {
  try {
    return import.meta.env.VITE_DB_BACKEND;
  } catch {
    return undefined;
  }
};

const CLIENT_ENV_ALLOWLIST: EnvRecord = {
  DB_BACKEND: readPublicDbBackend(),
};

const readFromProcess = (key: string): string | undefined => {
  if (typeof window !== 'undefined' || typeof process === 'undefined') {
    return undefined;
  }

  try {
    const env = process.env as EnvSource;
    return env ? env[key] : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Read an explicitly public client setting or a Node-only process variable.
 *
 * Never dynamically index import.meta.env here. Vite would serialize every VITE_ variable
 * into the browser bundle, including provider credentials added by a deployment operator.
 */
export const getEnvVar = (key: string): string | undefined => {
  return CLIENT_ENV_ALLOWLIST[key] ?? readFromProcess(key);
};
