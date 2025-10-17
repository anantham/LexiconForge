import { useEffect, useRef } from 'react';
import type { DiffMarker } from '../services/diff/types';

/**
 * Hook for keyboard navigation through diff markers
 * Provides Alt+J (next) and Alt+K (previous) shortcuts
 */
export function useDiffNavigation(markers: DiffMarker[], enabled: boolean = true) {
  const currentIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (!enabled || markers.length === 0) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Alt+J: Jump to next marker
      if (e.altKey && e.key === 'j') {
        e.preventDefault();
        currentIndexRef.current = (currentIndexRef.current + 1) % markers.length;
        jumpToMarker(markers[currentIndexRef.current]);
      }

      // Alt+K: Jump to previous marker
      if (e.altKey && e.key === 'k') {
        e.preventDefault();
        currentIndexRef.current = currentIndexRef.current <= 0
          ? markers.length - 1
          : currentIndexRef.current - 1;
        jumpToMarker(markers[currentIndexRef.current]);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [markers, enabled]);

  function jumpToMarker(marker: DiffMarker) {
    // Try to find the paragraph element by position
    const targetElement = document.querySelector(`[data-lf-chunk*="para-${marker.position}"]`);

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Add highlight class for visual feedback
      targetElement.classList.add('diff-highlight');
      setTimeout(() => targetElement.classList.remove('diff-highlight'), 2000);
    } else {
      // Fallback: try to scroll to approximate position using character offset
      const content = document.querySelector('[data-translation-content]');
      if (content) {
        const scrollPercentage = marker.aiRange.start / (content.textContent?.length || 1);
        content.scrollTop = scrollPercentage * content.scrollHeight;
      }
    }
  }
}
