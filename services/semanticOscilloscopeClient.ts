import type {
  SemanticCorpusIdentity,
  SemanticScanResult,
} from '../types/oscilloscope';

export const SEMANTIC_OSCILLOSCOPE_PROTOCOL = 'lexiconforge-semantic-oscilloscope-v1';
export const SEMANTIC_VECTOR_SPACE = 'qwen3-embedding-8b:mrl-512:l2-v1';
export const SEMANTIC_VECTOR_DIMENSIONS = 512;
export const SEMANTIC_SCORE_SEMANTICS = 'cosine-similarity-clipped-0-1';
export const SEMANTIC_SCORING_ALGORITHM = 'chapter-top-2-mean-cosine-v1';

export interface SemanticCapability {
  ok: true;
  protocol: string;
  ready: boolean;
  reason: string;
  corpus: SemanticCorpusIdentity;
  vectorSpace: string;
  dimensions: number;
  embeddingModel: string | null;
  index: { ready: boolean; vectorCount: number | null; createdAt: string | null };
}

export class SemanticOscilloscopeError extends Error {}

const sameCorpus = (left: SemanticCorpusIdentity, right: SemanticCorpusIdentity): boolean => (
  left.corpusId === right.corpusId
  && left.versionId === right.versionId
  && left.contentHash === right.contentHash
  && left.chapterCount === right.chapterCount
);

export const normalizeSemanticBaseUrl = (value: string): string => {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new SemanticOscilloscopeError('IndrasNet semantic scan URL is invalid');
  }
  const localHttp = url.protocol === 'http:'
    && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname.toLowerCase());
  if (url.protocol !== 'https:' && !localHttp) {
    throw new SemanticOscilloscopeError('IndrasNet semantic scans require HTTPS (HTTP is allowed only on loopback)');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new SemanticOscilloscopeError('IndrasNet semantic scan URL must be an origin without credentials, query, or fragment');
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

export class SemanticOscilloscopeClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(baseUrl: string, fetchImpl: typeof fetch = fetch) {
    this.baseUrl = normalizeSemanticBaseUrl(baseUrl);
    this.fetchImpl = fetchImpl;
  }

  async capability(corpus: SemanticCorpusIdentity, signal?: AbortSignal): Promise<SemanticCapability> {
    const params = new URLSearchParams({
      corpusId: corpus.corpusId,
      versionId: corpus.versionId,
      contentHash: corpus.contentHash,
      chapterCount: String(corpus.chapterCount),
    });
    const response = await this.fetchImpl(
      `${this.baseUrl}/api/lexiconforge/semantic-oscilloscope/capability?${params}`,
      { method: 'GET', credentials: 'omit', signal },
    );
    if (!response.ok) throw await responseError(response, 'Semantic capability check');
    const body = validateEnvelope(await response.json(), corpus, 'Semantic capability check');
    if (typeof body.ready !== 'boolean' || typeof body.reason !== 'string') {
      throw new SemanticOscilloscopeError('Semantic capability check returned an invalid readiness state');
    }
    if (!body.index || typeof body.index !== 'object' || typeof (body.index as Record<string, unknown>).ready !== 'boolean') {
      throw new SemanticOscilloscopeError('Semantic capability check returned invalid index metadata');
    }
    return body as unknown as SemanticCapability;
  }

  async scan(query: string, corpus: SemanticCorpusIdentity, signal?: AbortSignal): Promise<SemanticScanResult> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/api/lexiconforge/semantic-oscilloscope/scan`,
      {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...corpus, query }),
        signal,
      },
    );
    if (!response.ok) throw await responseError(response, 'Semantic scan');
    const body = validateEnvelope(await response.json(), corpus, 'Semantic scan');
    if (!Array.isArray(body.scores) || body.scores.length !== corpus.chapterCount) {
      throw new SemanticOscilloscopeError(`Semantic scan must return ${corpus.chapterCount} chapter scores`);
    }
    if (body.scores.some((score: unknown) => typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1)) {
      throw new SemanticOscilloscopeError('Semantic scan returned a non-finite or out-of-range score');
    }
    if (body.query !== query.trim() || body.scoreSemantics !== SEMANTIC_SCORE_SEMANTICS) {
      throw new SemanticOscilloscopeError('Semantic scan returned invalid provenance');
    }
    if (!body.scoring || typeof body.scoring !== 'object') {
      throw new SemanticOscilloscopeError('Semantic scan returned invalid scoring metadata');
    }
    const scoring = body.scoring as Record<string, unknown>;
    if (
      scoring.algorithm !== SEMANTIC_SCORING_ALGORITHM
      || !Array.isArray(scoring.range)
      || scoring.range.length !== 2
      || scoring.range[0] !== 0
      || scoring.range[1] !== 1
    ) {
      throw new SemanticOscilloscopeError('Semantic scan returned unsupported scoring semantics');
    }
    return body as unknown as SemanticScanResult;
  }
}
