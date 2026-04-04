import React, { useEffect, useState, useRef } from 'react';
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
  handleFeedbackSubmit: (feedback: { type: FeedbackItem['type']; selection: string; comment?: string }) => void;
  clearSelection: () => void;
  viewRef: React.RefObject<HTMLDivElement>;
}

interface SelectionSheetProps {
  selection: SelectionInfo;
  onReact: (emoji: '👍' | '❤️' | '😂' | '🎨' | '✏️' | '🔍', comment?: string) => void;
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
  const [pendingEmoji, setPendingEmoji] = useState<'👍' | '❤️' | '😂' | null>(null);
  const [comment, setComment] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const blockContextMenu = (event: Event) => event.preventDefault();
    document.addEventListener('contextmenu', blockContextMenu, { passive: false });
    return () => document.removeEventListener('contextmenu', blockContextMenu as any);
  }, []);

  useEffect(() => {
    if (pendingEmoji && inputRef.current) inputRef.current.focus();
  }, [pendingEmoji]);

  const handleEmojiClick = (emoji: '👍' | '❤️' | '😂' | '🎨' | '✏️' | '🔍') => {
    if (emoji === '🎨' || emoji === '✏️' || emoji === '🔍') {
      onReact(emoji);
      return;
    }
    setPendingEmoji(emoji);
  };

  const submitWithComment = () => {
    if (!pendingEmoji) return;
    onReact(pendingEmoji, comment.trim() || undefined);
    setPendingEmoji(null);
    setComment('');
  };

  const skipComment = () => {
    if (!pendingEmoji) return;
    onReact(pendingEmoji);
    setPendingEmoji(null);
    setComment('');
  };

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[70] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-xl rounded-t-2xl bg-gray-900/95 text-white shadow-2xl p-3">
        {pendingEmoji ? (
          <div className="flex items-center gap-2">
            <span className="text-xl">{pendingEmoji}</span>
            <input
              ref={inputRef}
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitWithComment();
              }}
              placeholder="Add a comment..."
              className="flex-1 bg-white/10 text-white rounded px-3 py-2 text-sm outline-none placeholder-gray-400"
            />
            <button onClick={submitWithComment} className="px-3 py-2 rounded bg-blue-600 text-sm">Save</button>
            <button onClick={skipComment} className="px-3 py-2 rounded bg-white/10 text-sm">Skip</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button className="p-3 text-xl" onClick={() => handleEmojiClick('👍')}>👍</button>
            <button className="p-3 text-xl" onClick={() => handleEmojiClick('❤️')}>❤️</button>
            <button className="p-3 text-xl" onClick={() => handleEmojiClick('😂')}>😂</button>
            <button className="p-3 text-xl" onClick={() => handleEmojiClick('🎨')}>🎨</button>
            <button className="p-3 text-xl" onClick={() => handleEmojiClick('✏️')}>✏️</button>
            <button
              className={`p-3 text-xl ${canCompare && !isComparing ? '' : 'opacity-40 cursor-not-allowed'}`}
              onClick={() => {
                debugLog('comparison', 'summary', '[SelectionSheet] Compare button clicked', { canCompare, isComparing });
                if (canCompare && !isComparing) {
                  debugLog('comparison', 'summary', '[SelectionSheet] Invoking compare action');
                  handleEmojiClick('🔍');
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
        )}
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
  if (viewMode === 'original' || !selection || inlineEditActive) {
    return null;
  }

  if (isTouch) {
    return (
      <SelectionSheet
        selection={selection}
        canCompare={canCompare}
        isComparing={comparisonLoading}
        onReact={(emoji, comment) => {
          if (emoji === '✏️') {
            beginInlineEdit();
          } else if (emoji === '🔍') {
            handleCompareRequest();
          } else {
            handleFeedbackSubmit({ type: emoji, selection: selection.text, comment });
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
