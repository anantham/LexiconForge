import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';

type PersistOpts<T> = {
  version?: number;
  migrate?: (oldValue: unknown, oldVersion: number) => T;
  decode?: (json: unknown) => T;
  encode?: (value: T) => unknown;
  syncAcrossTabs?: boolean;
};

function usePersistentState<T>(
  storageKey: string,
  defaultValue: T,
  opts: PersistOpts<T> = {}
): [T, Dispatch<SetStateAction<T>>] {
  const { version = 1, migrate, decode, encode, syncAcrossTabs } = opts;

  const [value, setValue] = useState<T>(() => {
    try {
      const savedStateJSON = localStorage.getItem(storageKey);
      if (savedStateJSON !== null) {
        const parsed = JSON.parse(savedStateJSON);
        const storedVer = typeof parsed?.__v === 'number' ? parsed.__v : 0;
        const payload = parsed?.value ?? parsed;
        const decoded = decode ? decode(payload) : (payload as T);
        return storedVer === version && !migrate
          ? decoded
          : (migrate ? migrate(decoded, storedVer) : decoded);
      }
    } catch (error) {
      console.error(`Failed to load state for key "${storageKey}" from localStorage`, error);
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      const payload = encode ? encode(value) : value;
      localStorage.setItem(storageKey, JSON.stringify({ __v: version, value: payload }));
    } catch (error) {
      console.error(`Failed to save state for key "${storageKey}" to localStorage`, error);
    }
  }, [storageKey, version, value, encode]);

  useEffect(() => {
    if (!syncAcrossTabs) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey || e.newValue == null) return;
      try {
        const parsed = JSON.parse(e.newValue);
        const payload = parsed?.value ?? parsed;
        setValue(decode ? decode(payload) : (payload as T));
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey, syncAcrossTabs, decode]);

  return [value, setValue];
}

export default usePersistentState;
