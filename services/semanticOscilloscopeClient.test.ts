import { describe, expect, it, vi } from 'vitest';
import {
  SemanticOscilloscopeClient,
  SemanticOscilloscopeError,
  SEMANTIC_OSCILLOSCOPE_PROTOCOL,
  SEMANTIC_VECTOR_SPACE,
  normalizeSemanticBaseUrl,
} from './semanticOscilloscopeClient';
import type { SemanticCorpusIdentity } from '../types/oscilloscope';

const corpus: SemanticCorpusIdentity = {
  corpusId: 'book-a',
  versionId: 'v1',
  contentHash: `sha256:${'a'.repeat(64)}`,
  chapterCount: 2,
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

describe('SemanticOscilloscopeClient', () => {
  it('allows Tailnet HTTPS and loopback HTTP but rejects remote cleartext', () => {
    expect(normalizeSemanticBaseUrl('https://asus.example.ts.net:9443/')).toBe('https://asus.example.ts.net:9443');
    expect(normalizeSemanticBaseUrl('http://127.0.0.1:7777')).toBe('http://127.0.0.1:7777');
    expect(() => normalizeSemanticBaseUrl('http://100.81.65.74:7777')).toThrow(SemanticOscilloscopeError);
  });

  it('passes the complete corpus identity to capability and accepts exact readiness', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL) => jsonResponse({
      ok: true,
      protocol: SEMANTIC_OSCILLOSCOPE_PROTOCOL,
      ready: true,
      reason: 'ready',
      corpus,
      vectorSpace: SEMANTIC_VECTOR_SPACE,
      dimensions: 512,
      embeddingModel: 'model',
      index: { ready: true, vectorCount: 2, createdAt: null },
    }));
    const result = await new SemanticOscilloscopeClient('https://asus.example.ts.net', fetchImpl as typeof fetch)
      .capability(corpus);

    expect(result.ready).toBe(true);
    expect(String(fetchImpl.mock.calls[0][0])).toContain(`contentHash=${encodeURIComponent(corpus.contentHash)}`);
  });

  it('keeps absolute server scores and rejects malformed or wrong-corpus tracks', async () => {
    const valid = {
      ok: true,
      protocol: SEMANTIC_OSCILLOSCOPE_PROTOCOL,
      corpus,
      query: 'romantic trust',
      scores: [0.31, 0.62],
      scoreSemantics: 'cosine-similarity-clipped-0-1',
      scoring: { algorithm: 'chapter-top-2-mean-cosine-v1', range: [0, 1] },
      vectorSpace: SEMANTIC_VECTOR_SPACE,
      dimensions: 512,
    };
    const validClient = new SemanticOscilloscopeClient(
      'https://asus.example.ts.net', vi.fn(async () => jsonResponse(valid)) as typeof fetch,
    );
    await expect(validClient.scan('romantic trust', corpus)).resolves.toMatchObject({ scores: [0.31, 0.62] });

    const invalidClient = new SemanticOscilloscopeClient(
      'https://asus.example.ts.net',
      vi.fn(async () => jsonResponse({ ...valid, scores: [0.2, 1.2] })) as typeof fetch,
    );
    await expect(invalidClient.scan('romantic trust', corpus)).rejects.toThrow(/out-of-range/);

    const wrongCorpusClient = new SemanticOscilloscopeClient(
      'https://asus.example.ts.net',
      vi.fn(async () => jsonResponse({ ...valid, corpus: { ...corpus, versionId: 'v2' } })) as typeof fetch,
    );
    await expect(wrongCorpusClient.scan('romantic trust', corpus)).rejects.toThrow(/different corpus/);

    const wrongScoringClient = new SemanticOscilloscopeClient(
      'https://asus.example.ts.net',
      vi.fn(async () => jsonResponse({ ...valid, scoring: { algorithm: 'max-normalized', range: [0, 1] } })) as typeof fetch,
    );
    await expect(wrongScoringClient.scan('romantic trust', corpus)).rejects.toThrow(/scoring semantics/);
  });
});
