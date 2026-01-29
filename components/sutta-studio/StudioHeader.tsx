import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { StudioProgress } from './StudioProgress';

export function StudioHeader({
  backToReaderUrl,
  showProgress,
  progressLabel,
  progressOverdue,
  studyMode,
  onToggleStudy,
  debugButton,
}: {
  backToReaderUrl?: string | null;
  showProgress: boolean;
  progressLabel: string;
  progressOverdue?: boolean;
  studyMode: boolean;
  onToggleStudy: () => void;
  debugButton?: ReactNode;
}) {
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
        <div
          data-interactive="true"
          onClick={onToggleStudy}
          className={`w-10 h-5 rounded-full p-1 cursor-pointer transition-colors ${
            studyMode ? 'bg-emerald-500' : 'bg-slate-700'
          }`}
          title="Toggle study mode"
          aria-label="Toggle study mode"
          role="button"
        >
          <motion.div
            layout
            className="w-3 h-3 bg-white rounded-full"
            animate={{ x: studyMode ? 20 : 0 }}
          />
        </div>
      </div>
    </>
  );
}
