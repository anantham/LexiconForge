import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDiffMarkers } from '../../hooks/useDiffMarkers';
import type { DiffResult } from '../../services/diff/types';

// Mock DiffResultsRepo
vi.mock('../../adapters/repo/DiffResultsRepo', () => ({
  DiffResultsRepo: class {
    async getByChapter(chapterId: string) {
      if (chapterId === 'ch-with-diffs') {
        return [{
          chapterId,
          aiVersionId: '100',
          fanVersionId: null,
          rawVersionId: 'raw1',
          algoVersion: '1.0.0',
          markers: [{ chunkId: 'para-0-abc', colors: ['orange'], reasons: ['raw-divergence'], aiRange: { start: 0, end: 20 }, position: 0 }],
          analyzedAt: Date.now(),
          costUsd: 0.001,
          model: 'gpt-4o-mini'
        } as DiffResult];
      }
      return [];
    }
  }
}));

describe('useDiffMarkers', () => {
  it('should load diff markers for a chapter', async () => {
    const { result } = renderHook(() => useDiffMarkers('ch-with-diffs'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.markers).toHaveLength(1);
    expect(result.current.markers[0].chunkId).toBe('para-0-abc');
  });

  it('should return empty array for chapter with no diffs', async () => {
    const { result } = renderHook(() => useDiffMarkers('ch-no-diffs'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.markers).toHaveLength(0);
  });

  it('should return empty array when chapterId is null', async () => {
    const { result } = renderHook(() => useDiffMarkers(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.markers).toHaveLength(0);
  });
});
