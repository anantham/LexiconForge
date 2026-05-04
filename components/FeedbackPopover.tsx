import React, { useState, useRef, useEffect } from 'react';
import { FeedbackItem } from '../types';
import ThumbsUpIcon from './icons/ThumbsUpIcon';
import ThumbsDownIcon from './icons/ThumbsDownIcon';
import QuestionMarkIcon from './icons/QuestionMarkIcon';
import PaintBrushIcon from './icons/PaintBrushIcon';
import PencilIcon from './icons/PencilIcon';
import CompareIcon from './icons/CompareIcon';
import PortalIcon from './icons/PortalIcon';
import { debugLog } from '../utils/debug';

interface FeedbackPopoverProps {
  selectionText: string;
  position: DOMRect;
  positioningParentRef: React.RefObject<HTMLElement>;
  onFeedback: (feedback: Omit<FeedbackItem, 'id'>) => void;
  onEdit: () => void;
  onCompare: () => void;
  canCompare: boolean;
  onSelfInsert?: () => void | Promise<void>;
  enableSillyTavern?: boolean;
}

const FeedbackPopover: React.FC<FeedbackPopoverProps> = ({ selectionText, position, positioningParentRef, onFeedback, onEdit, onCompare, canCompare, onSelfInsert, enableSillyTavern }) => {
  const [pendingType, setPendingType] = useState<'👍' | '👎' | '?' | null>(null);
  const [comment, setComment] = useState('');
  // Pending state for the portal/self-insert button — issue #4 fix.
  // Ref guards against synchronous re-entry (test environments + StrictMode);
  // state drives the visible disabled+spinner UI.
  const [isSelfInsertPending, setIsSelfInsertPending] = useState(false);
  const isSelfInsertPendingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (pendingType && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [pendingType]);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(40, textarea.scrollHeight)}px`;
    }
  };

  if (!positioningParentRef.current) return null;

  const parentRect = positioningParentRef.current.getBoundingClientRect();
  const top = position.top - parentRect.top - (pendingType ? 55 : 45);
  const left = position.left - parentRect.left + (position.width / 2);

  const handleEmojiClick = (type: '👍' | '👎' | '?' | '🎨') => {
    if (type === '🎨') {
      onFeedback({ selection: selectionText, type });
      return;
    }
    setPendingType(type);
  };

  const submitWithComment = () => {
    if (!pendingType) return;
    onFeedback({ selection: selectionText, type: pendingType, comment: comment.trim() || undefined });
    setPendingType(null);
    setComment('');
  };

  const skipComment = () => {
    if (!pendingType) return;
    onFeedback({ selection: selectionText, type: pendingType });
    setPendingType(null);
    setComment('');
  };

  return (
    <div
      className="absolute z-50 bg-gray-800 dark:bg-gray-900 text-white rounded-lg shadow-2xl transition-transform transform -translate-x-1/2"
      style={{ top: `${top}px`, left: `${left}px` }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {pendingType ? (
        <div className="flex items-start gap-1 p-2">
          <span className="text-lg pl-1 mt-1">{pendingType}</span>
          <textarea
            ref={textareaRef}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              adjustTextareaHeight();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                submitWithComment();
              }
              if (e.key === 'Escape') skipComment();
            }}
            placeholder="Add a comment..."
            rows={1}
            className="bg-gray-700 text-white text-sm rounded px-2 py-1 w-64 min-h-[40px] max-w-80 outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-400 resize-none overflow-hidden"
          />
          <div className="flex flex-col gap-1">
            <button onClick={submitWithComment} className="px-2 py-1 text-xs bg-blue-600 rounded hover:bg-blue-700">
              Save
            </button>
            <button onClick={skipComment} className="px-2 py-1 text-xs bg-gray-600 rounded hover:bg-gray-500">
              Skip
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1 p-2">
          <button onClick={() => handleEmojiClick('👍')} className="p-2 rounded-full hover:bg-green-600 transition-colors duration-200">
            <ThumbsUpIcon className="w-5 h-5" />
          </button>
          <button onClick={() => handleEmojiClick('👎')} className="p-2 rounded-full hover:bg-red-600 transition-colors duration-200">
            <ThumbsDownIcon className="w-5 h-5" />
          </button>
          <button onClick={() => handleEmojiClick('?')} className="p-2 rounded-full hover:bg-blue-600 transition-colors duration-200">
            <QuestionMarkIcon className="w-5 h-5" />
          </button>
          <div className="w-px h-5 bg-gray-600 mx-0.5" />
          <button onClick={() => handleEmojiClick('🎨')} className="p-2 rounded-full hover:bg-purple-600 transition-colors duration-200">
            <PaintBrushIcon className="w-5 h-5" />
          </button>
          <button onClick={onEdit} className="p-2 rounded-full hover:bg-blue-500 transition-colors duration-200" title="Edit selection">
            <PencilIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              debugLog('comparison', 'summary', '[FeedbackPopover] Compare button clicked', { selectionText, canCompare });
              if (canCompare) {
                debugLog('comparison', 'summary', '[FeedbackPopover] Invoking onCompare callback');
                onCompare();
              }
            }}
            className={`p-2 rounded-full transition-colors duration-200 ${canCompare ? 'hover:bg-teal-600' : 'opacity-40 cursor-not-allowed'}`}
            title={canCompare ? 'Compare with fan translation' : 'Comparison unavailable'}
            disabled={!canCompare}
          >
            <CompareIcon className="w-5 h-5" />
          </button>
          {enableSillyTavern && onSelfInsert && (
            <>
              <div className="w-px h-5 bg-gray-600 mx-0.5" />
              <button
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
                className={`p-2 rounded-full transition-colors duration-200 ${
                  isSelfInsertPending
                    ? 'opacity-60 cursor-wait'
                    : 'hover:bg-amber-700'
                }`}
                title={
                  isSelfInsertPending
                    ? 'Entering Story…'
                    : 'Enter Story — Self-insert into SillyTavern'
                }
              >
                {isSelfInsertPending ? (
                  <svg
                    className="w-5 h-5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-label="Loading"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray="50 100"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <PortalIcon className="w-5 h-5" />
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FeedbackPopover;
