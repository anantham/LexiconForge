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
  onSelfInsert?: () => void;
  enableSillyTavern?: boolean;
}

const FeedbackPopover: React.FC<FeedbackPopoverProps> = ({ selectionText, position, positioningParentRef, onFeedback, onEdit, onCompare, canCompare, onSelfInsert, enableSillyTavern }) => {
  const [pendingType, setPendingType] = useState<'👍' | '👎' | '?' | null>(null);
  const [comment, setComment] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pendingType && inputRef.current) {
      inputRef.current.focus();
    }
  }, [pendingType]);

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
        <div className="flex items-center gap-1 p-2">
          <span className="text-lg pl-1">{pendingType}</span>
          <input
            ref={inputRef}
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitWithComment();
              if (e.key === 'Escape') skipComment();
            }}
            placeholder="Add a comment..."
            className="bg-gray-700 text-white text-sm rounded px-2 py-1 w-48 outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-400"
          />
          <button onClick={submitWithComment} className="px-2 py-1 text-xs bg-blue-600 rounded hover:bg-blue-700">
            Save
          </button>
          <button onClick={skipComment} className="px-2 py-1 text-xs bg-gray-600 rounded hover:bg-gray-500">
            Skip
          </button>
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
                onClick={onSelfInsert}
                className="p-2 rounded-full hover:bg-amber-700 transition-colors duration-200"
                title="Enter Story — Self-insert into SillyTavern"
              >
                <PortalIcon className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FeedbackPopover;
