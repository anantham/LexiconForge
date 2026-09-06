/**
 * Oscilloscope Slice - Manages Narrative Oscilloscope feature state
 *
 * Handles:
 * - Thread data (character, tone, meta, and custom keyword threads)
 * - Active thread selection and color assignment
 * - Zoom range and chapter hover/selection view state
 * - Verified session graphs and semantic scan results
 */

import type { StateCreator } from 'zustand';
import type { StoreState } from '../storeTypes';
import type {
  OscilloscopeSlice,
  OscilloscopeState,
  ThreadData,
} from '../../types/oscilloscope';
import {
  MAX_SESSION_THREADS,
  sameCorpus,
} from '../../services/semanticOscilloscopeSession';
import {
  pickThreadColor,
  toThreadMetadata,
} from './oscilloscopeThreadUtils';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: OscilloscopeState = {
  threads: new Map<string, ThreadData>(),
  availableThreads: [],
  activeThreadIds: new Set<string>(),
  zoomRange: [1, 1],
  hoveredChapter: null,
  selectedRange: null,
  isExpanded: false,
  isLoaded: false,
  totalChapters: 0,
  corpusIdentity: null,
};

// ---------------------------------------------------------------------------
// Slice creator
// ---------------------------------------------------------------------------

export const createOscilloscopeSlice: StateCreator<
  StoreState,
  [],
  [],
  OscilloscopeSlice
> = (set, get) => ({
  ...initialState,

  // -------------------------------------------------------------------------
  // Thread management
  // -------------------------------------------------------------------------

  toggleThread: (threadId) => {
    set((state: OscilloscopeState) => {
      const newActive = new Set(state.activeThreadIds);
      if (newActive.has(threadId)) {
        newActive.delete(threadId);
      } else {
        newActive.add(threadId);
      }
      return { activeThreadIds: newActive };
    });
  },

  setActiveThreads: (threadIds) => {
    set({ activeThreadIds: new Set(threadIds) });
  },

  // -------------------------------------------------------------------------
  // View controls
  // -------------------------------------------------------------------------

  setZoomRange: (range) => {
    set({ zoomRange: range });
  },

  zoomToChapter: (chapter, padding = 10) => {
    const { totalChapters } = get() as OscilloscopeState;
    const start = Math.max(1, chapter - padding);
    const end = Math.min(totalChapters, chapter + padding);
    set({ zoomRange: [start, end] as [number, number] });
  },

  setHoveredChapter: (chapter) => {
    set({ hoveredChapter: chapter });
  },

  selectRange: (range) => {
    set({ selectedRange: range });
  },

  setExpanded: (expanded) => {
    set({ isExpanded: expanded });
  },

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  addThread: (thread) => {
    set((state: OscilloscopeState) => {
      const newThreads = new Map(state.threads);
      newThreads.set(thread.threadId, thread);

      const newAvailable = Array.from(newThreads.values()).map(toThreadMetadata);

      return {
        threads: newThreads,
        availableThreads: newAvailable,
      };
    });
  },

  addSemanticThread: (query, result) => {
    const state = get() as OscilloscopeState;
    if (!state.corpusIdentity || !sameCorpus(state.corpusIdentity, result.corpus)) {
      throw new Error('Semantic scan result does not match the loaded oscilloscope corpus');
    }
    if (result.scores.length !== state.totalChapters) {
      throw new Error(`Semantic scan returned ${result.scores.length} scores for ${state.totalChapters} chapters`);
    }
    const cleanQuery = query.trim();
    if (!cleanQuery || result.query !== cleanQuery) {
      throw new Error('Semantic scan result does not match the requested query');
    }
    if (result.scores.some((score) => !Number.isFinite(score) || score < 0 || score > 1)) {
      throw new Error('Semantic scan result contains a non-finite or out-of-range score');
    }
    const threadId = `custom:semantic:${cleanQuery}`;
    if (!state.threads.has(threadId) && state.threads.size >= MAX_SESSION_THREADS) {
      throw new Error(`Semantic oscilloscope sessions support at most ${MAX_SESSION_THREADS} threads`);
    }
    const newThreads = new Map(state.threads);
    const thread: ThreadData = {
      threadId,
      category: 'custom',
      label: cleanQuery,
      color: pickThreadColor(newThreads, 'custom'),
      values: [...result.scores],
      totalChapters: state.totalChapters,
      provenance: {
        origin: 'private-semantic-scan',
        query: cleanQuery,
        generatedAt: new Date().toISOString(),
        protocol: result.protocol,
        scoreSemantics: result.scoreSemantics,
        vectorSpace: result.vectorSpace,
        dimensions: result.dimensions,
        scoring: { ...result.scoring, range: [...result.scoring.range] },
        corpus: { ...result.corpus },
      },
    };
    newThreads.set(threadId, thread);
    const newAvailable = Array.from(newThreads.values()).map(toThreadMetadata);
    const newActive = new Set(state.activeThreadIds);
    newActive.add(threadId);
    set({
      threads: newThreads,
      availableThreads: newAvailable,
      activeThreadIds: newActive,
    });
    return threadId;
  },

  initializeOscilloscope: (corpus) => set({
    threads: new Map(),
    availableThreads: [],
    activeThreadIds: new Set(),
    zoomRange: [1, corpus.chapterCount] as [number, number],
    hoveredChapter: null,
    selectedRange: null,
    isLoaded: true,
    totalChapters: corpus.chapterCount,
    corpusIdentity: { ...corpus },
  }),

  loadSessionOscilloscope: (data) => {
    const threads = new Map(data.threads.map((thread) => [thread.threadId, thread]));
    set({
      threads,
      availableThreads: Array.from(threads.values()).map(toThreadMetadata),
      activeThreadIds: new Set(data.activeThreadIds),
      zoomRange: [1, data.corpus.chapterCount] as [number, number],
      hoveredChapter: null,
      selectedRange: null,
      isLoaded: true,
      totalChapters: data.corpus.chapterCount,
      corpusIdentity: { ...data.corpus },
    });
  },

  resetOscilloscope: () => set({
    threads: new Map(),
    availableThreads: [],
    activeThreadIds: new Set(),
    zoomRange: [1, 1] as [number, number],
    hoveredChapter: null,
    selectedRange: null,
    isExpanded: false,
    isLoaded: false,
    totalChapters: 0,
    corpusIdentity: null,
  }),
});
