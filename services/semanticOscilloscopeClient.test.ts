import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSemanticCapability,
  SemanticOscilloscopeError,
  SEMANTIC_OSCILLOSCOPE_PROTOCOL,
  SEMANTIC_VECTOR_SPACE,
  normalizeSemanticBaseUrl,
} from './semanticOscilloscopeClient';
import type { SemanticCorpusIdentity } from '../types/oscilloscope';
import { OWNER_SCAN_PROTOCOL } from './semanticScanProtocol';

const corpus: SemanticCorpusIdentity = {
  corpusId: 'book-a',
  versionId: 'v1',
  contentHash: `sha256:${'a'.repeat(64)}`,
  chapterCount: 2,
};

const capability = {
  ok: true, protocol: SEMANTIC_OSCILLOSCOPE_PROTOCOL, scanTransport: OWNER_SCAN_PROTOCOL,
  ready: true, reason: 'ready', corpus, vectorSpace: SEMANTIC_VECTOR_SPACE, dimensions: 512,
  embeddingModel: 'model', index: { ready: true, vectorCount: 2, createdAt: null },
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
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL) => jsonResponse(capability));
    vi.stubGlobal('fetch', fetchImpl);
    const result = await getSemanticCapability('https://asus.example.ts.net', corpus);

    expect(result.ready).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(String(fetchImpl.mock.calls[0][0])).toContain(`contentHash=${encodeURIComponent(corpus.contentHash)}`);
  });

  it.each([undefined, null, 'lf-owner-scan-v0'])('rejects ready compute with unsupported window transport %s', async scanTransport => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ...capability, scanTransport })));
    await expect(getSemanticCapability('https://owner.example', corpus)).rejects.toThrow(/scan window protocol/i);
  });

  it('rejects readiness that contradicts the index state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ...capability, index: { ...capability.index, ready: false } })));
    await expect(getSemanticCapability('https://owner.example', corpus)).rejects.toThrow(/index metadata/i);
  });

  it('preserves a compatible backend not-ready reason without probing another endpoint', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ...capability, ready: false, reason: 'owner-scan-window-not-built' }));
    vi.stubGlobal('fetch', fetchImpl);
    await expect(getSemanticCapability('https://owner.example', corpus)).resolves.toMatchObject({
      ready: false, reason: 'owner-scan-window-not-built',
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
