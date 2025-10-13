import React from 'react';
import { FeedbackItem } from '../types';
import ThumbsUpIcon from './icons/ThumbsUpIcon';
import ThumbsDownIcon from './icons/ThumbsDownIcon';
import QuestionMarkIcon from './icons/QuestionMarkIcon';
import PaintBrushIcon from './icons/PaintBrushIcon';
import PencilIcon from './icons/PencilIcon';
import CompareIcon from './icons/CompareIcon';
import { debugLog } from '../utils/debug';

interface FeedbackPopoverProps {
  selectionText: string;
  position: DOMRect;
  positioningParentRef: React.RefObject<HTMLElement>;
  onFeedback: (feedback: Omit<FeedbackItem, 'id'>) => void;
  onEdit: () => void;
  onCompare: () => void;
  canCompare: boolean;
}

const FeedbackPopover: React.FC<FeedbackPopoverProps> = ({ selectionText, position, positioningParentRef, onFeedback, onEdit, onCompare, canCompare }) => {
  console.groupCollapsed('[FeedbackPopover] Render');
  
  if (!positioningParentRef.current) {
    console.log('Positioning parent ref is null. Not rendering.');
    console.groupEnd();
    return null;
  }

  const parentRect = positioningParentRef.current.getBoundingClientRect();

  // Calculate position relative to the positioning parent. `position` is viewport-relative.
  // So is `parentRect`. The difference gives the correct coords inside the parent.
  const top = position.top - parentRect.top - 45; // 45px offset to appear above the text and account for popover height
  const left = position.left - parentRect.left + (position.width / 2);

  console.log(`Selection text: "${selectionText}"`);
  console.log('Position (from prop):', position);
  console.log('Parent Rect:', parentRect);
  console.log(`Calculated CSS - top: ${top}px, left: ${left}px`);
  console.groupEnd();

  const handleFeedback = (type: '👍' | '👎' | '?' | '🎨') => {
    console.log(`[FeedbackPopover] Button clicked: ${type}`);
    onFeedback({ selection: selectionText, type });
  };

  return (
    <div
      className="absolute z-50 flex items-center gap-1 p-2 bg-gray-800 dark:bg-gray-900 text-white rounded-lg shadow-2xl transition-transform transform -translate-x-1/2"
      style={{ top: `${top}px`, left: `${left}px` }}
      onMouseDown={(e) => e.preventDefault()} // Prevents text deselection
    >
      <button onClick={() => handleFeedback('👍')} className="p-2 rounded-full hover:bg-green-600 transition-colors duration-200">
        <ThumbsUpIcon className="w-5 h-5" />
      </button>
      <button onClick={() => handleFeedback('👎')} className="p-2 rounded-full hover:bg-red-600 transition-colors duration-200">
        <ThumbsDownIcon className="w-5 h-5" />
      </button>
      <button onClick={() => handleFeedback('?')} className="p-2 rounded-full hover:bg-blue-600 transition-colors duration-200">
        <QuestionMarkIcon className="w-5 h-5" />
      </button>
      <button onClick={() => handleFeedback('🎨')} className="p-2 rounded-full hover:bg-purple-600 transition-colors duration-200">
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
    </div>
  );
};

export default FeedbackPopover;
