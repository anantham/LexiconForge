import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDiffMarkers } from '../../hooks/useDiffMarkers';
import type { DiffResult } from '../../services/diff/types';

const diffResultsByChapter: Record<string, DiffResult[]> = {};

vi.mock('../../adapters/repo/DiffResultsRepo', () => {
  return {
    DiffResultsRepo: class {
      async getByChapter(chapterId: string) {
        return diffResultsByChapter[chapterId] || [];
      }
    }
  };
});

describe('useDiffMarkers', () => {
  it('should load diff markers for a chapter', async () => {
    diffResultsByChapter['ch-with-diffs'] = [{
      chapterId: 'ch-with-diffs',
      aiVersionId: '100',
      fanVersionId: null,
      rawVersionId: 'raw1',
      algoVersion: '1.0.0',
      aiHash: 'abc12345',
      rawHash: 'rawhash1',
      markers: [{
        chunkId: 'para-0-abc',
        colors: ['orange'],
        reasons: ['raw-divergence'],
        aiRange: { start: 0, end: 20 },
        position: 0
      }],
      analyzedAt: Date.now(),
      costUsd: 0.001,
      model: 'gpt-4o-mini'
    }];

    const { result } = renderHook(() => useDiffMarkers('ch-with-diffs'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.markers).toHaveLength(1);
    expect(result.current.markers[0].chunkId).toBe('para-0-abc');
  });

  it('should return empty array for chapter with no diffs', async () => {
    diffResultsByChapter['ch-no-diffs'] = [];
    const { result } = renderHook(() => useDiffMarkers('ch-no-diffs'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.markers).toHaveLength(0);
  });

  it('should return empty array when chapterId is null', async () => {
    diffResultsByChapter['ch-null'] = [{
      chapterId: 'ch-null',
      aiVersionId: '100',
      fanVersionId: null,
      rawVersionId: 'raw1',
      algoVersion: '1.0.0',
      markers: [{
        chunkId: 'para-0-xyz',
        colors: ['gray'],
        reasons: ['stylistic-choice'],
        aiRange: { start: 0, end: 10 },
        position: 0
      }],
      analyzedAt: Date.now(),
      costUsd: 0,
      model: 'gpt-4o-mini'
    }];

    const { result } = renderHook(() => useDiffMarkers(null));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.markers).toHaveLength(0);
  });

  it('should refresh markers when diff:updated event is dispatched', async () => {
    diffResultsByChapter['ch-live'] = [];
    const { result } = renderHook(() => useDiffMarkers('ch-live'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.markers).toHaveLength(0);

    diffResultsByChapter['ch-live'] = [{
      chapterId: 'ch-live',
      aiVersionId: '101',
      fanVersionId: null,
      rawVersionId: 'raw2',
      algoVersion: '1.0.0',
      aiHash: 'deadbeef',
      rawHash: 'cafebabe',
      markers: [{
        chunkId: 'para-1-def',
        colors: ['red'],
        reasons: ['missing-context'],
        aiRange: { start: 20, end: 40 },
        position: 1
      }],
      analyzedAt: Date.now(),
      costUsd: 0.001,
      model: 'gpt-4o-mini'
    }];

    act(() => {
      window.dispatchEvent(new CustomEvent('diff:updated', { detail: { chapterId: 'ch-live' } }));
    });

    await waitFor(() => {
      expect(result.current.markers).toHaveLength(1);
    });
    expect(result.current.markers[0].chunkId).toBe('para-1-def');
  });
});
