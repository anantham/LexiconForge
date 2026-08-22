import React, { useEffect, useState } from 'react';

const DISMISSED_KEY = 'lf-mobile-selection-hint-dismissed-v1';

interface MobileSelectionHintProps {
  isTouch: boolean;
  viewMode: 'original' | 'fan' | 'english';
  selectionActive: boolean;
}

const persistDismissal = () => {
  try {
    localStorage.setItem(DISMISSED_KEY, 'true');
  } catch (error) {
    console.warn(
      '[MobileSelectionHint] Could not persist dismissal; the hint will remain dismissed for this page only.',
      error,
    );
  }
};

const readDismissal = (): boolean => {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  } catch (error) {
    console.warn(
      '[MobileSelectionHint] Could not read persisted dismissal; showing the hint for this page.',
      error,
    );
    return false;
  }
};

const MobileSelectionHint: React.FC<MobileSelectionHintProps> = ({
  isTouch,
  viewMode,
  selectionActive,
}) => {
  const [dismissed, setDismissed] = useState(readDismissal);

  useEffect(() => {
    if (!isTouch || viewMode === 'original' || !selectionActive) return;
    setDismissed(true);
    persistDismissal();
  }, [isTouch, selectionActive, viewMode]);

  if (!isTouch || viewMode === 'original' || selectionActive || dismissed) {
    return null;
  }

  return (
    <div
      role="status"
      data-testid="mobile-selection-hint"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 mx-auto flex max-w-sm items-center gap-2 rounded-2xl border border-white/10 bg-gray-900/95 px-3 py-2 text-sm text-white shadow-xl backdrop-blur"
    >
      <span aria-hidden="true" className="text-lg">☝️</span>
      <span className="min-w-0 flex-1">Long-press text, then choose <strong>Illustrate</strong>.</span>
      <button
        type="button"
        aria-label="Dismiss text selection hint"
        className="min-h-11 min-w-11 rounded-xl bg-white/10 text-xl"
        onClick={() => {
          setDismissed(true);
          persistDismissal();
        }}
      >
        ×
      </button>
    </div>
  );
};

export default MobileSelectionHint;
