import type { SessionData } from '../types/session';
import type {
  SemanticCorpusIdentity,
  SessionOscilloscopeData,
  ThreadData,
  ThreadProvenance,
} from '../types/oscilloscope';

const CORPUS_SCHEMA = 'lexiconforge-semantic-corpus-v1';
const CATEGORIES = new Set([
  'character', 'tone', 'location', 'faction', 'entity', 'power', 'meta', 'custom',
]);

const normalizeText = (value: unknown): string => (
  typeof value === 'string'
    ? value.replace(/\r\n?/g, '\n').normalize('NFC').trim()
    : ''
);

const chapterNumber = (chapter: Record<string, unknown>, fallback: number): number => {
  const value = chapter.chapterNumber;
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
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
    return {
      chapterNumber: chapterNumber(chapter, index + 1),
      title: normalizeText(chapter.title),
      text: selectedChapterText(chapter),
    };
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

const cloneProvenance = (value: ThreadProvenance | undefined): ThreadProvenance | undefined => {
  if (!value) return undefined;
  if (value.origin === 'precomputed') {
    return { origin: value.origin, method: value.method, ...(value.generatedAt ? { generatedAt: value.generatedAt } : {}) };
  }
  return {
    origin: value.origin,
    query: value.query,
    generatedAt: value.generatedAt,
    protocol: value.protocol,
    scoreSemantics: value.scoreSemantics,
    vectorSpace: value.vectorSpace,
    dimensions: value.dimensions,
    scoring: { algorithm: value.scoring.algorithm, range: [...value.scoring.range] },
    corpus: { ...value.corpus },
  };
};

const validateThread = (value: unknown, corpus: SemanticCorpusIdentity): ThreadData => {
  if (!value || typeof value !== 'object') throw new Error('oscilloscope thread must be an object');
  const thread = value as ThreadData;
  if (!thread.threadId || !thread.label || !CATEGORIES.has(thread.category)) {
    throw new Error('oscilloscope thread identity, label, or category is invalid');
  }
  if (!/^#[0-9a-f]{6}$/i.test(thread.color)) throw new Error(`thread ${thread.threadId} has an invalid color`);
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
  return { ...thread, values: [...thread.values], ...(provenance ? { provenance } : {}) };
};

export const parseSessionOscilloscope = (
  value: unknown,
  expectedCorpus: SemanticCorpusIdentity,
): SessionOscilloscopeData => {
  if (!value || typeof value !== 'object') throw new Error('session.oscilloscope must be an object');
  const data = value as SessionOscilloscopeData;
  if (data.format !== 'lexiconforge-oscilloscope' || data.version !== '1.0') {
    throw new Error('unsupported session oscilloscope format');
  }
  if (!data.corpus || !sameCorpus(data.corpus, expectedCorpus)) {
    throw new Error('session oscilloscope corpus does not match the loaded chapter text');
  }
  if (!Array.isArray(data.threads) || data.threads.length > 500) {
    throw new Error('session oscilloscope threads must be an array with at most 500 entries');
  }
  const threads = data.threads.map((thread) => validateThread(thread, expectedCorpus));
  const ids = new Set(threads.map((thread) => thread.threadId));
  const activeThreadIds = Array.isArray(data.activeThreadIds)
    ? data.activeThreadIds.filter((id): id is string => typeof id === 'string' && ids.has(id))
    : [];
  return { ...data, corpus: { ...expectedCorpus }, threads, activeThreadIds };
};

export const createSessionOscilloscope = (
  corpus: SemanticCorpusIdentity,
  threads: Map<string, ThreadData>,
  activeThreadIds: Set<string>,
): SessionOscilloscopeData => {
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
