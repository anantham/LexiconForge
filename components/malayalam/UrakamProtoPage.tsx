import React, { useEffect, useRef, useState } from 'react';
import { ConceptInterlinear } from '../liturgy/concept/ConceptInterlinear';
import { URAKAM_SENTENCE_1 } from '../../data/malayalam/urakam-ammathiruvadi';
import { URAKAM_TIER1 } from '../../data/malayalam/urakam-tier1';

// Curated sentence 1 (full unit spine + concepts) followed by the whole
// legend at Tier 1 (deterministic sounds + Opus-draft English witness).
const ALL_SEGMENTS = [...URAKAM_SENTENCE_1, ...URAKAM_TIER1];

const SERIF = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";

/** Reader preferences — persisted so the choice survives visits. */
type ReaderPrefs = { tooltips: boolean; scale: number };
const PREFS_KEY = 'ml-reader-prefs';
const loadPrefs = (): ReaderPrefs => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { tooltips: p.tooltips !== false, scale: typeof p.scale === 'number' ? p.scale : 1 };
    }
  } catch {
    /* private mode / parse error → defaults */
  }
  return { tooltips: true, scale: 1 };
};

/**
 * Malayalam studio reader (`/malayalam/urakam-ammathiruvadi`).
 *
 * Aithihyamala ch. 64 (public domain, 1909): curated opening + Tier-1 rest.
 * Reader controls live behind a subtle gear (the Sutta Studio settings
 * pattern): tooltips on/off (highlights and threads stay either way) and the
 * text-size slider. Scale drives ROOT font-size so every rem-based measure
 * (glyphs, sounds, tooltips, thread geometry) reflows together.
 */
export const UrakamProtoPage: React.FC = () => {
  const [prefs, setPrefs] = useState<ReaderPrefs>(loadPrefs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const update = (patch: Partial<ReaderPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* best-effort persistence */
      }
      return next;
    });
  };

  // Root font-size drives every rem unit in the interlinear. Reset on leave.
  useEffect(() => {
    document.documentElement.style.fontSize = `${Math.round(prefs.scale * 100)}%`;
    return () => {
      document.documentElement.style.fontSize = '';
    };
  }, [prefs.scale]);

  // Close the panel on outside click or Escape.
  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    const t = setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between">
          <a href="/malayalam" className="text-emerald-400/70 hover:text-emerald-300 text-sm">
            ← Malayalam Studio
          </a>

          {/* Settings gear — Sutta Studio's pattern */}
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition ${
                settingsOpen
                  ? 'border-emerald-500 text-emerald-400 bg-slate-900'
                  : 'border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-600 hover:bg-slate-900/60'
              }`}
              title="Reader settings"
              aria-label="Reader settings"
              aria-expanded={settingsOpen}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </button>

            {settingsOpen && (
              <div className="absolute top-11 right-0 w-60 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-[100] p-4 text-left">
                <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-3" style={{ fontFamily: SERIF }}>
                  Reader
                </div>

                <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
                  <span className="text-sm text-slate-300">Tooltips</span>
                  <input
                    type="checkbox"
                    checked={prefs.tooltips}
                    onChange={(e) => update({ tooltips: e.target.checked })}
                    className="accent-emerald-500 w-4 h-4"
                  />
                </label>
                <p className="mt-1 text-[11px] leading-snug text-slate-600">
                  Off = quiet reading: highlights and alignment threads stay, popups don't.
                </p>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>Text size</span>
                    <span className="text-slate-500 text-xs">{Math.round(prefs.scale * 100)}%</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-slate-500">
                    <span style={{ fontSize: '0.7rem', fontFamily: SERIF }}>Aa</span>
                    <input
                      type="range"
                      min={0.85}
                      max={1.7}
                      step={0.05}
                      value={prefs.scale}
                      onChange={(e) => update({ scale: Number(e.target.value) })}
                      className="w-full accent-emerald-500"
                      aria-label="Text size"
                    />
                    <span style={{ fontSize: '1.05rem', fontFamily: SERIF }}>Aa</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-14 text-center text-sm text-slate-500 italic" style={{ fontFamily: SERIF }}>
          Aithihyamala · Kottarathil Sankunni, 1909 · public domain · the full legend — opening deep-curated, the rest Tier-1
        </p>
        <p className="mt-1 mb-16 text-center text-xs text-slate-600" style={{ fontFamily: SERIF }}>
          English witness: Opus draft (2026) — unreviewed machine translation, shown for alignment, not authority
        </p>

        <ConceptInterlinear segments={ALL_SEGMENTS} tooltips={prefs.tooltips} />

        <p className="mt-20 text-center text-xs text-slate-600" style={{ fontFamily: SERIF }}>
          Malayalam source:{' '}
          <a
            className="underline decoration-slate-700 hover:text-slate-400"
            href="https://ml.wikisource.org/wiki/%E0%B4%90%E0%B4%A4%E0%B4%BF%E0%B4%B9%E0%B5%8D%E0%B4%AF%E0%B4%AE%E0%B4%BE%E0%B4%B2/%E0%B4%8A%E0%B4%B0%E0%B4%95%E0%B4%A4%E0%B5%8D%E0%B4%A4%E0%B5%8D%20%E0%B4%85%E0%B4%AE%E0%B5%8D%E0%B4%AE%E0%B4%A4%E0%B4%BF%E0%B4%B0%E0%B5%81%E0%B4%B5%E0%B4%9F%E0%B4%BF"
            target="_blank"
            rel="noreferrer"
          >
            ml.wikisource
          </a>{' '}
          · glosses &amp; concept cards drafted by Opus, native review pending
        </p>
      </div>
    </div>
  );
};

export default UrakamProtoPage;
