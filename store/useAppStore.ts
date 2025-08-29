import { create } from 'zustand';
import { Chapter, FeedbackItem, AmendmentProposal, TranslationResult, AppSettings, HistoricalChapter, PromptTemplate } from '../types';
import { INITIAL_SYSTEM_PROMPT, SUPPORTED_WEBSITES } from '../constants';
import { translateChapter, validateApiKey } from '../services/aiService';
import { generateImage } from '../services/imageService';
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
  translationSettingsSnapshot?: Partial<Pick<AppSettings, 'provider' | 'model' | 'temperature' | 'topP' | 'frequencyPenalty' | 'presencePenalty' | 'seed' | 'contextDepth' | 'systemPrompt'>>;
}

const defaultSettings: AppSettings = {
    contextDepth: 3, // <-- Updated as per user's instruction
    preloadCount: 0,
    fontSize: 18,
    fontStyle: 'serif',
    lineHeight: 1.7,
    systemPrompt: INITIAL_SYSTEM_PROMPT,
    // Localization
    targetLanguage: 'English',
    provider: 'Gemini',
    model: 'gemini-2.5-flash',
    imageModel: 'imagen-3.0-generate-001',
  temperature: 0.3,
  apiKeyGemini: '',
  apiKeyOpenAI: '',
  apiKeyDeepSeek: '',
  apiKeyOpenRouter: '',
  // Advanced defaults
  maxOutputTokens: 8192,
  retryMax: 3,
  retryInitialDelayMs: 2000,
  footnoteStrictMode: 'append_missing',
  imageWidth: 1024,
    imageHeight: 1024,
    imageAspectRatio: '1:1',
    imageSizePreset: '1K',
    exportOrder: 'number',
    includeTitlePage: true,
    includeStatsPage: true,
    epubGratitudeMessage: '',
    epubProjectDescription: '',
    epubFooter: '',
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

    viewMode: 'original' | 'fan' | 'english';
    feedbackHistory: { [key: string]: FeedbackItem[] }; // Keyed by chapterId
    settings: AppSettings;
    isDirty: boolean;
    amendmentProposal: AmendmentProposal | null;
    activeTranslations: Record<string, AbortController>; // Keyed by chapterId
    urlLoadingStates: Record<string, boolean>; // Keyed by chapterId
    feedbackUIState?: { isSubmitting: boolean; activeChapterId?: string };
    promptTemplates: PromptTemplate[];
    activePromptTemplate: PromptTemplate | null;
    generatedImages: Record<string, { isLoading: boolean; data: string | null; error: string | null; }>;
    imageGenerationMetrics: { count: number; totalTime: number; totalCost: number; lastModel?: string; } | null;
    // OpenRouter dynamic catalogue state (cached)
    openRouterModels?: { data: any[]; fetchedAt: string } | null;
    openRouterKeyUsage?: { usage: number | null; limit: number | null; remaining: number | null; fetchedAt: string } | null;
    // Distinct cache hydration state per chapter (separate from URL fetches and translations)
    hydratingChapters: Record<string, boolean>;
}

interface AppActions {
    handleFetch: (fetchUrl: string) => Promise<void>;
    handleTranslate: (chapterId: string) => Promise<void>;
    cancelTranslation: (chapterId: string) => void;
    handleRetranslateCurrent: () => void;
    handleNavigate: (newUrl: string) => Promise<void>;
    isValidUrl: (url: string) => boolean;
    handleToggleLanguage: (mode: 'original' | 'fan' | 'english') => void;
    isChapterLoading: (chapterId: string) => boolean;
    buildTranslationHistory: (chapterId: string) => HistoricalChapter[];
    buildTranslationHistoryAsync?: (chapterId: string) => Promise<HistoricalChapter[]>;
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
    exportEpub: () => Promise<void>;
    isChapterTranslating: (chapterId: string) => boolean;
    hasTranslationSettingsChanged: (chapterId: string) => boolean;
    shouldEnableRetranslation: (chapterId: string) => boolean;
    getNavigationHistory: () => string[];
    navigateBack: () => string | undefined;
    startFeedbackSubmission: (chapterId: string) => void;
    cancelFeedbackSubmission: () => void;
    handleGenerateImages: (chapterId: string) => Promise<void>;
    handleRetryImage: (chapterId: string, placementMarker: string) => Promise<void>;
    updateIllustrationPrompt: (chapterId: string, placementMarker: string, newPrompt: string) => Promise<void>;
    createPromptTemplate: (template: Omit<PromptTemplate, 'id' | 'createdAt'>) => Promise<void>;
    updatePromptTemplate: (template: PromptTemplate) => Promise<void>;
    deletePromptTemplate: (id: string) => Promise<void>;
    setActivePromptTemplate: (id: string) => Promise<void>;
    loadPromptTemplates: () => Promise<void>;
    // OpenRouter helpers
    loadOpenRouterCatalogue: (force?: boolean) => Promise<void>;
    refreshOpenRouterModels: () => Promise<void>;
    refreshOpenRouterCredits: () => Promise<void>;
    getOpenRouterOptions: (search?: string) => Array<{ id: string; label: string; lastUsed?: string; priceKey?: number | null }>;
    getChapterById: (chapterId: string) => EnhancedChapter | null;
    isChapterHydrating: (chapterId: string) => boolean;
    hydrateIndicesOnBoot: () => Promise<void>;
    loadChapterFromIDB: (chapterId: string) => Promise<EnhancedChapter | null>;
    fetchTranslationVersions: (chapterId: string) => Promise<TranslationRecord[]>;
    setActiveTranslationVersion: (chapterId: string, version: number) => Promise<void>;
}

type Store = AppState & AppActions;

// Store-level debug gates (respect LF_AI_DEBUG_LEVEL: off|summary|full)
const storeDebugEnabled = (): boolean => {
  try {
    const lvl = localStorage.getItem('LF_AI_DEBUG_LEVEL');
    return lvl === 'summary' || lvl === 'full';
  } catch { return false; }
};
const storeDebugFullEnabled = (): boolean => {
  try { return localStorage.getItem('LF_AI_DEBUG_LEVEL') === 'full'; } catch { return false; }
};
const slog = (...args: any[]) => { if (storeDebugEnabled()) console.log(...args); };
const swarn = (...args: any[]) => { if (storeDebugEnabled()) console.warn(...args); };

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
  viewMode: 'original',
  isDirty: false,
  amendmentProposal: null,
  promptTemplates: [],
  activePromptTemplate: null,
  generatedImages: {},
  imageGenerationMetrics: null,
  openRouterModels: null,
  openRouterKeyUsage: null,
  hydratingChapters: {},

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
  isChapterHydrating: (chapterId: string) => !!get().hydratingChapters[chapterId],

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
    // Persist navigation history
    try { indexedDBService.setSetting('navigation-history', { stableIds: navigationHistory.slice(0, -1) }).catch(() => {}); } catch {}
    try {
      const prevUrl = chapters.get(prevChapterId)?.canonicalUrl;
      if (prevUrl) indexedDBService.setSetting('lastActiveChapter', { id: prevChapterId, url: prevUrl }).catch(() => {});
    } catch {}

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
        // Persist
        try { indexedDBService.setSetting('navigation-history', { stableIds: newHistory }).catch(() => {}); } catch {}
        try { indexedDBService.setSetting('lastActiveChapter', { id: chapterId, url: chapters.get(chapterId!)?.canonicalUrl || url }).catch(() => {}); } catch {}
        return {
          currentChapterId: chapterId,
          navigationHistory: newHistory,
          error: null,
          imageGenerationMetrics: null,
        };
      });

      slog(`[Navigate] Found existing chapter ${chapterId} for URL ${url}.`);
      
      // Update browser history
      const chapter = chapters.get(chapterId);
      if (chapter && typeof history !== 'undefined' && history.pushState) {
          // Avoid using `?url=` which collides with Vite's special asset query
          history.pushState({ chapterId }, '', `?chapter=${encodeURIComponent(chapter.canonicalUrl)}`);
      }

      // If translationResult is missing in memory, hydrate active version from IndexedDB
      try {
        if (chapter && !chapter.translationResult) {
          const active = await indexedDBService.getActiveTranslationByStableId(chapterId);
          if (active) {
            set(s => {
              const cs = new Map(s.chapters);
              const ch = cs.get(chapterId);
              if (ch) {
                const usageMetrics = {
                  totalTokens: active.totalTokens || 0,
                  promptTokens: active.promptTokens || 0,
                  completionTokens: active.completionTokens || 0,
                  estimatedCost: active.estimatedCost || 0,
                  requestTime: active.requestTime || 0,
                  provider: (active.provider as any) || s.settings.provider,
                  model: active.model || s.settings.model,
                } as any;
                ch.translationResult = {
                  translatedTitle: active.translatedTitle,
                  translation: active.translation,
                  proposal: active.proposal || null,
                  footnotes: active.footnotes || [],
                  suggestedIllustrations: active.suggestedIllustrations || [],
                  usageMetrics,
                } as any;
                cs.set(chapterId, ch);
              }
              return { chapters: cs };
            });
          }
        }
      } catch {}

    } else if (chapterId && !chapters.has(chapterId)) {
      // We have a mapping but content isn't in memory; lazy-load from IndexedDB
      console.log(`[Nav] Mapping found (${chapterId}) but not loaded. Hydrating from IndexedDB...`);
      set(s => ({ hydratingChapters: { ...s.hydratingChapters, [chapterId]: true }, error: null }));
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
            // Persist
            try { indexedDBService.setSetting('navigation-history', { stableIds: newHistory }).catch(() => {}); } catch {}
            try { indexedDBService.setSetting('lastActiveChapter', { id: chapterId, url: loaded.canonicalUrl }).catch(() => {}); } catch {}
            return {
              currentChapterId: chapterId,
              navigationHistory: newHistory,
              error: null,
              imageGenerationMetrics: null,
            };
          });
          if (typeof history !== 'undefined' && history.pushState) {
            history.pushState({ chapterId }, '', `?chapter=${encodeURIComponent(loaded.canonicalUrl)}`);
          }
          slog(`[Navigate] Hydrated chapter ${chapterId} from IndexedDB.`);
          return;
        }
      } catch (e) {
        console.error('[Navigate] Failed to hydrate chapter from IndexedDB', e);
      } finally {
        set(s => {
          const hc = { ...s.hydratingChapters };
          delete hc[chapterId!];
          return { hydratingChapters: hc };
        });
      }

      // Fall through to supported fetch or error
      // Before fetching, attempt a last-chance cache hit by querying URL mapping in IndexedDB
      try {
        const norm = normalizedUrl;
        const mapping = (norm ? await indexedDBService.getUrlMappingForUrl(norm) : null) ||
                        await indexedDBService.getUrlMappingForUrl(url);
        if (mapping?.stableId) {
          console.log('[Navigate] Found URL mapping in IndexedDB. Hydrating chapter instead of fetching.');
          const loaded = await get().loadChapterFromIDB(mapping.stableId);
          if (loaded) return; // success; stop here
        }
      } catch (e) {
        swarn('[Navigate] IDB mapping lookup failed, proceeding to fetch if supported', e);
      }

      if (get().isValidUrl(url)) {
        slog(`[Navigate] Hydration failed; attempting fetch for ${url}...`);
        set({ error: null });
        await get().handleFetch(url);
      } else {
        const errorMessage = `Navigation failed: The URL is not from a supported source and the chapter has not been imported.`;
        console.error(`[Navigate] ${errorMessage}`, { url });
        set({ error: errorMessage });
      }

    } else if (get().isValidUrl(url)) {
      // Chapter not found, but the URL is from a supported scraping source
      slog(`[Navigate] No chapter found for ${url}. Attempting to fetch...`);
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
            imageGenerationMetrics: null,
          }));
          try {
            await indexedDBService.setSetting('lastActiveChapter', { id: chapterIdFound, url: canonicalUrl });
            const hist = get().navigationHistory;
            await indexedDBService.setSetting('navigation-history', { stableIds: hist });
          } catch {}
          if (typeof history !== 'undefined' && history.pushState) {
            history.pushState({ chapterId: chapterIdFound }, '', `?chapter=${encodeURIComponent(canonicalUrl)}`);
          }
          slog(`[Navigate] Found chapter directly in IndexedDB for URL ${url}.`);
          return;
        }
      } catch (e) {
        swarn('[Navigate] IndexedDB direct lookup failed', e);
      }

      const errorMessage = `Navigation failed: The URL is not from a supported source and the chapter has not been imported.`;
      console.error(`[Navigate] ${errorMessage}`, { url });
      set({ error: errorMessage });
    }
  },

  // Lazily load a chapter by stableId from IndexedDB and cache it in memory
  loadChapterFromIDB: async (chapterId: string) => {
    slog(`[IDB] Loading chapter from IndexedDB: ${chapterId}`);
    // Mark hydrating
    set(s => ({ hydratingChapters: { ...s.hydratingChapters, [chapterId]: true } }));
    try {
      const rec = await indexedDBService.getChapterByStableId(chapterId);
      slog(`[IDB] Retrieved record:`, {
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
          swarn(`[IDB] No record found for ${chapterId}`);
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
        fanTranslation: (rec as any).fanTranslation || null,
        translationResult: null,
      } as EnhancedChapter;
      
      slog(`[IDB] Created enhanced chapter:`, {
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
    } finally {
      set(s => {
        const hc = { ...s.hydratingChapters };
        delete hc[chapterId];
        return { hydratingChapters: hc };
      });
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
    // Persist to IndexedDB (fire-and-forget)
    try {
      const ch = get().chapters.get(chapterId);
      const url = ch?.canonicalUrl || ch?.originalUrl;
      if (url) {
        indexedDBService.storeFeedback(url, { ...item, id, createdAt: Date.now() } as any).catch(() => {});
      }
    } catch {}
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

    // Persist deletion
    try { indexedDBService.deleteFeedbackById(id).catch(() => {}); } catch {}
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
    // Persist update
    try { indexedDBService.updateFeedbackComment(id, comment).catch(() => {}); } catch {}
    
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
    const { chapters, settings } = get();
    const currentChapter = chapters.get(currentChapterId);
    
    console.log(`[History] Current chapter:`, {
      exists: !!currentChapter,
      title: currentChapter?.title,
      chapterNumber: currentChapter?.chapterNumber
    });
    console.log(`[History] Total chapters in memory:`, chapters.size);
    console.log(`[History] Context depth setting:`, settings.contextDepth);
    
    if (!currentChapter?.chapterNumber || settings.contextDepth === 0) {
      console.log(`[History] No context: missing chapter number (${currentChapter?.chapterNumber}) or contextDepth is 0`);
      return [];
    }
    
    // Find previous chapters by chapter number that have translations
    const targetNumbers = [];
    for (let i = 1; i <= settings.contextDepth; i++) {
      const prevNumber = currentChapter.chapterNumber - i;
      if (prevNumber > 0) targetNumbers.push(prevNumber);
    }
    console.log(`[History] Looking for chapters with numbers:`, targetNumbers);
    
    const candidateChapters: Array<{ chapter: EnhancedChapter, id: string }> = [];
    for (const [chapterId, chapter] of chapters.entries()) {
      if (targetNumbers.includes(chapter.chapterNumber || 0) && 
          chapter.translationResult &&
          chapter.content) {
        candidateChapters.push({ chapter, id: chapterId });
      }
    }
    
    console.log(`[History] Found ${candidateChapters.length} candidate chapters with translations`);
    
    // Sort by chapter number ascending and build history
    const result = candidateChapters
      .sort((a, b) => (a.chapter.chapterNumber || 0) - (b.chapter.chapterNumber || 0))
      .slice(-settings.contextDepth)  // Take the most recent contextDepth chapters
      .map(({ chapter, id }) => {
        console.log(`[History] Including chapter ${id} (${chapter.chapterNumber}): ${chapter.title}`);
        return {
          originalTitle: chapter.title,
          originalContent: chapter.content,
          translatedTitle: chapter.translationResult!.translatedTitle,
          translatedContent: chapter.translationResult!.translation,
          feedback: chapter.feedback ?? [],
        };
      });
    
    console.log(`[History] Built history with ${result.length} chapters using chapter-number-based selection`);
    return result;
  },

  // Async variant that can hydrate missing context from IndexedDB
  buildTranslationHistoryAsync: async (currentChapterId: string) => {
    try {
      slog(`[HistoryAsync] Building history for chapter: ${currentChapterId}`);
      const { chapters, settings } = get();
      const currentChapter = chapters.get(currentChapterId);

      if (!currentChapter) {
        slog('[HistoryAsync] Current chapter not in memory; returning empty history');
        return [];
      }

      if (settings.contextDepth === 0) {
        slog(`[HistoryAsync] No context: contextDepth is 0`);
        return [];
      }

      // If chapterNumber missing, switch to chronological fallback by domain
      if (!currentChapter.chapterNumber) {
        try {
          const domain = new URL(currentChapter.canonicalUrl || currentChapter.originalUrl).hostname;
          swarn(`[HistoryAsync] Missing chapterNumber for ${currentChapterId}. Falling back to chronological context by domain: ${domain}`);
          const recent = await indexedDBService.getRecentActiveTranslationsByDomain(domain, settings.contextDepth, currentChapterId);
          const built: HistoricalChapter[] = recent
            .reverse() // oldest -> newest among selected
            .map(({ translation: tr, chapter: ch }) => ({
              originalTitle: ch.title,
              originalContent: ch.content,
              translatedTitle: tr.translatedTitle,
              translatedContent: tr.translation,
              feedback: []
            }));
          slog(`[HistoryAsync] Chronological fallback built ${built.length} items`);
          return built;
        } catch (e) {
          swarn('[HistoryAsync] Chronological fallback failed:', e);
          return [];
        }
      }

      // Reuse in-memory builder first
      const inMemory = get().buildTranslationHistory(currentChapterId);
      slog(`[HistoryAsync] In-memory context count: ${inMemory.length} (target ${settings.contextDepth})`);
      if (inMemory.length >= settings.contextDepth) return inMemory;

      // Determine target chapter numbers
      const targets: number[] = [];
      for (let i = 1; i <= settings.contextDepth; i++) {
        const n = (currentChapter.chapterNumber || 0) - i;
        if (n > 0) targets.push(n);
      }
      slog('[HistoryAsync] Target chapter numbers:', targets);

      // Load all chapters from IDB to find missing ones
      const allFromDb = await indexedDBService.getChaptersForReactRendering();
      const byNumber = new Map<number, typeof allFromDb[number]>();
      for (const ch of allFromDb) {
        if (typeof ch.chapterNumber === 'number') byNumber.set(ch.chapterNumber, ch);
      }

      // Collect candidates in ascending order
      const candidates: HistoricalChapter[] = [];
      for (const num of targets.sort((a, b) => a - b)) {
        // Skip if already included from memory
        const already = inMemory.find(h => {
          // No direct number on HistoricalChapter; approximate by title/content match
          // Rely on DB for missing ones
          return false;
        });
        if (already) continue;

        const dbRec = byNumber.get(num);
        if (!dbRec) continue;

        // Need an active translation for this stableId
        const active = await indexedDBService.getActiveTranslationByStableId(dbRec.stableId);
        if (!active) {
          slog(`[HistoryAsync] No active translation for chapterNumber ${num}; skipping`);
          continue;
        }

        // Use original content from DB and translated content from active version
        const originalTitle = dbRec.title;
        const originalContent = dbRec.data?.chapter?.content || '';
        if (!originalContent) {
          slog(`[HistoryAsync] DB chapter ${num} missing content; skipping`);
          continue;
        }
        candidates.push({
          originalTitle,
          originalContent,
          translatedTitle: active.translatedTitle,
          translatedContent: active.translation,
          feedback: []
        });
      }

      // Build final list oldest->newest by target numbers, prefer live memory match
      const merged: HistoricalChapter[] = [];
      const want = settings.contextDepth;
      const ordered = targets.sort((a, b) => a - b);
      const stateChapters = get().chapters;
      for (const num of ordered) {
        // Prefer in-memory chapter with this chapterNumber
        let picked: HistoricalChapter | null = null;
        for (const [, ch] of stateChapters) {
          if ((ch.chapterNumber || 0) === num && ch.translationResult && ch.content) {
            picked = {
              originalTitle: ch.title,
              originalContent: ch.content,
              translatedTitle: ch.translationResult.translatedTitle,
              translatedContent: ch.translationResult.translation,
              feedback: ch.feedback ?? []
            };
            break;
          }
        }
        if (!picked) {
          // Fallback to DB candidate for this number
          const idx = ordered.indexOf(num);
          const c = candidates[idx];
          if (c) picked = c;
        }
        if (picked) merged.push(picked);
        if (merged.length >= want) break;
      }

      let finalHistory = merged.length > 0 ? merged : inMemory;

      // If still short, top-up via chronological fallback by domain
      if (finalHistory.length < settings.contextDepth) {
        try {
          const domain = new URL(currentChapter.canonicalUrl || currentChapter.originalUrl).hostname;
          const needed = settings.contextDepth - finalHistory.length;
          swarn(`[HistoryAsync] Insufficient in-memory/numbered context (${finalHistory.length}/${settings.contextDepth}). Topping up ${needed} via chronological fallback for domain ${domain}`);
          const recent = await indexedDBService.getRecentActiveTranslationsByDomain(domain, settings.contextDepth + 2, currentChapterId);
          // Build candidates not already present by matching originalContent title pairs
          const existingKeys = new Set(finalHistory.map(h => `${h.originalTitle}|${h.translatedTitle}`));
          for (const { translation: tr, chapter: ch } of recent.reverse()) { // oldest first
            const key = `${ch.title}|${tr.translatedTitle}`;
            if (existingKeys.has(key)) continue;
            finalHistory.push({
              originalTitle: ch.title,
              originalContent: ch.content,
              translatedTitle: tr.translatedTitle,
              translatedContent: tr.translation,
              feedback: []
            });
            if (finalHistory.length >= settings.contextDepth) break;
          }
        } catch (e) {
          swarn('[HistoryAsync] Chronological top-up failed:', e);
        }
      }
      slog(`[HistoryAsync] Final context count: ${finalHistory.length}`);
      return finalHistory;
    } catch (e) {
      swarn('[HistoryAsync] Failed to build history with DB fallback:', e);
      return get().buildTranslationHistory(currentChapterId);
    }
  },

  hasTranslationSettingsChanged: (chapterId) => {
    const chapter = get().chapters.get(chapterId);
    if (!chapter?.translationSettingsSnapshot) return true;
    
    const relevantSettings = (({ provider, model, temperature, topP, frequencyPenalty, presencePenalty, seed, contextDepth, systemPrompt }) =>
      ({ provider, model, temperature, topP, frequencyPenalty, presencePenalty, seed, contextDepth, systemPrompt }))(get().settings);
      
    return !shallowEqual(chapter.translationSettingsSnapshot, relevantSettings);
  },
  shouldEnableRetranslation: (chapterId) => get().hasTranslationSettingsChanged(chapterId),

  exportSessionData: () => {
    // Maintain return shape for tests: return in-memory snapshot
    const { chapters } = get();
    const memorySnapshot = {
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
    };
    const memoryJson = JSON.stringify(memorySnapshot, null, 2);

    // Kick off full IndexedDB export for the actual download
    indexedDBService.exportFullSessionToJson()
      .then(jsonObj => {
        const json = JSON.stringify(jsonObj, null, 2);
        const ts = new Date().toISOString().slice(0,19).replace(/[-:T]/g, '');
        const filename = `lexicon-forge-session-${ts}.json`;
        try {
          const a = document.createElement('a');
          a.download = filename;
          a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(json);
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch {}
      })
      .catch(err => {
        swarn('[Export] Full export failed, falling back to memory snapshot download', err);
        try {
          const ts = new Date().toISOString().slice(0,19).replace(/[-:T]/g, '');
          const filename = `lexicon-forge-session-${ts}.json`;
          const a = document.createElement('a');
          a.download = filename;
          a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(memoryJson);
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch {}
      });

    return memoryJson;
  },

  exportEpub: async () => {
    try {
      // Gather chapters in order using IndexedDB as ground truth
      const [rendering, navHistSetting] = await Promise.all([
        indexedDBService.getChaptersForReactRendering(),
        indexedDBService.getSetting<any>('navigation-history').catch(() => null),
      ]);

      const navOrder: string[] = Array.isArray(navHistSetting?.stableIds) ? navHistSetting.stableIds : [];
      const byStableId = new Map(rendering.map(r => [r.stableId, r] as const));

      // Build candidate orders
      // A) Navigation-first (current default behavior)
      const remaining = rendering
        .map(r => r.stableId)
        .filter(id => !navOrder.includes(id));
      const sortedRemaining = remaining.sort((a, b) => {
        const ca = byStableId.get(a)?.chapterNumber ?? 0;
        const cb = byStableId.get(b)?.chapterNumber ?? 0;
        return ca - cb;
      });
      const navOrdered = [...navOrder.filter(id => byStableId.has(id)), ...sortedRemaining];

      // B) Numeric chapterNumber order (preferred when most chapters have numbers)
      const extractNumFromTitle = (t?: string): number => {
        if (!t) return 0;
        const m = t.match(/(?:chapter|episode)\s*(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
      };
      const withNumbers = rendering.map(r => ({
        id: r.stableId,
        num: (r.chapterNumber && r.chapterNumber > 0) ? r.chapterNumber : extractNumFromTitle(r.title)
      }));
      const haveNums = withNumbers.filter(x => x.num && x.num > 0).length;
      const numericOrdered = withNumbers
        .slice()
        .sort((a, b) => (a.num || 0) - (b.num || 0))
        .map(x => x.id);

      // Choose ordering based on settings or heuristic
      const prefOrder = get().settings.exportOrder;
      let ordered: string[];
      if (prefOrder === 'number') ordered = numericOrdered;
      else if (prefOrder === 'navigation') ordered = navOrdered;
      else {
        const threshold = Math.ceil(rendering.length * 0.6);
        ordered = haveNums >= threshold ? numericOrdered : navOrdered;
      }

      // Build ChapterForEpub list using active translation versions
      const chaptersForEpub: import('../services/epubService').ChapterForEpub[] = [];
      for (const sid of ordered) {
        const ch = byStableId.get(sid);
        if (!ch) continue;
        const active = await indexedDBService.getActiveTranslationByStableId(sid);
        if (!active) continue;
        // Compose chapter for EPUB
        const images = (active.suggestedIllustrations || [])
          .filter((i: any) => !!(i as any).url)
          .map((i: any) => ({ marker: i.placementMarker, imageData: (i as any).url, prompt: i.imagePrompt }));
        const footnotes = (active.footnotes || []).map((f: any) => ({ marker: f.marker, text: f.text }));
        chaptersForEpub.push({
          title: ch.title,
          content: active.translation || ch.data?.chapter?.content || '',
          originalUrl: ch.url,
          translatedTitle: active.translatedTitle || ch.title,
          usageMetrics: {
            totalTokens: active.totalTokens || 0,
            promptTokens: active.promptTokens || 0,
            completionTokens: active.completionTokens || 0,
            estimatedCost: active.estimatedCost || 0,
            requestTime: active.requestTime || 0,
            provider: (active.provider as any) || get().settings.provider,
            model: active.model || get().settings.model,
          },
          images,
          footnotes,
        });
      }

      if (chaptersForEpub.length === 0) {
        throw new Error('No chapters with active translations found to export.');
      }

      // Generate EPUB via service
      const { generateEpub, getDefaultTemplate } = await import('../services/epubService');
      // Enable EPUB debug artifacts only when API logging level is FULL
      let epubDebug = false;
      try {
        const level = localStorage.getItem('LF_AI_DEBUG_LEVEL');
        const full = localStorage.getItem('LF_AI_DEBUG_FULL');
        epubDebug = (level && level.toLowerCase() === 'full') || (full === '1' || (full ?? '').toLowerCase() === 'true');
      } catch {}

      const tpl = getDefaultTemplate();
      const s = get().settings as any;
      if (s.epubGratitudeMessage) tpl.gratitudeMessage = s.epubGratitudeMessage;
      if (s.epubProjectDescription) tpl.projectDescription = s.epubProjectDescription;
      if (s.epubFooter !== undefined) tpl.customFooter = s.epubFooter || '';

      await generateEpub({
        title: undefined,
        author: undefined,
        description: undefined,
        chapters: chaptersForEpub,
        settings: get().settings,
        template: tpl,
        novelConfig: undefined,
        includeTitlePage: !!get().settings.includeTitlePage,
        includeStatsPage: !!get().settings.includeStatsPage,
        debug: epubDebug,
      });
    } catch (e: any) {
      console.error('[Export] EPUB generation failed', e);
      throw e;
    }
  },

  importSessionData: async (payload: string | object) => {
    try {
      const obj = typeof payload === 'string' ? JSON.parse(payload) : payload as any;
      // Full session format branch
      if (obj?.metadata?.format === 'lexiconforge-full-1') {
        console.log('[Import] Detected full session format. Importing into IndexedDB as ground truth.');
        await indexedDBService.importFullSessionData(obj);
        // Hydrate store from IDB for UI
        const rendering = await indexedDBService.getChaptersForReactRendering();
        const nav = await indexedDBService.getSetting<any>('navigation-history').catch(() => null);
        const lastActive = await indexedDBService.getSetting<any>('lastActiveChapter').catch(() => null);
        set(s => {
          const newChapters = new Map<string, any>();
          const newUrlIndex = new Map<string, string>();
          const newRawUrlIndex = new Map<string, string>();
          for (const ch of rendering) {
            newChapters.set(ch.stableId, {
              id: ch.stableId,
              title: ch.data.chapter.title,
              content: ch.data.chapter.content,
              originalUrl: ch.url,
              nextUrl: ch.data.chapter.nextUrl,
              prevUrl: ch.data.chapter.prevUrl,
              chapterNumber: ch.chapterNumber,
              canonicalUrl: ch.url,
              sourceUrls: [ch.url],
              fanTranslation: (ch.data.chapter as any).fanTranslation ?? null,
              translationResult: ch.data.translationResult || null,
              feedback: [],
            });
            const norm = normalizeUrlAggressively(ch.url);
            if (norm) newUrlIndex.set(norm, ch.stableId);
            newRawUrlIndex.set(ch.url, ch.stableId);
          }
          return {
            chapters: newChapters,
            urlIndex: newUrlIndex,
            rawUrlIndex: newRawUrlIndex,
            navigationHistory: Array.isArray(nav?.stableIds) ? nav.stableIds : s.navigationHistory,
            currentChapterId: (lastActive && lastActive.id) ? lastActive.id : s.currentChapterId,
            error: null,
          };
        });
        // Hydrate active translations for all loaded chapters to avoid cache-miss UI
        try {
          const ids = rendering.map(r => r.stableId);
          const hydrateTranslation = async (sid: string) => {
            try {
              const active = await indexedDBService.getActiveTranslationByStableId(sid);
              if (!active) return;
              set(s => {
                const chapters = new Map(s.chapters);
                const ch = chapters.get(sid);
                if (!ch) return {} as any;
                const usageMetrics = {
                  totalTokens: active.totalTokens || 0,
                  promptTokens: active.promptTokens || 0,
                  completionTokens: active.completionTokens || 0,
                  estimatedCost: active.estimatedCost || 0,
                  requestTime: active.requestTime || 0,
                  provider: (active.provider as any) || s.settings.provider,
                  model: active.model || s.settings.model,
                } as any;
                ch.translationResult = {
                  translatedTitle: active.translatedTitle,
                  translation: active.translation,
                  proposal: active.proposal || null,
                  footnotes: active.footnotes || [],
                  suggestedIllustrations: active.suggestedIllustrations || [],
                  usageMetrics,
                } as any;
                chapters.set(sid, ch);
                return { chapters } as any;
              });
            } catch {}
          };
          const HYDRATION_BATCH_SIZE = 8;
          for (let i = 0; i < ids.length; i += HYDRATION_BATCH_SIZE) {
            const batch = ids.slice(i, i + HYDRATION_BATCH_SIZE);
            await Promise.all(batch.map(hydrateTranslation));
          }
        } catch {}
        return;
      }

      if (!obj.chapters || !Array.isArray(obj.chapters)) {
        throw new Error('Invalid import file format: Missing chapters array.');
      }

      console.log(`[Import] Starting import of ${obj.chapters.length} chapters.`);

      // Use the stableIdService to process the imported data
      const incomingStableData = transformImportedChapters(obj.chapters, obj.metadata);

      // Persist chapters + URL mappings to IndexedDB first so translations can bind to stableIds
      try {
        await indexedDBService.importStableSessionData({
          novels: incomingStableData.novels,
          chapters: incomingStableData.chapters,
          urlIndex: incomingStableData.urlIndex,
          rawUrlIndex: incomingStableData.rawUrlIndex,
          currentChapterId: incomingStableData.currentChapterId,
          navigationHistory: incomingStableData.navigationHistory
        });
      } catch (e) {
        console.warn('[DB] Failed to persist imported chapters before translations', e);
      }

      // If incoming JSON carried an active translationResult per chapter, persist it as version 1 and mark active
      for (const raw of obj.chapters as any[]) {
        try {
          const originalUrl = raw.url || raw.sourceUrl;
          if (!originalUrl) continue;
          if (!raw.translationResult) continue; // nothing to persist
          const stableId = generateStableChapterId(raw.content || '', raw.chapterNumber || 0, raw.title || '');
          const tr: any = raw.translationResult;
          const provider = tr?.usageMetrics?.provider || get().settings.provider;
          const model = tr?.usageMetrics?.model || get().settings.model;
          const temperature = get().settings.temperature;
          const systemPrompt = get().settings.systemPrompt;
          await indexedDBService.storeTranslationByStableId(stableId, tr, {
            provider,
            model,
            temperature,
            systemPrompt,
            promptId: get().activePromptTemplate?.id,
            promptName: get().activePromptTemplate?.name,
          });
        } catch (e) {
          console.warn('[Import] Skipped persisting translationResult for a chapter:', e);
        }
      }

      // Merge the new stable data with the existing state (and reflect any active translationResult present in file)
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

        // If the incoming JSON has translationResult, also reflect it in memory for immediate use
        for (const raw of obj.chapters as any[]) {
          const sid = generateStableChapterId(raw.content || '', raw.chapterNumber || 0, raw.title || '');
          const ch = newChapters.get(sid);
          if (ch && raw.translationResult) {
            ch.translationResult = raw.translationResult;
            newChapters.set(sid, ch);
          }
        }

        console.log(`[Import] Merge complete. Total chapters: ${newChapters.size}`);

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

      // After persisting, hydrate active translations from IDB for all imported chapters
      try {
        const ids = Array.from(incomingStableData.chapters.keys());
        const hydrateTranslation = async (sid: string) => {
          try {
            const active = await indexedDBService.getActiveTranslationByStableId(sid);
            if (!active) return;
            set(s => {
              const chapters = new Map(s.chapters);
              const ch = chapters.get(sid);
              if (!ch) return {} as any;
              const usageMetrics = {
                totalTokens: active.totalTokens || 0,
                promptTokens: active.promptTokens || 0,
                completionTokens: active.completionTokens || 0,
                estimatedCost: active.estimatedCost || 0,
                requestTime: active.requestTime || 0,
                provider: (active.provider as any) || s.settings.provider,
                model: active.model || s.settings.model,
              } as any;
              ch.translationResult = {
                translatedTitle: active.translatedTitle,
                translation: active.translation,
                proposal: active.proposal || null,
                footnotes: active.footnotes || [],
                suggestedIllustrations: active.suggestedIllustrations || [],
                usageMetrics,
              } as any;
              chapters.set(sid, ch);
              return { chapters } as any;
            });
          } catch {}
        };
        const HYDRATION_BATCH_SIZE = 8;
        for (let i = 0; i < ids.length; i += HYDRATION_BATCH_SIZE) {
          const batch = ids.slice(i, i + HYDRATION_BATCH_SIZE);
          await Promise.all(batch.map(hydrateTranslation));
        }
      } catch {}

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
        slog(`[Fetch] Fetching and parsing URL: ${url}`);
        const chapterData = await fetchAndParseUrl(url, {}, () => {});
        slog(`[Fetch] Raw chapter data:`, {
          title: chapterData.title,
          hasContent: !!chapterData.content,
          contentLength: chapterData.content?.length || 0,
          url: chapterData.originalUrl, // <--- ADDED THIS LINE
          chapterNumber: chapterData.chapterNumber,
          nextUrl: chapterData.nextUrl,
          prevUrl: chapterData.prevUrl
        });
        
        // This is a new chapter, so we need to transform it to the stable format
        slog(`[Fetch] Transforming to stable format...`);
        // Create a new object that includes the 'url' property for transformation
        const dataForTransformation = {
          ...chapterData,
          url: chapterData.originalUrl // Ensure 'url' property is present for stableIdService
        };
        const stableData = transformImportedChapters([dataForTransformation]);
        slog(`[Fetch] Stable transformation result:`, {
          chaptersCount: stableData.chapters.size,
          currentChapterId: stableData.currentChapterId,
          urlIndexSize: stableData.urlIndex.size,
          rawUrlIndexSize: stableData.rawUrlIndex.size
        });
        
        // Verify the transformed chapter has content
        if (stableData.currentChapterId) {
          const transformedChapter = stableData.chapters.get(stableData.currentChapterId);
          slog(`[Fetch] Transformed chapter content check:`, {
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
          
          slog(`[Fetch] State update:`, {
            totalChaptersAfter: newChapters.size,
            navigationHistoryAfter: newHistory,
            currentChapterId: newChapterId
          });

          // Persist navigation updates
          try { indexedDBService.setSetting('navigation-history', { stableIds: newHistory }).catch(() => {}); } catch {}
          try {
            if (newChapterId) {
              const ch = Array.from(stableData.chapters.values())[0];
              indexedDBService.setSetting('lastActiveChapter', { id: newChapterId, url: ch?.canonicalUrl || url }).catch(() => {});
            }
          } catch {}

          return {
            chapters: newChapters,
            urlIndex: newUrlIndex,
            rawUrlIndex: newRawUrlIndex,
            novels: newNovels,
            currentChapterId: newChapterId,
            navigationHistory: newHistory,
          };
        });

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
        isLoading: { ...s.isLoading, translating: true } 
    }));

    try {
        // Prefer async builder to hydrate from IndexedDB when needed
        let history: HistoricalChapter[] = [];
        if (typeof get().buildTranslationHistoryAsync === 'function') {
            history = await (get().buildTranslationHistoryAsync as any)(chapterId);
        } else {
            history = buildTranslationHistory(chapterId);
        }
        slog('[Translate] Using context items:', history.length);
        const result = await translateChapter(
          chapterToTranslate.title,
          chapterToTranslate.content,
          settings,
          history,
          (chapterToTranslate as any).fanTranslation || null,
          3,
          2000,
          abortController.signal
        );
        
        if (abortController.signal.aborted) {
            console.log(`Translation for ${chapterId} was cancelled.`);
            return;
        }

        const relevantSettings = (({ provider, model, temperature, topP, frequencyPenalty, presencePenalty, seed, contextDepth, systemPrompt }) =>
            ({ provider, model, temperature, topP, frequencyPenalty, presencePenalty, seed, contextDepth, systemPrompt }))(settings);

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

        // NEW: Load existing images and generate new ones if needed
        if (result.suggestedIllustrations && result.suggestedIllustrations.length > 0) {
            // First, load any existing images from persisted data
            get().loadExistingImages(chapterId);
            
            // Then check if any illustrations need new generation
            const needsGeneration = result.suggestedIllustrations.some(illust => !illust.generatedImage);
            if (needsGeneration) {
                get().handleGenerateImages(chapterId);
            } else {
                slog(`[ImageGen] All illustrations already generated for chapter ${chapterId}`);
            }
        }
            
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
            delete newActiveTranslations[chapterId];
            const isTranslating = Object.values(newActiveTranslations).some(Boolean);
            return { 
                activeTranslations: newActiveTranslations, 
                isLoading: { ...s.isLoading, translating: isTranslating } 
            };
        });
    }
  },

  // Cancel an in-flight translation for this chapter (if any)
  cancelTranslation: (chapterId: string) => {
    const { activeTranslations } = get();
    const ctrl = activeTranslations[chapterId];
    if (ctrl) {
      try { ctrl.abort(); } catch {}
      // Immediately reflect cancel in UI
      set(s => {
        const active = { ...s.activeTranslations };
        delete active[chapterId];
        const urlStates = { ...s.urlLoadingStates };
        delete urlStates[chapterId];
        const stillTranslating = Object.keys(active).length > 0;
        return { activeTranslations: active, urlLoadingStates: urlStates, isLoading: { ...s.isLoading, translating: stillTranslating } };
      });
      slog(`[Translate] Cancel requested for ${chapterId}`);
    }
  },

  loadExistingImages: (chapterId: string) => {
    slog(`[ImageGen] Loading existing images for ${chapterId}`);
    const { chapters } = get();
    const chapter = chapters.get(chapterId);
    const translationResult = chapter?.translationResult;

    if (!translationResult || !translationResult.suggestedIllustrations) {
      slog(`[ImageGen] No illustrations found for chapter ${chapterId}`);
      return;
    }

    const imageStateUpdates: Record<string, { isLoading: boolean; data: string | null; error: string | null; }> = {};
    let foundExistingImages = false;

    translationResult.suggestedIllustrations.forEach(illust => {
      if (illust.generatedImage) {
        const key = `${chapterId}:${illust.placementMarker}`;
        imageStateUpdates[key] = {
          isLoading: false,
          data: illust.generatedImage.imageData,
          error: null
        };
        foundExistingImages = true;
        slog(`[ImageGen] Loaded existing image for ${illust.placementMarker}`);
      }
    });

    if (foundExistingImages) {
      set(state => ({
        generatedImages: { ...state.generatedImages, ...imageStateUpdates }
      }));
      slog(`[ImageGen] Loaded ${Object.keys(imageStateUpdates).length} existing images for chapter ${chapterId}`);
    }
  },

  handleGenerateImages: async (chapterId: string) => {
    slog(`[ImageGen] Starting image generation for ${chapterId}`);
    const { chapters, settings, generatedImages } = get();
    const chapter = chapters.get(chapterId);
    const translationResult = chapter?.translationResult;

    if (settings.imageModel === 'None') {
      slog('[ImageGen] Image generation is disabled in settings.');
      return;
    }

    if (!translationResult || !translationResult.suggestedIllustrations) {
        swarn('[ImageGen] No illustrations suggested for this chapter.');
        return;
    }

    // Reset metrics and set initial loading state
    set(state => {
        const initialImageStates: Record<string, { isLoading: boolean; data: string | null; error: string | null; }> = {};
        translationResult.suggestedIllustrations.forEach(illust => {
            const key = `${chapterId}:${illust.placementMarker}`;
            initialImageStates[key] = { isLoading: true, data: null, error: null };
        });
        return {
            imageGenerationMetrics: null,
            generatedImages: { ...state.generatedImages, ...initialImageStates }
        };
    });

    let totalTime = 0;
    let totalCost = 0;
    let generatedCount = 0;

    // Only generate images for illustrations that don't already have generated data
    const illustrationsNeedingGeneration = translationResult.suggestedIllustrations.filter(
        illust => !illust.generatedImage
    );

    if (illustrationsNeedingGeneration.length === 0) {
        slog('[ImageGen] All illustrations already have generated images');
        return;
    }

    slog(`[ImageGen] Generating ${illustrationsNeedingGeneration.length}/${translationResult.suggestedIllustrations.length} new images`);

    // Sequentially generate images to avoid overwhelming the API
    for (const illust of illustrationsNeedingGeneration) {
        try {
            slog(`[ImageGen] Generating image for marker: ${illust.placementMarker}`);
            const result = await generateImage(illust.imagePrompt, settings);
            totalTime += result.requestTime;
            totalCost += result.cost;
            generatedCount++;

            // Store in Zustand for immediate UI updates
            set(state => ({
                generatedImages: {
                    ...state.generatedImages,
                    [`${chapterId}:${illust.placementMarker}`]: { isLoading: false, data: result.imageData, error: null },
                }
            }));

            // Store in chapter's translationResult for persistence
            if (chapter && chapter.translationResult) {
                const suggestionIndex = chapter.translationResult.suggestedIllustrations.findIndex(
                    s => s.placementMarker === illust.placementMarker
                );
                if (suggestionIndex >= 0) {
                    const target = chapter.translationResult.suggestedIllustrations[suggestionIndex];
                    target.generatedImage = result;
                    // Write base64 into url so UI/exports can embed images
                    (target as any).url = result.imageData;
                    // Persist to IndexedDB using stableId mapping
                    try {
                        await indexedDBService.storeTranslationByStableId(chapter.id, chapter.translationResult as any, {
                          provider: settings.provider,
                          model: settings.model,
                          temperature: settings.temperature,
                          systemPrompt: settings.systemPrompt,
                          promptId: get().activePromptTemplate?.id,
                          promptName: get().activePromptTemplate?.name,
                        });
                        slog(`[ImageGen] Persisted image for ${illust.placementMarker} to IndexedDB`);
                    } catch (error) {
                        swarn(`[ImageGen] Failed to persist image to IndexedDB:`, error);
                    }
                }
            }
            
            slog(`[ImageGen] Successfully generated and stored image for ${illust.placementMarker}`);
        } catch (error: any) {
            console.error(`[ImageGen] Failed to generate image for ${illust.placementMarker}:`, error);
            
            // Enhanced error message with suggestions
            let errorMessage = error.message || 'Image generation failed';
            if (error.suggestedActions && error.suggestedActions.length > 0) {
                errorMessage += `\n\nSuggestions:\n• ${error.suggestedActions.join('\n• ')}`;
            }
            
            set(state => ({
                generatedImages: {
                    ...state.generatedImages,
                    [`${chapterId}:${illust.placementMarker}`]: { 
                        isLoading: false, 
                        data: null, 
                        error: errorMessage,
                        errorType: error.errorType,
                        canRetry: error.canRetry
                    },
                }
            }));
        }
    }

    // Set final aggregated metrics
    set({
        imageGenerationMetrics: {
            count: generatedCount,
            totalTime: totalTime,
            totalCost: totalCost,
            lastModel: settings.imageModel,
        }
    });
    slog(`[ImageGen] Finished generation. Total time: ${totalTime.toFixed(2)}s, Total cost: ${totalCost.toFixed(5)}`);
  },

  handleRetryImage: async (chapterId: string, placementMarker: string) => {
    slog(`[ImageGen] Retrying image generation for ${placementMarker} in chapter ${chapterId}`);
    const { chapters, settings } = get();
    const chapter = chapters.get(chapterId);
    const illust = chapter?.translationResult?.suggestedIllustrations?.find(i => i.placementMarker === placementMarker);

    if (!illust) {
        console.error(`[ImageGen] Could not find illustration with marker ${placementMarker} to retry.`);
        return;
    }

    if (settings.imageModel === 'None') {
        // Immediately surface a friendly message instead of calling the API
        set(state => ({
            generatedImages: {
                ...state.generatedImages,
                [`${chapterId}:${placementMarker}`]: {
                    isLoading: false,
                    data: null,
                    error: 'Image generation is disabled in Settings (Image Generation Model = None). Choose Imagen 3.0/4.0 or a Gemini image-capable model to enable.'
                },
            }
        }));
        slog('[ImageGen] Retry skipped because image model is None');
        return;
    }

    // Set loading state for this specific image
    set(state => ({
        generatedImages: {
            ...state.generatedImages,
            [`${chapterId}:${placementMarker}`]: { isLoading: true, data: null, error: null },
        }
    }));

    try {
        const result = await generateImage(illust.imagePrompt, settings);
        set(state => ({
            generatedImages: {
                ...state.generatedImages,
                [`${chapterId}:${placementMarker}`]: { isLoading: false, data: result.imageData, error: null },
            }
        }));
        // Update aggregated image metrics for this session
        set(state => ({
          imageGenerationMetrics: state.imageGenerationMetrics
            ? {
                count: state.imageGenerationMetrics.count + 1,
                totalTime: state.imageGenerationMetrics.totalTime + result.requestTime,
                totalCost: state.imageGenerationMetrics.totalCost + result.cost,
                lastModel: settings.imageModel,
              }
            : {
                count: 1,
                totalTime: result.requestTime,
                totalCost: result.cost,
                lastModel: settings.imageModel,
              }
        }));
        // Write into chapter translation and persist
        if (chapter && chapter.translationResult) {
          const suggestionIndex = chapter.translationResult.suggestedIllustrations.findIndex(
            s => s.placementMarker === placementMarker
          );
          if (suggestionIndex >= 0) {
            const target = chapter.translationResult.suggestedIllustrations[suggestionIndex];
            target.generatedImage = result;
            (target as any).url = result.imageData;
            try {
              await indexedDBService.storeTranslationByStableId(chapter.id, chapter.translationResult as any, {
                provider: settings.provider,
                model: settings.model,
                temperature: settings.temperature,
                systemPrompt: settings.systemPrompt,
                promptId: get().activePromptTemplate?.id,
                promptName: get().activePromptTemplate?.name,
              });
              slog(`[ImageGen] Persisted retry image for ${placementMarker} to IndexedDB`);
            } catch (e) {
              swarn('[ImageGen] Failed to persist retry image to IndexedDB', e);
            }
          }
        }
        slog(`[ImageGen] Successfully retried and stored image for ${placementMarker}`);
    } catch (error: any) {
        console.error(`[ImageGen] Failed to retry image for ${placementMarker}:`, error);
        set(state => ({
            generatedImages: {
                ...state.generatedImages,
                [`${chapterId}:${placementMarker}`]: { isLoading: false, data: null, error: error.message },
            }
        }));
    }
  },

  // Allow users to edit a suggested illustration's prompt and persist it
  updateIllustrationPrompt: async (chapterId: string, placementMarker: string, newPrompt: string) => {
    const { chapters, settings } = get();
    const chapter = chapters.get(chapterId);
    if (!chapter || !chapter.translationResult || !Array.isArray(chapter.translationResult.suggestedIllustrations)) {
      return;
    }

    const idx = chapter.translationResult.suggestedIllustrations.findIndex(s => s.placementMarker === placementMarker);
    if (idx < 0) return;

    // Update in-memory
    set(s => {
      const newChapters = new Map(s.chapters);
      const ch = newChapters.get(chapterId);
      if (ch && ch.translationResult) {
        const target = ch.translationResult.suggestedIllustrations[idx];
        target.imagePrompt = newPrompt;
        newChapters.set(chapterId, { ...ch });
      }
      return { chapters: newChapters };
    });

    // Persist by storing a new active translation version with updated illustrations
    try {
      await indexedDBService.storeTranslationByStableId(chapterId, chapter.translationResult as any, {
        provider: settings.provider,
        model: settings.model,
        temperature: settings.temperature,
        systemPrompt: settings.systemPrompt,
        promptId: get().activePromptTemplate?.id,
        promptName: get().activePromptTemplate?.name,
      });
      slog(`[ImageGen] Updated illustration prompt persisted for ${placementMarker}`);
    } catch (e) {
      swarn('[ImageGen] Failed to persist updated illustration prompt', e);
    }
  },
  
  // Keep other methods from the original file that are not in the skeleton
  handleRetranslateCurrent: () => {
      const { currentChapterId, handleTranslate } = get();
      if (!currentChapterId) return;
      handleTranslate(currentChapterId);
  },
  handleToggleLanguage: (mode: 'original' | 'fan' | 'english') => set({ viewMode: mode }),
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
      // Reset in-memory session state immediately
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

      // Clear IndexedDB fully
      indexedDBService.clearAllData()
        .then(async () => {
          // Recreate a default prompt template so UI isn't left without one
          const defaultTemplate = {
            id: crypto.randomUUID(),
            name: 'Default',
            description: 'Initial system prompt',
            content: INITIAL_SYSTEM_PROMPT,
            isDefault: true,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
          } as PromptTemplate;
          try {
            await indexedDBService.storePromptTemplate(defaultTemplate);
            await indexedDBService.setDefaultPromptTemplate(defaultTemplate.id);
          } catch (e) {
            console.warn('[ClearSession] Failed to bootstrap default prompt template', e);
          }

          // Update in-memory settings to defaults and point to the default template
          set(() => ({
            settings: { ...defaultSettings, systemPrompt: INITIAL_SYSTEM_PROMPT, activePromptId: defaultTemplate.id },
            promptTemplates: [defaultTemplate],
            activePromptTemplate: defaultTemplate
          }));
        })
        .catch(err => console.error('[DB] Failed to clear database', err));

      // Remove persisted app settings from localStorage
      try { localStorage.removeItem(settingsStorageKey); } catch {}
      // Clear API debug flags
      try {
        localStorage.removeItem('LF_AI_DEBUG');
        localStorage.removeItem('LF_AI_DEBUG_FULL');
        localStorage.removeItem('LF_AI_DEBUG_LEVEL');
      } catch {}
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

  // OpenRouter dynamic catalogue and credits
  loadOpenRouterCatalogue: async (force = false) => {
    try {
      const { openrouterService } = await import('../services/openrouterService');
      const cached = await indexedDBService.getSetting<any>('openrouter-models');
      const ttlMs = 24 * 60 * 60 * 1000; // 24h
      const fresh = cached && cached.fetchedAt && (Date.now() - new Date(cached.fetchedAt).getTime() < ttlMs);
      if (cached) set({ openRouterModels: cached });
      if (!fresh || force) {
        const envKey = (process as any).env?.OPENROUTER_API_KEY as string | undefined;
        const apiKey = (get().settings as any).apiKeyOpenRouter || envKey || '';
        const updated = await openrouterService.fetchModels(apiKey);
        set({ openRouterModels: updated });
      }
    } catch (e) {
      console.warn('[OpenRouter] loadOpenRouterCatalogue failed', e);
    }
  },
  refreshOpenRouterModels: async () => {
    try {
      const { openrouterService } = await import('../services/openrouterService');
      const envKey = (process as any).env?.OPENROUTER_API_KEY as string | undefined;
      const apiKey = (get().settings as any).apiKeyOpenRouter || envKey || '';
      const updated = await openrouterService.fetchModels(apiKey);
      set({ openRouterModels: updated });
    } catch (e) { console.warn('[OpenRouter] refresh models failed', e); }
  },
  refreshOpenRouterCredits: async () => {
    try {
      const { openrouterService } = await import('../services/openrouterService');
      const envKey = (process as any).env?.OPENROUTER_API_KEY as string | undefined;
      const apiKey = (get().settings as any).apiKeyOpenRouter || envKey || '';
      if (!apiKey) { set({ openRouterKeyUsage: null }); return; }
      const ttlMs = 30 * 60 * 1000; // 30m
      const cached = await indexedDBService.getSetting<any>('openrouter-key-usage');
      const fresh = cached && cached.fetchedAt && (Date.now() - new Date(cached.fetchedAt).getTime() < ttlMs);
      if (fresh) { set({ openRouterKeyUsage: cached }); return; }
      const updated = await openrouterService.fetchKeyUsage(apiKey);
      set({ openRouterKeyUsage: updated });
    } catch (e) { console.warn('[OpenRouter] refresh credits failed', e); }
  },
  getOpenRouterOptions: (search?: string) => {
    const state = get();
    const cached = state.openRouterModels?.data || [];
    const needle = (search || '').trim().toLowerCase();
    const filterTextCapable = (m: any) => {
      const ins = (m.architecture?.input_modalities || []).map((x: any) => String(x).toLowerCase());
      const outs = (m.architecture?.output_modalities || []).map((x: any) => String(x).toLowerCase());
      return ins.includes('text') && outs.includes('text');
    };
    const list = cached.filter(filterTextCapable).filter((m: any) => {
      if (!needle) return true;
      return (m.name?.toLowerCase().includes(needle) || m.id?.toLowerCase().includes(needle));
    }).map((m: any) => {
      const pricing = m.pricing || {};
      const pIn = typeof pricing.prompt === 'string' ? parseFloat(pricing.prompt) : pricing.prompt;
      const pOut = typeof pricing.completion === 'string' ? parseFloat(pricing.completion) : pricing.completion;
      const inPerM = (pIn && isFinite(pIn) && pIn > 0) ? pIn * 1_000_000 : null;
      const outPerM = (pOut && isFinite(pOut) && pOut > 0) ? pOut * 1_000_000 : null;
      const extras: string[] = [];
      const ins = (m.architecture?.input_modalities || []).map((x: any) => String(x).toLowerCase());
      const outs = (m.architecture?.output_modalities || []).map((x: any) => String(x).toLowerCase());
      if (ins.includes('image')) extras.push('image-in');
      if (ins.includes('audio')) extras.push('audio-in');
      if (outs.includes('image')) extras.push('image-out');
      if (outs.includes('audio')) extras.push('audio-out');
      const extrasLabel = extras.length ? ` (${extras.join(', ')})` : '';
      const label = (inPerM != null && outPerM != null)
        ? `${m.name} — $${inPerM.toFixed(2)}/$${outPerM.toFixed(2)} per 1M${extrasLabel}`
        : `${m.name}${extrasLabel}`;
      const priceKey = (inPerM != null && outPerM != null) ? (inPerM + outPerM) : null;
      return { id: m.id, label, priceKey };
    });
    // Basic sort by price (recents applied in UI through selection memory)
    return list.sort((a, b) => {
      const ak = a.priceKey == null ? Number.POSITIVE_INFINITY : a.priceKey;
      const bk = b.priceKey == null ? Number.POSITIVE_INFINITY : b.priceKey;
      return ak - bk || a.id.localeCompare(b.id);
    });
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
      slog(`[Boot] Hydrated ${mappings.length} URL mappings from IndexedDB`);
    } catch (e) {
      swarn('[Boot] Failed to hydrate URL indices from IndexedDB', e);
    }
  },
}));

export default useAppStore;
