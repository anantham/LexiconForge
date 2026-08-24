import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../../store';
import type { SemanticCorpusIdentity, SemanticScanResult } from '../../types/oscilloscope';

const corpus: SemanticCorpusIdentity = {
  corpusId: 'book-a',
  versionId: 'v1',
  contentHash: `sha256:${'a'.repeat(64)}`,
  chapterCount: 2,
};

const result: SemanticScanResult = {
  ok: true,
  protocol: 'lexiconforge-semantic-oscilloscope-v1',
  corpus,
  query: 'romantic trust',
  scores: [0.31, 0.62],
  scoreSemantics: 'cosine-similarity-clipped-0-1',
  scoring: { algorithm: 'chapter-top-2-mean-cosine-v1', range: [0, 1] },
  vectorSpace: 'qwen3-embedding-8b:mrl-512:l2-v1',
  dimensions: 512,
};

describe('semantic oscilloscope store', () => {
  beforeEach(() => useAppStore.getState().resetOscilloscope());

  it('registers exact server scores without per-query max normalization', () => {
    useAppStore.getState().initializeOscilloscope(corpus);
    const threadId = useAppStore.getState().addSemanticThread('romantic trust', result);
    const thread = useAppStore.getState().threads.get(threadId);

    expect(thread?.values).toEqual([0.31, 0.62]);
    expect(thread?.values[1]).not.toBe(1);
    expect(thread?.provenance).toMatchObject({
      origin: 'private-semantic-scan',
      query: 'romantic trust',
      corpus,
    });
    expect(useAppStore.getState().activeThreadIds.has(threadId)).toBe(true);
  });

  it('rejects a result for a different book version before mutating state', () => {
    useAppStore.getState().initializeOscilloscope(corpus);
    expect(() => useAppStore.getState().addSemanticThread('trust', {
      ...result,
      corpus: { ...corpus, versionId: 'v2' },
    })).toThrow(/does not match/);
    expect(useAppStore.getState().threads.size).toBe(0);
  });

  it('rejects malformed scores even when a caller bypasses the HTTP adapter', () => {
    useAppStore.getState().initializeOscilloscope(corpus);

    expect(() => useAppStore.getState().addSemanticThread('romantic trust', {
      ...result,
      scores: [Number.NaN, 0.6],
    })).toThrow(/non-finite or out-of-range/);

    expect(useAppStore.getState().threads.size).toBe(0);
  });
});
