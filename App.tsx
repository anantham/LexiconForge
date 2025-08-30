import React, { useEffect } from 'react';
import { useAppStore } from './store';
import InputBar from './components/InputBar';
import ChapterView from './components/ChapterView';
import AmendmentModal from './components/AmendmentModal';
import SessionInfo from './components/SessionInfo';
import SettingsModal from './components/SettingsModal';
import Loader from './components/Loader';

import { validateApiKey } from './services/aiService';
import { Analytics } from '@vercel/analytics/react';

const App: React.FC = () => {
// Browser-side env diagnostics (masked) when LF_AI_DEBUG=1
useEffect(() => {
  try {
    const debug = typeof localStorage !== 'undefined' && localStorage.getItem('LF_AI_DEBUG') === '1';
    if (!debug) return;
    const mask = (k: any) => {
      if (!k || typeof k !== 'string') return String(k ?? '');
      return '*'.repeat(Math.max(0, k.length - 4)) + k.slice(-4);
    };
    // console.log('[Env Diagnostic] Keys (masked):', {
    //   GEMINI_API_KEY: mask((process as any).env?.GEMINI_API_KEY),
    //   OPENAI_API_KEY: mask((process as any).env?.OPENAI_API_KEY),
    //   DEEPSEEK_API_KEY: mask((process as any).env?.DEEPSEEK_API_KEY),
    //   CLAUDE_API_KEY: mask((process as any).env?.CLAUDE_API_KEY),
    //   OPENROUTER_API_KEY: mask((process as any).env?.OPENROUTER_API_KEY),
    // });
  } catch {}
}, []);
// inside App component, near the top
// Individual primitive selectors to avoid fresh object creation
const currentChapterId = useAppStore((s) => s.currentChapterId);
const viewMode = useAppStore((s) => s.viewMode);
const isLoading = useAppStore((s) => s.isLoading);
const settings = useAppStore((s) => s.settings);
const isTranslationActive = useAppStore((s) => s.isTranslationActive);
const handleTranslate = useAppStore((s) => s.handleTranslate);
const handleFetch = useAppStore((s) => s.handleFetch);
const amendmentProposal = useAppStore((s) => s.amendmentProposal);
const acceptProposal = useAppStore((s) => s.acceptProposal);
const rejectProposal = useAppStore((s) => s.rejectProposal);
const showSettingsModal = useAppStore((s) => s.showSettingsModal);
const setShowSettingsModal = useAppStore((s) => s.setShowSettingsModal);
const loadPromptTemplates = useAppStore((s) => s.loadPromptTemplates);
const getChapter = useAppStore((s) => s.getChapter);
const hasTranslationSettingsChanged = useAppStore((s) => s.hasTranslationSettingsChanged);
const handleNavigate = useAppStore((s) => s.handleNavigate);
const isInitialized = useAppStore((s) => s.isInitialized);
const initializeStore = useAppStore((s) => s.initializeStore);

// Separate leaf selector for translation result (returns primitive/null)
const currentChapterTranslationResult = useAppStore((state) => {
  const id = state.currentChapterId;
  const ch = id ? state.getChapter(id) : null;
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


    // Initialize store on first render, then handle URL params
    useEffect(() => {
      const init = async () => {
        await initializeStore();
        // Now that the store is initialized, handle any URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const chapterUrl = urlParams.get('chapter');
        if (chapterUrl) {
          // Avoid noisy navigation logs in normal dev mode.
          handleNavigate(decodeURIComponent(chapterUrl));
        }
      };
      init();
    }, [initializeStore, handleNavigate]);

    // Boot-time hydration is now handled automatically by the store initialization

    // Main translation trigger effect remains here to orchestrate store actions
    useEffect(() => {
      const chapter = getChapter(currentChapterId || '');
      if (viewMode !== 'english' || !currentChapterId || !chapter) return;

      const translating = isTranslationActive(currentChapterId) || isLoading.translating;
      const hasResult  = !!currentChapterTranslationResult;
      const prevSig    = requestedRef.current.get(currentChapterId);
      const alreadyRequested = prevSig === settingsFingerprint;

      if (!hasResult && !translating && !alreadyRequested) {
        requestedRef.current.set(currentChapterId, settingsFingerprint);
        handleTranslate(currentChapterId);
      } else {
        // console.log(`[UI Debug] NOT triggering handleTranslate - conditions not met`);
      }
    }, [
      viewMode,
      currentChapterId,
      currentChapterTranslationResult,
      settingsFingerprint,
      isLoading.translating,
      isTranslationActive,
      handleTranslate,
    ]);

    // And clear the one-shot once a result lands (or when leaving English):
    useEffect(() => {
      if (currentChapterId && currentChapterTranslationResult) {
        requestedRef.current.delete(currentChapterId);
      }
    }, [currentChapterId, currentChapterTranslationResult]);

    useEffect(() => {
      if (viewMode !== 'english' && currentChapterId) {
        requestedRef.current.delete(currentChapterId);
      }
    }, [viewMode, currentChapterId]);

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

    // Proactive Cache Worker effect
    useEffect(() => {
      // The worker logic is now in the chaptersSlice.
      // This effect simply triggers it when the user or settings change.
      const { preloadNextChapters } = useAppStore.getState();
      preloadNextChapters();
    }, [currentChapterId, settings.preloadCount, settings.provider, settings.model, settings.temperature]);
    
    if (!isInitialized) {
      return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
          <Loader text="Initializing Session..." />
        </div>
      );
    }
    
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
            {import.meta.env.PROD && <Analytics />}
        </div>
    );
};

export default App;
