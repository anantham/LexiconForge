import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { FeedbackItem } from '../../types';
import FeedbackPopover from '../FeedbackPopover';
import { debugLog } from '../../utils/debug';

type SelectionInfo = {
  text: string;
  rect: DOMRect;
};

interface SelectionOverlayProps {
  selection: SelectionInfo | null;
  viewMode: 'original' | 'fan' | 'english';
  isTouch: boolean;
  inlineEditActive: boolean;
  canCompare: boolean;
  comparisonLoading: boolean;
  beginInlineEdit: () => void;
  handleCompareRequest: () => void;
  handleFeedbackSubmit: (feedback: { type: FeedbackItem['type']; selection: string }) => void;
  clearSelection: () => void;
  viewRef: React.RefObject<HTMLDivElement>;
}

interface SelectionSheetProps {
  selection: SelectionInfo;
  onReact: (emoji: '👍' | '❤️' | '😂' | '🎨' | '✏️' | '🔍') => void;
  onCopy: () => void;
  onClose: () => void;
  canCompare: boolean;
  isComparing: boolean;
}

const SelectionSheet: React.FC<SelectionSheetProps> = ({
  selection,
  onReact,
  onCopy,
  onClose,
  canCompare,
  isComparing,
}) => {
  useEffect(() => {
    const blockContextMenu = (event: Event) => event.preventDefault();
    document.addEventListener('contextmenu', blockContextMenu, { passive: false });
    return () => document.removeEventListener('contextmenu', blockContextMenu as any);
  }, []);

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[70] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-xl rounded-t-2xl bg-gray-900/95 text-white shadow-2xl p-3">
        <div className="flex items-center gap-2">
          <button className="p-3 text-xl" onClick={() => onReact('👍')}>👍</button>
          <button className="p-3 text-xl" onClick={() => onReact('❤️')}>❤️</button>
          <button className="p-3 text-xl" onClick={() => onReact('😂')}>😂</button>
          <button className="p-3 text-xl" onClick={() => onReact('🎨')}>🎨</button>
          <button className="p-3 text-xl" onClick={() => onReact('✏️')}>✏️</button>
          <button
            className={`p-3 text-xl ${canCompare && !isComparing ? '' : 'opacity-40 cursor-not-allowed'}`}
            onClick={() => {
              debugLog('comparison', 'summary', '[SelectionSheet] Compare button clicked', { canCompare, isComparing });
              if (canCompare && !isComparing) {
                debugLog('comparison', 'summary', '[SelectionSheet] Invoking compare action');
                onReact('🔍');
              }
            }}
            disabled={!canCompare || isComparing}
          >
            🔍
          </button>
          <div className="grow" />
          <button
            className="px-3 py-2 rounded bg-white/10"
            onClick={() => {
              navigator.vibrate?.(10);
              onCopy();
            }}
          >
            Copy
          </button>
          <button className="px-3 py-2 rounded bg-white/10" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  selection,
  viewMode,
  isTouch,
  inlineEditActive,
  canCompare,
  comparisonLoading,
  beginInlineEdit,
  handleCompareRequest,
  handleFeedbackSubmit,
  clearSelection,
  viewRef,
}) => {
  if (viewMode !== 'english' || !selection || inlineEditActive) {
    return null;
  }

  if (isTouch) {
    return (
      <SelectionSheet
        selection={selection}
        canCompare={canCompare}
        isComparing={comparisonLoading}
        onReact={(emoji) => {
          if (emoji === '✏️') {
            beginInlineEdit();
          } else if (emoji === '🔍') {
            handleCompareRequest();
          } else {
            handleFeedbackSubmit({ type: emoji, selection: selection.text });
          }
        }}
        onCopy={async () => {
          try {
            await navigator.clipboard?.writeText(selection.text);
          } catch {
            // ignore clipboard failures
          }
        }}
        onClose={clearSelection}
      />
    );
  }

  return (
    <FeedbackPopover
      selectionText={selection.text}
      position={selection.rect}
      positioningParentRef={viewRef}
      onFeedback={handleFeedbackSubmit}
      onEdit={beginInlineEdit}
      onCompare={handleCompareRequest}
      canCompare={canCompare && !comparisonLoading}
    />
  );
};
