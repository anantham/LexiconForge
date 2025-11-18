import { useState, useEffect, useCallback } from 'react';
import type { DiffMarker } from '../services/diff/types';
import { debugLog } from '../utils/debug';
import { DiffOps } from '../services/db/operations';

export function useDiffMarkers(chapterId: string | null) {
  const [markers, setMarkers] = useState<DiffMarker[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadMarkers = useCallback(async (activeChapterId: string | null, signal?: AbortSignal) => {
    if (!activeChapterId) {
      setMarkers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const results = await DiffOps.getByChapter(activeChapterId);
      if (signal?.aborted) return;
      const latestResult = results[0];
      setMarkers(latestResult?.markers || []);
      debugLog('diff', 'summary', '[useDiffMarkers] Loaded markers', {
        chapterId: activeChapterId,
        markerCount: latestResult?.markers?.length || 0,
      });
    } catch (error) {
      console.error('[useDiffMarkers] Error loading markers:', error);
      setMarkers([]);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadMarkers(chapterId, controller.signal);
    return () => controller.abort();
  }, [chapterId, loadMarkers]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ chapterId?: string }>;
      if (!customEvent.detail?.chapterId) return;
      if (customEvent.detail.chapterId !== chapterId) return;
      debugLog('diff', 'summary', '[useDiffMarkers] diff:updated received', {
        chapterId,
      });
      loadMarkers(chapterId);
    };

    window.addEventListener('diff:updated', handler as EventListener);
    return () => {
      window.removeEventListener('diff:updated', handler as EventListener);
    };
  }, [chapterId, loadMarkers]);

  return { markers, loading };
}
