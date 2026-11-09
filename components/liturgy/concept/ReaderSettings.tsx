import React, { useEffect, useRef, useState } from 'react';
import type { ReaderPreferences } from '../../../hooks/useReaderPreferences';

const SERIF = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";

type ReaderSettingsProps = {
  preferences: ReaderPreferences;
  onChange: (_patch: Partial<ReaderPreferences>) => void;
  tooltipDescription: string;
};

export const ReaderSettings: React.FC<ReaderSettingsProps> = ({
  preferences,
  onChange,
  tooltipDescription,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close the panel on outside click or Escape.
  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && e.target instanceof Node && !panelRef.current.contains(e.target)) setSettingsOpen(false);
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
              checked={preferences.tooltips}
              onChange={(e) => onChange({ tooltips: e.target.checked })}
              className="accent-emerald-500 w-4 h-4"
            />
          </label>
          <p className="mt-1 text-[11px] leading-snug text-slate-600">
            {tooltipDescription}
          </p>

          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Text size</span>
              <span className="text-slate-500 text-xs">{Math.round(preferences.scale * 100)}%</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-slate-500">
              <span style={{ fontSize: '0.7rem', fontFamily: SERIF }}>Aa</span>
              <input
                type="range"
                min={0.85}
                max={1.7}
                step={0.05}
                value={preferences.scale}
                onChange={(e) => onChange({ scale: Number(e.target.value) })}
                className="w-full accent-emerald-500"
                aria-label="Text size"
              />
              <span style={{ fontSize: '1.05rem', fontFamily: SERIF }}>Aa</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
