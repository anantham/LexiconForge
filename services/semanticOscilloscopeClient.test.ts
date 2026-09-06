import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSemanticCapability,
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

afterEach(() => vi.unstubAllGlobals());

describe('getSemanticCapability', () => {
  it('allows Tailnet HTTPS and loopback HTTP but rejects remote cleartext', () => {
    expect(normalizeSemanticBaseUrl('https://asus.example.ts.net:9443/')).toBe('https://asus.example.ts.net:9443');
    expect(normalizeSemanticBaseUrl('http://127.0.0.1:7777')).toBe('http://127.0.0.1:7777');
    expect(normalizeSemanticBaseUrl('http://[::1]:7777')).toBe('http://[::1]:7777');
    expect(() => normalizeSemanticBaseUrl('http://192.0.2.10:7777')).toThrow(SemanticOscilloscopeError);
    expect(() => normalizeSemanticBaseUrl('https://owner.example/api')).toThrow(/without a path/);
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
    vi.stubGlobal('fetch', fetchImpl);
    const result = await getSemanticCapability('https://asus.example.ts.net', corpus);

    expect(result.ready).toBe(true);
    expect(String(fetchImpl.mock.calls[0][0])).toContain(`contentHash=${encodeURIComponent(corpus.contentHash)}`);
  });

});
