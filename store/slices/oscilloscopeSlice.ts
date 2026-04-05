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

// ---------------------------------------------------------------------------
// Color palettes
// ---------------------------------------------------------------------------

const THREAD_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6',
  '#a855f7', '#6366f1', '#0ea5e9', '#84cc16', '#f59e0b',
];

const CATEGORY_COLORS: Record<string, string> = {
  character: '#3b82f6',  // blue
  tone: '#ef4444',       // red
  location: '#22c55e',   // green
  faction: '#f97316',    // orange
  entity: '#8b5cf6',     // purple
  power: '#eab308',      // yellow
  meta: '#6b7280',       // gray
  custom: '#ec4899',     // pink
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick the next color from THREAD_COLORS cycling by current thread count. */
function pickColor(threads: Map<string, ThreadData>, category: string): string {
  const existing = threads.size;
  if (existing < THREAD_COLORS.length) {
    return THREAD_COLORS[existing];
  }
  return CATEGORY_COLORS[category] ?? THREAD_COLORS[existing % THREAD_COLORS.length];
}

/** Derive ThreadMetadata from a ThreadData object. */
function toMetadata(thread: ThreadData): ThreadMetadata {
  let peakValue = 0;
  let peakChapter = 1;

  for (let i = 0; i < thread.values.length; i++) {
    if (thread.values[i] > peakValue) {
      peakValue = thread.values[i];
      peakChapter = i + 1; // chapters are 1-indexed
    }
  }

  return {
    threadId: thread.threadId,
    category: thread.category,
    label: thread.label,
    chaptersCovered: thread.values.filter(v => v !== 0).length,
    peakValue,
    peakChapter,
  };
}

/** Normalize an array of raw numeric values to [0, 1]. Returns the array unchanged if max === 0. */
function normalizeValues(raw: number[]): number[] {
  const max = Math.max(...raw);
  if (max === 0) return raw;
  return raw.map(v => v / max);
}

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
        : normalizeValues(rawValues);

      const thread: ThreadData = {
        threadId,
        category: 'meta',
        label,
        color: CATEGORY_COLORS.meta,
        values,
        totalChapters,
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
        color: pickColor(threads, 'character'),
        values,
        totalChapters,
      };
      threads.set(threadId, thread);
    }

    // -- Build availableThreads metadata -------------------------------------
    const availableThreads: ThreadMetadata[] = Array.from(threads.values()).map(toMetadata);

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

      const newAvailable = Array.from(newThreads.values()).map(toMetadata);

      return {
        threads: newThreads,
        availableThreads: newAvailable,
      };
    });
  },

  /**
   * Compute a keyword thread by calling searchFn, normalizing counts, and
   * registering the thread under "custom:<keyword>".
   *
   * @returns The new threadId.
   */
  computeKeywordThread: async (keyword, searchFn) => {
    const threadId = `custom:${keyword}`;
    const state = get() as OscilloscopeState;
    const { totalChapters } = state;

    const results = await searchFn(keyword);

    // Accumulate counts per chapter
    const countMap: Record<number, number> = {};
    for (const result of results) {
      const chNum = parseInt(result.chapter_number, 10);
      if (!isNaN(chNum)) {
        countMap[chNum] = (countMap[chNum] ?? 0) + (result.count ?? 1);
      }
    }

    const rawValues: number[] = [];
    for (let ch = 1; ch <= totalChapters; ch++) {
      rawValues.push(countMap[ch] ?? 0);
    }

    const values = normalizeValues(rawValues);

    const newThreads = new Map(state.threads);
    const thread: ThreadData = {
      threadId,
      category: 'custom',
      label: keyword,
      color: pickColor(newThreads, 'custom'),
      values,
      totalChapters,
    };
    newThreads.set(threadId, thread);

    const newAvailable = Array.from(newThreads.values()).map(toMetadata);
    const newActive = new Set(state.activeThreadIds);
    newActive.add(threadId);

    set({
      threads: newThreads,
      availableThreads: newAvailable,
      activeThreadIds: newActive,
    });

    return threadId;
  },
});
