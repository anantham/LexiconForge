import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

/**
 * Track which phase is currently in the viewport center using IntersectionObserver.
 * Returns the index of the "current" phase and a visibility flag that
 * auto-hides 1.5 seconds after scrolling stops.
 */
export function useScrollProgress(
  phaseIds: string[],
  scrollContainerRef: RefObject<HTMLElement | null>
) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Track which phase sections are intersecting
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || phaseIds.length === 0) return;

    // Map of phaseId → intersection ratio
    const ratios = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.intersectionRatio);
        }

        // Find the phase with the highest intersection ratio
        let bestId = phaseIds[0];
        let bestRatio = 0;
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }

        const idx = phaseIds.indexOf(bestId);
        if (idx !== -1) setCurrentIndex(idx);
      },
      {
        root: container,
        // Sample at multiple thresholds for smoother tracking
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      }
    );

    for (const id of phaseIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [phaseIds, scrollContainerRef]);

  // Show on scroll, auto-hide after 1.5s of inactivity
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setVisible(true);
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setVisible(false), 1500);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(hideTimerRef.current);
    };
  }, [scrollContainerRef]);

  return { currentIndex, total: phaseIds.length, visible };
}
