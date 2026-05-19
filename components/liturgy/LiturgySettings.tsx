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
  /** Show subtle hue accents on refrain words (Buddha=amber, Dharma=sky, Sangha=rose). */
  showAccents: boolean;
  /**
   * Show a small Roman / phonetic transliteration line beneath non-Latin
   * scripts (Chinese, Japanese, Tibetan, Devanāgarī). Helps readers who
   * can't read the source script pronounce it.
   */
  showTransliteration: boolean;
  /**
   * Multiplier on the chant body's base font size. 1.0 = default
   * (mn10-matching large chant rendering). Range 0.7–1.6 via the
   * settings slider. Applied as a `--liturgy-scale` CSS variable on
   * the LiturgyChantPage wrapper; chant-body Tailwind classes read it
   * via `text-[calc(var(--liturgy-scale,1)*Xrem)]`.
   */
  fontScale: number;
};

const DEFAULT_SETTINGS: LiturgySettings = {
  showAccents: true,
  showTransliteration: true,
  fontScale: 1.0,
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
        <div className="absolute right-0 top-full mt-2 bg-slate-900/95 border border-slate-700 rounded shadow-xl text-sm w-72 p-3">
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
          {/* Color legend — visible while the toggle is on, so the reader
              knows what each accent marks. Buddha=amber, Dharma=sky,
              Sangha=rose by convention across all chants and scripts. */}
          {settings.showAccents && (
            <div className="mt-2 space-y-1 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-sm bg-amber-400/80" />
                <span className="text-amber-300/80">Buddha</span>
                <span className="text-slate-500">— 佛 / Butsu / Buddhaṁ</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-sm bg-sky-400/80" />
                <span className="text-sky-300/80">Dharma</span>
                <span className="text-slate-500">— 法 / Hō / Dhammaṁ</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-sm bg-rose-400/80" />
                <span className="text-rose-300/80">Sangha</span>
                <span className="text-slate-500">— 僧 / Sō / Saṅghaṁ</span>
              </div>
            </div>
          )}
          <div className="text-[10px] text-slate-600 mt-1 leading-snug">
            Same color across every script (Sanskrit, Pāli, Chinese, Japanese, Tibetan, English) so the eye can track each refuge across translations.
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
            Phonetic line beneath the chant: romanization beneath non-Latin scripts, pronunciation respelling beneath Latin scripts.
          </div>
          {/* Font-size slider — multiplies the chant body. Default 1.0
              matches the mn10 demo's large chant rendering. */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-slate-300">
              <span>Chant text size</span>
              <span className="text-[10px] text-slate-500 tabular-nums">{Math.round(settings.fontScale * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.7}
              max={1.6}
              step={0.05}
              value={settings.fontScale}
              onChange={(e) => setSettings({ ...settings, fontScale: parseFloat(e.target.value) })}
              className="w-full mt-2 accent-emerald-500"
              aria-label="Chant body font size"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-600 mt-1">
              <button
                type="button"
                onClick={() => setSettings({ ...settings, fontScale: 0.85 })}
                className="hover:text-emerald-400"
              >Small</button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, fontScale: 1.0 })}
                className="hover:text-emerald-400"
              >Default</button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, fontScale: 1.2 })}
                className="hover:text-emerald-400"
              >Large</button>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, fontScale: 1.45 })}
                className="hover:text-emerald-400"
              >XL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
