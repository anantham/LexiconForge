/**
 * OscilloscopeMinimap - Collapsed sparkline view (~40px tall)
 *
 * Shows the most prominent active thread as a Canvas2D sparkline
 * with a marker for the current chapter position.
 * Click anywhere to expand the full oscilloscope.
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store';
import type { ThreadData } from '../../types/oscilloscope';

const MINIMAP_HEIGHT = 40;

const OscilloscopeMinimap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const threads = useAppStore((s) => s.threads);
  const activeThreadIds = useAppStore((s) => s.activeThreadIds);
  const totalChapters = useAppStore((s) => s.totalChapters);
  const setExpanded = useAppStore((s) => s.setExpanded);

  // Current chapter for position marker
  const currentChapterId = useAppStore((s) => s.currentChapterId);
  const chapters = useAppStore((s) => s.chapters);
  const currentChapterNumber = useMemo(() => {
    if (!currentChapterId) return null;
    const ch = chapters.get(currentChapterId);
    return ch?.chapterNumber ?? null;
  }, [currentChapterId, chapters]);

  // Pick the most prominent thread (highest chaptersCovered among active)
  const prominentThread = useMemo((): ThreadData | null => {
    let best: ThreadData | null = null;
    let bestCoverage = 0;
    for (const id of activeThreadIds) {
      const thread = threads.get(id);
      if (!thread) continue;
      const coverage = thread.values.filter((v) => v !== 0).length;
      if (coverage > bestCoverage) {
        bestCoverage = coverage;
        best = thread;
      }
    }
    return best;
  }, [threads, activeThreadIds]);

  // Draw the sparkline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const width = parent.clientWidth;
    const height = MINIMAP_HEIGHT;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#111827'; // gray-900
    ctx.fillRect(0, 0, width, height);

    if (!prominentThread || totalChapters === 0) {
      // Draw placeholder text
      ctx.fillStyle = '#4b5563';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No oscilloscope data', width / 2, height / 2 + 4);
      return;
    }

    const values = prominentThread.values;
    const padding = 4;
    const drawWidth = width - padding * 2;
    const drawHeight = height - padding * 2;

    // Draw sparkline
    ctx.beginPath();
    ctx.strokeStyle = prominentThread.color;
    ctx.lineWidth = 1.5;

    for (let i = 0; i < values.length; i++) {
      const x = padding + (i / (values.length - 1 || 1)) * drawWidth;
      const y = padding + drawHeight - values[i] * drawHeight;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Fill area under the curve with low opacity
    ctx.lineTo(padding + drawWidth, padding + drawHeight);
    ctx.lineTo(padding, padding + drawHeight);
    ctx.closePath();
    ctx.fillStyle = prominentThread.color + '15'; // ~8% opacity
    ctx.fill();

    // Current chapter marker
    if (currentChapterNumber !== null && totalChapters > 0) {
      const markerX =
        padding +
        ((currentChapterNumber - 1) / (totalChapters - 1 || 1)) * drawWidth;

      ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)'; // amber
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(markerX, 0);
      ctx.lineTo(markerX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Small triangle marker at top
      ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
      ctx.beginPath();
      ctx.moveTo(markerX - 4, 0);
      ctx.lineTo(markerX + 4, 0);
      ctx.lineTo(markerX, 6);
      ctx.closePath();
      ctx.fill();
    }

    // Label
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(prominentThread.label, padding + 4, height - 6);

    // "Click to expand" hint on right
    ctx.textAlign = 'right';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Click to expand', width - padding - 4, height - 6);
  }, [prominentThread, totalChapters, currentChapterNumber]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;

    const observer = new ResizeObserver(() => {
      // Trigger re-render by changing nothing — the draw effect depends on refs
      // We need to force the draw effect to re-run
      const event = new Event('resize');
      window.dispatchEvent(event);
    });

    observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      onClick={() => setExpanded(true)}
      className="cursor-pointer hover:opacity-90 transition-opacity"
      style={{ height: MINIMAP_HEIGHT }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
};

export default OscilloscopeMinimap;
