/**
 * ThreadLegend - Horizontal scrollable legend for active oscilloscope threads
 *
 * Shows each thread as a colored circle + label. Click to toggle.
 * Active threads have filled circles; inactive have outlined circles.
 */

import React, { useMemo } from 'react';
import { useAppStore } from '../../store';
import type { ThreadMetadata } from '../../types/oscilloscope';

const ThreadLegend: React.FC = () => {
  const availableThreads = useAppStore((s) => s.availableThreads);
  const activeThreadIds = useAppStore((s) => s.activeThreadIds);
  const threads = useAppStore((s) => s.threads);
  const toggleThread = useAppStore((s) => s.toggleThread);

  // Show only threads that are active or recently toggled — keep it manageable
  // by showing all available, sorted by active first then by chaptersCovered
  const sortedThreads = useMemo(() => {
    return [...availableThreads].sort((a, b) => {
      const aActive = activeThreadIds.has(a.threadId) ? 1 : 0;
      const bActive = activeThreadIds.has(b.threadId) ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return b.chaptersCovered - a.chaptersCovered;
    });
  }, [availableThreads, activeThreadIds]);

  // Determine if we're showing mixed categories
  const activeCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const id of activeThreadIds) {
      const t = threads.get(id);
      if (t) cats.add(t.category);
    }
    return cats;
  }, [activeThreadIds, threads]);

  const showCategory = activeCategories.size > 1;

  if (sortedThreads.length === 0) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600"
      style={{ maxHeight: 60 }}
    >
      {sortedThreads.map((meta: ThreadMetadata) => {
        const isActive = activeThreadIds.has(meta.threadId);
        const threadData = threads.get(meta.threadId);
        const color = threadData?.color ?? '#6b7280';

        return (
          <button
            key={meta.threadId}
            onClick={() => toggleThread(meta.threadId)}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded-full text-xs
              whitespace-nowrap transition-all duration-150
              ${isActive
                ? 'bg-gray-700 text-gray-100'
                : 'bg-transparent text-gray-500 hover:text-gray-300'
              }
            `}
            title={`${meta.label} (${meta.chaptersCovered} chapters, peak: ${meta.peakValue.toFixed(2)} at ch.${meta.peakChapter})`}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{
                background: isActive ? color : 'transparent',
                border: `2px solid ${color}`,
              }}
            />
            <span>
              {meta.label}
              {showCategory && (
                <span className="text-gray-500 ml-1">({meta.category})</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ThreadLegend;
