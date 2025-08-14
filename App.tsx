import React, { useEffect } from 'react';
import useAppStore from './store/useAppStore';
import InputBar from './components/InputBar';
import ChapterView from './components/ChapterView';
import AmendmentModal from './components/AmendmentModal';
import SessionInfo from './components/SessionInfo';
import SettingsModal from './components/SettingsModal';

import { validateApiKey } from './services/aiService';
import { Analytics } from '@vercel/analytics/react';

const App: React.FC = () => {
// inside App component, near the top
// Individual primitive selectors to avoid fresh object creation
const currentUrl = useAppStore((s) => s.currentUrl);
const showEnglish = useAppStore((s) => s.showEnglish);
const isLoading = useAppStore((s) => s.isLoading);
const settings = useAppStore((s) => s.settings);
const sessionData = useAppStore((s) => s.sessionData);
const isUrlTranslating = useAppStore((s) => s.isUrlTranslating);
const handleTranslate = useAppStore((s) => s.handleTranslate);
const handleFetch = useAppStore((s) => s.handleFetch);
const amendmentProposal = useAppStore((s) => s.amendmentProposal);
const acceptProposal = useAppStore((s) => s.acceptProposal);
const rejectProposal = useAppStore((s) => s.rejectProposal);
const showSettingsModal = useAppStore((s) => s.showSettingsModal);
const setShowSettingsModal = useAppStore((s) => s.setShowSettingsModal);
const initializeIndexedDB = useAppStore((s) => s.initializeIndexedDB);

// Separate leaf selector for translation result (returns primitive/null)
const currentChapterTranslationResult = useAppStore((state) => {
  const url = state.currentUrl;
  return url ? state.sessionData[url]?.translationResult : null;
});

// one-shot guard helpers
const requestedRef = React.useRef(new Map<string, string>());

const settingsFingerprint = React.useMemo(
  () =>
    JSON.stringify({
      provider: settings.provider,
      model: settings.model,
      temperature: settings.temperature,
    }),
  [settings.provider, settings.model, settings.temperature]
);

// Debug logging (moved to avoid infinite loop from separate selector)
React.useEffect(() => {
  console.log(
    `%c[App.tsx Selector] currentUrl: ${currentUrl}, chapterData exists: ${!!(currentUrl && sessionData[currentUrl])}, translationResult: ${currentChapterTranslationResult ? 'EXISTS' : 'NULL'}`,
    'color: purple;'
  );
}, [currentUrl, sessionData, currentChapterTranslationResult]);

    // Initialize IndexedDB on app start (one-shot)
    const didInitDB = React.useRef(false);
    useEffect(() => {
        if (didInitDB.current) return;
        didInitDB.current = true;

        console.log('[App.tsx] Initializing IndexedDB…');
        const initPromise = initializeIndexedDB();
        if (initPromise && typeof initPromise.then === 'function') {
            initPromise.then(() => {
                console.log('[App.tsx] IndexedDB init complete');
            }).catch((e) => {
                console.error('[App.tsx] IndexedDB init failed', e);
            });
        }
    }, [initializeIndexedDB]);

    // Main translation trigger effect remains here to orchestrate store actions
    useEffect(() => {
      if (!showEnglish || !currentUrl) return;

      const translating = isUrlTranslating(currentUrl) || isLoading.translating;
      const hasResult  = !!currentChapterTranslationResult;
      const prevSig    = requestedRef.current.get(currentUrl);
      const alreadyRequested = prevSig === settingsFingerprint;

      console.log(
        `%c[App.tsx useEffect] RE-EVALUATING (guarded). showEnglish=${showEnglish}, url=${currentUrl}, hasResult=${hasResult}, translating=${translating}, alreadyRequested=${alreadyRequested}`,
        'color: blue;'
      );

      if (!hasResult && !translating && !alreadyRequested) {
        requestedRef.current.set(currentUrl, settingsFingerprint);
        console.log('%c[App.tsx useEffect] Triggering handleTranslate (one-shot)', 'color: red; font-weight: bold;');
        handleTranslate(currentUrl);
      }
    }, [
      showEnglish,
      currentUrl,
      currentChapterTranslationResult,
      settingsFingerprint,
      isLoading.translating,
      isUrlTranslating,
      handleTranslate,
    ]);

    // And clear the one-shot once a result lands (or when leaving English):
    useEffect(() => {
      if (currentUrl && currentChapterTranslationResult) {
        requestedRef.current.delete(currentUrl);
      }
    }, [currentUrl, currentChapterTranslationResult]);

    useEffect(() => {
      if (!showEnglish && currentUrl) {
        requestedRef.current.delete(currentUrl);
      }
    }, [showEnglish, currentUrl]);

    // Sanity check: selector subscription (optional but nice)
    useEffect(() => {
      const unsub = useAppStore.subscribe(
        (s) => (s.currentUrl ? s.sessionData[s.currentUrl]?.translationResult : null),
        (next, prev) => {
          console.log('[subscribe] translationResult changed:', { prev, next });
        }
      );
      return unsub;
    }, []);

    // Proactive Cache Worker effect also remains to orchestrate silent fetches/translations
    useEffect(() => {
        if (!currentUrl || settings.preloadCount === 0) return;

        const worker = async () => {
            const currentSessionData = useAppStore.getState().sessionData;
            let nextUrlToPreload = currentSessionData[currentUrl]?.chapter.nextUrl;
            
            for (let i = 0; i < settings.preloadCount && nextUrlToPreload; i++) {
                const url = nextUrlToPreload;
                const latestSessionData = useAppStore.getState().sessionData;

                // Check if URL is already being translated
                if (useAppStore.getState().isUrlTranslating(url)) {
                    console.log(`[Worker] Skipping ${url} - translation in progress`);
                    nextUrlToPreload = latestSessionData[url]?.chapter.nextUrl;
                    continue;
                }

                // Check if we have a translation with current settings
                const hasCurrentTranslation = latestSessionData[url]?.translationResult && 
                    !useAppStore.getState().hasTranslationSettingsChanged(url);
                
                if (hasCurrentTranslation) {
                    console.log(`[Worker] Skipping ${url} - already translated with current settings`);
                    nextUrlToPreload = latestSessionData[url]?.chapter.nextUrl;
                    continue;
                }
                
                const chapter = latestSessionData[url]?.chapter || await handleFetch(url, true);

                if (!chapter) {
                    console.warn(`[Worker] Halting preload chain due to fetch failure for: ${url}`);
                    break;
                }
                
                // Final check before translating - settings might have changed during fetch
                const finalCheck = useAppStore.getState();
                const stillNeedsTranslation = !finalCheck.sessionData[url]?.translationResult || 
                    finalCheck.hasTranslationSettingsChanged(url);
                
                if (stillNeedsTranslation && !finalCheck.isUrlTranslating(url)) {
                    // Check API key before attempting translation
                    const apiValidation = validateApiKey(finalCheck.settings);
                    if (!apiValidation.isValid) {
                        console.warn(`[Worker] Skipping preload translation for ${url} - API key missing: ${apiValidation.errorMessage}`);
                        break; // Stop the preload chain when API key is missing
                    }
                    
                    console.log(`[Worker] Pre-translating chapter: ${url}`);
                    await handleTranslate(url, true);
                } else {
                    console.log(`[Worker] Skipping ${url} - conditions changed during fetch`);
                }

                nextUrlToPreload = chapter?.nextUrl || null;
            }
        };
        
        const timeoutId = setTimeout(worker, 1500);
        return () => clearTimeout(timeoutId);

    }, [currentUrl, settings.preloadCount, settings.provider, settings.model, settings.temperature, handleFetch, handleTranslate]);
    
    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans p-4 sm:p-6">
            <main className="container mx-auto">
                <header className="text-center mb-6">
                    <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 dark:text-white">Collaborative Novel Translator</h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">Read web novels with AI-powered, user-refined translations.</p>
                </header>
                <InputBar />
                <SessionInfo />
                <ChapterView />
                <SettingsModal
                  isOpen={showSettingsModal}
                  onClose={() => setShowSettingsModal(false)}
                />
                {amendmentProposal && (
                    <AmendmentModal
                        proposal={amendmentProposal}
                        onAccept={acceptProposal}
                        onReject={rejectProposal}
                    />
                )}
            </main>
            <Analytics />
        </div>
    );
};

export default App;