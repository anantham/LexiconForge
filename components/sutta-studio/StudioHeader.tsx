import { useState } from 'react';
import type { ReactNode } from 'react';
import { StudioProgress } from './StudioProgress';
import { SettingsPanel, type StudioSettings } from './SettingsPanel';

export function StudioHeader({
  backToReaderUrl,
  showProgress,
  progressLabel,
  progressOverdue,
  settings,
  onSettingsChange,
  debugButton,
}: {
  backToReaderUrl?: string | null;
  showProgress: boolean;
  progressLabel: string;
  progressOverdue?: boolean;
  settings: StudioSettings;
  onSettingsChange: (settings: StudioSettings) => void;
  debugButton?: ReactNode;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      {backToReaderUrl && (
        <a
          href={backToReaderUrl}
          className="absolute top-6 left-6 w-10 h-10 rounded-full flex items-center justify-center border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 hover:bg-slate-900/60 transition"
          title="Back to Reader"
          aria-label="Back to Reader"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
            <path fill="currentColor" d="M14.5 6l-6 6 6 6 1.4-1.4L11.3 12l4.6-4.6L14.5 6z" />
          </svg>
        </a>
      )}

      <div className="absolute top-6 right-6 flex items-center gap-2 z-50 select-none">
        {debugButton}
        <StudioProgress show={showProgress} label={progressLabel} overdue={progressOverdue} />

        {/* Settings gear icon */}
        <div className="relative">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`w-10 h-10 rounded-full flex items-center justify-center border transition ${
              settingsOpen
                ? 'border-emerald-500 text-emerald-400 bg-slate-900'
                : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 hover:bg-slate-900/60'
            }`}
            title="Settings"
            aria-label="Settings"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
          </button>

          <SettingsPanel
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            settings={settings}
            onSettingsChange={onSettingsChange}
          />
        </div>
      </div>
    </>
  );
}
