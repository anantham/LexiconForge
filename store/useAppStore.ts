
import { create } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { Chapter, FeedbackItem, AmendmentProposal, TranslationResult, AppSettings, HistoricalChapter, ImportedSession, TranslationProvider } from '../types';
import { INITIAL_SYSTEM_PROMPT } from '../constants';
import { translateChapter } from '../services/aiService';
import { fetchAndParseUrl } from '../services/adapters';
import { indexedDBService, TranslationRecord, migrateFromLocalStorage } from '../services/indexeddb';

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
    cancelActiveTranslations: () => void;
    isUrlTranslating: (url: string) => boolean;
    hasTranslationSettingsChanged: (url: string) => boolean;
    shouldEnableRetranslation: (url: string) => boolean;
    // Version management
    loadTranslationVersions: (url: string) => Promise<void>;
    switchTranslationVersion: (url: string, version: number) => Promise<void>;
    deleteTranslationVersion: (url: string, version: number) => Promise<void>;
    initializeIndexedDB: () => Promise<void>;
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
            
            // --- ACTIONS ---
            
            handleFetch: async (fetchUrl, isSilent = false) => {
                const { sessionData, proxyScores, updateProxyScore } = get();
                if (!isSilent) {
                    console.groupCollapsed(`[App] handleFetch triggered for: ${fetchUrl}`);
                    set({ error: null, currentUrl: fetchUrl, isDirty: false });
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
                    
                    set(state => ({
                        sessionData: {
                            ...state.sessionData,
                            [fetchUrl]: { chapter: chapterData, translationResult: null },
                        },
                        urlHistory: state.urlHistory.includes(fetchUrl) ? state.urlHistory : [...state.urlHistory, fetchUrl]
                    }));

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
                    
                    // Check if translation was cancelled
                    if (abortController.signal.aborted) {
                        console.log(`[Translation] Translation for ${urlToTranslate} was cancelled`);
                        return;
                    }

                    // Store translation as new version in IndexedDB
                    try {
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
                        
                        await indexedDBService.storeTranslation(urlToTranslate, result, {
                            provider: settings.provider,
                            model: settings.model,
                            temperature: settings.temperature,
                            systemPrompt: settings.systemPrompt
                        });
                        
                        // Reload versions to update UI
                        await get().loadTranslationVersions(urlToTranslate);
                        
                        console.log(`[Translation] Stored new version for ${urlToTranslate}`);
                    } catch (error) {
                        console.error('[Translation] Failed to store in IndexedDB:', error);
                        // Fallback to in-memory storage
                    }

                    set(state => ({
                        sessionData: {
                            ...state.sessionData,
                            [urlToTranslate]: { ...state.sessionData[urlToTranslate], translationResult: result },
                        },
                        amendmentProposal: (result.proposal && !isSilent) ? result.proposal : state.amendmentProposal,
                        lastTranslationSettings: {
                            ...state.lastTranslationSettings,
                            [urlToTranslate]: {
                                provider: settings.provider,
                                model: settings.model,
                                temperature: settings.temperature
                            }
                        }
                    }));
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

            handleNavigate: (newUrl: string) => get().handleFetch(newUrl),

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
            
            clearSession: () => {
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
            
            importSession: (event: React.ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const text = e.target?.result;
                        if (typeof text !== 'string') throw new Error('File content is not text.');
                        
                        const importedData: ImportedSession = JSON.parse(text);
                        if (!importedData.session_metadata || !Array.isArray(importedData.chapters)) {
                            throw new Error('Invalid session file format.');
                        }

                        set(state => {
                            const newSessionData = { ...state.sessionData };
                            const newFeedbackHistory = { ...state.feedbackHistory };
                            let conflicts = 0;

                            for (const chapter of importedData.chapters) {
                                if (!chapter.sourceUrl) continue;
                                const chapterExists = !!newSessionData[chapter.sourceUrl];
                                if (chapterExists) conflicts++;

                                if (!chapterExists || window.confirm(`A chapter for the URL "${chapter.sourceUrl}" already exists. Overwrite your local version with the one from the file?`)) {
                                    newSessionData[chapter.sourceUrl] = {
                                        chapter: {
                                            title: chapter.title, 
                                            content: chapter.originalContent, 
                                            originalUrl: chapter.sourceUrl,
                                            nextUrl: chapter.nextUrl, 
                                            prevUrl: chapter.prevUrl,
                                        },
                                        translationResult: chapter.translationResult ?? null,
                                    };
                                    if (chapter.feedback?.length > 0) newFeedbackHistory[chapter.sourceUrl] = chapter.feedback;
                                }
                            }

                            let newSettings = state.settings;
                            if (importedData.session_metadata.settings && window.confirm('Session file contains settings. Do you want to import and apply them?')) {
                                newSettings = { ...state.settings, ...importedData.session_metadata.settings };
                            }
                            
                            let newUrlHistory = state.urlHistory;
                            if (importedData.urlHistory && window.confirm('Session file contains reading history. Do you want to import it? This will overwrite your current reading path.')) {
                                newUrlHistory = importedData.urlHistory;
                            }
                            
                            alert(`Import complete! ${importedData.chapters.length} chapters processed. ${conflicts} conflicts were handled.`);
                            
                            return {
                                sessionData: newSessionData,
                                feedbackHistory: newFeedbackHistory,
                                settings: newSettings,
                                urlHistory: newUrlHistory,
                                currentUrl: importedData.chapters.length > 0 ? importedData.chapters[importedData.chapters.length - 1].sourceUrl : state.currentUrl
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
                const translationExists = !!sessionData[url]?.translationResult;
                const settingsChanged = get().hasTranslationSettingsChanged(url);
                const isTranslating = get().isUrlTranslating(url);
                
                return translationExists && !isTranslating && (isDirty || settingsChanged);
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
        }),
        persistOptions
    )
);

export default useAppStore;