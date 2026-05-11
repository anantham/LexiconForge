import { motion } from 'framer-motion';

export function Tooltip({
  text,
  pinned = false,
  facetIndex,
  facetTotal,
  onUnpin,
}: {
  text: string;
  pinned?: boolean;
  /** 0-indexed facet currently shown. Only set when there are multiple facets. */
  facetIndex?: number;
  /** Total facet count for this segment. Only set when > 1. */
  facetTotal?: number;
  /** Click handler for the × glyph. Only enables the × when supplied (typically on pinned). */
  onUnpin?: () => void;
}) {
  // Pinned tooltips look visually distinct from hover tooltips:
  //   - emerald border instead of slate
  //   - small × glyph (interactive: clicking unpins, if onUnpin supplied)
  // When a segment has multiple tooltip facets (e.g., "Meaning", "What English
  // hides", "Example", …), show a small "1/3" indicator so the reader knows
  // clicking again advances to the next facet.
  const hasFacets = typeof facetIndex === 'number' && typeof facetTotal === 'number' && facetTotal > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      className={`absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900/90 border ${
        pinned ? 'border-emerald-700/70' : 'border-slate-700'
      } text-slate-200 text-xs px-3 py-2 rounded shadow-xl whitespace-nowrap z-50 select-none ${
        // The tooltip body itself should not intercept hovers from the segment
        // below it (which would re-trigger setHovered cycles). The × button
        // re-enables pointer events on its own element only.
        'pointer-events-none'
      }`}
    >
      {hasFacets && (
        <span className="absolute -top-1.5 -left-1.5 inline-flex items-center justify-center px-1 h-4 text-[9px] leading-none bg-slate-900 border border-slate-700 text-slate-400 rounded-full tabular-nums">
          {(facetIndex ?? 0) + 1}/{facetTotal}
        </span>
      )}
      {pinned && onUnpin && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUnpin();
          }}
          className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center w-4 h-4 text-[9px] leading-none bg-slate-900 border border-emerald-700/70 text-emerald-400/80 rounded-full pointer-events-auto cursor-pointer hover:text-emerald-300 hover:border-emerald-600"
          aria-label="Unpin tooltip"
          title="Click to close"
        >
          ×
        </button>
      )}
      {text}
    </motion.div>
  );
}
