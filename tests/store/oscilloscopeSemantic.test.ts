import { beforeEach, describe, expect, it } from 'vitest';
import { createSessionOscilloscope } from '../../services/semanticOscilloscopeSession';
import { useAppStore } from '../../store';
import type { SemanticCorpusIdentity, SemanticScanResult, ThreadData } from '../../types/oscilloscope';

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

  it('rejects a new semantic track at the portable ceiling but allows replacement', () => {
    useAppStore.getState().initializeOscilloscope(corpus);
    const threads = new Map<string, ThreadData>();
    for (let index = 0; index < 500; index += 1) {
      const threadId = index === 0 ? 'custom:semantic:romantic trust' : `custom:${index}`;
      threads.set(threadId, {
        threadId,
        category: 'custom',
        label: `track ${index}`,
        color: '#ec4899',
        values: [0.2, 0.4],
        totalChapters: 2,
      });
    }
    useAppStore.setState({ threads });

    expect(() => useAppStore.getState().addSemanticThread('new concept', {
      ...result,
      query: 'new concept',
    })).toThrow(/at most 500/);
    expect(useAppStore.getState().threads.size).toBe(500);
    expect(() => createSessionOscilloscope(corpus, useAppStore.getState().threads, new Set())).not.toThrow();

    expect(() => useAppStore.getState().addSemanticThread('romantic trust', result)).not.toThrow();
    expect(useAppStore.getState().threads.size).toBe(500);
  });
});

it('invalidates frozen graphs when selected chapter text changes, but preserves them for image-only updates', () => {
  const chapter = { id: 'ch1', chapterNumber: 1, title: 'One', content: 'raw', translationResult: { translation: 'selected' } };
  useAppStore.setState({ chapters: new Map([['ch1', chapter as any]]) });
  useAppStore.getState().initializeOscilloscope(corpus);
  useAppStore.getState().addSemanticThread('romantic trust', result);
  useAppStore.getState().updateChapter('ch1', { translationResult: { ...chapter.translationResult, suggestedIllustrations: [] } as any });
  expect(useAppStore.getState().corpusIdentity).toEqual(corpus);
  useAppStore.getState().updateChapter('ch1', { translationResult: { translation: 'a different selection' } as any });
  expect(useAppStore.getState().corpusIdentity).toBeNull();
  expect(useAppStore.getState().threads.size).toBe(0);
  expect(() => useAppStore.getState().addSemanticThread('romantic trust', result)).toThrow(/does not match/);
});
