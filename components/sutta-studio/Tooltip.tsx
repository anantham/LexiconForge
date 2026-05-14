import { motion } from 'framer-motion';
import { useLayoutEffect, useRef, useState } from 'react';

export function Tooltip({
  text,
  facetIndex,
  facetTotal,
}: {
  text: string;
  /** 0-indexed facet currently shown. Only set when there are multiple facets. */
  facetIndex?: number;
  /** Total facet count for this segment. Only set when > 1. */
  facetTotal?: number;
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
  // Tooltip left position in offsetParent coords. null = use default center
  // anchor (Tailwind left-1/2 + -translate-x-1/2); a number = position
  // computed by clamp logic below to keep tooltip inside viewport.
  const [leftPx, setLeftPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const parent = ref.current.offsetParent as HTMLElement | null;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const tooltipRect = ref.current.getBoundingClientRect();

    // Vertical: flip below segment when too close to top of viewport.
    const shouldFlip = parentRect.top < tooltipRect.height + 16;
    if (shouldFlip !== flipBelow) setFlipBelow(shouldFlip);

    // Horizontal: if the centered tooltip would overflow the viewport,
    // pin it 8px from the offending edge instead. This is the mobile fix —
    // when a word near the left edge has a wide tooltip, the centered
    // position spills off-screen; clamp it to the viewport.
    const margin = 8;
    const viewportWidth = window.innerWidth;
    const overflowLeft = margin - tooltipRect.left; // > 0 if overflowing left
    const overflowRight = tooltipRect.right - (viewportWidth - margin); // > 0 if overflowing right

    let newLeftPx: number | null = null;
    if (overflowLeft > 0) {
      // Shift right by overflowLeft from the current measured position.
      // tooltipRect.left is viewport-relative; convert to parent-relative.
      newLeftPx = margin - parentRect.left;
    } else if (overflowRight > 0) {
      // Pin right edge to viewportWidth - margin.
      newLeftPx = viewportWidth - margin - parentRect.left - tooltipRect.width;
    }
    if (newLeftPx !== leftPx) setLeftPx(newLeftPx);
  }, [flipBelow, leftPx, text, facetIndex, facetTotal]);

  // When a segment has multiple tooltip facets (e.g., "Meaning", "What English
  // hides", "Example", …), show a small "1/3" indicator so the reader knows
  // clicking advances to the next facet.
  const hasFacets = typeof facetIndex === 'number' && typeof facetTotal === 'number' && facetTotal > 1;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      // The tooltip body shouldn't intercept hovers from the segment below it
      // (which would re-trigger setHovered cycles). pointer-events-none keeps
      // hover targeting clean.
      //
      // Position: by default centered on parent (left-1/2 + translateX -50%).
      // When the clamp logic above detects viewport overflow, leftPx is set
      // and we override with an absolute parent-relative position (no
      // translateX). Inline style wins over Tailwind for both.
      className={`absolute ${
        leftPx === null ? 'left-1/2 -translate-x-1/2' : ''
      } ${flipBelow ? 'top-full mt-3' : 'bottom-full mb-3'} bg-slate-900/90 border border-slate-700 text-slate-200 text-xs leading-relaxed px-3 py-2 rounded shadow-xl whitespace-normal break-words text-left z-50 select-none pointer-events-none`}
      style={{
        // Inline maxWidth — Tailwind arbitrary-value parsing chokes on nested
        // CSS functions like `min(28rem, calc(100vw - 1rem))`. Inline style
        // always works.
        maxWidth: 'min(28rem, calc(100vw - 1rem))',
        // Width should be content's natural size, capped by maxWidth above.
        // Without this the tooltip would shrink narrower than needed.
        width: 'max-content',
        ...(leftPx !== null ? { left: `${leftPx}px` } : {}),
      }}
    >
      {hasFacets && (
        <span className="absolute -top-1.5 -left-1.5 inline-flex items-center justify-center px-1 h-4 text-[9px] leading-none bg-slate-900 border border-slate-700 text-slate-400 rounded-full tabular-nums">
          {(facetIndex ?? 0) + 1}/{facetTotal}
        </span>
      )}
      {text}
    </motion.div>
  );
}
