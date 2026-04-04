/**
 * ThreadSelector - Category tab bar + thread list popover
 *
 * Provides category tabs (Characters, Tone, Locations, etc.) and a searchable
 * list of threads. The "Custom" tab allows keyword search to create new threads.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '../../store';
import type { ThreadData, ThreadMetadata } from '../../types/oscilloscope';

const CATEGORIES = [
  { key: 'character', label: 'Characters' },
  { key: 'tone', label: 'Tone' },
  { key: 'location', label: 'Locations' },
  { key: 'entity', label: 'Entities' },
  { key: 'meta', label: 'Meta' },
  { key: 'custom', label: 'Custom' },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]['key'];

interface ThreadSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

const ThreadSelector: React.FC<ThreadSelectorProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<CategoryKey>('character');
  const [keyword, setKeyword] = useState('');
  const [isComputing, setIsComputing] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const availableThreads = useAppStore((s) => s.availableThreads);
  const activeThreadIds = useAppStore((s) => s.activeThreadIds);
  const threads = useAppStore((s) => s.threads);
  const toggleThread = useAppStore((s) => s.toggleThread);
  const computeKeywordThread = useAppStore((s) => s.computeKeywordThread);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  // Filter threads by active category
  const filteredThreads = useMemo(() => {
    return availableThreads
      .filter((m) => m.category === activeTab)
      .sort((a, b) => b.chaptersCovered - a.chaptersCovered);
  }, [availableThreads, activeTab]);

  // Count threads per category for badge
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of availableThreads) {
      counts[m.category] = (counts[m.category] ?? 0) + 1;
    }
    return counts;
  }, [availableThreads]);

  const handleKeywordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || isComputing) return;

    setIsComputing(true);
    try {
      // For now, use a stub search function. In production this would call
      // the backend or search the loaded text corpus.
      await computeKeywordThread(keyword.trim(), async (query) => {
        // Stub: no real search backend yet
        console.warn('[ThreadSelector] Keyword search not connected to backend yet:', query);
        return [];
      });
      setKeyword('');
    } finally {
      setIsComputing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute top-full left-0 mt-1 z-50 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-xl overflow-hidden"
    >
      {/* Category tabs */}
      <div className="flex overflow-x-auto border-b border-gray-700">
        {CATEGORIES.map(({ key, label }) => {
          const count = categoryCounts[key] ?? 0;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`
                flex-shrink-0 px-3 py-2 text-xs font-medium transition-colors
                ${activeTab === key
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
                  : 'text-gray-400 hover:text-gray-200'
                }
              `}
            >
              {label}
              {count > 0 && (
                <span className="ml-1 text-gray-500">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Thread list or custom keyword input */}
      <div className="max-h-60 overflow-y-auto p-2">
        {activeTab === 'custom' ? (
          <div className="space-y-2">
            <form onSubmit={handleKeywordSubmit} className="flex gap-2">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search keyword..."
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-400"
              />
              <button
                type="submit"
                disabled={!keyword.trim() || isComputing}
                className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isComputing ? '...' : 'Add'}
              </button>
            </form>

            {/* Show existing custom threads */}
            {filteredThreads.map((meta) => (
              <ThreadRow
                key={meta.threadId}
                meta={meta}
                isActive={activeThreadIds.has(meta.threadId)}
                color={threads.get(meta.threadId)?.color ?? '#ec4899'}
                onToggle={toggleThread}
              />
            ))}

            {filteredThreads.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">
                Type a keyword and click Add to create a custom thread.
              </p>
            )}
          </div>
        ) : (
          <>
            {filteredThreads.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">
                No {activeTab} threads available.
              </p>
            ) : (
              <div className="space-y-0.5">
                {filteredThreads.map((meta) => (
                  <ThreadRow
                    key={meta.threadId}
                    meta={meta}
                    isActive={activeThreadIds.has(meta.threadId)}
                    color={threads.get(meta.threadId)?.color ?? '#6b7280'}
                    onToggle={toggleThread}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/** Single thread row in the selector list. */
const ThreadRow: React.FC<{
  meta: ThreadMetadata;
  isActive: boolean;
  color: string;
  onToggle: (id: string) => void;
}> = ({ meta, isActive, color, onToggle }) => (
  <button
    onClick={() => onToggle(meta.threadId)}
    className={`
      w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors
      ${isActive
        ? 'bg-gray-700 text-gray-100'
        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
      }
    `}
  >
    <span
      className="w-3 h-3 rounded-full flex-shrink-0"
      style={{
        background: isActive ? color : 'transparent',
        border: `2px solid ${color}`,
      }}
    />
    <span className="flex-1 truncate">{meta.label}</span>
    <span className="text-xs text-gray-500 flex-shrink-0">
      {meta.chaptersCovered} ch
    </span>
  </button>
);

export default ThreadSelector;
