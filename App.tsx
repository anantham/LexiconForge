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
const currentChapterId = useAppStore((s) => s.currentChapterId);
const showEnglish = useAppStore((s) => s.showEnglish);
const isLoading = useAppStore((s) => s.isLoading);
const settings = useAppStore((s) => s.settings);
const isChapterTranslating = useAppStore((s) => s.isChapterTranslating);
const handleTranslate = useAppStore((s) => s.handleTranslate);
const handleFetch = useAppStore((s) => s.handleFetch);
const amendmentProposal = useAppStore((s) => s.amendmentProposal);
const acceptProposal = useAppStore((s) => s.acceptProposal);
const rejectProposal = useAppStore((s) => s.rejectProposal);
const showSettingsModal = useAppStore((s) => s.showSettingsModal);
const setShowSettingsModal = useAppStore((s) => s.setShowSettingsModal);
const loadPromptTemplates = useAppStore((s) => s.loadPromptTemplates);
const getChapterById = useAppStore((s) => s.getChapterById);
const hydrateIndicesOnBoot = useAppStore((s) => s.hydrateIndicesOnBoot);

// Separate leaf selector for translation result (returns primitive/null)
const currentChapterTranslationResult = useAppStore((state) => {
  const id = state.currentChapterId;
  const ch = id ? state.getChapterById(id) : null;
  return ch?.translationResult || null;
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


    // IndexedDB initializes automatically when first accessed

    // Load prompt templates on app startup
    useEffect(() => {
        loadPromptTemplates();
    }, [loadPromptTemplates]);

    // Boot-time index-only hydration (Option C)
    useEffect(() => {
      hydrateIndicesOnBoot();
    }, [hydrateIndicesOnBoot]);

    // Main translation trigger effect remains here to orchestrate store actions
    useEffect(() => {
      if (!showEnglish || !currentChapterId) return;

      const translating = isChapterTranslating(currentChapterId) || isLoading.translating;
      const hasResult  = !!currentChapterTranslationResult;
      const prevSig    = requestedRef.current.get(currentChapterId);
      const alreadyRequested = prevSig === settingsFingerprint;

      // console.log(`[UI Debug] Translation trigger check for ${currentUrl}:`);
      // console.log(`[UI Debug] - isUrlTranslating(${currentUrl}): ${isUrlTranslating(currentUrl)}`);
      // console.log(`[UI Debug] - isLoading.translating: ${isLoading.translating}`);
      // console.log(`[UI Debug] - translating (combined): ${translating}`);
      // console.log(`[UI Debug] - hasResult: ${hasResult}`);
      // console.log(`[UI Debug] - alreadyRequested: ${alreadyRequested}`);

      if (!hasResult && !translating && !alreadyRequested) {
        requestedRef.current.set(currentChapterId, settingsFingerprint);
        handleTranslate(currentChapterId);
      } else {
        // console.log(`[UI Debug] NOT triggering handleTranslate - conditions not met`);
      }
    }, [
      showEnglish,
      currentChapterId,
      currentChapterTranslationResult,
      settingsFingerprint,
      isLoading.translating,
      isChapterTranslating,
      handleTranslate,
    ]);

    // And clear the one-shot once a result lands (or when leaving English):
    useEffect(() => {
      if (currentChapterId && currentChapterTranslationResult) {
        requestedRef.current.delete(currentChapterId);
      }
    }, [currentChapterId, currentChapterTranslationResult]);

    useEffect(() => {
      if (!showEnglish && currentChapterId) {
        requestedRef.current.delete(currentChapterId);
      }
    }, [showEnglish, currentChapterId]);

    // Sanity check: selector subscription (optional but nice)
    // Optional subscription for debugging
    // useEffect(() => {
    //   const unsub = useAppStore.subscribe(
    //     (s) => (s.currentChapterId ? s.getChapterById(s.currentChapterId)?.translationResult : null),
    //     (next, prev) => {
    //       console.log('[subscribe] translationResult changed:', { prev, next });
    //     }
    //   );
    //   return unsub;
    // }, []);

    // Proactive Cache Worker effect also remains to orchestrate silent fetches/translations
    useEffect(() => {
      if (!currentChapterId || settings.preloadCount === 0) return;

      const worker = async () => {
        const state = useAppStore.getState();
        let nextUrlToPreload = state.chapters.get(currentChapterId)?.nextUrl || null;

        for (let i = 0; i < settings.preloadCount && nextUrlToPreload; i++) {
          const url = nextUrlToPreload;
          let s = useAppStore.getState();
          // Resolve chapterId via indices (try raw first, then canonical index)
          let nextChapterId = s.rawUrlIndex.get(url) || s.urlIndex.get(url) || '';

          if (!nextChapterId) {
            // Fetch if unknown
            await handleFetch(url);
            s = useAppStore.getState();
            nextChapterId = s.rawUrlIndex.get(url) || s.urlIndex.get(url) || '';
          }

          if (!nextChapterId) {
            console.warn(`[Worker] Could not resolve chapterId for ${url}`);
            break;
          }

          // Skip if translating
          if (s.isChapterTranslating(nextChapterId)) {
            console.log(`[Worker] Skipping ${url} - translation in progress`);
            nextUrlToPreload = s.chapters.get(nextChapterId)?.nextUrl || null;
            continue;
          }

          const ch = s.chapters.get(nextChapterId);
          const hasCurrentTranslation = !!ch?.translationResult && !s.hasTranslationSettingsChanged(nextChapterId);
          if (hasCurrentTranslation) {
            nextUrlToPreload = ch?.nextUrl || null;
            continue;
          }

          const apiValidation = validateApiKey(s.settings);
          if (!apiValidation.isValid) {
            console.warn(`[Worker] Stopping preload - API key missing: ${apiValidation.errorMessage}`);
            break;
          }

          console.log(`[Worker] Pre-translating chapter: ${url}`);
          await handleTranslate(nextChapterId);
          s = useAppStore.getState();
          nextUrlToPreload = s.chapters.get(nextChapterId)?.nextUrl || null;
        }
      };

      const timeoutId = setTimeout(worker, 1500);
      return () => clearTimeout(timeoutId);

    }, [currentChapterId, settings.preloadCount, settings.provider, settings.model, settings.temperature, handleFetch, handleTranslate]);
    
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
