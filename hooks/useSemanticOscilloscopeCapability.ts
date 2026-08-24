import { useCallback, useEffect, useMemo, useState } from 'react';
import { SemanticOscilloscopeClient } from '../services/semanticOscilloscopeClient';
import type { SemanticCapability } from '../services/semanticOscilloscopeClient';
import type { SemanticCorpusIdentity, SemanticScanResult } from '../types/oscilloscope';

type CapabilityStatus = 'checking' | 'ready' | 'unavailable';

interface CapabilityState {
  key: string | null;
  status: CapabilityStatus;
  reason: string;
  capability: SemanticCapability | null;
}

export const useSemanticOscilloscopeCapability = (
  baseUrl: string | undefined,
  corpus: SemanticCorpusIdentity | null,
) => {
  const [refreshToken, setRefreshToken] = useState(0);
  const [state, setState] = useState<CapabilityState>({
    key: null,
    status: 'checking',
    reason: 'Checking private semantic compute…',
    capability: null,
  });

  const client = useMemo(() => {
    if (!baseUrl) return null;
    try {
      return new SemanticOscilloscopeClient(baseUrl);
    } catch {
      return null;
    }
  }, [baseUrl]);

  const capabilityKey = client && corpus
    ? `${corpus.corpusId}\0${corpus.versionId}\0${corpus.contentHash}\0${corpus.chapterCount}\0${refreshToken}`
    : null;

  useEffect(() => {
    if (!corpus || !client || !capabilityKey) return;

    const controller = new AbortController();
    client.capability(corpus, controller.signal)
      .then((capability) => {
        if (capability.ready) {
          setState({ key: capabilityKey, status: 'ready', reason: 'Private semantic compute is ready.', capability });
        } else {
          setState({ key: capabilityKey, status: 'unavailable', reason: capability.reason, capability });
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        const reason = error instanceof Error ? error.message : String(error);
        setState({ key: capabilityKey, status: 'unavailable', reason, capability: null });
      });
    return () => controller.abort();
  }, [capabilityKey, client, corpus]);

  const effectiveState: CapabilityState = !corpus
    ? { key: null, status: 'unavailable', reason: 'This session has no verified semantic corpus identity.', capability: null }
    : !client
      ? { key: null, status: 'unavailable', reason: 'The private IndrasNet URL is missing or invalid.', capability: null }
      : state.key === capabilityKey
        ? state
        : { key: capabilityKey, status: 'checking', reason: 'Checking private semantic compute…', capability: null };

  const scan = useCallback(async (query: string): Promise<SemanticScanResult> => {
    if (!client || !corpus || effectiveState.status !== 'ready') {
      throw new Error(`Private semantic scan is unavailable: ${effectiveState.reason}`);
    }
    return client.scan(query.trim(), corpus);
  }, [client, corpus, effectiveState.reason, effectiveState.status]);

  return {
    ...effectiveState,
    scan,
    refresh: () => setRefreshToken((value) => value + 1),
  };
};
