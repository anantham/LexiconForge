export interface ThreadData {
  threadId: string;           // e.g., "char:Li Yao", "tone:combat", "meta:word_count"
  category: 'character' | 'tone' | 'location' | 'faction' | 'entity' | 'power' | 'meta' | 'custom';
  label: string;              // Display name
  color: string;              // Hex color
  values: number[];           // One value per chapter, indexed by chapterNumber-1. 0 if no data.
  totalChapters: number;      // Length of values array
}

export interface ThreadMetadata {
  threadId: string;
  category: ThreadData['category'];
  label: string;
  chaptersCovered: number;    // How many chapters have non-zero values
  peakValue: number;
  peakChapter: number;
}

export interface ChapterExtraction {
  chapter: number;
  toneScores?: Record<string, number>;
  characterPresence?: Record<string, number>;
  locationPresence?: Record<string, number>;
  entityMentions?: Record<string, number>;
  meta?: {
    wordCount: number;
    sentenceCount: number;
    paragraphCount: number;
    dialogueRatio: number;
  };
  events?: string[];
  arc?: string;
  volume?: number;
}

export interface OscilloscopeState {
  // Thread data
  threads: Map<string, ThreadData>;
  availableThreads: ThreadMetadata[];
  activeThreadIds: Set<string>;

  // View state
  zoomRange: [number, number];    // [startChapter, endChapter]
  hoveredChapter: number | null;
  selectedRange: [number, number] | null;
  isExpanded: boolean;

  // Data loading
  isLoaded: boolean;
  totalChapters: number;
}

export interface OscilloscopeActions {
  // Thread management
  toggleThread: (threadId: string) => void;
  setActiveThreads: (threadIds: string[]) => void;

  // View controls
  setZoomRange: (range: [number, number]) => void;
  zoomToChapter: (chapter: number, padding?: number) => void;
  setHoveredChapter: (chapter: number | null) => void;
  selectRange: (range: [number, number] | null) => void;
  setExpanded: (expanded: boolean) => void;

  // Data loading
  loadFromJSON: (
    metaData: Record<string, any>,
    characterThreads: Record<string, Record<string, number>>,
    totalChapters: number
  ) => void;
  addThread: (thread: ThreadData) => void;
  computeKeywordThread: (
    keyword: string,
    searchFn: (query: string) => Promise<Array<{ chapter_number: string; count?: number }>>
  ) => Promise<string>;
}

export type OscilloscopeSlice = OscilloscopeState & OscilloscopeActions;
