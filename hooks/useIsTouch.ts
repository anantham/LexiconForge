import { useEffect, useState } from 'react';

/**
 * Detect whether the current device is touch-first (no hover + coarse pointer).
 * Used by ChapterView and other components to pick mobile-friendly overlays.
 */
export const useIsTouch = (): boolean => {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const update = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsTouch('matches' in event ? event.matches : (event as MediaQueryList).matches);
    };
    update(mq);
    mq.addEventListener?.('change', update as any);
    return () => mq.removeEventListener?.('change', update as any);
  }, []);

  return isTouch;
};
