import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ThreadSelector from '../../../components/oscilloscope/ThreadSelector';
import { useAppStore } from '../../../store';
import { SEMANTIC_OSCILLOSCOPE_PROTOCOL } from '../../../services/semanticOscilloscopeClient';
import type { SemanticCorpusIdentity } from '../../../types/oscilloscope';

const corpus: SemanticCorpusIdentity = {
  corpusId: 'book-a',
  versionId: 'v1',
  contentHash: `sha256:${'a'.repeat(64)}`,
  chapterCount: 2,
};

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

describe('ThreadSelector private semantic scan gate', () => {
  beforeEach(() => {
    useAppStore.getState().resetOscilloscope();
    useAppStore.setState((state) => ({
      settings: { ...state.settings, indrasNetBaseUrl: 'https://asus.example.ts.net' },
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows no custom-query input when the session has no private capability', () => {
    render(<ThreadSelector isOpen onClose={() => undefined} />);

    expect(screen.queryByRole('button', { name: 'Custom' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(/available only when the matching private corpus index is reachable/i)).toBeInTheDocument();
  });

  it('keeps frozen custom tracks selectable without exposing the query input', () => {
    useAppStore.getState().addThread({
      threadId: 'custom:semantic:romantic trust',
      category: 'custom',
      label: 'romantic trust',
      color: '#ec4899',
      values: [0.31, 0.62],
      totalChapters: 2,
      provenance: { origin: 'precomputed', method: 'semantic-v1' },
    });
    render(<ThreadSelector isOpen onClose={() => undefined} />);

    fireEvent.click(screen.getByRole('button', { name: 'Custom (1)' }));

    expect(screen.getByRole('button', { name: /romantic trust/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('surfaces the exact reason a capability check fails closed', async () => {
    useAppStore.getState().initializeOscilloscope(corpus);
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      ok: true,
      protocol: SEMANTIC_OSCILLOSCOPE_PROTOCOL,
      ready: true,
      reason: 'ready',
      corpus: { ...corpus, versionId: 'wrong-version' },
      vectorSpace: 'qwen3-embedding-8b:mrl-512:l2-v1',
      dimensions: 512,
      embeddingModel: 'qwen3-embedding:8b',
      index: { ready: true, vectorCount: 2, createdAt: null },
    })));
    render(<ThreadSelector isOpen onClose={() => undefined} />);

    expect(await screen.findByText(/returned data for a different corpus/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Custom' })).not.toBeInTheDocument();
  });

  it('invalidates readiness immediately when the configured endpoint changes', async () => {
    useAppStore.getState().initializeOscilloscope(corpus);
    let releaseSecond: (() => void) | undefined;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('https://asus.example.ts.net/')) {
        return jsonResponse({
          ok: true,
          protocol: SEMANTIC_OSCILLOSCOPE_PROTOCOL,
          ready: true,
          reason: 'ready',
          corpus,
          vectorSpace: 'qwen3-embedding-8b:mrl-512:l2-v1',
          dimensions: 512,
          embeddingModel: 'qwen3-embedding:8b',
          index: { ready: true, vectorCount: 2, createdAt: null },
        });
      }
      await new Promise<void>((resolve) => { releaseSecond = resolve; });
      return jsonResponse({
        ok: true,
        protocol: SEMANTIC_OSCILLOSCOPE_PROTOCOL,
        ready: true,
        reason: 'ready',
        corpus,
        vectorSpace: 'qwen3-embedding-8b:mrl-512:l2-v1',
        dimensions: 512,
        embeddingModel: 'qwen3-embedding:8b',
        index: { ready: true, vectorCount: 2, createdAt: null },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ThreadSelector isOpen onClose={() => undefined} />);
    expect(await screen.findByRole('button', { name: 'Custom' })).toBeInTheDocument();

    useAppStore.setState((state) => ({
      settings: { ...state.settings, indrasNetBaseUrl: 'https://replacement.example.ts.net' },
    }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: 'Custom' })).not.toBeInTheDocument();
    releaseSecond?.();
  });

  it('submits a semantic query only after exact-corpus capability is ready', async () => {
    useAppStore.getState().initializeOscilloscope(corpus);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.includes('/capability?')) throw new Error('The public reader must not POST a scan');
      return jsonResponse({
        ok: true, protocol: SEMANTIC_OSCILLOSCOPE_PROTOCOL, ready: true, reason: 'ready', corpus,
        vectorSpace: 'qwen3-embedding-8b:mrl-512:l2-v1', dimensions: 512, embeddingModel: 'qwen3-embedding:8b',
        index: { ready: true, vectorCount: 2, createdAt: null },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const popup = { close: vi.fn(), postMessage: vi.fn(), closed: false } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);
    render(<ThreadSelector isOpen onClose={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Custom' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'romantic trust' } });
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }));

    act(() => window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://asus.example.ts.net', source: popup,
      data: JSON.stringify({ protocol: 'lf-owner-scan-v1', type: 'ready' }),
    })));
    const request = JSON.parse(vi.mocked(popup.postMessage).mock.calls[0][0]);
    act(() => window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://asus.example.ts.net', source: popup,
      data: JSON.stringify({ protocol: 'lf-owner-scan-v1', type: 'result', requestId: request.requestId,
        result: { ok: true, protocol: SEMANTIC_OSCILLOSCOPE_PROTOCOL, corpus, query: request.query,
          scores: [0.31, 0.62], scoreSemantics: 'cosine-similarity-clipped-0-1',
          scoring: { algorithm: 'chapter-top-2-mean-cosine-v1', range: [0, 1] },
          vectorSpace: 'qwen3-embedding-8b:mrl-512:l2-v1', dimensions: 512 } }),
    })));
    await waitFor(() => {
      expect(useAppStore.getState().threads.get('custom:semantic:romantic trust')?.values).toEqual([0.31, 0.62]);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(['book', 'endpoint'])('cancels a pending scan after a %s change and discards late scores', async change => {
    useAppStore.getState().initializeOscilloscope(corpus);
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      ok: true, protocol: SEMANTIC_OSCILLOSCOPE_PROTOCOL, ready: true, reason: 'ready', corpus,
      vectorSpace: 'qwen3-embedding-8b:mrl-512:l2-v1', dimensions: 512,
      index: { ready: true, vectorCount: 2, createdAt: null },
    })));
    const popup = { close: vi.fn(), postMessage: vi.fn(), closed: false } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);
    render(<ThreadSelector isOpen onClose={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Custom' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'trust' } });
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
    act(() => {
      if (change === 'book') useAppStore.getState().initializeOscilloscope({ ...corpus, versionId: 'v2' });
      else useAppStore.setState(state => ({ settings: { ...state.settings, indrasNetBaseUrl: 'https://new.example' } }));
    });
    await waitFor(() => expect(popup.close).toHaveBeenCalledOnce());
    act(() => window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://asus.example.ts.net', source: popup,
      data: JSON.stringify({ protocol: 'lf-owner-scan-v1', type: 'ready' }),
    })));
    expect(popup.postMessage).not.toHaveBeenCalled();
    expect(useAppStore.getState().threads.has('custom:semantic:trust')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Scanning…' })).not.toBeInTheDocument();
  });

});
