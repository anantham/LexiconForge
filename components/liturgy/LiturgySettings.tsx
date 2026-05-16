import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Page-level reader preferences. Lives in localStorage so the reader's
 * choices persist across page loads and across chants.
 *
 * Kept deliberately small — each setting must answer "what changes if this
 * is off?" If the answer is "I'd have to add documentation explaining what
 * it does," it doesn't belong here.
 */

export type LiturgySettings = {
  /** Show subtle hue accents on refrain words (Buddhaṁ=sky, Dhammaṁ=amber, etc.). */
  showAccents: boolean;
  /**
   * Show a small Roman / phonetic transliteration line beneath non-Latin
   * scripts (Chinese, Japanese, Tibetan, Devanāgarī). Helps readers who
   * can't read the source script pronounce it.
   */
  showTransliteration: boolean;
};

const DEFAULT_SETTINGS: LiturgySettings = {
  showAccents: true,
  showTransliteration: true,
};

const STORAGE_KEY = 'liturgy:settings';

const SettingsCtx = createContext<{
  settings: LiturgySettings;
  setSettings: React.Dispatch<React.SetStateAction<LiturgySettings>>;
}>({
  settings: DEFAULT_SETTINGS,
  setSettings: () => undefined,
});

function loadFromStorage(): LiturgySettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const LiturgySettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<LiturgySettings>(loadFromStorage);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore quota / private mode
    }
  }, [settings]);

  return (
    <SettingsCtx.Provider value={{ settings, setSettings }}>
      {children}
    </SettingsCtx.Provider>
  );
};

export function useLiturgySettings() {
  return useContext(SettingsCtx);
}

/**
 * Small gear icon + popover for toggling settings. Fixed to top-right so
 * it doesn't compete with the back-link.
 */
export const SettingsButton: React.FC = () => {
  const { settings, setSettings } = useLiturgySettings();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed top-4 right-6 z-40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Reader settings"
        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-emerald-300 hover:bg-slate-900/40 transition-colors"
        title="Reader settings"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-slate-900/95 border border-slate-700 rounded shadow-xl text-sm w-64 p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">Reader</div>
          <label className="flex items-center justify-between text-slate-300 cursor-pointer hover:text-slate-100">
            <span>Refrain colors</span>
            <input
              type="checkbox"
              checked={settings.showAccents}
              onChange={(e) => setSettings({ ...settings, showAccents: e.target.checked })}
              className="accent-emerald-500"
            />
          </label>
          <div className="text-[10px] text-slate-600 mt-1 leading-snug">
            Sky/amber/rose on Buddha/Dhamma/Sangha to mark the refrain rhythm.
          </div>
          <label className="flex items-center justify-between text-slate-300 cursor-pointer hover:text-slate-100 mt-4">
            <span>Show transliteration</span>
            <input
              type="checkbox"
              checked={settings.showTransliteration}
              onChange={(e) => setSettings({ ...settings, showTransliteration: e.target.checked })}
              className="accent-emerald-500"
            />
          </label>
          <div className="text-[10px] text-slate-600 mt-1 leading-snug">
            Roman / phonetic line beneath Chinese, Japanese, Tibetan, Devanāgarī — for pronunciation.
          </div>
        </div>
      )}
    </div>
  );
};
