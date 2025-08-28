
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

  // Use useCallback with [ref] to create a stable function that always has the latest ref.current
  const handleMouseUp = useCallback(() => {
    // The handler now runs on every mouseup event anywhere on the page.
    // It must first check if our target element even exists yet.
    if (!ref.current) {
      return; // Not ready yet, do nothing.
    }
    
    if (selDebugEnabled()) console.groupCollapsed('[useTextSelection] MouseUp Event');
    const currentSelection = window.getSelection();

    // The logic is now: IF a selection exists AND it is inside our target element, then update the state.
    if (currentSelection && currentSelection.rangeCount > 0 && currentSelection.toString().trim().length > 0 && ref.current.contains(currentSelection.anchorNode)) {
      const text = currentSelection.toString().trim();
      const range = currentSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      if (selDebugEnabled()) console.log(`Selected text: "${text}"`);
      if (selDebugEnabled()) console.log('Selection is within the target element.');
      setSelection({ text, rect });
      if (selDebugEnabled()) console.log('State updated with new selection.');
    } else {
      // OTHERWISE (no selection, or selection is outside our element), clear the state.
      // This ensures clicking outside the box dismisses the popover.
      if (selDebugEnabled()) console.log('Selection is empty or outside the target element. Clearing state.');
      setSelection(null);
    }
    if (selDebugEnabled()) console.groupEnd();
  }, [ref]); // Dependency on the stable ref object

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
    document.addEventListener('scroll', clearSelection, true);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('scroll', clearSelection, true);
    };
  }, [handleMouseUp, clearSelection]); // These dependencies are stable, so this runs once.

  return { selection, clearSelection };
};
