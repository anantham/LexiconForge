
import { create } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { Chapter, FeedbackItem, AmendmentProposal, TranslationResult, AppSettings, HistoricalChapter, ImportedSession, TranslationProvider, PromptTemplate } from '../types';
import { INITIAL_SYSTEM_PROMPT, SUPPORTED_WEBSITES } from '../constants';
import { translateChapter, validateApiKey } from '../services/aiService';
import { generateImage } from '../services/imageService';
import { fetchAndParseUrl } from '../services/adapters';
import { indexedDBService, TranslationRecord, PromptTemplateRecord, migrateFromLocalStorage } from '../services/indexeddb';
import { collectActiveVersions, generateEpub, EpubExportOptions } from '../services/epubService';

// Helper function to find session data by normalized URL
const findSessionDataByUrl = (sessionData: Record<string, any>, targetUrl: string): any => {
    const normalizedTarget = normalizeUrl(targetUrl);
    if (!normalizedTarget) return null;
    
    // First try exact match
    if (sessionData[targetUrl]) {
        return sessionData[targetUrl];
    }
    
    // Then try normalized match
    for (const [storedUrl, data] of Object.entries(sessionData)) {
        if (normalizeUrl(storedUrl) === normalizedTarget) {
            return data;
        }
    }
    
    return null;
};

// Helper to prevent duplicate URLs (e.g. with/without trailing slash, viewer param)
const normalizeUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        // Remove the viewer and book parameter
        urlObj.searchParams.delete('viewer');
        urlObj.searchParams.delete('book');
        // Rebuild the URL without the hash and with a standardized path
        return urlObj.origin + urlObj.pathname.replace(/\/$/, "") + urlObj.search;
    } catch (e) {
        // If URL is invalid, return it as is
        return url;
    }
};

export interface SessionChapterData {
  chapter: Chapter;
  translationResult: TranslationResult | null;
  availableVersions?: TranslationRecord[]; // All available translation versions
  activeVersion?: number; // Currently selected version number
}

const defaultSettings: AppSettings = {
    contextDepth: 2,
    preloadCount: 0,
    fontSize: 18,
    fontStyle: 'serif',
    lineHeight: 1.7,
    systemPrompt: INITIAL_SYSTEM_PROMPT,
    provider: 'Gemini',
    model: 'gemini-2.5-flash',
    imageModel: 'gemini-1.5-flash',
    temperature: 0.3,
    apiKeyGemini: '',
    apiKeyOpenAI: '',
    apiKeyDeepSeek: '',
};

interface AppState {
    isLoading: { fetching: boolean; translating: boolean };
    error: string | null;
    showSettingsModal: boolean;
    sessionData: Record<string, SessionChapterData>;
    currentUrl: string | null;
    urlHistory: string[];
    showEnglish: boolean;
    feedbackHistory: { [key: string]: FeedbackItem[] }; // Legacy: URL -> feedback[]
    versionFeedback: { [url: string]: { [versionId: string]: FeedbackItem[] } }; // New: URL -> version -> feedback[]
    settings: AppSettings;
    proxyScores: Record<string, number>;
    isDirty: boolean;
    amendmentProposal: AmendmentProposal | null;
    lastApiCallTimestamp: number;
    activeTranslations: Record<string, AbortController>;
    urlLoadingStates: Record<string, boolean>;
    lastTranslationSettings: Record<string, { provider: string; model: string; temperature: number }>;
    promptTemplates: PromptTemplateRecord[];
    activePromptTemplate: PromptTemplateRecord | null;
    generatedImages: Record<string, { isLoading: boolean; data: string | null; error: string | null; imagePrompt: string; }>;
    imageGenerationMetrics: { count: number; totalTime: number; totalCost: number; } | null;
}

interface AppActions {
    handleFetch: (fetchUrl: string, isSilent?: boolean) => Promise<Chapter | null>;
    handleTranslate: (urlToTranslate: string, isSilent?: boolean) => Promise<void>;
    handleRetranslateCurrent: () => void;
    handleNavigate: (newUrl: string) => void;
    handleToggleLanguage: (show: boolean) => void;
    addFeedback: (feedback: Omit<FeedbackItem, 'id'>) => void;
    deleteFeedback: (feedbackId: string) => void;
    updateFeedbackComment: (feedbackId: string, comment: string) => void;
    setShowSettingsModal: (isOpen: boolean) => void;
    updateSettings: (newSettings: Partial<AppSettings>) => void;
    updateProxyScore: (proxyUrl: string, successful: boolean) => void;
    acceptProposal: () => void;
    rejectProposal: () => void;
    clearSession: () => void;
    importSession: (event: React.ChangeEvent<HTMLInputElement>) => void;
    exportSession: () => void;
    exportEpub: () => Promise<void>;
    cancelActiveTranslations: () => void;
    isUrlTranslating: (url: string) => boolean;
    hasTranslationSettingsChanged: (url: string) => boolean;
    shouldEnableRetranslation: (url: string) => boolean;
    handleGenerateImages: (url: string) => Promise<void>;
    getSessionDataByUrl: (url: string) => any;
    // Version management
    loadTranslationVersions: (url: string) => Promise<void>;
    switchTranslationVersion: (url: string, version: number) => Promise<void>;
    deleteTranslationVersion: (url: string, version: number) => Promise<void>;
    initializeIndexedDB: () => Promise<void>;
    // Prompt template management
    loadPromptTemplates: () => Promise<void>;
    createPromptTemplate: (name: string, content: string, description?: string) => Promise<void>;
    updatePromptTemplate: (template: PromptTemplate) => Promise<void>;
    deletePromptTemplate: (id: string) => Promise<void>;
    setActivePromptTemplate: (id: string) => Promise<void>;
}

type Store = AppState & AppActions;

// Define the keys we want to persist (activeTranslations and urlLoadingStates are runtime-only)
const PERSIST_KEYS = ['sessionData', 'currentUrl', 'urlHistory', 'showEnglish', 'feedbackHistory', 'versionFeedback', 'settings', 'proxyScores'] as const;
type PersistedState = Pick<Store, typeof PERSIST_KEYS[number]>;

const persistOptions: PersistOptions<Store, PersistedState> = {
    name: 'novel-translator-storage-v2',
    partialize: (state) => {
        const persisted: Partial<PersistedState> = {};
        PERSIST_KEYS.forEach(key => {
            (persisted as any)[key] = state[key];
        });
        return persisted as PersistedState;
    },
};

const useAppStore = create<Store>()(
    persist(
        (set, get) => ({
            // --- INITIAL STATE ---
            isLoading: { fetching: false, translating: false },
            error: null,
            showSettingsModal: false,
            sessionData: {},
            currentUrl: null,
            urlHistory: [],
            showEnglish: false,
            feedbackHistory: {}, // Legacy feedback storage
            versionFeedback: {}, // New version-specific feedback storage
            settings: defaultSettings,
            proxyScores: {},
            isDirty: false,
            amendmentProposal: null,
            lastApiCallTimestamp: 0,
            activeTranslations: {},
            urlLoadingStates: {},
            lastTranslationSettings: {},
            promptTemplates: [],
            activePromptTemplate: null,
            generatedImages: {},
            imageGenerationMetrics: null,
            
            // --- ACTIONS ---
            
            handleFetch: async (rawFetchUrl, isSilent = false) => {
                const fetchUrl = normalizeUrl(rawFetchUrl);
                if (!fetchUrl) return null;

                const { sessionData, proxyScores, updateProxyScore } = get();

                // Check if the chapter is already in the cache
                if (sessionData[fetchUrl]) {
                    if (!isSilent) {
                        console.log('%cCACHE HIT', 'color: green; font-weight: bold;', 'Using cached chapter data.');
                        set(state => ({
                            currentUrl: fetchUrl,
                            urlHistory: state.urlHistory.includes(fetchUrl) 
                                ? [...state.urlHistory.filter(u => u !== fetchUrl), fetchUrl] 
                                : [...state.urlHistory, fetchUrl]
                        }));
                    }
                    return sessionData[fetchUrl].chapter;
                }

                // If not in cache, check if the URL is from a supported website
                try {
                    const urlObj = new URL(fetchUrl);
                    if (!SUPPORTED_WEBSITES.some(hostname => urlObj.hostname.includes(hostname))) {
                        console.log(`[Fetch] Skipping fetch for unsupported website: ${urlObj.hostname}`);
                        return null;
                    }
                } catch (e) {
                    console.error(`[Fetch] Invalid URL: ${fetchUrl}`);
                    return null;
                }

                console.log(`[Fetch] handleFetch called for: ${fetchUrl}`);
                if (!isSilent) {
                    console.groupCollapsed(`[App] handleFetch triggered for: ${fetchUrl}`);
                    set({ error: null, currentUrl: fetchUrl, isDirty: false, imageGenerationMetrics: null });
                } else {
                    console.groupCollapsed(`[App] Silent fetch triggered for: ${fetchUrl}`);
                }
                
                if (sessionData[fetchUrl]) {
                    if (!isSilent) {
                        console.log('%cCACHE HIT', 'color: green; font-weight: bold;', 'Using cached chapter data.');
                        set(state => ({
                            urlHistory: state.urlHistory.includes(fetchUrl) 
                                ? [...state.urlHistory.filter(u => u !== fetchUrl), fetchUrl] 
                                : [...state.urlHistory, fetchUrl]
                        }));
                    }
                    console.groupEnd();
                    return sessionData[fetchUrl].chapter;
                }

                if (!isSilent) {
                    console.log('%cCACHE MISS', 'color: orange; font-weight: bold;', 'No data in cache. Proceeding to fetch.');
                    set({ isLoading: { fetching: true, translating: false }, showEnglish: false });
                }

                try {
                    const chapterData = await fetchAndParseUrl(fetchUrl, proxyScores, updateProxyScore);
                    if (!isSilent) console.log('Fetch successful. New chapter data:', chapterData);
                    
                    // Store chapter in IndexedDB
                    try {
                        await indexedDBService.storeChapter(chapterData);
                        console.log(`[IndexedDB] Chapter stored: ${fetchUrl}`);
                    } catch (error) {
                        console.error('[IndexedDB] Failed to store chapter:', error);
                    }
                    
                    set(state => {
                        console.log(`%c[Diag] handleFetch: Updating sessionData for ${fetchUrl}. Setting translationResult to NULL.`, 'color: green; font-weight: bold;');
                        return {
                            sessionData: {
                                ...state.sessionData,
                                [fetchUrl]: { chapter: chapterData, translationResult: null },
                            },
                            urlHistory: state.urlHistory.includes(fetchUrl) ? state.urlHistory : [...state.urlHistory, fetchUrl]
                        };
                    });

                    // Load existing translation versions for this chapter
                    if (!isSilent) {
                        try {
                            await get().loadTranslationVersions(fetchUrl);
                        } catch (error) {
                            console.error('[Versions] Failed to load versions during fetch:', error);
                        }
                    }

                    console.groupEnd();
                    return chapterData;
                } catch (e: any) {
                    if (!isSilent) {
                        console.error('Fetch failed with error:', e.message);
                        set({ error: e.message || 'An unknown error occurred during fetching.' });
                        if(get().currentUrl === fetchUrl) set({ currentUrl: null });
                    } else {
                        console.error(`Silent fetch failed for ${fetchUrl}:`, e);
                    }
                    console.groupEnd();
                    return null;
                } finally {
                    if (!isSilent) {
                        set(prev => ({ isLoading: { ...prev.isLoading, fetching: false } }));
                    }
                }
            },

            handleTranslate: async (urlToTranslate, isSilent = false) => {
                const { sessionData, urlHistory, settings, feedbackHistory, lastApiCallTimestamp, activeTranslations } = get();

                console.log(`[LoadingState Debug] handleTranslate called for ${urlToTranslate}, isSilent: ${isSilent}`);
                const currentState = get();
                console.log(`[LoadingState Debug] Current isLoading.translating: ${currentState.isLoading.translating}`);
                console.log(`[LoadingState Debug] Current urlLoadingStates[${urlToTranslate}]: ${currentState.urlLoadingStates[urlToTranslate]}`);

                // EARLY API KEY VALIDATION - Check before any processing
                const apiValidation = validateApiKey(settings);
                if (!apiValidation.isValid) {
                    console.error(`[Translation] API key validation failed: ${apiValidation.errorMessage}`);
                    console.log(`[LoadingState Debug] API validation failed - about to clear loading states`);
                    
                    // Clear any loading state for this URL since we're not actually translating
                    set(prev => {
                        const newUrlLoadingStates = { ...prev.urlLoadingStates };
                        delete newUrlLoadingStates[urlToTranslate];
                        
                        console.log(`[LoadingState Debug] Clearing states - prev.isLoading.translating: ${prev.isLoading.translating}`);
                        console.log(`[LoadingState Debug] Clearing states - prev.urlLoadingStates[${urlToTranslate}]: ${prev.urlLoadingStates[urlToTranslate]}`);
                        
                        return {
                            ...prev,
                            urlLoadingStates: newUrlLoadingStates,
                            isLoading: { ...prev.isLoading, translating: false },
                            error: isSilent ? prev.error : `Translation API error: ${apiValidation.errorMessage}`
                        };
                    });
                    
                    // Log the state after clearing
                    const stateAfterClear = get();
                    console.log(`[LoadingState Debug] After clearing - isLoading.translating: ${stateAfterClear.isLoading.translating}`);
                    console.log(`[LoadingState Debug] After clearing - urlLoadingStates[${urlToTranslate}]: ${stateAfterClear.urlLoadingStates[urlToTranslate]}`);
                    
                    return; // Exit immediately, no rate limiting, no further state changes
                }

                // Cancel any existing translation for this URL
                if (activeTranslations[urlToTranslate]) {
                    activeTranslations[urlToTranslate].abort();
                    console.log(`[Translation] Cancelled existing translation for ${urlToTranslate}`);
                }

                const RATE_LIMIT_INTERVAL_MS = 6500;
                const now = Date.now();
                const timeSinceLastCall = now - lastApiCallTimestamp;

                if (timeSinceLastCall < RATE_LIMIT_INTERVAL_MS) {
                    const delay = RATE_LIMIT_INTERVAL_MS - timeSinceLastCall;
                    console.log(`[Rate Limiter] Throttling request for ${delay}ms to respect API rate limits.`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                set({ lastApiCallTimestamp: Date.now() });
                
                const chapterToTranslate = sessionData[urlToTranslate]?.chapter;
                if (!chapterToTranslate?.content) return;

                // For silent pre-translations, check if any version already exists in IndexedDB
                if (isSilent) {
                    const existingVersions = await indexedDBService.getTranslationVersions(urlToTranslate);
                    if (existingVersions.length > 0) {
                        console.log(`[Translation] Skipping silent pre-translation for ${urlToTranslate}: Version(s) already exist.`);
                        return; // Skip API call if a version already exists
                    }
                }

                // Create abort controller for this translation
                const abortController = new AbortController();
                
                if (!isSilent) {
                    set(prev => ({ 
                        ...prev, 
                        isLoading: { ...prev.isLoading, translating: true }, 
                        error: null,
                        activeTranslations: { ...prev.activeTranslations, [urlToTranslate]: abortController },
                        urlLoadingStates: { ...prev.urlLoadingStates, [urlToTranslate]: true }
                    }));
                } else {
                    set(prev => ({ 
                        ...prev,
                        activeTranslations: { ...prev.activeTranslations, [urlToTranslate]: abortController },
                        urlLoadingStates: { ...prev.urlLoadingStates, [urlToTranslate]: true }
                    }));
                }
                
                const historyUrls = urlHistory.slice(Math.max(0, urlHistory.indexOf(urlToTranslate) - settings.contextDepth), urlHistory.indexOf(urlToTranslate));
                const historyForApi: HistoricalChapter[] = historyUrls.map(url => {
                    const data = sessionData[url];
                    if (!data?.translationResult || !data?.chapter) return null;
                    return {
                        originalTitle: data.chapter.title,
                        originalContent: data.chapter.content,
                        translatedTitle: data.translationResult.translatedTitle,
                        translatedContent: data.translationResult.translation,
                        feedback: feedbackHistory[url] ?? []
                    };
                }).filter((item): item is HistoricalChapter => item !== null);

                try {
                    const result = await translateChapter(chapterToTranslate.title, chapterToTranslate.content, settings, historyForApi);
                    console.log('%c[Diag] handleTranslate: API call SUCCEEDED', 'color: #ff00ff; font-weight: bold;', result);
                    
                    // Check if translation was cancelled
                    if (abortController.signal.aborted) {
                        console.log(`[Translation] Translation for ${urlToTranslate} was cancelled`);
                        return;
                    }

                    // Store translation as new version in IndexedDB
                    try {
                        console.log('%c[Diag] handleTranslate: Storing in IndexedDB...', 'color: #ff00ff; font-weight: bold;');
                        // Check version limit before storing
                        const existingVersions = await indexedDBService.getTranslationVersions(urlToTranslate);
                        const MAX_VERSIONS = 9;
                        
                        if (existingVersions.length >= MAX_VERSIONS) {
                            // Prompt user to delete a version
                            const versionList = existingVersions
                                .sort((a, b) => b.version - a.version) // Latest first
                                .map(v => `v${v.version} (${v.provider} ${v.model}) - ${new Date(v.createdAt).toLocaleDateString()}`)
                                .join('\n');
                            
                            const userChoice = confirm(
                                `You have reached the maximum of ${MAX_VERSIONS} translation versions for this chapter.\n\n` +
                                `Current versions:\n${versionList}\n\n` +
                                `Would you like to delete the oldest version to make room for the new translation?\n\n` +
                                `Click OK to delete oldest, or Cancel to keep current versions (new translation will not be saved).`
                            );
                            
                            if (userChoice) {
                                // Delete the oldest version
                                const oldestVersion = existingVersions.sort((a, b) => a.version - b.version)[0];
                                await indexedDBService.deleteTranslationVersion(oldestVersion.id);
                                console.log(`[Translation] Deleted oldest version ${oldestVersion.version} to make room`);
                            } else {
                                console.log('[Translation] User cancelled - not storing new version');
                                // Still update in-memory but don't store in IndexedDB
                                set(state => ({
                                    sessionData: {
                                        ...state.sessionData,
                                        [urlToTranslate]: { ...state.sessionData[urlToTranslate], translationResult: result },
                                    },
                                    amendmentProposal: (result.proposal && !isSilent) ? result.proposal : state.amendmentProposal,
                                }));
                                return;
                            }
                        }
                        
                        const { activePromptTemplate } = get();
                        await indexedDBService.storeTranslation(urlToTranslate, result, {
                            provider: settings.provider,
                            model: settings.model,
                            temperature: settings.temperature,
                            systemPrompt: settings.systemPrompt,
                            promptId: activePromptTemplate?.id,
                            promptName: activePromptTemplate?.name
                        });
                        
                        console.log('%c[Diag] handleTranslate: Stored in IndexedDB. Reloading versions...', 'color: #ff00ff; font-weight: bold;');
                        // Reload versions to update UI
                        await get().loadTranslationVersions(urlToTranslate);
                        
                        console.log('%c[Diag] handleTranslate: Versions reloaded. Checking for image generation...', 'color: #ff00ff; font-weight: bold;');
                        
                        // COMPREHENSIVE IMAGE GENERATION DIAGNOSTICS
                        console.log(`[ImageGen Debug] Translation result exists: ${!!result}`);
                        console.log(`[ImageGen Debug] suggestedIllustrations exists: ${!!result.suggestedIllustrations}`);
                        console.log(`[ImageGen Debug] suggestedIllustrations length: ${result.suggestedIllustrations?.length || 'undefined'}`);
                        console.log(`[ImageGen Debug] suggestedIllustrations content:`, result.suggestedIllustrations);
                        console.log(`[ImageGen Debug] urlToTranslate: ${urlToTranslate}`);
                        

                        console.log(`[Translation] Stored new version for ${urlToTranslate}`);
                    } catch (error) {
                        console.error('[Translation] Failed to store in IndexedDB:', error);
                        // Fallback to in-memory storage
                    }

                    set((state) => {
                      console.log(`%c[Translation Update] Starting state update for: ${urlToTranslate}`, 'color: #00ff00; font-weight: bold;');
                      
                      // Use helper function to handle URL normalization differences
                      const prevUrlEntry = findSessionDataByUrl(state.sessionData, urlToTranslate);
                      if (!prevUrlEntry) {
                        console.error(`[Translation] Cannot set translation result - no chapter data found for ${urlToTranslate}`);
                        console.error(`[Translation] Available keys:`, Object.keys(state.sessionData).slice(0, 3));
                        return state; // Don't update if no chapter data exists
                      }
                      
                      // Find the actual key that was matched (for updating the right entry)
                      let actualKey = urlToTranslate;
                      if (!state.sessionData[urlToTranslate]) {
                        // If direct lookup failed, find the key that findSessionDataByUrl found
                        const normalizedTarget = normalizeUrl(urlToTranslate);
                        for (const [storedUrl] of Object.entries(state.sessionData)) {
                          if (normalizeUrl(storedUrl) === normalizedTarget) {
                            actualKey = storedUrl;
                            console.log(`[Translation] URL mapping: ${urlToTranslate} → ${actualKey}`);
                            break;
                          }
                        }
                      }
                      
                      console.log(`%c[Translation] Updating sessionData with key: ${actualKey}`, 'color: green; font-weight: bold;');
                      console.log(`[Translation] Result has ${result?.translation?.length || 0} chars`);
                      
                      const nextUrlEntry: SessionChapterData = {
                        ...prevUrlEntry,
                        // write the new leaf
                        translationResult: result,
                        // optional: keep lightweight metadata to help selectors/debugging
                        translationMeta: {
                          ...(prevUrlEntry as any).translationMeta,
                          updatedAt: Date.now(),
                          settings: {
                            provider: settings.provider,
                            model: settings.model,
                            temperature: settings.temperature,
                          },
                        },
                      };

                      return {
                        // NEW object for the map
                        sessionData: {
                          ...state.sessionData,
                          [actualKey]: nextUrlEntry, // Use actualKey instead of urlToTranslate
                        },

                        // keep or clear proposal as you intended
                        amendmentProposal:
                          result.proposal && !isSilent ? result.proposal : state.amendmentProposal,

                        // persist last translation settings per-URL immutably
                        lastTranslationSettings: {
                          ...state.lastTranslationSettings,
                          [urlToTranslate]: {
                            provider: settings.provider,
                            model: settings.model,
                            temperature: settings.temperature,
                          },
                        },

                        // make sure the global loading flag changes by ref
                        isLoading: {
                          ...state.isLoading,
                          translating: false,
                        },

                        // IMPORTANT: if you track per-URL translating, replace that map by ref too
                        urlLoadingStates: { // Assuming urlLoadingStates is the per-URL translating flag
                          ...state.urlLoadingStates,
                          [urlToTranslate]: false,
                        },
                      };
                    });
                    
                    // FIXED: Trigger image generation AFTER sessionData is updated
                    if (result.suggestedIllustrations && result.suggestedIllustrations.length > 0) {
                        console.log(`[ImageGen Debug] ✅ CONDITION MET - Calling handleGenerateImages for ${result.suggestedIllustrations.length} illustrations`);
                        get().handleGenerateImages(urlToTranslate);
                    } else {
                        console.log(`[ImageGen Debug] ❌ CONDITION NOT MET - No image generation triggered`);
                        if (!result.suggestedIllustrations) {
                            console.log(`[ImageGen Debug] - suggestedIllustrations is falsy: ${result.suggestedIllustrations}`);
                        } else if (result.suggestedIllustrations.length === 0) {
                            console.log(`[ImageGen Debug] - suggestedIllustrations array is empty`);
                        }
                    }
                } catch (e: any) {
                    // Don't show errors for aborted translations
                    if (abortController.signal.aborted) {
                        console.log(`[Translation] Translation for ${urlToTranslate} was cancelled`);
                        return;
                    }

                    const sanitizedMessage = JSON.stringify(e instanceof Error ? e.message : String(e));
                    if (!isSilent) {
                        let errorMessage = `An unexpected error occurred during translation. Full error: ${sanitizedMessage}`;
                        if (e instanceof Error) {
                             if (e.message.includes('429')) {
                                errorMessage = 'API rate limit exceeded. The app will automatically slow down. Please try again in a moment.';
                             } else if (e.message.toLowerCase().includes('api key')) {
                                 errorMessage = `Translation API error: Invalid or missing API Key for ${settings.provider}. Please add it in the settings.`;
                             } else if (e.message.toLowerCase().includes('quota')) {
                                 errorMessage = 'Translation API error: You may have exceeded your API usage quota.';
                             } else if (e.message.toLowerCase().includes('blocked')) {
                                 errorMessage = 'Translation failed because the content was blocked by the safety policy. The source text may contain sensitive material.';
                             } else {
                                errorMessage = `Translation API error: ${e.message}`;
                             }
                        }
                        set({ error: errorMessage });
                    } else {
                        console.error(`Silent translation failed for ${urlToTranslate}:`, sanitizedMessage);
                    }
                } finally {
                    console.log(`%c[Diag] handleTranslate: FINALLY block entered for ${urlToTranslate}`, 'color: #ff00ff; font-weight: bold;');
                    // Clean up regardless of success/failure/cancellation
                    set(prev => {
                        const newActiveTranslations = { ...prev.activeTranslations };
                        const newUrlLoadingStates = { ...prev.urlLoadingStates };
                        delete newActiveTranslations[urlToTranslate];
                        delete newUrlLoadingStates[urlToTranslate];

                        return {
                            ...prev,
                            isLoading: { ...prev.isLoading, translating: Object.keys(newActiveTranslations).length > 0 },
                            activeTranslations: newActiveTranslations,
                            urlLoadingStates: newUrlLoadingStates
                        };
                    });
                }
            },

            handleRetranslateCurrent: () => {
                const { currentUrl, urlHistory, handleTranslate } = get();
                if (!currentUrl) return;

                const currentIndex = urlHistory.indexOf(currentUrl);
                if (currentIndex !== -1) {
                    const urlsToInvalidate = urlHistory.slice(currentIndex + 1);
                    if (urlsToInvalidate.length > 0) {
                        console.log(`[Retranslate] Invalidating future cache for ${urlsToInvalidate.length} chapter(s).`);
                    }
                    set(state => {
                        const newData = { ...state.sessionData };
                        urlsToInvalidate.forEach(url => {
                            if (newData[url]) {
                                newData[url] = { ...newData[url], translationResult: null };
                            }
                        });
                        return { sessionData: newData };
                    });
                }
                
                handleTranslate(currentUrl);
                set({ isDirty: false });
            },

            handleNavigate: (rawUrl: string) => {
                const newUrl = normalizeUrl(rawUrl);
                if (!newUrl) return;
                console.log(`[Navigate] Navigating to: ${newUrl}`);
                get().handleFetch(newUrl);
            },

            handleToggleLanguage: (show: boolean) => set({ showEnglish: show, isDirty: false }),

            addFeedback: (feedback: Omit<FeedbackItem, 'id'>) => {
                const { currentUrl, sessionData } = get();
                if (!currentUrl) return;
                
                const activeVersion = sessionData[currentUrl]?.activeVersion;
                if (!activeVersion) {
                    console.warn('[Feedback] No active version found for feedback');
                    return;
                }
                
                const newFeedback: FeedbackItem = { ...feedback, id: new Date().toISOString() };
                const versionKey = activeVersion.toString();
                
                set(state => ({
                    // Keep legacy feedbackHistory for backward compatibility during transition
                    feedbackHistory: {
                        ...state.feedbackHistory,
                        [currentUrl]: [...(state.feedbackHistory[currentUrl] ?? []), newFeedback],
                    },
                    // Add to version-specific feedback
                    versionFeedback: {
                        ...state.versionFeedback,
                        [currentUrl]: {
                            ...state.versionFeedback[currentUrl],
                            [versionKey]: [...(state.versionFeedback[currentUrl]?.[versionKey] ?? []), newFeedback],
                        }
                    },
                    isDirty: true
                }));
            },

            deleteFeedback: (feedbackId: string) => {
                const { currentUrl, sessionData } = get();
                if (!currentUrl) return;
                
                const activeVersion = sessionData[currentUrl]?.activeVersion;
                if (!activeVersion) return;
                
                const versionKey = activeVersion.toString();
                
                set(state => ({
                    // Update legacy feedback
                    feedbackHistory: {
                        ...state.feedbackHistory,
                        [currentUrl]: (state.feedbackHistory[currentUrl] || []).filter(f => f.id !== feedbackId),
                    },
                    // Update version-specific feedback
                    versionFeedback: {
                        ...state.versionFeedback,
                        [currentUrl]: {
                            ...state.versionFeedback[currentUrl],
                            [versionKey]: (state.versionFeedback[currentUrl]?.[versionKey] || []).filter(f => f.id !== feedbackId),
                        }
                    },
                    isDirty: true
                }));
            },

            updateFeedbackComment: (feedbackId: string, comment: string) => {
                const { currentUrl, sessionData } = get();
                if (!currentUrl) return;
                
                const activeVersion = sessionData[currentUrl]?.activeVersion;
                if (!activeVersion) return;
                
                const versionKey = activeVersion.toString();
                
                set(state => ({
                    // Update legacy feedback
                    feedbackHistory: {
                        ...state.feedbackHistory,
                        [currentUrl]: (state.feedbackHistory[currentUrl] || []).map(f =>
                            f.id === feedbackId ? { ...f, comment } : f
                        ),
                    },
                    // Update version-specific feedback
                    versionFeedback: {
                        ...state.versionFeedback,
                        [currentUrl]: {
                            ...state.versionFeedback[currentUrl],
                            [versionKey]: (state.versionFeedback[currentUrl]?.[versionKey] || []).map(f =>
                                f.id === feedbackId ? { ...f, comment } : f
                            ),
                        }
                    },
                    isDirty: true
                }));
            },

            setShowSettingsModal: (isOpen: boolean) => set({ showSettingsModal: isOpen }),
            
            updateSettings: (newSettings: Partial<AppSettings>) => {
                const currentSettings = get().settings;
                const modelOrProviderChanged = 
                    (newSettings.provider && newSettings.provider !== currentSettings.provider) ||
                    (newSettings.model && newSettings.model !== currentSettings.model);

                if (modelOrProviderChanged) {
                    console.log('[Settings] Model/provider changed, cancelling active translations');
                    get().cancelActiveTranslations();
                }

                set(state => ({ settings: { ...state.settings, ...newSettings } }));
                
                // Auto-retry failed images if Gemini API key was just added
                if (!currentSettings.apiKeyGemini && newSettings.apiKeyGemini && get().currentUrl) {
                    console.log('[Settings] Gemini API key added, auto-retrying failed images...');
                    setTimeout(() => {
                        get().retryFailedImages(get().currentUrl!);
                    }, 500); // Small delay to ensure UI updates
                }
            },

            updateProxyScore: (proxyUrl: string, successful: boolean) => {
                set(state => {
                    const currentScore = state.proxyScores[proxyUrl] || 0;
                    const newScore = successful 
                        ? Math.min(5, currentScore + 1)
                        : Math.max(-5, currentScore - 1);
                    
                    try {
                        console.log(`[ProxyManager] Score for ${new URL(proxyUrl).hostname}: ${currentScore} -> ${newScore} (${successful ? 'Success' : 'Failure'})`);
                    } catch(e) { /* ignore invalid url for hostname */ }
            
                    return {
                        proxyScores: {
                            ...state.proxyScores,
                            [proxyUrl]: newScore
                        }
                    };
                });
            },

            acceptProposal: () => {
                const { amendmentProposal, settings } = get();
                if (!amendmentProposal) {
                    console.warn('[Amendment] No amendment proposal to accept');
                    return;
                }
                
                console.groupCollapsed('[Amendment] Processing proposal acceptance');
                
                // Log current state
                console.log('[Amendment] Current system prompt (first 300 chars):', 
                    settings.systemPrompt.substring(0, 300) + (settings.systemPrompt.length > 300 ? '...' : ''));
                
                console.log('[Amendment] Searching for current rule:', amendmentProposal.currentRule);
                console.log('[Amendment] Original proposed change:', amendmentProposal.proposedChange);
                
                // Process the proposed change (remove +/- prefixes)
                const processedChange = amendmentProposal.proposedChange.replace(/^[+-]\s/gm, '');
                console.log('[Amendment] Processed proposed change (after regex):', processedChange);
                
                // Check if current rule exists in the prompt
                const ruleFound = settings.systemPrompt.includes(amendmentProposal.currentRule);
                console.log('[Amendment] Current rule found in system prompt:', ruleFound);
                
                if (!ruleFound) {
                    console.warn('[Amendment] Current rule not found in system prompt - replacement will fail');
                    console.log('[Amendment] This might be due to text formatting differences');
                }
                
                // Perform the replacement
                const newPrompt = settings.systemPrompt.replace(amendmentProposal.currentRule, processedChange);
                
                // Check if replacement actually happened
                const replacementWorked = newPrompt !== settings.systemPrompt;
                console.log('[Amendment] Replacement worked:', replacementWorked);
                
                if (replacementWorked) {
                    console.log('[Amendment] New system prompt (first 300 chars):', 
                        newPrompt.substring(0, 300) + (newPrompt.length > 300 ? '...' : ''));
                    
                    // Show the specific changed section if possible
                    const changeIndex = newPrompt.indexOf(processedChange);
                    if (changeIndex !== -1) {
                        const contextStart = Math.max(0, changeIndex - 50);
                        const contextEnd = Math.min(newPrompt.length, changeIndex + processedChange.length + 50);
                        console.log('[Amendment] Changed section with context:', 
                            '...' + newPrompt.substring(contextStart, contextEnd) + '...');
                    }
                } else {
                    console.error('[Amendment] Replacement failed - system prompt unchanged');
                }
                
                console.groupEnd();
                
                // Update the state
                set(state => ({ 
                    settings: {...state.settings, systemPrompt: newPrompt}, 
                    amendmentProposal: null 
                }));
                
                console.log('[Amendment] Amendment processing complete, proposal cleared');
            },
            
            rejectProposal: () => set({ amendmentProposal: null }),
            
            clearSession: async () => {
                // Clear in-memory state first
                set({
                    sessionData: {},
                    currentUrl: null,
                    urlHistory: [],
                    showEnglish: false,
                    feedbackHistory: {},
                    versionFeedback: {},
                    settings: defaultSettings,
                    proxyScores: {},
                    error: null,
                    isDirty: false,
                    amendmentProposal: null,
                });

                // Clear IndexedDB for complete clean slate
                try {
                    console.log('[ClearSession] Wiping IndexedDB...');
                    indexedDBService.close(); // Close connection first
                    
                    // Delete the entire database
                    const deleteRequest = indexedDB.deleteDatabase('lexicon-forge');
                    await new Promise<void>((resolve, reject) => {
                        deleteRequest.onsuccess = () => {
                            console.log('[ClearSession] IndexedDB cleared successfully');
                            resolve();
                        };
                        deleteRequest.onerror = () => {
                            console.error('[ClearSession] Failed to clear IndexedDB:', deleteRequest.error);
                            reject(deleteRequest.error);
                        };
                    });
                } catch (error) {
                    console.error('[ClearSession] Error clearing IndexedDB:', error);
                }
            },
            
            exportSession: () => {
                const { sessionData, settings, urlHistory, feedbackHistory } = get();
                if (Object.keys(sessionData).length === 0) return;

                // Destructure to remove sensitive API keys before exporting
                const { apiKeyGemini, apiKeyOpenAI, apiKeyDeepSeek, ...settingsToExport } = settings;

                const dataToExport = {
                    session_metadata: { 
                        exported_at: new Date().toISOString(), 
                        settings: settingsToExport
                    },
                    urlHistory: urlHistory,
                    chapters: Object.entries(sessionData)
                        .filter(([url, data]) => data?.chapter) // Filter out entries with no chapter data
                        .map(([url, data]) => ({
                        sourceUrl: url,
                        title: data.chapter.title,
                        originalContent: data.chapter.content,
                        nextUrl: data.chapter.nextUrl,
                        prevUrl: data.chapter.prevUrl,
                        translationResult: data.translationResult,
                        feedback: feedbackHistory[url] ?? [],
                    }))
                };
                
                const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(dataToExport, null, 2))}`;
                const link = document.createElement('a');
                link.href = jsonString;
                const now = new Date();
                const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}`;
                link.download = `novel-translator-session_${timestamp}_${Object.keys(sessionData).length}-chapters.json`;
                link.click();
            },

            exportEpub: async () => {
                const { sessionData, settings, urlHistory } = get();
                if (Object.keys(sessionData).length === 0) {
                    throw new Error('No chapters available for EPUB export');
                }

                console.log('[EPUB Export] Starting EPUB generation...');

                // Collect chapters with active versions (last viewed translations)
                const chapters = collectActiveVersions(sessionData, urlHistory);
                
                if (chapters.length === 0) {
                    throw new Error('No translated chapters available for EPUB export');
                }

                console.log(`[EPUB Export] Collected ${chapters.length} chapters for EPUB`);

                // Determine book title from first chapter or use fallback
                const firstChapter = chapters[0];
                const bookTitle = firstChapter.translatedTitle || firstChapter.title || 'Translated Novel';

                const epubOptions: EpubExportOptions = {
                    title: bookTitle,
                    author: 'AI Translation',
                    description: `AI-translated novel containing ${chapters.length} chapters. Translated using ${settings.provider} ${settings.model}.`,
                    chapters,
                    settings
                };

                // Generate and download EPUB
                await generateEpub(epubOptions);
                
                console.log('[EPUB Export] EPUB generation completed successfully');
            },
            
            importSession: (event: React.ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const text = e.target?.result;
                        if (typeof text !== 'string') throw new Error('File content is not text.');
                        
                        const importedData: ImportedSession = JSON.parse(text);
                        
                        // Compatibility check for older session files
                        const sessionMetadata = importedData.session_metadata || importedData.metadata;

                        if (!sessionMetadata || !Array.isArray(importedData.chapters)) {
                            throw new Error('Invalid session file format.');
                        }

                        console.groupCollapsed('[Import] Processing imported session file');

                        set(state => {
                            const newSessionData = { ...state.sessionData };
                            const newFeedbackHistory = { ...state.feedbackHistory };
                            let conflicts = 0;

                            for (const chapter of importedData.chapters) {
                                const rawChapterUrl = chapter.sourceUrl || (chapter as any).url;
                                if (!rawChapterUrl) continue;

                                let sourceUrl: string | null = rawChapterUrl;
                                let nextUrl: string | null = chapter.nextUrl;
                                let prevUrl: string | null = chapter.prevUrl;

                                try {
                                    // Always normalize URLs during import for consistent cache lookups
                                    sourceUrl = normalizeUrl(rawChapterUrl);
                                    nextUrl = normalizeUrl(chapter.nextUrl);
                                    prevUrl = normalizeUrl(chapter.prevUrl);
                                } catch (e) {
                                    console.warn(`[Import] Invalid URL encountered during normalization: ${rawChapterUrl}. Using as-is.`);
                                    // If URL is invalid, use it as-is, and next/prev as-is
                                }
                                
                                if (!sourceUrl) continue; // Should not happen if rawChapterUrl was valid

                                console.log(`[Import Debug] Original URL: ${rawChapterUrl}`);
                                console.log(`[Import Debug] Processed URL: ${sourceUrl} (Normalized: ${sourceUrl !== rawChapterUrl})`);
                                console.log(`[Import Debug] Chapter Number: ${chapter.chapterNumber}`);

                                const chapterExists = !!newSessionData[sourceUrl];
                                if (chapterExists) {
                                    conflicts++;
                                    console.warn(`[Import Debug] Conflict detected for processed URL: ${sourceUrl}. Overwriting existing entry.`);
                                }

                                if (!chapterExists || window.confirm(`A chapter for the URL "${sourceUrl}" already exists. Overwrite your local version with the one from the file?`)) {
                                    newSessionData[sourceUrl] = {
                                        chapter: {
                                            title: chapter.title, 
                                            content: (chapter as any).content || chapter.originalContent, // Compatibility with older formats
                                            originalUrl: sourceUrl,
                                            nextUrl: nextUrl, 
                                            prevUrl: prevUrl,
                                            chapterNumber: chapter.chapterNumber,
                                        },
                                        translationResult: chapter.translationResult ?? null,
                                    };
                                    if (chapter.feedback?.length > 0) newFeedbackHistory[sourceUrl] = chapter.feedback;
                                }
                                console.log(`[Import Debug] newSessionData after processing ${sourceUrl}:`, newSessionData);
                            }

                            console.groupEnd();

                            let newSettings = state.settings;
                            if (sessionMetadata?.settings && window.confirm('Session file contains settings. Do you want to import and apply them?')) {
                                newSettings = { ...state.settings, ...sessionMetadata.settings };
                            }
                            
                            let newUrlHistory = state.urlHistory;
                            if (importedData.urlHistory && window.confirm('Session file contains reading history. Do you want to import it? This will overwrite your current reading path.')) {
                                newUrlHistory = importedData.urlHistory;
                            }
                            
                            alert(`Import complete! ${importedData.chapters.length} chapters processed. ${conflicts} conflicts were handled.`);
                            
                            console.log('[Import] sessionData before import:', state.sessionData);
                            console.log('[Import] newSessionData after import:', newSessionData);

                            return {
                                sessionData: newSessionData,
                                feedbackHistory: newFeedbackHistory,
                                settings: newSettings,
                                urlHistory: newUrlHistory,
                                currentUrl: importedData.chapters.length > 0 ? normalizeUrl((importedData.chapters[importedData.chapters.length - 1].sourceUrl || (importedData.chapters[importedData.chapters.length - 1] as any).url)) : state.currentUrl
                            };
                        });

                    } catch (err: any) {
                        console.error("Failed to import session file:", err);
                        alert(`Error importing file: ${err.message}`);
                    }
                };
                reader.readAsText(file);
                event.target.value = '';
            },

            cancelActiveTranslations: () => {
                const { activeTranslations } = get();
                Object.keys(activeTranslations).forEach(url => {
                    activeTranslations[url].abort();
                    console.log(`[Translation] Cancelled translation for ${url}`);
                });
                set(prev => ({
                    activeTranslations: {},
                    urlLoadingStates: {},
                    isLoading: { ...prev.isLoading, translating: false }
                }));
            },

            isUrlTranslating: (url: string) => {
                const { urlLoadingStates } = get();
                return urlLoadingStates[url] || false;
            },

            hasTranslationSettingsChanged: (url: string) => {
                const { settings, lastTranslationSettings, sessionData } = get();
                const lastSettings = lastTranslationSettings[url];
                const hasTranslation = !!sessionData[url]?.translationResult;
                
                // If there's a translation but no recorded last settings, assume settings changed
                if (!lastSettings && hasTranslation) return true;
                
                // If no last settings and no translation, no change
                if (!lastSettings) return false;
                
                return (
                    lastSettings.provider !== settings.provider ||
                    lastSettings.model !== settings.model ||
                    lastSettings.temperature !== settings.temperature
                );
            },

            shouldEnableRetranslation: (url: string) => {
                const { sessionData, isDirty } = get();
                const urlData = findSessionDataByUrl(sessionData, url);
                const translationExists = !!urlData?.translationResult;
                const settingsChanged = get().hasTranslationSettingsChanged(url);
                const isTranslating = get().isUrlTranslating(url);
                
                return translationExists && !isTranslating && (isDirty || settingsChanged);
            },

            getSessionDataByUrl: (url: string) => {
                const { sessionData } = get();
                return findSessionDataByUrl(sessionData, url);
            },

                        handleGenerateImages: async (url: string) => {
                console.log(`%c[ImageGen] ⚡ FUNCTION CALLED - Starting image generation for ${url}`, 'color: #00ff00; font-weight: bold; font-size: 14px;');
                const { sessionData, settings } = get();
                
                // DIAGNOSTIC LOGGING - Let's see what's actually happening
                const urlSessionData = findSessionDataByUrl(sessionData, url);
                console.log(`[ImageGen Debug] Session data exists for URL: ${!!urlSessionData}`);
                console.log(`[ImageGen Debug] Session data keys: ${Object.keys(sessionData)}`);
                
                const translationResult = urlSessionData?.translationResult;
                console.log(`[ImageGen Debug] Translation result exists: ${!!translationResult}`);
                console.log(`[ImageGen Debug] Translation result type: ${typeof translationResult}`);
                
                if (translationResult) {
                    console.log(`[ImageGen Debug] Translation result keys: ${Object.keys(translationResult)}`);
                    console.log(`[ImageGen Debug] suggestedIllustrations exists: ${!!translationResult.suggestedIllustrations}`);
                    console.log(`[ImageGen Debug] suggestedIllustrations type: ${typeof translationResult.suggestedIllustrations}`);
                    console.log(`[ImageGen Debug] suggestedIllustrations length: ${translationResult.suggestedIllustrations?.length || 'undefined'}`);
                    
                    if (translationResult.suggestedIllustrations) {
                        console.log(`[ImageGen Debug] Illustration details:`, translationResult.suggestedIllustrations);
                    }
                } else {
                    console.log(`[ImageGen Debug] Translation result is null/undefined`);
                    console.log(`[ImageGen Debug] Full session data for URL:`, urlSessionData);
                }

                if (!translationResult || !translationResult.suggestedIllustrations || translationResult.suggestedIllustrations.length === 0) {
                    console.warn('[ImageGen] No illustrations suggested for this chapter.');
                    console.log(`[ImageGen Debug] Reason: translationResult=${!!translationResult}, suggestedIllustrations=${!!translationResult?.suggestedIllustrations}, length=${translationResult?.suggestedIllustrations?.length}`);
                    return;
                }

                // Reset metrics and set initial loading state
                set(state => {
                    const initialImageStates: Record<string, { isLoading: boolean; data: string | null; error: string | null; imagePrompt: string; }> = {};
                    translationResult.suggestedIllustrations.forEach(illust => {
                        initialImageStates[illust.placementMarker] = { isLoading: true, data: null, error: null, imagePrompt: illust.imagePrompt };
                    });
                    return {
                        imageGenerationMetrics: null,
                        generatedImages: { ...state.generatedImages, ...initialImageStates }
                    };
                });

                let totalTime = 0;
                let totalCost = 0;
                let generatedCount = 0;

                // Sequentially generate images to avoid overwhelming the API
                for (const illust of translationResult.suggestedIllustrations) {
                    try {
                        console.log(`[ImageGen] Generating image for marker: ${illust.placementMarker}`);
                        const result = await generateImage(illust.imagePrompt, settings);
                        totalTime += result.requestTime;
                        totalCost += result.cost;
                        generatedCount++;

                        set(state => {
                            // Update generatedImages state
                            const newGeneratedImages = {
                                ...state.generatedImages,
                                [illust.placementMarker]: { isLoading: false, data: result.imageData, error: null, imagePrompt: illust.imagePrompt },
                            };

                            // Update translationResult in sessionData for persistence
                            const currentSessionData = state.sessionData[url];
                            if (currentSessionData && currentSessionData.translationResult) {
                                const newSuggestedIllustrations = currentSessionData.translationResult.suggestedIllustrations?.map(si => {
                                    if (si.placementMarker === illust.placementMarker) {
                                        return { ...si, url: result.imageData }; // Add the generated image data
                                    }
                                    return si;
                                });
                                const newTranslationResult = {
                                    ...currentSessionData.translationResult,
                                    suggestedIllustrations: newSuggestedIllustrations,
                                };
                                return {
                                    generatedImages: newGeneratedImages,
                                    sessionData: {
                                        ...state.sessionData,
                                        [url]: {
                                            ...currentSessionData,
                                            translationResult: newTranslationResult,
                                        },
                                    },
                                };
                            }
                            return { generatedImages: newGeneratedImages }; // Fallback if translationResult not found
                        });
                        console.log(`[ImageGen] Successfully generated and stored image for ${illust.placementMarker}`);
                    } catch (error: any) {
                        console.error(`[ImageGen] Failed to generate image for ${illust.placementMarker}:`, error);
                        set(state => ({
                            generatedImages: {
                                ...state.generatedImages,
                                [illust.placementMarker]: { isLoading: false, data: null, error: error.message, imagePrompt: illust.imagePrompt },
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
                    }
                });
                console.log(`[ImageGen] Finished generation. Total time: ${totalTime.toFixed(2)}s, Total cost: ${totalCost.toFixed(5)}`);
            },

            // Retry failed image generation
            retryFailedImages: async (url: string) => {
                console.log(`[ImageGen] Retrying failed image generation for ${url}`);
                const { sessionData, settings, generatedImages } = get();
                const translationResult = sessionData[url]?.translationResult;

                if (!translationResult || !translationResult.suggestedIllustrations) {
                    console.warn('[ImageGen] No illustrations to retry for this chapter.');
                    return;
                }

                // Find failed images
                const failedImages = translationResult.suggestedIllustrations.filter(illust => {
                    const imageState = generatedImages[illust.placementMarker];
                    return imageState && imageState.error && !imageState.data;
                });

                if (failedImages.length === 0) {
                    console.log('[ImageGen] No failed images to retry.');
                    return;
                }

                console.log(`[ImageGen] Found ${failedImages.length} failed images to retry`);

                // Reset failed images to loading state
                set(state => {
                    const updatedImageStates: Record<string, { isLoading: boolean; data: string | null; error: string | null; }> = {};
                    failedImages.forEach(illust => {
                        updatedImageStates[illust.placementMarker] = { isLoading: true, data: null, error: null };
                    });
                    return {
                        generatedImages: { ...state.generatedImages, ...updatedImageStates }
                    };
                });

                // Retry generation for failed images
                for (const illust of failedImages) {
                    try {
                        console.log(`[ImageGen] Retrying image for marker: ${illust.placementMarker}`);
                        const result = await generateImage(illust.imagePrompt, settings);

                        set(state => {
                            // Update generatedImages state
                            const newGeneratedImages = {
                                ...state.generatedImages,
                                [illust.placementMarker]: { isLoading: false, data: result.imageData, error: null, imagePrompt: illust.imagePrompt },
                            };

                            // Update translationResult in sessionData for persistence
                            const currentSessionData = state.sessionData[url];
                            if (currentSessionData && currentSessionData.translationResult) {
                                const newSuggestedIllustrations = currentSessionData.translationResult.suggestedIllustrations?.map(si => {
                                    if (si.placementMarker === illust.placementMarker) {
                                        return { ...si, url: result.imageData }; // Add the generated image data
                                    } 
                                    return si;
                                });
                                const newTranslationResult = {
                                    ...currentSessionData.translationResult,
                                    suggestedIllustrations: newSuggestedIllustrations,
                                };
                                return {
                                    generatedImages: newGeneratedImages,
                                    sessionData: {
                                        ...state.sessionData,
                                        [url]: {
                                            ...currentSessionData,
                                            translationResult: newTranslationResult,
                                        },
                                    },
                                };
                            }
                            return { generatedImages: newGeneratedImages }; // Fallback if translationResult not found
                        });
                        console.log(`[ImageGen] Successfully retried and stored image for ${illust.placementMarker}`);
                    } catch (error: any) {
                        console.error(`[ImageGen] Retry failed for ${illust.placementMarker}:`, error);
                        set(state => ({
                            generatedImages: {
                                ...state.generatedImages,
                                [illust.placementMarker]: { isLoading: false, data: null, error: error.message, imagePrompt: illust.imagePrompt },
                            }
                        }));
                    }
                }
            },

            // Version management methods
            initializeIndexedDB: async () => {
                try {
                    await indexedDBService.init();
                    console.log('[IndexedDB] Initialized successfully');
                    
                    // Try to migrate from localStorage
                    try {
                        await migrateFromLocalStorage();
                        console.log('[Migration] Successfully migrated from localStorage');
                    } catch (error) {
                        console.log('[Migration] No localStorage data to migrate or migration failed:', error);
                    }
                    
                    // Load prompt templates or create default one
                    await get().loadPromptTemplates();
                    
                    const { promptTemplates, settings } = get();
                    if (promptTemplates.length === 0) {
                        // Create default template from current system prompt
                        console.log('[PromptTemplates] Creating default template from current system prompt');
                        await get().createPromptTemplate(
                            'Default',
                            settings.systemPrompt,
                            'Default system prompt for translations'
                        );
                    }
                } catch (error) {
                    console.error('[IndexedDB] Initialization failed:', error);
                }
            },

            loadTranslationVersions: async (url: string) => {
                try {
                    const versions = await indexedDBService.getTranslationVersions(url);
                    const activeTranslation = await indexedDBService.getActiveTranslation(url);
                    
                    set(state => ({
                        sessionData: {
                            ...state.sessionData,
                            [url]: {
                                ...state.sessionData[url],
                                availableVersions: versions,
                                activeVersion: activeTranslation?.version
                            }
                        }
                    }));
                    
                    console.log(`[Versions] Loaded ${versions.length} versions for ${url}`);
                } catch (error) {
                    console.error('[Versions] Failed to load versions:', error);
                }
            },

            switchTranslationVersion: async (url: string, version: number) => {
                try {
                    await indexedDBService.setActiveTranslation(url, version);
                    const activeTranslation = await indexedDBService.getActiveTranslation(url);
                    
                    if (activeTranslation) {
                        // Convert IndexedDB record back to TranslationResult format
                        const translationResult: TranslationResult = {
                            translatedTitle: activeTranslation.translatedTitle,
                            translation: activeTranslation.translation,
                            footnotes: activeTranslation.footnotes,
                            suggestedIllustrations: activeTranslation.suggestedIllustrations,
                            usageMetrics: {
                                totalTokens: activeTranslation.totalTokens,
                                promptTokens: activeTranslation.promptTokens,
                                completionTokens: activeTranslation.completionTokens,
                                estimatedCost: activeTranslation.estimatedCost,
                                requestTime: activeTranslation.requestTime,
                                provider: activeTranslation.provider,
                                model: activeTranslation.model
                            },
                            proposal: activeTranslation.proposal
                        };
                        
                        set(state => ({
                            sessionData: {
                                ...state.sessionData,
                                [url]: {
                                    ...state.sessionData[url],
                                    translationResult,
                                    activeVersion: version
                                }
                            }
                        }));
                        
                        console.log(`[Versions] Switched to version ${version} for ${url}`);
                    }
                } catch (error) {
                    console.error('[Versions] Failed to switch version:', error);
                }
            },

            deleteTranslationVersion: async (url: string, version: number) => {
                try {
                    const versions = await indexedDBService.getTranslationVersions(url);
                    const versionToDelete = versions.find(v => v.version === version);
                    
                    if (versionToDelete) {
                        await indexedDBService.deleteTranslationVersion(versionToDelete.id);
                        
                        // Reload versions
                        await get().loadTranslationVersions(url);
                        
                        console.log(`[Versions] Deleted version ${version} for ${url}`);
                    }
                } catch (error) {
                    console.error('[Versions] Failed to delete version:', error);
                }
            },

            // Prompt template management methods
            loadPromptTemplates: async () => {
                try {
                    const templates = await indexedDBService.getPromptTemplates();
                    const defaultTemplate = await indexedDBService.getDefaultPromptTemplate();
                    
                    set({
                        promptTemplates: templates,
                        activePromptTemplate: defaultTemplate
                    });
                    
                    console.log(`[PromptTemplates] Loaded ${templates.length} templates`);
                } catch (error) {
                    console.error('[PromptTemplates] Failed to load templates:', error);
                }
            },

            createPromptTemplate: async (name: string, content: string, description?: string) => {
                try {
                    const { promptTemplates } = get();
                    const isFirstTemplate = promptTemplates.length === 0;
                    
                    const template: PromptTemplate = {
                        id: crypto.randomUUID(),
                        name,
                        content,
                        description,
                        isDefault: isFirstTemplate, // First template becomes default
                        createdAt: new Date().toISOString(),
                        lastUsed: isFirstTemplate ? new Date().toISOString() : undefined
                    };
                    
                    await indexedDBService.storePromptTemplate(template);
                    await get().loadPromptTemplates();
                    
                    console.log(`[PromptTemplates] Created template: ${name}`);
                } catch (error) {
                    console.error('[PromptTemplates] Failed to create template:', error);
                }
            },

            updatePromptTemplate: async (template: PromptTemplate) => {
                try {
                    await indexedDBService.storePromptTemplate(template);
                    await get().loadPromptTemplates();
                    
                    console.log(`[PromptTemplates] Updated template: ${template.name}`);
                } catch (error) {
                    console.error('[PromptTemplates] Failed to update template:', error);
                }
            },

            deletePromptTemplate: async (id: string) => {
                try {
                    const { activePromptTemplate, promptTemplates } = get();
                    
                    // Don't delete the active template if it's the only one
                    if (promptTemplates.length <= 1) {
                        console.warn('[PromptTemplates] Cannot delete the only template');
                        return;
                    }
                    
                    await indexedDBService.deletePromptTemplate(id);
                    
                    // If we deleted the active template, switch to another one
                    if (activePromptTemplate?.id === id) {
                        const remainingTemplates = promptTemplates.filter(t => t.id !== id);
                        if (remainingTemplates.length > 0) {
                            await get().setActivePromptTemplate(remainingTemplates[0].id);
                        }
                    } else {
                        await get().loadPromptTemplates();
                    }
                    
                    console.log(`[PromptTemplates] Deleted template: ${id}`);
                } catch (error) {
                    console.error('[PromptTemplates] Failed to delete template:', error);
                }
            },

            setActivePromptTemplate: async (id: string) => {
                try {
                    const template = await indexedDBService.getPromptTemplate(id);
                    if (template) {
                        // Update lastUsed timestamp
                        template.lastUsed = new Date().toISOString();
                        await indexedDBService.storePromptTemplate(template);
                        
                        // Set as default and update settings
                        await indexedDBService.setDefaultPromptTemplate(id);
                        
                        set(state => ({
                            activePromptTemplate: template,
                            settings: {
                                ...state.settings,
                                systemPrompt: template.content,
                                activePromptId: id
                            }
                        }));
                        
                        await get().loadPromptTemplates();
                        
                        console.log(`[PromptTemplates] Set active template: ${template.name}`);
                    }
                } catch (error) {
                    console.error('[PromptTemplates] Failed to set active template:', error);
                }
            },
        }),
        persistOptions
    )
);

export default useAppStore;