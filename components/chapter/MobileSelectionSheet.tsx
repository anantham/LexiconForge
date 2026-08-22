import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { debugLog } from '../../utils/debug';

type ReactionEmoji = '👍' | '❤️' | '😂';
type SelectionAction = ReactionEmoji | '🎨' | '✏️' | '🔍';

interface MobileSelectionSheetProps {
  selectedText: string;
  onReact: (_emoji: SelectionAction, _comment?: string) => void;
  onCopy: () => void | Promise<void>;
  onClose: () => void;
  canCompare: boolean;
  isComparing: boolean;
  onSelfInsert?: () => void | Promise<void>;
  enableSillyTavern?: boolean;
}

const primaryButtonClass =
  'min-h-12 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium transition-colors active:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40';
const utilityButtonClass =
  'min-h-11 rounded-xl bg-white/10 px-3 py-2 text-sm transition-colors active:bg-white/20';

export const MobileSelectionSheet: React.FC<MobileSelectionSheetProps> = ({
  selectedText,
  onReact,
  onCopy,
  onClose,
  canCompare,
  isComparing,
  onSelfInsert,
  enableSillyTavern,
}) => {
  const [pendingEmoji, setPendingEmoji] = useState<ReactionEmoji | null>(null);
  const [comment, setComment] = useState('');
  const [isSelfInsertPending, setIsSelfInsertPending] = useState(false);
  const isSelfInsertPendingRef = useRef(false);
  const [isIllustrationPending, setIsIllustrationPending] = useState(false);
  const illustrationPendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (illustrationPendingTimeoutRef.current) {
      clearTimeout(illustrationPendingTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const blockContextMenu = (event: Event) => event.preventDefault();
    document.addEventListener('contextmenu', blockContextMenu, { passive: false });
    return () => document.removeEventListener('contextmenu', blockContextMenu);
  }, []);

  useEffect(() => {
    if (pendingEmoji && inputRef.current) inputRef.current.focus();
  }, [pendingEmoji]);

  const handleAction = (action: SelectionAction) => {
    if (action === '🎨') {
      if (isIllustrationPending) return;
      setIsIllustrationPending(true);
      onReact(action);
      if (illustrationPendingTimeoutRef.current) {
        clearTimeout(illustrationPendingTimeoutRef.current);
      }
      illustrationPendingTimeoutRef.current = setTimeout(() => {
        setIsIllustrationPending(false);
      }, 1200);
      return;
    }
    if (action === '✏️' || action === '🔍') {
      onReact(action);
      return;
    }
    setPendingEmoji(action);
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
    <aside
      role="dialog"
      aria-label="Selected text actions"
      className="fixed inset-x-0 bottom-0 z-[70] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto max-w-xl space-y-3 rounded-t-2xl bg-gray-900/95 p-3 text-white shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Selected passage</div>
            <div className="truncate text-sm text-gray-100" data-testid="selected-text-preview">
              {selectedText}
            </div>
          </div>
          <button type="button" className={`${utilityButtonClass} shrink-0`} onClick={onClose}>
            Done
          </button>
        </div>

        {pendingEmoji ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden="true">{pendingEmoji}</span>
              <input
                ref={inputRef}
                type="text"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                onMouseDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitWithComment();
                }}
                placeholder="Add a comment…"
                aria-label="Reaction comment"
                className="min-h-11 min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={submitWithComment} className="min-h-11 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium">
                Save reaction
              </button>
              <button type="button" onClick={skipComment} className={utilityButtonClass}>
                Skip comment
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={`grid gap-2 ${enableSillyTavern && onSelfInsert ? 'grid-cols-2' : 'grid-cols-3'}`}>
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => handleAction('🎨')}
                disabled={isIllustrationPending}
                aria-busy={isIllustrationPending}
                data-testid="illustration-button"
              >
                <span aria-hidden="true">{isIllustrationPending ? '⟳' : '🎨'}</span>{' '}
                {isIllustrationPending ? 'Starting…' : 'Illustrate'}
              </button>
              <button type="button" className={primaryButtonClass} onClick={() => handleAction('✏️')}>
                <span aria-hidden="true">✏️</span> Edit
              </button>
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => {
                  debugLog('comparison', 'summary', '[MobileSelectionSheet] Compare clicked', { canCompare, isComparing });
                  if (canCompare && !isComparing) handleAction('🔍');
                }}
                disabled={!canCompare || isComparing}
              >
                <span aria-hidden="true">🔍</span> {isComparing ? 'Comparing…' : 'Compare'}
              </button>
              {enableSillyTavern && onSelfInsert && (
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={async () => {
                    if (isSelfInsertPendingRef.current) return;
                    isSelfInsertPendingRef.current = true;
                    setIsSelfInsertPending(true);
                    try {
                      await onSelfInsert();
                    } finally {
                      isSelfInsertPendingRef.current = false;
                      setIsSelfInsertPending(false);
                    }
                  }}
                  disabled={isSelfInsertPending}
                  aria-busy={isSelfInsertPending}
                  data-testid="portal-self-insert-button"
                >
                  <span aria-hidden="true">{isSelfInsertPending ? '⟳' : '🌀'}</span>{' '}
                  {isSelfInsertPending ? 'Entering…' : 'Enter story'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2" aria-label="Reactions and copy">
              {(['👍', '❤️', '😂'] as const).map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`${utilityButtonClass} text-lg`}
                  onClick={() => handleAction(emoji)}
                  aria-label={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
              <button
                type="button"
                className={utilityButtonClass}
                onClick={() => {
                  navigator.vibrate?.(10);
                  void onCopy();
                }}
              >
                Copy
              </button>
            </div>
          </>
        )}
      </div>
    </aside>,
    document.body,
  );
};
