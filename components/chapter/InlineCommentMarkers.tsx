import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { FeedbackItem } from '../../types';

interface MarkerPosition {
  feedback: FeedbackItem;
  top: number;
}

interface InlineCommentMarkersProps {
  feedback: FeedbackItem[];
  contentRef: React.RefObject<HTMLDivElement>;
  onScrollToText: (text: string) => void;
}

/** Find the vertical position of a text snippet within the content container. */
function findTextTop(root: HTMLElement, text: string): number | null {
  if (!text) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const content = node.textContent || '';
    const idx = content.indexOf(text);
    if (idx !== -1) {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + text.length);
      const rootRect = root.getBoundingClientRect();
      const rect = range.getBoundingClientRect();
      return rect.top - rootRect.top;
    }
  }
  return null;
}

const InlineCommentMarkers: React.FC<InlineCommentMarkersProps> = ({
  feedback,
  contentRef,
  onScrollToText,
}) => {
  const [positions, setPositions] = useState<MarkerPosition[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const computeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computePositions = useCallback(() => {
    const root = contentRef.current;
    if (!root) return;

    const items = feedback.filter((f) => f.selection);
    const computed: MarkerPosition[] = [];

    for (const item of items) {
      const top = findTextTop(root, item.selection!);
      if (top !== null) {
        computed.push({ feedback: item, top });
      }
    }

    // De-overlap: push markers apart if they're within 32px of each other
    computed.sort((a, b) => a.top - b.top);
    for (let i = 1; i < computed.length; i++) {
      if (computed[i].top - computed[i - 1].top < 32) {
        computed[i] = { ...computed[i], top: computed[i - 1].top + 32 };
      }
    }

    setPositions(computed);
  }, [feedback, contentRef]);

  useEffect(() => {
    // Debounce position computation to avoid thrashing during renders
    if (computeTimeoutRef.current) clearTimeout(computeTimeoutRef.current);
    computeTimeoutRef.current = setTimeout(computePositions, 150);
    return () => {
      if (computeTimeoutRef.current) clearTimeout(computeTimeoutRef.current);
    };
  }, [computePositions]);

  // Recompute on resize
  useEffect(() => {
    const onResize = () => computePositions();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [computePositions]);

  if (positions.length === 0) return null;

  return (
    <div className="absolute top-0 right-[calc(100%+8px)] w-6 hidden lg:block" style={{ height: '100%' }}>
      {positions.map(({ feedback: item, top }) => (
        <div
          key={item.id}
          className="absolute flex items-start"
          style={{ top: `${top}px`, right: 0 }}
        >
          <button
            onClick={() => {
              if (expandedId === item.id) {
                setExpandedId(null);
              } else {
                setExpandedId(item.id);
                if (item.selection) onScrollToText(item.selection);
              }
            }}
            className={`
              w-6 h-6 rounded-full flex items-center justify-center text-xs
              shadow-md cursor-pointer transition-all duration-200
              ${item.type === '👍' ? 'bg-green-500/90 hover:bg-green-400' :
                item.type === '👎' ? 'bg-red-500/90 hover:bg-red-400' :
                item.type === '?' ? 'bg-blue-500/90 hover:bg-blue-400' :
                'bg-gray-500/90 hover:bg-gray-400'}
            `}
            title={item.comment || item.selection || ''}
          >
            {item.type === '👍' ? '+' : item.type === '👎' ? '-' : item.type === '?' ? '?' : item.type || '.'}
          </button>
          {expandedId === item.id && (
            <div className="absolute right-8 top-0 z-50 w-56 p-2 rounded-lg shadow-xl bg-gray-800 text-white text-xs whitespace-normal">
              <div className="font-medium text-gray-300 mb-1 truncate">
                "{item.selection?.slice(0, 60)}{(item.selection?.length || 0) > 60 ? '...' : ''}"
              </div>
              {item.comment && (
                <div className="text-gray-100 mt-1">{item.comment}</div>
              )}
              {!item.comment && (
                <div className="text-gray-400 italic">No comment</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default InlineCommentMarkers;
