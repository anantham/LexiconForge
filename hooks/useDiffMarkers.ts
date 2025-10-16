import { useState, useEffect } from 'react';
import { DiffResultsRepo } from '../adapters/repo/DiffResultsRepo';
import type { DiffMarker } from '../services/diff/types';

const repo = new DiffResultsRepo();

export function useDiffMarkers(chapterId: string | null) {
  const [markers, setMarkers] = useState<DiffMarker[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!chapterId) {
      setMarkers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const results = await repo.getByChapter(chapterId);
        if (cancelled) return;

        // Use the most recent diff result
        const latestResult = results[0];
        setMarkers(latestResult?.markers || []);
      } catch (error) {
        console.error('[useDiffMarkers] Error loading markers:', error);
        setMarkers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [chapterId]);

  return { markers, loading };
}
