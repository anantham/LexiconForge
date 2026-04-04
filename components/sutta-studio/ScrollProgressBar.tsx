import { AnimatePresence, motion } from 'framer-motion';

type ScrollProgressBarProps = {
  currentIndex: number;
  total: number;
  visible: boolean;
  phaseIds: string[];
};

/**
 * Vertical progress bar on the right edge showing scroll position through phases.
 * Auto-hides 1.5s after scrolling stops.
 */
export function ScrollProgressBar({
  currentIndex,
  total,
  visible,
  phaseIds,
}: ScrollProgressBarProps) {
  if (total <= 1) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          transition={{ duration: 0.2 }}
          className="fixed right-3 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-0.5"
        >
          {/* Phase dots */}
          {phaseIds.map((id, i) => (
            <button
              key={id}
              onClick={() => {
                document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`rounded-full transition-all duration-200 ${
                i === currentIndex
                  ? 'w-2.5 h-2.5 bg-emerald-400'
                  : 'w-1.5 h-1.5 bg-slate-600 hover:bg-slate-400'
              }`}
              title={`Phase ${i + 1}`}
            />
          ))}

          {/* Counter label */}
          <span className="text-[10px] text-slate-500 mt-1 font-mono">
            {currentIndex + 1}/{total}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
