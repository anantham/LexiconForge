import { SettingsOps } from './db/operations/settings';
import type { OscilloscopeState, SessionOscilloscopeData } from '../types/oscilloscope';
import {
  computeSemanticCorpusIdentity,
  createSessionOscilloscope,
  parseSessionOscilloscope,
} from './semanticOscilloscopeSession';

const cacheKey = (novelId: string, versionId: string) =>
  `oscilloscope:${JSON.stringify([novelId, versionId])}`;
let pendingWrite: Promise<unknown> = Promise.resolve();

// Save only on book departure, not on graph hover/zoom or every store change.
export const cacheOscilloscope = (state: OscilloscopeState): void => {
  if (!state.corpusIdentity || state.threads.size === 0) return;
  try {
    const data = createSessionOscilloscope(state.corpusIdentity, state.threads, state.activeThreadIds);
    pendingWrite = SettingsOps.set(cacheKey(data.corpus.corpusId, data.corpus.versionId), data)
      .catch((error) => console.warn('[Oscilloscope] Could not cache frozen graph:', error));
  } catch (error) {
    console.warn('[Oscilloscope] Could not serialize frozen graph for cache:', error);
  }
};

export const restoreCachedOscilloscope = async (signal: AbortSignal): Promise<boolean> => {
  const { useAppStore } = await import('../store');
  const state = useAppStore.getState();
  if (!state.activeNovelId || !state.activeVersionId || state.isLoaded) return false;
  try {
    await pendingWrite;
    const data = await SettingsOps.getKey<SessionOscilloscopeData>(cacheKey(state.activeNovelId, state.activeVersionId));
    if (!data) return false;
    const corpus = await computeSemanticCorpusIdentity({
      novel: { id: state.activeNovelId },
      version: { versionId: state.activeVersionId },
      chapters: Array.from(state.chapters.values()).filter((chapter) =>
        chapter.novelId === state.activeNovelId && chapter.libraryVersionId === state.activeVersionId),
    } as any);
    const current = useAppStore.getState();
    if (signal.aborted || current.chapters !== state.chapters || current.isLoaded
      || current.activeNovelId !== state.activeNovelId || current.activeVersionId !== state.activeVersionId) return false;
    current.loadSessionOscilloscope(parseSessionOscilloscope(data, corpus));
    return true;
  } catch (error) {
    if (!signal.aborted) console.warn('[Oscilloscope] Cached graph could not be verified:', error);
    return false;
  }
};
