// Portable wire contract. Keep the owner's vendored copy byte-identical; no runtime dependencies.
export const SEMANTIC_OSCILLOSCOPE_PROTOCOL = 'lexiconforge-semantic-oscilloscope-v1';
export const SEMANTIC_VECTOR_SPACE = 'qwen3-embedding-8b:mrl-512:l2-v1';
export const SEMANTIC_VECTOR_DIMENSIONS = 512;
export const SEMANTIC_SCORE_SEMANTICS = 'cosine-similarity-clipped-0-1';
export const SEMANTIC_SCORING_ALGORITHM = 'chapter-top-2-mean-cosine-v1';
export const OWNER_SCAN_PROTOCOL = 'lf-owner-scan-v1';
export const OWNER_SCAN_PATH = '/api/lexiconforge/semantic-oscilloscope/owner-window';
export const MAX_SCAN_MESSAGE = 3_145_728;

export interface SemanticCorpusIdentity {
  corpusId: string;
  versionId: string;
  contentHash: `sha256:${string}`;
  chapterCount: number;
}
export interface SemanticScanResult {
  ok: true;
  protocol: string;
  corpus: SemanticCorpusIdentity;
  query: string;
  scores: number[];
  scoreSemantics: string;
  scoring: { algorithm: string; range: [number, number] };
  vectorSpace: string;
  dimensions: number;
}
export interface OwnerScanRequest {
  protocol: typeof OWNER_SCAN_PROTOCOL;
  type: 'scan';
  requestId: string;
  corpus: SemanticCorpusIdentity;
  query: string;
}
export const SCAN_ERRORS = {
  AUTH_REQUIRED: 'Private scan authorization failed. Check access on your owner device.',
  PROOF_REJECTED: 'Private scan security proof was rejected. Close the window and try again.',
  INDEX_UNAVAILABLE: 'The matching private corpus index is unavailable.',
  EMBEDDING_UNAVAILABLE: 'The private embedding model is unavailable.',
  INVALID_REQUEST: 'The private scan request was invalid.',
  CONNECTION_FAILED: 'The private scan connection failed or returned an invalid response.',
} as const;
export type OwnerScanReply =
  | { protocol: typeof OWNER_SCAN_PROTOCOL; type: 'ready' }
  | { protocol: typeof OWNER_SCAN_PROTOCOL; type: 'result'; requestId: string; result: SemanticScanResult }
  | { protocol: typeof OWNER_SCAN_PROTOCOL; type: 'error'; requestId: string; code: keyof typeof SCAN_ERRORS };

export class SemanticOscilloscopeError extends Error {}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SemanticOscilloscopeError('Semantic scan returned an invalid object');
  }
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, keys: string[]): void {
  if (Object.keys(value).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(value, key))) {
    throw new SemanticOscilloscopeError('Semantic scan returned missing or unexpected fields');
  }
}
function boundedText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value === value.trim() && value.length > 0 && [...value].length <= max;
}
function validateCorpus(value: unknown): asserts value is SemanticCorpusIdentity {
  const c = object(value);
  exactKeys(c, ['corpusId', 'versionId', 'contentHash', 'chapterCount']);
  if (!boundedText(c.corpusId, 200) || !boundedText(c.versionId, 200)
    || typeof c.contentHash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(c.contentHash)
    || !Number.isInteger(c.chapterCount) || Number(c.chapterCount) < 1 || Number(c.chapterCount) > 100_000) {
    throw new SemanticOscilloscopeError('Semantic scan has an invalid corpus identity');
  }
}
export const sameCorpus = (left: SemanticCorpusIdentity, right: SemanticCorpusIdentity): boolean => (
  left.corpusId === right.corpusId && left.versionId === right.versionId
  && left.contentHash === right.contentHash && left.chapterCount === right.chapterCount
);

export function validateSemanticScan(value: unknown, corpus: SemanticCorpusIdentity, query: string): SemanticScanResult {
  const body = object(value);
  exactKeys(body, ['ok', 'protocol', 'corpus', 'query', 'scores', 'scoreSemantics', 'scoring', 'vectorSpace', 'dimensions']);
  validateCorpus(body.corpus);
  if (!sameCorpus(body.corpus, corpus)) throw new SemanticOscilloscopeError('Semantic scan returned data for a different corpus');
  if (body.ok !== true || body.protocol !== SEMANTIC_OSCILLOSCOPE_PROTOCOL
    || body.vectorSpace !== SEMANTIC_VECTOR_SPACE || body.dimensions !== SEMANTIC_VECTOR_DIMENSIONS) {
    throw new SemanticOscilloscopeError('Semantic scan returned an unsupported protocol or embedding vector space');
  }
  if (!Array.isArray(body.scores) || body.scores.length !== corpus.chapterCount) {
    throw new SemanticOscilloscopeError(`Semantic scan must return ${corpus.chapterCount} chapter scores`);
  }
  if (body.scores.some(score => typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1)) {
    throw new SemanticOscilloscopeError('Semantic scan returned a non-finite or out-of-range score');
  }
  if (body.query !== query || body.scoreSemantics !== SEMANTIC_SCORE_SEMANTICS) {
    throw new SemanticOscilloscopeError('Semantic scan returned invalid provenance');
  }
  const scoring = object(body.scoring);
  exactKeys(scoring, ['algorithm', 'range']);
  if (scoring.algorithm !== SEMANTIC_SCORING_ALGORITHM || !Array.isArray(scoring.range)
    || scoring.range.length !== 2 || scoring.range[0] !== 0 || scoring.range[1] !== 1) {
    throw new SemanticOscilloscopeError('Semantic scan returned unsupported scoring semantics');
  }
  return body as unknown as SemanticScanResult;
}

function decode(data: unknown, limit: number): Record<string, unknown> {
  if (typeof data !== 'string' || data.length > limit) throw new SemanticOscilloscopeError('Invalid or oversized private scan message');
  const message = object(JSON.parse(data));
  if (message.protocol !== OWNER_SCAN_PROTOCOL) throw new SemanticOscilloscopeError('Unsupported private scan window protocol');
  return message;
}
function validateRequestId(id: unknown): void {
  if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) {
    throw new SemanticOscilloscopeError('Invalid private scan request ID');
  }
}
export function parseOwnerScanRequest(data: unknown): OwnerScanRequest {
  const message = decode(data, 16_384);
  exactKeys(message, ['protocol', 'type', 'requestId', 'corpus', 'query']);
  validateRequestId(message.requestId);
  validateCorpus(message.corpus);
  if (message.type !== 'scan' || !boundedText(message.query, 500)) throw new SemanticOscilloscopeError('Invalid private scan query');
  return message as unknown as OwnerScanRequest;
}
export function parseOwnerScanReply(data: unknown, request: OwnerScanRequest): OwnerScanReply {
  const message = decode(data, MAX_SCAN_MESSAGE);
  if (message.type === 'ready') {
    exactKeys(message, ['protocol', 'type']);
  } else {
    if (message.requestId !== request.requestId) throw new SemanticOscilloscopeError('Private scan returned a stale request ID');
    if (message.type === 'result') {
      exactKeys(message, ['protocol', 'type', 'requestId', 'result']);
      validateSemanticScan(message.result, request.corpus, request.query);
    } else if (message.type === 'error') {
      exactKeys(message, ['protocol', 'type', 'requestId', 'code']);
      if (typeof message.code !== 'string' || !Object.prototype.hasOwnProperty.call(SCAN_ERRORS, message.code)) {
        throw new SemanticOscilloscopeError('Private scan returned an unknown error');
      }
    } else throw new SemanticOscilloscopeError('Unexpected private scan message');
  }
  if (message.type !== 'result' && (data as string).length > 1024) throw new SemanticOscilloscopeError('Oversized private scan status');
  return message as unknown as OwnerScanReply;
}
