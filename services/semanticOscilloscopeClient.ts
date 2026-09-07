import type { SemanticCorpusIdentity } from '../types/oscilloscope';
import { sameCorpus, SemanticOscilloscopeError, SEMANTIC_OSCILLOSCOPE_PROTOCOL, SEMANTIC_VECTOR_SPACE, SEMANTIC_VECTOR_DIMENSIONS, OWNER_SCAN_PROTOCOL } from './semanticScanProtocol';
export { SemanticOscilloscopeError, SEMANTIC_OSCILLOSCOPE_PROTOCOL, SEMANTIC_VECTOR_SPACE, SEMANTIC_VECTOR_DIMENSIONS } from './semanticScanProtocol';

export interface SemanticCapability {
  ok: true;
  protocol: string;
  scanTransport: typeof OWNER_SCAN_PROTOCOL;
  ready: boolean;
  reason: string;
  corpus: SemanticCorpusIdentity;
  vectorSpace: string;
  dimensions: number;
  embeddingModel: string | null;
  index: { ready: boolean; vectorCount: number | null; createdAt: string | null };
}

export const normalizeSemanticBaseUrl = (value: string): string => {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new SemanticOscilloscopeError('IndrasNet semantic scan URL is invalid');
  }
  const localHttp = url.protocol === 'http:'
    && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase());
  if (url.protocol !== 'https:' && !localHttp) {
    throw new SemanticOscilloscopeError('IndrasNet semantic scans require HTTPS (HTTP is allowed only on loopback)');
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new SemanticOscilloscopeError('IndrasNet semantic scan URL must be an origin without a path, credentials, query, or fragment');
  }
  return url.toString().replace(/\/$/, '');
};

const responseError = async (response: Response, action: string): Promise<SemanticOscilloscopeError> => {
  try {
    const body = await response.json();
    const detail = typeof body?.detail === 'string' ? `: ${body.detail}` : '';
    return new SemanticOscilloscopeError(`${action} failed with HTTP ${response.status}${detail}`);
  } catch {
    return new SemanticOscilloscopeError(`${action} failed with HTTP ${response.status}`);
  }
};

const validateEnvelope = (
  value: unknown,
  corpus: SemanticCorpusIdentity,
  action: string,
): Record<string, unknown> => {
  if (!value || typeof value !== 'object') throw new SemanticOscilloscopeError(`${action} returned invalid JSON`);
  const body = value as Record<string, unknown>;
  if (body.ok !== true || body.protocol !== SEMANTIC_OSCILLOSCOPE_PROTOCOL) {
    throw new SemanticOscilloscopeError(`${action} returned an unsupported protocol`);
  }
  if (!body.corpus || typeof body.corpus !== 'object' || !sameCorpus(body.corpus as SemanticCorpusIdentity, corpus)) {
    throw new SemanticOscilloscopeError(`${action} returned data for a different corpus`);
  }
  if (body.vectorSpace !== SEMANTIC_VECTOR_SPACE || body.dimensions !== SEMANTIC_VECTOR_DIMENSIONS) {
    throw new SemanticOscilloscopeError(`${action} returned an unsupported embedding vector space`);
  }
  return body;
};

export async function getSemanticCapability(
  baseUrl: string, corpus: SemanticCorpusIdentity, signal?: AbortSignal,
): Promise<SemanticCapability> {
  const params = new URLSearchParams({
    corpusId: corpus.corpusId,
    versionId: corpus.versionId,
    contentHash: corpus.contentHash,
    chapterCount: String(corpus.chapterCount),
  });
  const response = await fetch(
    `${normalizeSemanticBaseUrl(baseUrl)}/api/lexiconforge/semantic-oscilloscope/capability?${params}`,
    { method: 'GET', credentials: 'omit', signal },
  );
  if (!response.ok) throw await responseError(response, 'Semantic capability check');
  const body = validateEnvelope(await response.json(), corpus, 'Semantic capability check');
  if (body.scanTransport !== OWNER_SCAN_PROTOCOL) {
    throw new SemanticOscilloscopeError('Private semantic backend does not support the required scan window protocol. Update the private scan service.');
  }
  if (typeof body.ready !== 'boolean' || typeof body.reason !== 'string') {
    throw new SemanticOscilloscopeError('Semantic capability check returned an invalid readiness state');
  }
  if (!body.index || typeof body.index !== 'object' || typeof (body.index as Record<string, unknown>).ready !== 'boolean'
    || (body.ready && !(body.index as Record<string, unknown>).ready)) {
    throw new SemanticOscilloscopeError('Semantic capability check returned invalid index metadata');
  }
  return body as unknown as SemanticCapability;
}
