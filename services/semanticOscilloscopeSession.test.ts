import { describe, expect, it } from 'vitest';
import {
  computeSemanticCorpusIdentity,
  createSessionOscilloscope,
  parseSessionOscilloscope,
} from './semanticOscilloscopeSession';
import type { SessionData } from '../types/session';
import type { ThreadData } from '../types/oscilloscope';

const session = (): SessionData => ({
  metadata: { format: 'lexiconforge-session', version: '2.0', exportedAt: '2026-08-24T00:00:00Z' },
  novel: { id: 'book-a', title: 'Book A' },
  version: { versionId: 'v1', displayName: 'V1', style: 'other', features: [] },
  chapters: [
    {
      chapterNumber: 1,
      title: 'Cafe\u0301\r\nOne',
      content: 'raw',
      fanTranslation: 'fan',
      translations: [{ version: 1, isActive: true, translation: 'Chosen\rtext' }],
    },
    { chapterNumber: 2, title: 'Two', content: 'source' },
  ],
});

describe('semantic oscilloscope session contract', () => {
  it('matches the backend corpus hash and selected-text contract', async () => {
    const identity = await computeSemanticCorpusIdentity(session());
    expect(identity).toEqual({
      corpusId: 'book-a',
      versionId: 'v1',
      contentHash: 'sha256:141cfadfc7489b6636e9a1a2778868de9e4622dbe634d0e306f17059db78d893',
      chapterCount: 2,
    });
  });

  it('serializes scalar tracks and explicit provenance without private endpoints', async () => {
    const corpus = await computeSemanticCorpusIdentity(session());
    const thread: ThreadData = {
      threadId: 'custom:semantic:trust',
      category: 'custom',
      label: 'trust',
      color: '#ec4899',
      values: [0.25, 0.75],
      totalChapters: 2,
      provenance: {
        origin: 'private-semantic-scan',
        query: 'trust',
        generatedAt: '2026-08-24T00:00:00Z',
        protocol: 'lexiconforge-semantic-oscilloscope-v1',
        scoreSemantics: 'cosine-similarity-clipped-0-1',
        vectorSpace: 'qwen3-embedding-8b:mrl-512:l2-v1',
        dimensions: 512,
        scoring: { algorithm: 'chapter-top-2-mean-cosine-v1', range: [0, 1] },
        corpus,
      },
    };
    const portable = createSessionOscilloscope(corpus, new Map([[thread.threadId, thread]]), new Set([thread.threadId]));

    expect(parseSessionOscilloscope(portable, corpus)).toEqual(portable);
    expect(JSON.stringify(portable)).not.toMatch(/asus|baseUrl|endpoint|embedding\s*:/i);
  });

  it('rejects stale tracks and non-finite values', async () => {
    const corpus = await computeSemanticCorpusIdentity(session());
    const portable = createSessionOscilloscope(corpus, new Map(), new Set());
    await expect(computeSemanticCorpusIdentity({ ...session(), chapters: [{ chapterNumber: 1, title: 'changed', content: 'x' }] }))
      .resolves.not.toEqual(corpus);
    expect(() => parseSessionOscilloscope({ ...portable, corpus: { ...corpus, contentHash: `sha256:${'0'.repeat(64)}` } }, corpus))
      .toThrow(/does not match/);
    expect(() => parseSessionOscilloscope({
      ...portable,
      threads: [{
        threadId: 'tone:test', category: 'tone', label: 'test', color: '#ef4444',
        values: [Number.NaN, 0], totalChapters: 2,
      }],
    }, corpus)).toThrow(/non-finite/);
  });
});
