import { useEffect, useState } from 'react';

export type ReaderPreferences = { tooltips: boolean; scale: number };

const loadPreferences = (storageKey: string): ReaderPreferences => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const stored: unknown = JSON.parse(raw);
      if (stored !== null && typeof stored === 'object') {
        return {
          tooltips: !('tooltips' in stored) || stored.tooltips !== false,
          scale: 'scale' in stored && typeof stored.scale === 'number' ? stored.scale : 1,
        };
      }
    }
  } catch {
    // Unavailable storage or malformed saved data must not prevent reading.
  }
  return { tooltips: true, scale: 1 };
};

export const useReaderPreferences = (storageKey: string) => {
  const [preferences, setPreferences] = useState(() => loadPreferences(storageKey));

  const updatePreferences = (patch: Partial<ReaderPreferences>) => {
    setPreferences((previous) => {
      const next = { ...previous, ...patch };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Keep the in-memory preference when browser storage is unavailable.
      }
      return next;
    });
  };

  // Scale every rem-based glyph and alignment measurement together.
  useEffect(() => {
    document.documentElement.style.fontSize = `${Math.round(preferences.scale * 100)}%`;
    return () => {
      document.documentElement.style.fontSize = '';
    };
  }, [preferences.scale]);

  return { preferences, updatePreferences };
};
