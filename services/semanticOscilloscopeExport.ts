import type { SessionData } from '../types/session';
import type {
  SemanticCorpusIdentity,
  SessionOscilloscopeData,
  ThreadData,
} from '../types/oscilloscope';
import {
  computeSemanticCorpusIdentity,
  createSessionOscilloscope,
} from './semanticOscilloscopeSession';

export const attachOscilloscopeToSession = async (session: SessionData): Promise<SessionData> => {
  const { useAppStore } = await import('../store');
  const state = useAppStore.getState();
  const corpus = await computeSemanticCorpusIdentity(session, {
    ...(session.novel.id === 'unknown' && state.corpusIdentity ? { corpusId: state.corpusIdentity.corpusId } : {}),
  });
  let oscilloscope: SessionOscilloscopeData;
  try {
    oscilloscope = createSessionOscilloscope(corpus, state.threads, state.activeThreadIds);
  } catch (error) {
    console.warn('[Export] Omitted stale oscilloscope tracks; corpus identity was refreshed:', error);
    oscilloscope = createSessionOscilloscope(corpus, new Map(), new Set());
  }
  return {
    ...session,
    oscilloscope,
  };
};

export const attachOscilloscopeToFullExport = async (
  payload: { chapters?: unknown[]; oscilloscope?: SessionOscilloscopeData; [key: string]: unknown },
  corpusHint: SemanticCorpusIdentity | null,
  threads: Map<string, ThreadData>,
  activeThreadIds: Set<string>,
): Promise<void> => {
  if (!corpusHint || !Array.isArray(payload.chapters) || payload.chapters.length === 0) return;
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
  try {
    payload.oscilloscope = createSessionOscilloscope(corpus, threads, activeThreadIds);
  } catch (error) {
    console.warn('[Export] Omitted stale oscilloscope tracks from full export:', error);
    payload.oscilloscope = createSessionOscilloscope(corpus, new Map(), new Set());
  }
};
