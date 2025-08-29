
import { useState, useEffect, RefObject, useCallback } from 'react';

// Local debug gate for selection logs (only at FULL level)
const selDebugEnabled = (): boolean => {
  try {
    return localStorage.getItem('LF_AI_DEBUG_LEVEL') === 'full';
  } catch { return false; }
};

interface Selection {
  text: string;
  rect: DOMRect;
}

export const useTextSelection = (ref: RefObject<HTMLElement>) => {
  const [selection, setSelection] = useState<Selection | null>(null);

  // Helpers
  const within = (root: HTMLElement, node: Node | null): boolean => !!node && (root === node || root.contains(node));
  const getUnionRect = (range: Range): DOMRect => {
    try {
      const rects = Array.from(range.getClientRects?.() ?? []);
      if (rects.length > 0) {
        const x1 = Math.min(...rects.map(r => r.left));
        const y1 = Math.min(...rects.map(r => r.top));
        const x2 = Math.max(...rects.map(r => r.right));
        const y2 = Math.max(...rects.map(r => r.bottom));
        return new DOMRect(x1, y1, x2 - x1, y2 - y1);
      }
    } catch {}
    try {
      return (range.getBoundingClientRect && range.getBoundingClientRect()) || new DOMRect(0, 0, 0, 0);
    } catch { return new DOMRect(0, 0, 0, 0); }
  };

  // Use useCallback with [ref] to create a stable function that always has the latest ref.current
  const handleMouseUp = useCallback(() => {
    const root = ref.current;
    if (!root || typeof window === 'undefined' || typeof document === 'undefined') return;

    if (selDebugEnabled()) console.groupCollapsed('[useTextSelection] MouseUp Event');
    const currentSelection = window.getSelection && window.getSelection();

    if (
      currentSelection &&
      currentSelection.rangeCount > 0 &&
      !currentSelection.isCollapsed &&
      currentSelection.toString().trim().length > 0
    ) {
      const range = currentSelection.getRangeAt(0);
      // Ensure selection start and end are inside the container
      const startOk = within(root, (range as any).startContainer ?? null);
      const endOk = within(root, (range as any).endContainer ?? null);
      if (!startOk || !endOk) {
        if (selDebugEnabled()) console.log('Selection crosses outside container. Clearing.');
        setSelection(null);
        if (selDebugEnabled()) console.groupEnd();
        return;
      }

      const text = currentSelection.toString().trim();
      if (!text) {
        setSelection(null);
        if (selDebugEnabled()) console.groupEnd();
        return;
      }
      const rect = getUnionRect(range);
      if (selDebugEnabled()) console.log(`Selected text: "${text}"`);
      setSelection({ text, rect });
      if (selDebugEnabled()) console.log('State updated with new selection.');
    } else {
      if (selDebugEnabled()) console.log('Selection is empty or outside the target element. Clearing state.');
      setSelection(null);
    }
    if (selDebugEnabled()) console.groupEnd();
  }, [ref]);

  const clearSelection = useCallback(() => {
      // console.log('[useTextSelection] clearSelection called.');
      setSelection(null);
      if(window.getSelection()){
          window.getSelection()?.removeAllRanges();
      }
  }, []);

  useEffect(() => {
    // This effect now runs only once on mount and cleans up on unmount.
    // The handlers are stable thanks to useCallback.
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('scroll', clearSelection, { capture: true, passive: true } as any);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelection(null); };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('scroll', clearSelection, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [handleMouseUp, clearSelection]);

  return { selection, clearSelection };
};
