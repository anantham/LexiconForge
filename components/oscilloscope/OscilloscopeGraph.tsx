/**
 * OscilloscopeGraph - uPlot wrapper for the Narrative Oscilloscope
 *
 * Renders thread data as time-series lines with chapters on the X axis.
 * uPlot is imperative, so we use a ref + useEffect to manage the instance.
 */

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useAppStore } from '../../store';
import type { ThreadData } from '../../types/oscilloscope';

interface OscilloscopeGraphProps {
  isExpanded: boolean;
}

/** Build uPlot data array from active threads. */
function buildData(
  activeThreads: ThreadData[],
  zoomRange: [number, number],
): uPlot.AlignedData {
  const [start, end] = zoomRange;
  const xValues: number[] = [];
  for (let ch = start; ch <= end; ch++) {
    xValues.push(ch);
  }

  const series: number[][] = activeThreads.map((thread) => {
    const slice: number[] = [];
    for (let ch = start; ch <= end; ch++) {
      const idx = ch - 1; // values are 0-indexed
      slice.push(idx < thread.values.length ? thread.values[idx] : 0);
    }
    return slice;
  });

  return [xValues, ...series];
}

/** Build uPlot series config from active threads. */
function buildSeriesConfig(activeThreads: ThreadData[]): uPlot.Series[] {
  return [
    {}, // x series placeholder
    ...activeThreads.map((thread) => ({
      label: thread.label,
      stroke: thread.color,
      width: 2,
      points: { show: false },
    })),
  ];
}

/** Build tooltip DOM content using safe DOM methods (no innerHTML). */
function buildTooltipContent(
  tooltipEl: HTMLDivElement,
  chapter: number,
  series: uPlot.Series[],
  data: uPlot.AlignedData,
  idx: number,
): void {
  // Clear existing content
  tooltipEl.textContent = '';

  // Chapter header
  const header = document.createElement('div');
  header.style.fontWeight = '600';
  header.style.marginBottom = '4px';
  header.textContent = `Chapter ${chapter}`;
  tooltipEl.appendChild(header);

  // Thread values
  for (let i = 1; i < series.length; i++) {
    const s = series[i];
    const val = data[i]?.[idx];
    if (val == null) continue;

    const color = typeof s.stroke === 'function' ? '#fff' : (s.stroke as string) || '#fff';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '6px';

    const dot = document.createElement('span');
    dot.style.width = '8px';
    dot.style.height = '8px';
    dot.style.borderRadius = '50%';
    dot.style.background = color;
    dot.style.display = 'inline-block';
    dot.style.flexShrink = '0';

    const label = document.createElement('span');
    label.textContent = `${s.label}: ${val.toFixed(3)}`;

    row.appendChild(dot);
    row.appendChild(label);
    tooltipEl.appendChild(row);
  }
}

const OscilloscopeGraph: React.FC<OscilloscopeGraphProps> = ({ isExpanded }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  // Store selectors
  const threads = useAppStore((s) => s.threads);
  const activeThreadIds = useAppStore((s) => s.activeThreadIds);
  const zoomRange = useAppStore((s) => s.zoomRange);
  const totalChapters = useAppStore((s) => s.totalChapters);
  const setHoveredChapter = useAppStore((s) => s.setHoveredChapter);
  const setZoomRange = useAppStore((s) => s.setZoomRange);
  const setCurrentChapter = useAppStore((s) => s.setCurrentChapter);

  // Current chapter position for "you are here" marker
  const currentChapterId = useAppStore((s) => s.currentChapterId);
  const chapters = useAppStore((s) => s.chapters);
  const currentChapterNumber = useMemo(() => {
    if (!currentChapterId) return null;
    const ch = chapters.get(currentChapterId);
    return ch?.chapterNumber ?? null;
  }, [currentChapterId, chapters]);

  // Derive active threads
  const activeThreads = useMemo(() => {
    const result: ThreadData[] = [];
    for (const id of activeThreadIds) {
      const thread = threads.get(id);
      if (thread) result.push(thread);
    }
    return result;
  }, [threads, activeThreadIds]);

  // Build data and series
  const data = useMemo(
    () => buildData(activeThreads, zoomRange),
    [activeThreads, zoomRange],
  );

  const seriesConfig = useMemo(
    () => buildSeriesConfig(activeThreads),
    [activeThreads],
  );

  // "You are here" vertical line plugin
  const youAreHerePlugin = useCallback((): uPlot.Plugin => {
    return {
      hooks: {
        draw: [
          (u: uPlot) => {
            if (currentChapterNumber === null) return;
            const ctx = u.ctx;
            const x = u.valToPos(currentChapterNumber, 'x', true);
            if (x < u.bbox.left || x > u.bbox.left + u.bbox.width) return;

            ctx.save();
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)'; // amber
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(x, u.bbox.top);
            ctx.lineTo(x, u.bbox.top + u.bbox.height);
            ctx.stroke();
            ctx.restore();
          },
        ],
      },
    };
  }, [currentChapterNumber]);

  // Click-to-navigate: click a point on the graph → navigate to that chapter
  const navigateToChapter = useCallback((chapterNumber: number) => {
    // Find the chapter's stableId by matching chapterNumber
    for (const [id, ch] of chapters) {
      if (ch.chapterNumber === chapterNumber) {
        setCurrentChapter(id);
        return;
      }
    }
  }, [chapters, setCurrentChapter]);

  // Tooltip plugin using safe DOM methods
  const tooltipPlugin = useCallback((): uPlot.Plugin => {
    let tooltipEl: HTMLDivElement | null = null;

    return {
      hooks: {
        init: [
          (u: uPlot) => {
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'oscilloscope-tooltip';
            tooltipEl.style.cssText = `
              position: absolute;
              pointer-events: none;
              background: rgba(17, 24, 39, 0.95);
              color: #e5e7eb;
              border: 1px solid rgba(75, 85, 99, 0.6);
              border-radius: 6px;
              padding: 8px 12px;
              font-size: 12px;
              line-height: 1.5;
              z-index: 100;
              display: none;
              white-space: nowrap;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            u.over.appendChild(tooltipEl);
          },
        ],
        setCursor: [
          (u: uPlot) => {
            if (!tooltipEl) return;
            const idx = u.cursor.idx;
            if (idx == null || idx < 0) {
              tooltipEl.style.display = 'none';
              setHoveredChapter(null);
              return;
            }

            const chapter = u.data[0][idx];
            if (chapter == null) {
              tooltipEl.style.display = 'none';
              return;
            }

            setHoveredChapter(chapter);

            // Build tooltip content with safe DOM methods
            buildTooltipContent(tooltipEl, chapter, u.series, u.data, idx);
            tooltipEl.style.display = 'block';

            // Position tooltip
            const cx = u.cursor.left ?? 0;
            const overRect = u.over.getBoundingClientRect();
            const ttWidth = tooltipEl.offsetWidth;

            // Flip tooltip to left if near right edge
            const xPos = cx + ttWidth + 20 > overRect.width
              ? cx - ttWidth - 10
              : cx + 10;
            tooltipEl.style.left = `${xPos}px`;
            tooltipEl.style.top = `${Math.max(0, (u.cursor.top ?? 0) - 10)}px`;
          },
        ],
      },
    };
  }, [setHoveredChapter]);

  // Create / recreate uPlot
  useEffect(() => {
    const container = containerRef.current;
    if (!container || activeThreads.length === 0) return;

    // Destroy old instance
    if (plotRef.current) {
      plotRef.current.destroy();
      plotRef.current = null;
    }

    const containerWidth = container.clientWidth;
    const height = isExpanded ? 280 : 40;

    const opts: uPlot.Options = {
      width: containerWidth,
      height,
      cursor: {
        show: isExpanded,
        x: true,
        y: false,
      },
      scales: {
        x: { time: false },
        y: { range: [0, 1] },
      },
      axes: [
        {
          show: isExpanded,
          label: 'Chapter',
          stroke: '#9ca3af',
          grid: { stroke: 'rgba(75, 85, 99, 0.3)' },
          ticks: { stroke: 'rgba(75, 85, 99, 0.3)' },
          font: '11px Inter, sans-serif',
          labelFont: '12px Inter, sans-serif',
        },
        {
          show: isExpanded,
          label: 'Value',
          stroke: '#9ca3af',
          grid: { stroke: 'rgba(75, 85, 99, 0.3)' },
          ticks: { stroke: 'rgba(75, 85, 99, 0.3)' },
          font: '11px Inter, sans-serif',
          labelFont: '12px Inter, sans-serif',
        },
      ],
      series: seriesConfig,
      plugins: isExpanded
        ? [youAreHerePlugin(), tooltipPlugin()]
        : [youAreHerePlugin()],
      hooks: {
        setScale: [
          (u: uPlot, scaleKey: string) => {
            if (scaleKey === 'x') {
              const min = u.scales.x.min ?? 1;
              const max = u.scales.x.max ?? totalChapters;
              setZoomRange([Math.round(min), Math.round(max)]);
            }
          },
        ],
      },
    };

    const plot = new uPlot(opts, data, container);
    plotRef.current = plot;

    return () => {
      plot.destroy();
      plotRef.current = null;
    };
    // We intentionally rebuild on these deps:
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreads, isExpanded, totalChapters]);

  // Update data without full rebuild when zoom or values change
  useEffect(() => {
    if (plotRef.current && data.length > 0) {
      plotRef.current.setData(data);
    }
  }, [data]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !plotRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0 && plotRef.current) {
          plotRef.current.setSize({
            width,
            height: isExpanded ? 280 : 40,
          });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [isExpanded]);

  if (activeThreads.length === 0) {
    return (
      <div className="flex items-center justify-center h-[280px] text-gray-500 text-sm">
        No threads active. Select threads from the legend below.
      </div>
    );
  }

  // Handle click on graph → navigate to hovered chapter
  const handleClick = useCallback(() => {
    const hoveredChapter = useAppStore.getState().hoveredChapter;
    if (hoveredChapter != null) {
      navigateToChapter(hoveredChapter);
    }
  }, [navigateToChapter]);

  return (
    <div
      ref={containerRef}
      className="w-full bg-gray-900 rounded cursor-pointer"
      style={{ minHeight: isExpanded ? 280 : 40 }}
      onClick={handleClick}
    />
  );
};

export default OscilloscopeGraph;
