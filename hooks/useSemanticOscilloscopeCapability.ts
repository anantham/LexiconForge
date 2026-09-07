import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  normalizeSemanticBaseUrl,
  getSemanticCapability,
} from '../services/semanticOscilloscopeClient';
import type { SemanticCapability } from '../services/semanticOscilloscopeClient';
import type { SemanticCorpusIdentity, SemanticScanResult } from '../types/oscilloscope';

import { scanInOwnerWindow } from '../services/semanticScanWindow';

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
  const activeScan = useRef<AbortController | null>(null);
  const [state, setState] = useState<CapabilityState>({
    key: null,
    status: 'checking',
    reason: 'Checking private semantic compute…',
    capability: null,
  });

  const endpoint = useMemo(() => {
    if (!baseUrl) return null;
    try {
      return normalizeSemanticBaseUrl(baseUrl);
    } catch {
      return null;
    }
  }, [baseUrl]);

  const capabilityKey = endpoint && corpus
    ? `${endpoint}\0${corpus.corpusId}\0${corpus.versionId}\0${corpus.contentHash}\0${corpus.chapterCount}`
    : null;

  useEffect(() => () => activeScan.current?.abort(), [capabilityKey]);

  useEffect(() => {
    if (!corpus || !endpoint || !capabilityKey) return;

    const controller = new AbortController();
    getSemanticCapability(endpoint, corpus, controller.signal)
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
  }, [capabilityKey, endpoint, corpus]);

  const effectiveState: CapabilityState = !corpus
    ? { key: null, status: 'unavailable', reason: 'This session has no verified semantic corpus identity.', capability: null }
    : !endpoint
      ? { key: null, status: 'unavailable', reason: 'The private IndrasNet URL is missing or invalid.', capability: null }
      : state.key === capabilityKey
        ? state
        : { key: capabilityKey, status: 'checking', reason: 'Checking private semantic compute…', capability: null };

  const scan = useCallback(async (query: string): Promise<SemanticScanResult> => {
    if (!endpoint || !corpus || effectiveState.status !== 'ready') {
      throw new Error(`Private semantic scan is unavailable: ${effectiveState.reason}`);
    }
    activeScan.current?.abort();
    const controller = new AbortController();
    activeScan.current = controller;
    return scanInOwnerWindow(endpoint, query, corpus, controller.signal);
  }, [endpoint, corpus, effectiveState.reason, effectiveState.status]);

  return {
    ...effectiveState,
    scan,
    cancel: () => activeScan.current?.abort(),
  };
};
