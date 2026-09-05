import type { SessionData } from '../types/session';
import type {
  SemanticCorpusIdentity,
  ThreadData,
} from '../types/oscilloscope';
import {
  computeSemanticCorpusIdentity,
  createSessionOscilloscope,
  sameCorpus,
} from './semanticOscilloscopeSession';

export const attachOscilloscopeToSession = async (session: SessionData): Promise<SessionData> => {
  const { useAppStore } = await import('../store');
  const state = useAppStore.getState();
  const corpusHint = state.corpusIdentity;
  const portableSession: SessionData = {
    ...session,
    novel: session.novel.id === 'unknown' && corpusHint
      ? { ...session.novel, id: corpusHint.corpusId }
      : session.novel,
    version: session.version.versionId === 'quick-export' && corpusHint
      ? { ...session.version, versionId: corpusHint.versionId }
      : session.version,
  };
  try {
    const corpus = await computeSemanticCorpusIdentity(portableSession);
    if (!corpusHint || !sameCorpus(corpusHint, corpus)) return portableSession;
    return {
      ...portableSession,
      oscilloscope: createSessionOscilloscope(corpus, state.threads, state.activeThreadIds),
    };
  } catch (error) {
    console.warn('[Export] Omitted unverifiable oscilloscope data; book export is preserved:', error);
    return portableSession;
  }
};

export const attachOscilloscopeToFullExport = async (
  payload: { chapters?: unknown[]; oscilloscope?: SessionData['oscilloscope']; [key: string]: unknown },
  corpusHint: SemanticCorpusIdentity | null,
  threads: Map<string, ThreadData>,
  activeThreadIds: Set<string>,
): Promise<void> => {
  delete payload.oscilloscope;
  if (!corpusHint || !Array.isArray(payload.chapters) || payload.chapters.length === 0) return;
  try {
    const corpus = await computeSemanticCorpusIdentity({
      novel: { id: corpusHint.corpusId, title: corpusHint.corpusId },
      version: {
        versionId: corpusHint.versionId,
        displayName: corpusHint.versionId,
        style: 'other',
        features: [],
      },
      chapters: payload.chapters,
    });
    if (!sameCorpus(corpusHint, corpus)) return;
    payload.oscilloscope = createSessionOscilloscope(corpus, threads, activeThreadIds);
  } catch (error) {
    console.warn('[Export] Omitted stale oscilloscope tracks from full export:', error);
  }
};
