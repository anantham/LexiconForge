/**
 * Oscilloscope Slice - Manages Narrative Oscilloscope feature state
 *
 * Handles:
 * - Thread data (character, tone, meta, and custom keyword threads)
 * - Active thread selection and color assignment
 * - Zoom range and chapter hover/selection view state
 * - Loading and computing thread data from analysis JSON files
 */

import type { StateCreator } from 'zustand';
import type { StoreState } from '../storeTypes';
import type {
  OscilloscopeSlice,
  OscilloscopeState,
  ThreadData,
  ThreadMetadata,
} from '../../types/oscilloscope';
import { sameCorpus } from '../../services/semanticOscilloscopeSession';
import {
  CATEGORY_COLORS,
  normalizeThreadValues,
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

  /**
   * Load thread data from pre-computed JSON files.
   *
   * @param metaData      Shape: { [chapter_number]: { word_count, sentence_count, paragraph_count, dialogue_ratio } }
   * @param characterThreads Shape: { [character_name]: { [chapter_number]: normalized_score } }
   * @param totalChapters Total chapter count
   */
  loadFromJSON: (metaData, characterThreads, totalChapters) => {
    const threads = new Map<string, ThreadData>();

    // -- Meta threads --------------------------------------------------------
    const metaKeys: Array<{ key: string; threadId: string; label: string }> = [
      { key: 'word_count',      threadId: 'meta:word_count',      label: 'Word Count' },
      { key: 'dialogue_ratio',  threadId: 'meta:dialogue_ratio',  label: 'Dialogue Ratio' },
    ];

    for (const { key, threadId, label } of metaKeys) {
      const rawValues: number[] = [];
      for (let ch = 1; ch <= totalChapters; ch++) {
        const entry = metaData[String(ch)];
        rawValues.push(entry ? (entry[key] ?? 0) : 0);
      }

      const values = key === 'dialogue_ratio'
        ? rawValues  // already a ratio [0, 1]
        : normalizeThreadValues(rawValues);

      const thread: ThreadData = {
        threadId,
        category: 'meta',
        label,
        color: CATEGORY_COLORS.meta,
        values,
        totalChapters,
        provenance: { origin: 'precomputed', method: 'legacy-oscilloscope-analysis-v1' },
      };
      threads.set(threadId, thread);
    }

    // -- Character threads ---------------------------------------------------
    for (const [charName, chapterMap] of Object.entries(characterThreads)) {
      const threadId = `char:${charName}`;
      const values: number[] = [];
      for (let ch = 1; ch <= totalChapters; ch++) {
        values.push(chapterMap[String(ch)] ?? 0);
      }

      const thread: ThreadData = {
        threadId,
        category: 'character',
        label: charName,
        color: pickThreadColor(threads, 'character'),
        values,
        totalChapters,
        provenance: { origin: 'precomputed', method: 'legacy-oscilloscope-analysis-v1' },
      };
      threads.set(threadId, thread);
    }

    // -- Build availableThreads metadata -------------------------------------
    const availableThreads: ThreadMetadata[] = Array.from(threads.values()).map(toThreadMetadata);

    // -- Auto-activate default threads: dialogue ratio + combat + romance ----
    const activeThreadIds = new Set<string>([
      'meta:dialogue_ratio',
      'tone:combat',
      'tone:romance',
    ]);

    set({
      threads,
      availableThreads,
      activeThreadIds,
      totalChapters,
      zoomRange: [1, totalChapters] as [number, number],
      isLoaded: true,
    });
  },

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
