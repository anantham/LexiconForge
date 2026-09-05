import type { SessionData } from '../types/session';
import type {
  SemanticCorpusIdentity,
  SessionOscilloscopeData,
  ThreadData,
  ThreadProvenance,
} from '../types/oscilloscope';

const CORPUS_SCHEMA = 'lexiconforge-semantic-corpus-v1';
export const MAX_SESSION_THREADS = 500;
const CATEGORIES = new Set([
  'character', 'tone', 'location', 'faction', 'entity', 'power', 'meta', 'custom',
]);

const normalizeText = (value: unknown): string => (
  typeof value === 'string'
    ? value.replace(/\r\n?/g, '\n').normalize('NFC').trim()
    : ''
);

const chapterNumber = (chapter: Record<string, unknown>, fallback: number): number => {
  if (!Object.prototype.hasOwnProperty.call(chapter, 'chapterNumber')) return fallback;
  const value = chapter.chapterNumber;
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  throw new Error('chapterNumber must be a positive integer when provided');
};

const selectedChapterText = (chapter: Record<string, unknown>): string => {
  if (Array.isArray(chapter.translations)) {
    const records = chapter.translations.filter(
      (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object',
    );
    const active = records.find(
      (item) => item.isActive === true && Boolean(normalizeText(item.translation)),
    );
    if (active) return normalizeText(active.translation);

    let latest: { record: Record<string, unknown>; version: number; index: number } | null = null;
    for (const [index, record] of records.entries()) {
      if (!normalizeText(record.translation)) continue;
      const version = typeof record.version === 'number' ? record.version : 0;
      if (!latest || version > latest.version || (version === latest.version && index > latest.index)) {
        latest = { record, version, index };
      }
    }
    if (latest) return normalizeText(latest.record.translation);
  }
  if (chapter.translationResult && typeof chapter.translationResult === 'object') {
    const hydratedTranslation = normalizeText(
      (chapter.translationResult as Record<string, unknown>).translation,
    );
    if (hydratedTranslation) return hydratedTranslation;
  }
  return normalizeText(chapter.fanTranslation) || normalizeText(chapter.content);
};

const sha256 = async (value: string): Promise<`sha256:${string}`> => {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto SHA-256 is unavailable; semantic corpus identity cannot be verified');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
};

export const computeSemanticCorpusIdentity = async (
  session: Pick<SessionData, 'novel' | 'version' | 'chapters'>,
  overrides: Partial<Pick<SemanticCorpusIdentity, 'corpusId' | 'versionId'>> = {},
): Promise<SemanticCorpusIdentity> => {
  const corpusId = normalizeText(overrides.corpusId || session.novel?.id);
  const versionId = normalizeText(overrides.versionId || session.version?.versionId);
  if (!corpusId) throw new Error('session.novel.id is required for semantic corpus identity');
  if (!versionId) throw new Error('session.version.versionId is required for semantic corpus identity');
  if (!Array.isArray(session.chapters) || session.chapters.length === 0) {
    throw new Error('session.chapters must be a non-empty array for semantic corpus identity');
  }

  const chapters = session.chapters.map((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      throw new Error(`session.chapters[${index}] must be an object`);
    }
    const chapter = raw as Record<string, unknown>;
    try {
      return {
        chapterNumber: chapterNumber(chapter, index + 1),
        title: normalizeText(chapter.title),
        text: selectedChapterText(chapter),
      };
    } catch (error) {
      throw new Error(
        `session.chapters[${index}].chapterNumber is invalid: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }).sort((left, right) => left.chapterNumber - right.chapterNumber);

  const actual = chapters.map((chapter) => chapter.chapterNumber);
  if (actual.some((value, index) => value !== index + 1)) {
    throw new Error(`chapter numbers must be unique and contiguous from 1; received ${actual.slice(0, 12).join(', ')}`);
  }

  const canonical = JSON.stringify({ schema: CORPUS_SCHEMA, chapters });
  return {
    corpusId,
    versionId,
    contentHash: await sha256(canonical),
    chapterCount: chapters.length,
  };
};

export const sameCorpus = (left: SemanticCorpusIdentity, right: SemanticCorpusIdentity): boolean => (
  left.corpusId === right.corpusId
  && left.versionId === right.versionId
  && left.contentHash === right.contentHash
  && left.chapterCount === right.chapterCount
);

const cloneProvenance = (value: unknown): ThreadProvenance | undefined => {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object') throw new Error('oscilloscope thread provenance must be an object');
  const provenance = value as Record<string, unknown>;
  if (provenance.origin === 'precomputed') {
    if (typeof provenance.method !== 'string' || !provenance.method.trim()) {
      throw new Error('precomputed oscilloscope provenance requires a method');
    }
    if (provenance.generatedAt !== undefined && typeof provenance.generatedAt !== 'string') {
      throw new Error('precomputed oscilloscope provenance generatedAt must be a string');
    }
    return {
      origin: 'precomputed',
      method: provenance.method,
      ...(provenance.generatedAt ? { generatedAt: provenance.generatedAt } : {}),
    };
  }
  if (provenance.origin !== 'private-semantic-scan') {
    throw new Error('oscilloscope thread provenance origin is invalid');
  }
  const scoring = provenance.scoring;
  const corpus = provenance.corpus;
  if (!scoring || typeof scoring !== 'object' || !corpus || typeof corpus !== 'object') {
    throw new Error('private semantic provenance requires scoring and corpus objects');
  }
  const rawRange = (scoring as Record<string, unknown>).range;
  const algorithm = (scoring as Record<string, unknown>).algorithm;
  if (
    !Array.isArray(rawRange)
    || rawRange.length !== 2
    || rawRange.some((bound) => typeof bound !== 'number' || !Number.isFinite(bound))
    || rawRange[0] > rawRange[1]
  ) {
    throw new Error('private semantic provenance requires a finite ordered scoring range');
  }
  if (typeof algorithm !== 'string' || !algorithm.trim()) {
    throw new Error('private semantic provenance requires a scoring algorithm');
  }
  const requiredStrings = ['query', 'generatedAt', 'protocol', 'scoreSemantics', 'vectorSpace'] as const;
  if (requiredStrings.some((key) => typeof provenance[key] !== 'string' || !(provenance[key] as string).trim())) {
    throw new Error('private semantic provenance string fields are invalid');
  }
  if (!Number.isInteger(provenance.dimensions) || (provenance.dimensions as number) <= 0) {
    throw new Error('private semantic provenance dimensions must be a positive integer');
  }
  const typedCorpus = corpus as unknown as SemanticCorpusIdentity;
  return {
    origin: 'private-semantic-scan',
    query: provenance.query as string,
    generatedAt: provenance.generatedAt as string,
    protocol: provenance.protocol as string,
    scoreSemantics: provenance.scoreSemantics as string,
    vectorSpace: provenance.vectorSpace as string,
    dimensions: provenance.dimensions as number,
    scoring: {
      algorithm,
      range: [rawRange[0], rawRange[1]],
    },
    corpus: {
      corpusId: typedCorpus.corpusId,
      versionId: typedCorpus.versionId,
      contentHash: typedCorpus.contentHash,
      chapterCount: typedCorpus.chapterCount,
    },
  };
};

const validateThread = (value: unknown, corpus: SemanticCorpusIdentity): ThreadData => {
  if (!value || typeof value !== 'object') throw new Error('oscilloscope thread must be an object');
  const thread = value as Record<string, unknown>;
  if (
    typeof thread.threadId !== 'string'
    || !thread.threadId
    || typeof thread.label !== 'string'
    || !thread.label
    || typeof thread.category !== 'string'
    || !CATEGORIES.has(thread.category)
  ) {
    throw new Error('oscilloscope thread identity, label, or category is invalid');
  }
  if (typeof thread.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(thread.color)) {
    throw new Error(`thread ${thread.threadId} has an invalid color`);
  }
  if (!Array.isArray(thread.values) || thread.values.length !== corpus.chapterCount) {
    throw new Error(`thread ${thread.threadId} must contain ${corpus.chapterCount} chapter values`);
  }
  if (thread.values.some((score) => typeof score !== 'number' || !Number.isFinite(score))) {
    throw new Error(`thread ${thread.threadId} contains a non-finite score`);
  }
  if (thread.totalChapters !== corpus.chapterCount) {
    throw new Error(`thread ${thread.threadId} chapter count does not match its corpus`);
  }
  const provenance = cloneProvenance(thread.provenance);
  if (provenance?.origin === 'private-semantic-scan' && !sameCorpus(provenance.corpus, corpus)) {
    throw new Error(`thread ${thread.threadId} semantic provenance references a different corpus`);
  }
  if (
    provenance?.origin === 'private-semantic-scan'
    && thread.values.some((score) => score < provenance.scoring.range[0] || score > provenance.scoring.range[1])
  ) {
    throw new Error(`thread ${thread.threadId} contains a score outside its declared scoring range`);
  }
  return {
    threadId: thread.threadId,
    category: thread.category as ThreadData['category'],
    label: thread.label,
    color: thread.color,
    values: [...thread.values],
    totalChapters: thread.totalChapters as number,
    ...(provenance ? { provenance } : {}),
  };
};

export const parseSessionOscilloscope = (
  value: unknown,
  expectedCorpus: SemanticCorpusIdentity,
): SessionOscilloscopeData => {
  if (!value || typeof value !== 'object') throw new Error('session.oscilloscope must be an object');
  const data = value as Record<string, unknown>;
  if (data.format !== 'lexiconforge-oscilloscope' || data.version !== '1.0') {
    throw new Error('unsupported session oscilloscope format');
  }
  if (!data.corpus || typeof data.corpus !== 'object' || !sameCorpus(data.corpus as SemanticCorpusIdentity, expectedCorpus)) {
    throw new Error('session oscilloscope corpus does not match the loaded chapter text');
  }
  if (!Array.isArray(data.threads) || data.threads.length > MAX_SESSION_THREADS) {
    throw new Error(`session oscilloscope threads must be an array with at most ${MAX_SESSION_THREADS} entries`);
  }
  const threads = data.threads.map((thread) => validateThread(thread, expectedCorpus));
  const ids = new Set(threads.map((thread) => thread.threadId));
  if (ids.size !== threads.length) {
    throw new Error('session oscilloscope thread IDs must be unique');
  }
  if (!Array.isArray(data.activeThreadIds)) {
    throw new Error('session oscilloscope active thread IDs must be an array');
  }
  const activeThreadIds = data.activeThreadIds.map((id) => {
    if (typeof id !== 'string' || !ids.has(id)) {
      throw new Error(`session oscilloscope active thread ID is invalid or unknown: ${String(id)}`);
    }
    return id;
  });
  if (new Set(activeThreadIds).size !== activeThreadIds.length) {
    throw new Error('session oscilloscope active thread IDs must be unique');
  }
  return {
    format: 'lexiconforge-oscilloscope',
    version: '1.0',
    corpus: { ...expectedCorpus },
    threads,
    activeThreadIds,
  };
};

export const createSessionOscilloscope = (
  corpus: SemanticCorpusIdentity,
  threads: Map<string, ThreadData>,
  activeThreadIds: Set<string>,
): SessionOscilloscopeData => {
  if (threads.size > MAX_SESSION_THREADS) {
    throw new Error(`cannot serialize more than ${MAX_SESSION_THREADS} oscilloscope threads`);
  }
  const serialized = Array.from(threads.values(), (thread) => validateThread(thread, corpus));
  const ids = new Set(serialized.map((thread) => thread.threadId));
  return {
    format: 'lexiconforge-oscilloscope',
    version: '1.0',
    corpus: { ...corpus },
    threads: serialized,
    activeThreadIds: Array.from(activeThreadIds).filter((id) => ids.has(id)),
  };
};
