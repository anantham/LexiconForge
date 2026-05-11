import { motion } from 'framer-motion';
import { useLayoutEffect, useRef, useState } from 'react';

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
  // Auto-flip tooltip below the segment when there isn't room above. Phase-a
  // (the opening of the sutta) sits at the top of the scroll container; with
  // the default "above the segment" position the tooltip would render off-
  // screen. useLayoutEffect measures before paint so there's no visible flash.
  //
  // We measure the *segment* (offsetParent), not the tooltip — measuring the
  // tooltip causes oscillation: above → top<8 → flip below → top>8 → flip
  // back → infinite loop. The segment's position is invariant under flip.
  const ref = useRef<HTMLDivElement>(null);
  const [flipBelow, setFlipBelow] = useState(false);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const parent = ref.current.offsetParent as HTMLElement | null;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const tooltipHeight = ref.current.getBoundingClientRect().height;
    // Flip below if there isn't enough room above the segment for the tooltip
    // (plus a small margin for breathing room).
    const shouldFlip = parentRect.top < tooltipHeight + 16;
    if (shouldFlip !== flipBelow) setFlipBelow(shouldFlip);
  }, [flipBelow, text, pinned, facetIndex, facetTotal]);
  // Pinned tooltips look visually distinct from hover tooltips:
  //   - emerald border instead of slate
  //   - small × glyph (interactive: clicking unpins, if onUnpin supplied)
  // When a segment has multiple tooltip facets (e.g., "Meaning", "What English
  // hides", "Example", …), show a small "1/3" indicator so the reader knows
  // clicking again advances to the next facet.
  const hasFacets = typeof facetIndex === 'number' && typeof facetTotal === 'number' && facetTotal > 1;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      // Width + wrap: long facet text would clip past viewport on right-edge
      // segments. Bounded max-width + wrapping keeps the tooltip multi-line
      // but never wider than 90vw.
      // Vertical: above segment by default (keeps English row visible);
      // flips to below when near top-of-viewport (e.g. phase-a). Flip is
      // decided in useLayoutEffect — before paint, no visible flash.
      className={`absolute left-1/2 -translate-x-1/2 ${
        flipBelow ? 'top-full mt-3' : 'bottom-full mb-3'
      } bg-slate-900/90 border ${
        pinned ? 'border-emerald-700/70' : 'border-slate-700'
      } text-slate-200 text-xs leading-relaxed px-3 py-2 rounded shadow-xl whitespace-normal break-words text-left max-w-[min(28rem,90vw)] w-max z-50 select-none ${
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
