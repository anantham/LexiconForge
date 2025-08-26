import { create } from 'zustand';
import { Chapter, FeedbackItem, AmendmentProposal, TranslationResult, AppSettings, HistoricalChapter, PromptTemplate } from '../types';
import { INITIAL_SYSTEM_PROMPT, SUPPORTED_WEBSITES } from '../constants';
import { translateChapter, validateApiKey } from '../services/aiService';
import { fetchAndParseUrl } from '../services/adapters';
import { TranslationRecord, indexedDBService } from '../services/indexeddb';
import { 
  NovelInfo, 
  EnhancedChapter, 
  normalizeUrlAggressively, 
  generateStableChapterId, 
  transformImportedChapters 
} from '../services/stableIdService';

// ---- User provided helpers ----
const settingsStorageKey = 'app-settings';

const isKakuyomuUrl = (u: string) => {
  try {
    const url = new URL(u);
    if (url.hostname !== 'kakuyomu.jp') return false;
    return /^\/works\/\d+\/episodes\/\d+/.test(url.pathname);
  } catch { return false; }
};

const normalizeUrl = (url: string | null): string | null => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.delete('viewer');
    urlObj.searchParams.delete('book');
    // Also remove trailing slashes from pathname
    const pathname = urlObj.pathname.replace(/\/$/, '');
    return urlObj.origin + pathname + urlObj.search;
  } catch (e) {
    // If URL is invalid, return it as is.
    return url;
  }
};

// Check if URL has a supported adapter using centralized SUPPORTED_WEBSITES list
const hasAdapter = (u: string) => {
  try {
    const url = new URL(u);
    return SUPPORTED_WEBSITES.some(domain => url.hostname.includes(domain));
  } catch { return false; }
};

const shallowEqual = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

const inflightFetches = new Map<string, Promise<void>>();
// ---- End of user provided helpers ----

export interface SessionChapterData {
  chapter: Chapter;
  translationResult: TranslationResult | null;
  availableVersions?: TranslationRecord[];
  activeVersion?: number;
  feedback?: FeedbackItem[];
  translationSettingsSnapshot?: Partial<Pick<AppSettings, 'provider' | 'model' | 'temperature' | 'contextDepth' | 'systemPrompt'>>;
}

const defaultSettings: AppSettings = {
    contextDepth: 3, // <-- Updated as per user's instruction
    preloadCount: 0,
    fontSize: 18,
    fontStyle: 'serif',
    lineHeight: 1.7,
    systemPrompt: INITIAL_SYSTEM_PROMPT,
    provider: 'Gemini',
    model: 'gemini-2.5-flash',
    imageModel: 'imagen-3.0-generate-001',
    temperature: 0.3,
    apiKeyGemini: '',
    apiKeyOpenAI: '',
    apiKeyDeepSeek: '',
};

interface AppState {
    isLoading: { fetching: boolean; translating: boolean };
    error: string | null;
    showSettingsModal: boolean;

    // New Stable State
    novels: Map<string, NovelInfo>;
    chapters: Map<string, EnhancedChapter>;
    urlIndex: Map<string, string>; // normalizedUrl -> chapterId
    rawUrlIndex: Map<string, string>; // rawUrl -> chapterId
    currentChapterId: string | null;
    navigationHistory: string[]; // array of chapterIds

    showEnglish: boolean;
    feedbackHistory: { [key: string]: FeedbackItem[] }; // Keyed by chapterId
    settings: AppSettings;
    isDirty: boolean;
    amendmentProposal: AmendmentProposal | null;
    activeTranslations: Record<string, AbortController>; // Keyed by chapterId
    urlLoadingStates: Record<string, boolean>; // Keyed by chapterId
    feedbackUIState?: { isSubmitting: boolean; activeChapterId?: string };
    promptTemplates: PromptTemplate[];
    activePromptTemplate: PromptTemplate | null;
}

interface AppActions {
    handleFetch: (fetchUrl: string) => Promise<void>;
    handleTranslate: (chapterId: string) => Promise<void>;
    handleRetranslateCurrent: () => void;
    handleNavigate: (newUrl: string) => Promise<void>;
    isValidUrl: (url: string) => boolean;
    handleToggleLanguage: (show: boolean) => void;
    isChapterLoading: (chapterId: string) => boolean;
    buildTranslationHistory: (chapterId: string) => HistoricalChapter[];
    addFeedback: (chapterId: string, item: FeedbackItem) => void;
    deleteFeedback: (chapterId: string, id: string) => void;
    updateFeedbackComment: (chapterId: string, id: string, comment: string) => void;
    setShowSettingsModal: (isOpen: boolean) => void;
    updateSettings: (newSettings: Partial<AppSettings>) => void;
    acceptProposal: () => void;
    rejectProposal: () => void;
    clearSession: () => void;
    importSessionData: (payload: string | object) => Promise<void>;
    exportSessionData: () => string;
    isChapterTranslating: (chapterId: string) => boolean;
    hasTranslationSettingsChanged: (chapterId: string) => boolean;
    shouldEnableRetranslation: (chapterId: string) => boolean;
    getNavigationHistory: () => string[];
    navigateBack: () => string | undefined;
    startFeedbackSubmission: (chapterId: string) => void;
    cancelFeedbackSubmission: () => void;
    createPromptTemplate: (template: Omit<PromptTemplate, 'id' | 'createdAt'>) => Promise<void>;
    updatePromptTemplate: (template: PromptTemplate) => Promise<void>;
    deletePromptTemplate: (id: string) => Promise<void>;
    setActivePromptTemplate: (id: string) => Promise<void>;
    loadPromptTemplates: () => Promise<void>;
    getChapterById: (chapterId: string) => EnhancedChapter | null;
    hydrateIndicesOnBoot: () => Promise<void>;
    loadChapterFromIDB: (chapterId: string) => Promise<EnhancedChapter | null>;
    fetchTranslationVersions: (chapterId: string) => Promise<TranslationRecord[]>;
    setActiveTranslationVersion: (chapterId: string, version: number) => Promise<void>;
}

type Store = AppState & AppActions;

export const useAppStore = create<Store>()((set, get) => ({
  // NEW STATE
  novels: new Map(),
  chapters: new Map(),
  urlIndex: new Map(),
  rawUrlIndex: new Map(),
  currentChapterId: null,
  navigationHistory: [],

  urlLoadingStates: {},
  activeTranslations: {},
  feedbackHistory: {},
  feedbackUIState: { isSubmitting: false },
  error: null,
  isLoading: { fetching: false, translating: false },
  showSettingsModal: false,
  showEnglish: false,
  isDirty: false,
  amendmentProposal: null,
  promptTemplates: [],
  activePromptTemplate: null,

  // DEFAULTS + HYDRATE
  settings: (() => {
    try {
      const raw = localStorage.getItem(settingsStorageKey);
      if (raw) return { ...defaultSettings, ...JSON.parse(raw) } as AppSettings;
    } catch (e) { console.warn('[settings] corrupted, using defaults', e); }
    return { ...defaultSettings };
  })(),

  // CONTRACT HELPERS
  isValidUrl: (u) => hasAdapter(u),
  isUrlLoading: (u) => !!get().urlLoadingStates[u],
  isUrlTranslating: (u) => !!get().activeTranslations[u],
  // StableID helpers used by new UI
  isChapterLoading: (chapterId: string) => !!get().urlLoadingStates[chapterId],
  isChapterTranslating: (chapterId: string) => !!get().activeTranslations[chapterId],

  getNavigationHistory: () => {
    const { navigationHistory, chapters } = get();
    // Return canonical URLs for display or external use
    return navigationHistory.map(id => chapters.get(id)?.canonicalUrl).filter(Boolean) as string[];
  },
  navigateBack: () => {
    const { navigationHistory, chapters } = get();
    if (navigationHistory.length < 2) return undefined;
    
    const prevChapterId = navigationHistory[navigationHistory.length - 2];
    
    set({ 
      navigationHistory: navigationHistory.slice(0, -1),
      currentChapterId: prevChapterId
    });

    return chapters.get(prevChapterId)?.canonicalUrl;
  },

  handleNavigate: async (url: string) => {
    console.log(`[Nav] Navigating to: ${url}`);
    const { urlIndex, rawUrlIndex, chapters } = get();
    const normalizedUrl = normalizeUrlAggressively(url);
    
    console.log(`[Nav] URL normalization: ${url} -> ${normalizedUrl}`);
    console.log(`[Nav] URL index size: ${urlIndex.size}, Raw URL index size: ${rawUrlIndex.size}`);

    let chapterId = urlIndex.get(normalizedUrl || '') || rawUrlIndex.get(url);
    console.log(`[Nav] Resolved chapterId: ${chapterId}`);
    
    if (chapterId) {
      const hasChapter = chapters.has(chapterId);
      const chapter = chapters.get(chapterId);
      console.log(`[Nav] Chapter ${chapterId} status:`, {
        inMemory: hasChapter,
        hasContent: !!chapter?.content,
        contentLength: chapter?.content?.length || 0,
        hasTranslation: !!chapter?.translationResult,
        title: chapter?.title
      });
    }

    if (chapterId && chapters.has(chapterId)) {
      // Chapter is already loaded, just set it as current
      console.log(`[Nav] Chapter found in memory, updating navigation history`);
      set(s => {
        const newHistory = [...new Set(s.navigationHistory.concat(chapterId!))];
        console.log(`[Nav] Navigation history update:`, {
          before: s.navigationHistory,
          after: newHistory,
          currentChapter: chapterId
        });
        return {
          currentChapterId: chapterId,
          navigationHistory: newHistory,
          error: null
        };
      });
      try {
        const canonical = chapters.get(chapterId)?.canonicalUrl || url;
        await indexedDBService.setSetting('lastActiveChapter', { id: chapterId, url: canonical });
      } catch {}
      console.log(`[Navigate] Found existing chapter ${chapterId} for URL ${url}.`);
      
      // Update browser history
      const chapter = chapters.get(chapterId);
      if (chapter && typeof history !== 'undefined' && history.pushState) {
          // Avoid using `?url=` which collides with Vite's special asset query
          history.pushState({ chapterId }, '', `?chapter=${encodeURIComponent(chapter.canonicalUrl)}`);
      }

    } else if (chapterId && !chapters.has(chapterId)) {
      // We have a mapping but content isn't in memory; lazy-load from IndexedDB
      console.log(`[Nav] Mapping found (${chapterId}) but not loaded. Hydrating from IndexedDB...`);
      set(s => ({ urlLoadingStates: { ...s.urlLoadingStates, [chapterId]: true }, error: null }));
      try {
        const loaded = await get().loadChapterFromIDB(chapterId);
        console.log(`[Nav] Lazy load result:`, {
          success: !!loaded,
          chapterId,
          title: loaded?.title,
          hasContent: !!loaded?.content,
          contentLength: loaded?.content?.length || 0
        });
        if (loaded) {
          set(s => {
            const newHistory = [...new Set(s.navigationHistory.concat(chapterId!))];
            console.log(`[Nav] Post-lazy-load navigation history:`, {
              before: s.navigationHistory,
              after: newHistory,
              currentChapter: chapterId
            });
            return {
              currentChapterId: chapterId,
              navigationHistory: newHistory,
              error: null,
            };
          });
          try { await indexedDBService.setSetting('lastActiveChapter', { id: chapterId, url: loaded.canonicalUrl }); } catch {}
          if (typeof history !== 'undefined' && history.pushState) {
            history.pushState({ chapterId }, '', `?chapter=${encodeURIComponent(loaded.canonicalUrl)}`);
          }
          console.log(`[Navigate] Hydrated chapter ${chapterId} from IndexedDB.`);
          return;
        }
      } catch (e) {
        console.error('[Navigate] Failed to hydrate chapter from IndexedDB', e);
      } finally {
        set(s => {
          const ls = { ...s.urlLoadingStates };
          delete ls[chapterId!];
          return { urlLoadingStates: ls };
        });
      }

      // Fall through to supported fetch or error
      if (get().isValidUrl(url)) {
        console.log(`[Navigate] Hydration failed; attempting fetch for ${url}...`);
        set({ error: null });
        await get().handleFetch(url);
      } else {
        const errorMessage = `Navigation failed: The URL is not from a supported source and the chapter has not been imported.`;
        console.error(`[Navigate] ${errorMessage}`, { url });
        set({ error: errorMessage });
      }

    } else if (get().isValidUrl(url)) {
      // Chapter not found, but the URL is from a supported scraping source
      console.log(`[Navigate] No chapter found for ${url}. Attempting to fetch...`);
      // Clear any stale error before we attempt a fresh fetch
      set({ error: null });
      await get().handleFetch(url);

    } else {
      // Chapter not found and not a valid scraping URL
      // As a last resort, try to locate the chapter directly in IndexedDB by URL
      try {
        const found = await indexedDBService.findChapterByUrl(url);
        if (found?.stableId) {
          const chapterIdFound = found.stableId;
          const c = found.data?.chapter || {};
          const canonicalUrl = found.canonicalUrl || c.originalUrl || url;
          const enhanced: EnhancedChapter = {
            id: chapterIdFound,
            title: c.title || 'Untitled Chapter',
            content: c.content || '',
            originalUrl: canonicalUrl,
            canonicalUrl,
            nextUrl: c.nextUrl,
            prevUrl: c.prevUrl,
            chapterNumber: c.chapterNumber || 0,
            sourceUrls: [c.originalUrl || canonicalUrl],
            importSource: { originalUrl: c.originalUrl || canonicalUrl, importDate: new Date(), sourceFormat: 'json' },
            translationResult: found.data?.translationResult || null,
          } as EnhancedChapter;

          set(s => {
            const chapters = new Map(s.chapters);
            chapters.set(chapterIdFound, enhanced);
            const urlIndex = new Map(s.urlIndex);
            const rawUrlIndex = new Map(s.rawUrlIndex);
            const norm = normalizeUrlAggressively(canonicalUrl);
            if (norm) urlIndex.set(norm, chapterIdFound);
            rawUrlIndex.set(canonicalUrl, chapterIdFound);
            return { chapters, urlIndex, rawUrlIndex };
          });

          set(s => ({
            currentChapterId: chapterIdFound,
            navigationHistory: [...new Set(s.navigationHistory.concat(chapterIdFound))],
            error: null,
          }));
          try { await indexedDBService.setSetting('lastActiveChapter', { id: chapterIdFound, url: canonicalUrl }); } catch {}
          if (typeof history !== 'undefined' && history.pushState) {
            history.pushState({ chapterId: chapterIdFound }, '', `?chapter=${encodeURIComponent(canonicalUrl)}`);
          }
          console.log(`[Navigate] Found chapter directly in IndexedDB for URL ${url}.`);
          return;
        }
      } catch (e) {
        console.warn('[Navigate] IndexedDB direct lookup failed', e);
      }

      const errorMessage = `Navigation failed: The URL is not from a supported source and the chapter has not been imported.`;
      console.error(`[Navigate] ${errorMessage}`, { url });
      set({ error: errorMessage });
    }
  },

  // Lazily load a chapter by stableId from IndexedDB and cache it in memory
  loadChapterFromIDB: async (chapterId: string) => {
    console.log(`[IDB] Loading chapter from IndexedDB: ${chapterId}`);
    try {
      const rec = await indexedDBService.getChapterByStableId(chapterId);
      console.log(`[IDB] Retrieved record:`, {
          exists: !!rec,
          title: rec?.title,
          hasContent: !!rec?.content,
          contentLength: rec?.content?.length || 0,
          url: rec?.url,
          canonicalUrl: rec?.canonicalUrl,
          originalUrl: rec?.originalUrl,
          chapterNumber: rec?.chapterNumber,
          nextUrl: rec?.nextUrl,
          prevUrl: rec?.prevUrl
      });
      
      if (!rec) {
          console.warn(`[IDB] No record found for ${chapterId}`);
          return null;
      }
      
      if (!rec.content) {
          console.error(`[IDB] CRITICAL: Chapter ${chapterId} has no content in IndexedDB:`, rec);
      }
      
      const canonicalUrl = rec.canonicalUrl || rec.url;
      const enhanced: EnhancedChapter = {
        id: chapterId,
        title: rec.title,
        content: rec.content,
        originalUrl: canonicalUrl,
        canonicalUrl,
        nextUrl: rec.nextUrl,
        prevUrl: rec.prevUrl,
        chapterNumber: rec.chapterNumber || 0,
        sourceUrls: [rec.originalUrl || canonicalUrl],
        importSource: { originalUrl: rec.originalUrl || canonicalUrl, importDate: new Date(), sourceFormat: 'json' },
        translationResult: null,
      } as EnhancedChapter;
      
      console.log(`[IDB] Created enhanced chapter:`, {
          id: enhanced.id,
          title: enhanced.title,
          hasContent: !!enhanced.content,
          contentLength: enhanced.content?.length || 0,
          canonicalUrl: enhanced.canonicalUrl,
          sourceUrls: enhanced.sourceUrls
      });
      // Try to hydrate active translation version for this chapter
      try {
        const active = await indexedDBService.getActiveTranslationByStableId(chapterId);
        if (active) {
          const usageMetrics = {
            totalTokens: active.totalTokens || 0,
            promptTokens: active.promptTokens || 0,
            completionTokens: active.completionTokens || 0,
            estimatedCost: active.estimatedCost || 0,
            requestTime: active.requestTime || 0,
            provider: (active.provider as any) || get().settings.provider,
            model: active.model || get().settings.model,
          } as any;
          enhanced.translationResult = {
            translatedTitle: active.translatedTitle,
            translation: active.translation,
            proposal: active.proposal || null,
            footnotes: active.footnotes || [],
            suggestedIllustrations: active.suggestedIllustrations || [],
            usageMetrics,
          } as any;
        }
      } catch {}
      set(s => {
        const chapters = new Map(s.chapters);
        chapters.set(chapterId, enhanced);
        // best effort: keep indices consistent
        const urlIndex = new Map(s.urlIndex);
        const rawUrlIndex = new Map(s.rawUrlIndex);
        const norm = normalizeUrlAggressively(canonicalUrl);
        if (norm) urlIndex.set(norm, chapterId);
        rawUrlIndex.set(canonicalUrl, chapterId);
        return { chapters, urlIndex, rawUrlIndex };
      });
      return enhanced;
    } catch (e) {
      console.error('[Store] loadChapterFromIDB failed', e);
      return null;
    }
  },

  addFeedback: (chapterId, item) => {
    const id = item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set(s => {
      const newFeedbackHistory = { ...s.feedbackHistory };
      const feedbackForChapter = newFeedbackHistory[chapterId] ?? [];
      newFeedbackHistory[chapterId] = feedbackForChapter.concat({ ...item, id, createdAt: Date.now() });

      const newChapters = new Map(s.chapters);
      const chapter = newChapters.get(chapterId);
      if (chapter) {
        chapter.feedback = (chapter.feedback ?? []).concat({ ...item, id, createdAt: Date.now() });
        newChapters.set(chapterId, chapter);
      }

      return { 
        feedbackHistory: newFeedbackHistory,
        chapters: newChapters,
        isDirty: true 
      };
    });
  },
  deleteFeedback: (chapterId, id) => set(s => {
    const newFeedbackHistory = { ...s.feedbackHistory };
    newFeedbackHistory[chapterId] = (newFeedbackHistory[chapterId] ?? []).filter(f => f.id !== id);
    
    const newChapters = new Map(s.chapters);
    const chapter = newChapters.get(chapterId);
    if (chapter && chapter.feedback) {
      chapter.feedback = chapter.feedback.filter(f => f.id !== id);
      newChapters.set(chapterId, chapter);
    }

    return { 
      feedbackHistory: newFeedbackHistory,
      chapters: newChapters,
      isDirty: true 
    };
  }),
  updateFeedbackComment: (chapterId, id, comment) => set(s => {
    const newFeedbackHistory = { ...s.feedbackHistory };
    (newFeedbackHistory[chapterId] ?? []).forEach(f => { if (f.id === id) f.comment = comment; });

    const newChapters = new Map(s.chapters);
    const chapter = newChapters.get(chapterId);
    if (chapter && chapter.feedback) {
      chapter.feedback.forEach(f => { if (f.id === id) f.comment = comment; });
      newChapters.set(chapterId, chapter);
    }
    
    return { 
      feedbackHistory: newFeedbackHistory,
      chapters: newChapters,
      isDirty: true 
    };
  }),

  startFeedbackSubmission: (chapterId: string) => set({ feedbackUIState: { isSubmitting: false, activeChapterId: chapterId } }),
  cancelFeedbackSubmission: () => set({ feedbackUIState: { isSubmitting: false, activeChapterId: undefined } }),

  buildTranslationHistory: (currentChapterId: string) => {
    console.log(`[History] Building history for chapter: ${currentChapterId}`);
    const { navigationHistory, chapters, settings } = get();
    
    console.log(`[History] Navigation history:`, navigationHistory);
    console.log(`[History] Total chapters in memory:`, chapters.size);
    console.log(`[History] Context depth setting:`, settings.contextDepth);
    
    const idx = navigationHistory.lastIndexOf(currentChapterId);
    console.log(`[History] Current chapter index in nav history: ${idx}`);
    
    if (idx <= 0) {
      console.log(`[History] No history available (idx=${idx})`);
      return [];
    }

    const historyChapterIds = navigationHistory.slice(Math.max(0, idx - settings.contextDepth), idx);
    console.log(`[History] History chapter IDs to process:`, historyChapterIds);
    
    const result = historyChapterIds.map(chapterId => {
      const chapter = chapters.get(chapterId);
      console.log(`[History] Processing chapter ${chapterId}:`, {
          exists: !!chapter,
          title: chapter?.title,
          hasContent: !!chapter?.content,
          contentLength: chapter?.content?.length || 0,
          hasTranslation: !!chapter?.translationResult,
          translatedTitle: chapter?.translationResult?.translatedTitle
      });
      
      if (!chapter) {
          console.warn(`[History] Chapter ${chapterId} not found in chapters Map`);
          return null;
      }
      
      if (!chapter.content) {
          console.warn(`[History] Chapter ${chapterId} has no content:`, {
              id: chapter.id,
              title: chapter.title,
              originalUrl: chapter.originalUrl,
              canonicalUrl: chapter.canonicalUrl,
              hasTranslationResult: !!chapter.translationResult,
              sourceUrls: chapter.sourceUrls,
              importSource: chapter.importSource
          });
      }
      
      return chapter ? {
        originalUrl: chapter.canonicalUrl,
        originalTitle: chapter.title,
        translatedTitle: chapter.translationResult?.translatedTitle ?? '',
        content: chapter.content,
        feedback: chapter.feedback ?? [],
      } : null;
    });
    
    const filtered = result.filter((c): c is HistoricalChapter => !!c && !!c.content);
    console.log(`[History] Final history items:`, filtered.length);
    filtered.forEach((item, idx) => {
      console.log(`[History] History item ${idx}:`, {
        title: item.originalTitle,
        translatedTitle: item.translatedTitle,
        hasContent: !!item.content,
        contentPreview: item.content?.substring(0, 100) + '...',
        feedbackCount: item.feedback?.length || 0
      });
    });
    
    return filtered;
  },

  hasTranslationSettingsChanged: (chapterId) => {
    const chapter = get().chapters.get(chapterId);
    if (!chapter?.translationSettingsSnapshot) return true;
    
    const relevantSettings = (({ provider, model, temperature, contextDepth, systemPrompt }) =>
      ({ provider, model, temperature, contextDepth, systemPrompt }))(get().settings);
      
    return !shallowEqual(chapter.translationSettingsSnapshot, relevantSettings);
  },
  shouldEnableRetranslation: (chapterId) => get().hasTranslationSettingsChanged(chapterId),

  exportSessionData: () => {
    const { chapters } = get();
    const data = {
      // We need to reconstruct the chapter array in a serializable format
      chapters: Array.from(chapters.values()).map(chapter => ({
        sourceUrl: chapter.canonicalUrl,
        title: chapter.title,
        content: chapter.content,
        translationResult: chapter.translationResult,
        feedback: chapter.feedback,
        chapterNumber: chapter.chapterNumber,
        nextUrl: chapter.nextUrl,
        prevUrl: chapter.prevUrl
      })),
      // We could also export novels and other metadata here if needed
    };
    const json = JSON.stringify(data, null, 2);
    try {
      const a = document.createElement('a');
      a.download = 'lexicon-forge-session.json';
      a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(json);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {}
    return json; // make tests happy
  },

  importSessionData: async (payload: string | object) => {
    try {
      const obj = typeof payload === 'string' ? JSON.parse(payload) : payload as any;
      if (!obj.chapters || !Array.isArray(obj.chapters)) {
        throw new Error('Invalid import file format: Missing chapters array.');
      }

      console.log(`[Import] Starting import of ${obj.chapters.length} chapters.`);

      // Use the stableIdService to process the imported data
      const incomingStableData = transformImportedChapters(obj.chapters, obj.metadata);

      // Merge the new stable data with the existing state
      set(s => {
        const newChapters = new Map([...s.chapters, ...incomingStableData.chapters]);
        const newNovels = new Map([...s.novels, ...incomingStableData.novels]);
        const newUrlIndex = new Map([...s.urlIndex, ...incomingStableData.urlIndex]);
        const newRawUrlIndex = new Map([...s.rawUrlIndex, ...incomingStableData.rawUrlIndex]);

        // Create a unified navigation history, preventing duplicates
        const newNavigationHistory = [...s.navigationHistory];
        for (const chapterId of incomingStableData.navigationHistory) {
          if (!newNavigationHistory.includes(chapterId)) {
            newNavigationHistory.push(chapterId);
          }
        }

        // Set the current chapter to the first imported chapter if the session is new
        const currentChapterId = s.currentChapterId || incomingStableData.currentChapterId;

        console.log(`[Import] Merge complete. Total chapters: ${newChapters.size}`);

        // Persist the newly merged data to IndexedDB
        indexedDBService.importStableSessionData({
          novels: newNovels,
          chapters: newChapters,
          urlIndex: newUrlIndex,
          rawUrlIndex: newRawUrlIndex,
          currentChapterId: currentChapterId,
          navigationHistory: newNavigationHistory
        }).catch(err => console.error('[DB] Failed to persist imported session', err));

        return {
          chapters: newChapters,
          novels: newNovels,
          urlIndex: newUrlIndex,
          rawUrlIndex: newRawUrlIndex,
          navigationHistory: newNavigationHistory,
          currentChapterId: currentChapterId,
          error: null,
        };
      });

    } catch (e: any) {
      console.error('[Import] Import failed:', e);
      set({ error: `Failed to import session: ${e.message}` });
    }
  },

  updateSettings: (partial) => {
    set(s => {
        const newSettings = { ...s.settings, ...partial };
        try { localStorage.setItem(settingsStorageKey, JSON.stringify(newSettings)); } catch {}
        return { settings: newSettings };
    });
  },

  handleFetch: async (url: string) => {
    if (inflightFetches.has(url)) return inflightFetches.get(url);

    const fetchPromise = (async () => {
      set(s => ({
        urlLoadingStates: { ...s.urlLoadingStates, [url]: true }, // Use raw URL for loading state key
        isLoading: { ...s.isLoading, fetching: true },
        error: null
      }));

      try {
        console.log(`[Fetch] Fetching and parsing URL: ${url}`);
        const chapterData = await fetchAndParseUrl(url, {}, () => {});
        console.log(`[Fetch] Raw chapter data:`, {
          title: chapterData.title,
          hasContent: !!chapterData.content,
          contentLength: chapterData.content?.length || 0,
          url: chapterData.url,
          chapterNumber: chapterData.chapterNumber,
          nextUrl: chapterData.nextUrl,
          prevUrl: chapterData.prevUrl
        });
        
        // This is a new chapter, so we need to transform it to the stable format
        console.log(`[Fetch] Transforming to stable format...`);
        const stableData = transformImportedChapters([chapterData]);
        console.log(`[Fetch] Stable transformation result:`, {
          chaptersCount: stableData.chapters.size,
          currentChapterId: stableData.currentChapterId,
          urlIndexSize: stableData.urlIndex.size,
          rawUrlIndexSize: stableData.rawUrlIndex.size
        });
        
        // Verify the transformed chapter has content
        if (stableData.currentChapterId) {
          const transformedChapter = stableData.chapters.get(stableData.currentChapterId);
          console.log(`[Fetch] Transformed chapter content check:`, {
            chapterId: stableData.currentChapterId,
            title: transformedChapter?.title,
            hasContent: !!transformedChapter?.content,
            contentLength: transformedChapter?.content?.length || 0,
            canonicalUrl: transformedChapter?.canonicalUrl
          });
        }
        
        set(s => {
          const newChapters = new Map([...s.chapters, ...stableData.chapters]);
          const newUrlIndex = new Map([...s.urlIndex, ...stableData.urlIndex]);
          const newRawUrlIndex = new Map([...s.rawUrlIndex, ...stableData.rawUrlIndex]);
          const newNovels = new Map([...s.novels, ...stableData.novels]);
          
          // Navigate to the newly fetched chapter
          const newChapterId = stableData.currentChapterId;
          const newHistory = newChapterId ? [...new Set(s.navigationHistory.concat(newChapterId))] : s.navigationHistory;
          
          console.log(`[Fetch] State update:`, {
            totalChaptersAfter: newChapters.size,
            navigationHistoryAfter: newHistory,
            currentChapterId: newChapterId
          });

          return {
            chapters: newChapters,
            urlIndex: newUrlIndex,
            rawUrlIndex: newRawUrlIndex,
            novels: newNovels,
            currentChapterId: newChapterId,
            navigationHistory: newHistory,
          };
        });
        try {
          if (stableData.currentChapterId) {
            const ch = Array.from(stableData.chapters.values())[0];
            await indexedDBService.setSetting('lastActiveChapter', { id: stableData.currentChapterId, url: ch?.canonicalUrl || url });
          }
        } catch {}

        // Persist to IndexedDB so it survives reloads
        try {
          await indexedDBService.importStableSessionData({
            novels: stableData.novels,
            chapters: stableData.chapters,
            urlIndex: stableData.urlIndex,
            rawUrlIndex: stableData.rawUrlIndex,
            currentChapterId: stableData.currentChapterId,
            navigationHistory: [],
          });
        } catch (e) {
          console.warn('[DB] Failed to persist fetched chapter to IndexedDB', e);
        }

      } catch (e: any) {
        console.error('[FETCH-ERROR]', e);
        set({ error: String(e?.message ?? e ?? 'Fetch failed') });
      } finally {
        set(s => {
          const newLoadingStates = { ...s.urlLoadingStates };
          delete newLoadingStates[url];
          const isStillFetching = Object.values(newLoadingStates).some(Boolean);
          return {
            urlLoadingStates: newLoadingStates,
            isLoading: { ...s.isLoading, fetching: isStillFetching }
          };
        });
        inflightFetches.delete(url);
      }
    })();

    inflightFetches.set(url, fetchPromise);
    return fetchPromise;
  },

  handleTranslate: async (chapterId: string) => {
    const { chapters, settings, buildTranslationHistory, activeTranslations } = get();
    const chapterToTranslate = chapters.get(chapterId);

    if (!chapterToTranslate) return;

    const apiValidation = validateApiKey(settings);
    if (!apiValidation.isValid) {
        set({ error: `Translation API error: ${apiValidation.errorMessage}` });
        return;
    }
    
    if (activeTranslations[chapterId]) {
        activeTranslations[chapterId].abort();
    }
    const abortController = new AbortController();
    set(s => ({ 
        // Clear any stale error when a fresh translation begins
        error: null,
        activeTranslations: { ...s.activeTranslations, [chapterId]: abortController }, 
        urlLoadingStates: { ...s.urlLoadingStates, [chapterId]: true }, 
        isLoading: { ...s.isLoading, translating: true } 
    }));

    try {
        const history = buildTranslationHistory(chapterId);
        const result = await translateChapter(
          chapterToTranslate.title,
          chapterToTranslate.content,
          settings,
          history
        );
        
        if (abortController.signal.aborted) {
            console.log(`Translation for ${chapterId} was cancelled.`);
            return;
        }

        const relevantSettings = (({ provider, model, temperature, contextDepth, systemPrompt }) =>
            ({ provider, model, temperature, contextDepth, systemPrompt }))(settings);

        set(s => {
            const newChapters = new Map(s.chapters);
            const chapter = newChapters.get(chapterId);
            if (chapter) {
                (chapter as any).translationResult = result;
                (chapter as any).translationSettingsSnapshot = relevantSettings;
                newChapters.set(chapterId, chapter);
            }
            return { chapters: newChapters, amendmentProposal: result.proposal ?? null };
        });

        // Persist translation as a new version and mark it active
        try {
          await indexedDBService.storeTranslationByStableId(chapterId, result as any, {
            provider: settings.provider,
            model: settings.model,
            temperature: settings.temperature,
            systemPrompt: settings.systemPrompt,
            promptId: get().activePromptTemplate?.id,
            promptName: get().activePromptTemplate?.name,
          });
        } catch (e) {
          console.warn('[Store] Failed to persist translation version', e);
        }

    } catch (e: any) {
        if (e.name === 'AbortError') {
            console.log(`Translation for ${chapterId} was aborted.`);
        } else {
            set({ error: String(e?.message ?? e ?? 'Translate failed') });
        }
    } finally {
        set(s => {
            const newActiveTranslations = { ...s.activeTranslations };
            const newUrlLoadingStates = { ...s.urlLoadingStates };
            delete newActiveTranslations[chapterId];
            delete newUrlLoadingStates[chapterId];
            const isTranslating = Object.values(newActiveTranslations).some(Boolean);
            return { 
                activeTranslations: newActiveTranslations, 
                urlLoadingStates: newUrlLoadingStates, 
                isLoading: { ...s.isLoading, translating: isTranslating } 
            };
        });
    }
  },
  
  // Keep other methods from the original file that are not in the skeleton
  handleRetranslateCurrent: () => {
      const { currentChapterId, handleTranslate } = get();
      if (!currentChapterId) return;
      handleTranslate(currentChapterId);
  },
  handleToggleLanguage: (show: boolean) => set({ showEnglish: show }),
  setShowSettingsModal: (isOpen: boolean) => set({ showSettingsModal: isOpen }),
  acceptProposal: () => {
      const { amendmentProposal, settings } = get();
      if (!amendmentProposal) return;
      const newPrompt = settings.systemPrompt.replace(amendmentProposal.currentRule, amendmentProposal.proposedChange.replace(/^[+-]\s/gm, ''));
      set(s => ({
          settings: { ...s.settings, systemPrompt: newPrompt },
          amendmentProposal: null,
      }));
  },
  rejectProposal: () => set({ amendmentProposal: null }),
  clearSession: () => {
      set({
          novels: new Map(),
          chapters: new Map(),
          urlIndex: new Map(),
          rawUrlIndex: new Map(),
          currentChapterId: null,
          navigationHistory: [],
          feedbackHistory: {},
          error: null,
          amendmentProposal: null,
      });
      // We might want to clear indexedDB as well
      indexedDBService.clearAllData().catch(err => console.error('[DB] Failed to clear database', err));
      localStorage.removeItem(settingsStorageKey);
  },

  // Prompt Template Methods
  loadPromptTemplates: async () => {
    try {
      const templates = await indexedDBService.getPromptTemplates();
      const activeTemplate = await indexedDBService.getDefaultPromptTemplate();
      set({ 
        promptTemplates: templates,
        activePromptTemplate: activeTemplate 
      });
    } catch (error) {
      console.error('[Store] Failed to load prompt templates:', error);
    }
  },

  createPromptTemplate: async (templateData) => {
    try {
      const template: PromptTemplate = {
        ...templateData,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      await indexedDBService.storePromptTemplate(template);
      set(state => ({
        promptTemplates: [...state.promptTemplates, template]
      }));
    } catch (error) {
      console.error('[Store] Failed to create prompt template:', error);
    }
  },

  updatePromptTemplate: async (template) => {
    try {
      await indexedDBService.storePromptTemplate(template);
      set(state => ({
        promptTemplates: state.promptTemplates.map(t => t.id === template.id ? template : t),
        activePromptTemplate: state.activePromptTemplate?.id === template.id ? template : state.activePromptTemplate
      }));
    } catch (error) {
      console.error('[Store] Failed to update prompt template:', error);
    }
  },

  deletePromptTemplate: async (id) => {
    try {
      await indexedDBService.deletePromptTemplate(id);
      set(state => ({
        promptTemplates: state.promptTemplates.filter(t => t.id !== id),
        activePromptTemplate: state.activePromptTemplate?.id === id ? null : state.activePromptTemplate
      }));
    } catch (error) {
      console.error('[Store] Failed to delete prompt template:', error);
    }
  },

  setActivePromptTemplate: async (id) => {
    try {
      await indexedDBService.setDefaultPromptTemplate(id);
      const template = get().promptTemplates.find(t => t.id === id);
      set({ activePromptTemplate: template || null });
    } catch (error) {
      console.error('[Store] Failed to set active prompt template:', error);
    }
  },

  getChapterById: (chapterId: string) => {
    return get().chapters.get(chapterId) || null;
  },

  // Versioning helpers
  fetchTranslationVersions: async (chapterId: string) => {
    try {
      const versions = await indexedDBService.getTranslationVersionsByStableId(chapterId);
      return versions;
    } catch (e) {
      console.warn('[Store] fetchTranslationVersions failed', e);
      return [] as any;
    }
  },

  setActiveTranslationVersion: async (chapterId: string, version: number) => {
    try {
      await indexedDBService.setActiveTranslationByStableId(chapterId, version);
      const active = await indexedDBService.getActiveTranslationByStableId(chapterId);
      if (active) {
        const usageMetrics = {
          totalTokens: active.totalTokens || 0,
          promptTokens: active.promptTokens || 0,
          completionTokens: active.candidatesTokenCount || active.completionTokens || 0,
          estimatedCost: active.estimatedCost || 0,
          requestTime: active.requestTime || 0,
          provider: (active.provider as any) || get().settings.provider,
          model: active.model || get().settings.model,
        } as any;

        set(s => {
          const chapters = new Map(s.chapters);
          const ch = chapters.get(chapterId);
          if (ch) {
            ch.translationResult = {
              translatedTitle: active.translatedTitle,
              translation: active.translation,
              proposal: active.proposal || null,
              footnotes: active.footnotes || [],
              suggestedIllustrations: active.suggestedIllustrations || [],
              usageMetrics,
            } as any;
            chapters.set(chapterId, ch);
          }
          return { chapters };
        });
      }
    } catch (e) {
      console.error('[Store] setActiveTranslationVersion failed', e);
      set({ error: 'Failed to switch translation version' });
    }
  },

  // Boot-time index hydration for Option C (index-only)
  hydrateIndicesOnBoot: async () => {
    try {
      // One-time backfill of URL mappings if needed
      const already = await indexedDBService.getSetting<boolean>('urlMappingsBackfilled');
      if (!already) {
        await indexedDBService.backfillUrlMappingsFromChapters();
      }
      const mappings = await indexedDBService.getAllUrlMappings();
      if (!mappings || mappings.length === 0) return;
      set(s => {
        const urlIndex = new Map(s.urlIndex);
        const rawUrlIndex = new Map(s.rawUrlIndex);
        for (const m of mappings) {
          if (m.isCanonical) urlIndex.set(m.url, m.stableId);
          else rawUrlIndex.set(m.url, m.stableId);
        }
        return { urlIndex, rawUrlIndex };
      });
      // Prefer exact last active chapter if available
      const last = await indexedDBService.getSetting<{ id: string; url: string }>('lastActiveChapter');
      if (last?.id) {
        set(s => ({ currentChapterId: s.currentChapterId || last.id }));
        // lazily load content for last active if missing
        const sNow = get();
        if (!sNow.chapters.has(last.id)) {
          // fire and forget; UI can render once loaded
          get().loadChapterFromIDB(last.id).catch(() => {});
        }
      } else {
        // Fallback to most recent in DB
        const mostRecent = await indexedDBService.getMostRecentChapterStableId();
        if (mostRecent?.stableId) {
          set(s => ({ currentChapterId: s.currentChapterId || mostRecent.stableId }));
        }
      }
      console.log(`[Boot] Hydrated ${mappings.length} URL mappings from IndexedDB`);
    } catch (e) {
      console.warn('[Boot] Failed to hydrate URL indices from IndexedDB', e);
    }
  },
}));

export default useAppStore;
