import { motion } from 'framer-motion';

export function Tooltip({ text, pinned = false }: { text: string; pinned?: boolean }) {
  // Pinned tooltips look visually distinct from hover tooltips:
  //   - emerald border instead of slate
  //   - a small × glyph in the corner indicating "click target to unpin"
  // The × is decorative (pointer-events-none); unpinning happens by
  // clicking the pinned segment itself.
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      className={`absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900/90 border ${
        pinned ? 'border-emerald-700/70' : 'border-slate-700'
      } text-slate-200 text-xs px-3 py-2 rounded shadow-xl whitespace-nowrap z-50 pointer-events-none select-none`}
    >
      {pinned && (
        <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-4 h-4 text-[9px] leading-none bg-slate-900 border border-emerald-700/70 text-emerald-400/80 rounded-full">
          ×
        </span>
      )}
      {text}
    </motion.div>
  );
}
