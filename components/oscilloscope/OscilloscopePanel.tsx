/**
 * OscilloscopePanel - Main container for the Narrative Oscilloscope
 *
 * Collapsible panel: expanded shows full graph + legend, collapsed shows minimap.
 * Contains the toolbar with thread category tabs, keyword search, zoom reset,
 * and expand/collapse toggle.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../../store';
import OscilloscopeGraph from './OscilloscopeGraph';
import ThreadLegend from './ThreadLegend';
import ThreadSelector from './ThreadSelector';
import OscilloscopeMinimap from './OscilloscopeMinimap';
import { loadOscilloscopeData } from './loadOscilloscopeData';

/**
 * Toolbar component shown in expanded mode.
 * Contains thread selector trigger, zoom reset, and collapse button.
 */
const OscilloscopeToolbar: React.FC<{
  onCollapse: () => void;
}> = ({ onCollapse }) => {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const totalChapters = useAppStore((s) => s.totalChapters);
  const setZoomRange = useAppStore((s) => s.setZoomRange);
  const zoomRange = useAppStore((s) => s.zoomRange);
  const hoveredChapter = useAppStore((s) => s.hoveredChapter);

  const isZoomed = zoomRange[0] !== 1 || zoomRange[1] !== totalChapters;

  const handleZoomReset = useCallback(() => {
    setZoomRange([1, totalChapters]);
  }, [setZoomRange, totalChapters]);

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700">
      <div className="flex items-center gap-3">
        {/* Thread selector trigger */}
        <div className="relative">
          <button
            onClick={() => setSelectorOpen(!selectorOpen)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-300 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
            Threads
          </button>
          <ThreadSelector
            isOpen={selectorOpen}
            onClose={() => setSelectorOpen(false)}
          />
        </div>

        {/* Hovered chapter indicator */}
        {hoveredChapter !== null && (
          <span className="text-xs text-gray-400">
            Ch. {hoveredChapter}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Zoom reset */}
        {isZoomed && (
          <button
            onClick={handleZoomReset}
            className="px-2 py-1 text-xs text-gray-400 bg-gray-700 rounded hover:bg-gray-600 hover:text-gray-200 transition-colors"
            title="Reset zoom to show all chapters"
          >
            Reset Zoom
          </button>
        )}

        {/* Zoom range display */}
        <span className="text-xs text-gray-500">
          {zoomRange[0]}–{zoomRange[1]}
        </span>

        {/* Collapse button */}
        <button
          onClick={onCollapse}
          className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
          title="Collapse oscilloscope"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 15l7-7 7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

/**
 * Main oscilloscope panel. Only renders when data is loaded.
 */
const OscilloscopePanel: React.FC = () => {
  const isLoaded = useAppStore((s) => s.isLoaded);
  const isExpanded = useAppStore((s) => s.isExpanded);
  const setExpanded = useAppStore((s) => s.setExpanded);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-load oscilloscope data from public directory
  useEffect(() => {
    if (isLoaded || isLoading) return;
    setIsLoading(true);
    loadOscilloscopeData(
      '/oscilloscope-data/_all_meta.json',
      '/oscilloscope-data/_character_threads.json',
      3457, // FMoC total chapters — will be dynamic later
    )
      .then(() => setIsLoading(false))
      .catch((err) => {
        setLoadError(err?.message || 'Failed to load oscilloscope data');
        setIsLoading(false);
      });
  }, [isLoaded, isLoading]);

  if (loadError) return null; // silently hide if no data available
  if (!isLoaded) return null;

  return (
    <div className="oscilloscope-panel border border-gray-700 rounded-lg mb-4 bg-gray-900 overflow-hidden">
      {isExpanded ? (
        <>
          <OscilloscopeToolbar onCollapse={() => setExpanded(false)} />
          <OscilloscopeGraph isExpanded />
          <ThreadLegend />
        </>
      ) : (
        <OscilloscopeMinimap />
      )}
    </div>
  );
};

export default OscilloscopePanel;
