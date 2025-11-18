import React, { useEffect } from 'react';
import { useAppStore } from './store';
import InputBar from './components/InputBar';
import ChapterView from './components/ChapterView';
import AmendmentModal from './components/AmendmentModal';
import SessionInfo from './components/SessionInfo';
import SettingsModal from './components/SettingsModal';
import Loader from './components/Loader';
import { LandingPage } from './components/LandingPage';
import { DefaultKeyBanner } from './components/DefaultKeyBanner';

import { validateApiKey } from './services/aiService';
import { Analytics } from '@vercel/analytics/react';

// Initialize diff trigger service for automatic semantic diff analysis
import './services/diff/DiffTriggerService';

// Import diff colors CSS
import './styles/diff-colors.css';

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
const amendmentProposals = useAppStore((s) => s.amendmentProposals);
const acceptProposal = useAppStore((s) => s.acceptProposal);
const rejectProposal = useAppStore((s) => s.rejectProposal);
const editAndAcceptProposal = useAppStore((s) => s.editAndAcceptProposal);

// Track current proposal index for queue navigation
const [currentProposalIndex, setCurrentProposalIndex] = React.useState(0);

// Reset index when queue changes
React.useEffect(() => {
  if (amendmentProposals.length === 0) {
    setCurrentProposalIndex(0);
  } else if (currentProposalIndex >= amendmentProposals.length) {
    setCurrentProposalIndex(Math.max(0, amendmentProposals.length - 1));
  }
}, [amendmentProposals.length, currentProposalIndex]);
const showSettingsModal = useAppStore((s) => s.showSettingsModal);
const setShowSettingsModal = useAppStore((s) => s.setShowSettingsModal);
const loadPromptTemplates = useAppStore((s) => s.loadPromptTemplates);
const getChapter = useAppStore((s) => s.getChapter);
const hasTranslationSettingsChanged = useAppStore((s) => s.hasTranslationSettingsChanged);
const handleNavigate = useAppStore((s) => s.handleNavigate);
const isInitialized = useAppStore((s) => s.isInitialized);
console.log('[App:init] isInitialized selector', { isInitialized });
const initializeStore = useAppStore((s) => s.initializeStore);
const chapters = useAppStore((s) => s.chapters);

// Determine if we should show landing page or main app
const hasSession = chapters.size > 0 || currentChapterId !== null;

// Separate leaf selector for translation result (returns primitive/null)
const currentChapterTranslationResult = useAppStore((state) => {
  const id = state.currentChapterId;
  const ch = id ? state.getChapter(id) : null;
  const result = ch?.translationResult || null;

  // Diagnostic logging to track selector updates
  if (typeof window !== 'undefined' && (window as any).LF_DEBUG_SELECTOR) {
    console.log(`🔎 [Selector] currentChapterTranslationResult evaluated @${Date.now()}`, {
      chapterId: id,
      hasChapter: !!ch,
      hasTranslationResult: !!result,
      translationMetadata: result ? {
        hasId: !!(result as any).id,
        provider: result.usageMetrics?.provider,
        model: result.usageMetrics?.model,
        cost: result.usageMetrics?.estimatedCost
      } : null
    });
  }

  return result;
});

const hasCurrentChapter = useAppStore((state) => {
  const id = state.currentChapterId;
  if (!id) return false;
  const chapter = state.getChapter(id);
  return !!chapter;
});

// one-shot guard helpers
const requestedRef = React.useRef(new Map<string, string>());

// Memory optimization: Track previous chapter for cleanup
const previousChapterIdRef = React.useRef<string | null>(null);

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
      console.log(`🔍 [AutoTranslate] Effect triggered @${Date.now()}`, {
        viewMode,
        currentChapterId,
        hasCurrentChapter,
        hasTranslationResult: !!currentChapterTranslationResult,
        translationResultValue: currentChapterTranslationResult ? 'exists' : 'null/undefined'
      });

      if (viewMode !== 'english' || !currentChapterId || !hasCurrentChapter) {
        console.log(`🔍 [AutoTranslate] Early exit - preconditions not met`);
        return;
      }

      const chapter = getChapter(currentChapterId);
      if (!chapter) {
        console.log(`🔍 [AutoTranslate] Early exit - chapter not found in map`);
        return;
      }

      const translating = isTranslationActive(currentChapterId) || isLoading.translating;
      const pending = useAppStore.getState().pendingTranslations.has(currentChapterId);
      const hasResult  = !!currentChapterTranslationResult;
      const prevSig    = requestedRef.current.get(currentChapterId);
      const alreadyRequested = prevSig === settingsFingerprint;

      console.log(`🔍 [AutoTranslate] Conditions check for ${currentChapterId}:`, {
        hasResult,
        translating,
        alreadyRequested,
        pending,
        prevSig: prevSig ? 'exists' : 'none',
        currentSig: settingsFingerprint,
        chapterHasTranslationResult: !!chapter.translationResult,
        chapterTranslationMetadata: chapter.translationResult ? {
          hasId: !!(chapter.translationResult as any).id,
          hasUsageMetrics: !!chapter.translationResult.usageMetrics,
          provider: chapter.translationResult.usageMetrics?.provider,
          model: chapter.translationResult.usageMetrics?.model,
          cost: chapter.translationResult.usageMetrics?.estimatedCost
        } : null
      });

      if (!hasResult && !translating && !alreadyRequested && !pending) {
        console.warn(`🚨 [AutoTranslate] TRIGGERING AUTO-TRANSLATION for chapter ${currentChapterId}`);
        console.warn(`🚨 [AutoTranslate] This may be a HYDRATION RACE if chapter already has translationResult in state!`);
        requestedRef.current.set(currentChapterId, settingsFingerprint);
        handleTranslate(currentChapterId);
      } else {
        console.log(`✅ [AutoTranslate] NOT triggering - conditions not met (blocking reason logged above)`);
      }
    }, [
      viewMode,
      currentChapterId,
      currentChapterTranslationResult,
      settingsFingerprint,
      isLoading.translating,
      isTranslationActive,
      handleTranslate,
      hasCurrentChapter,
      getChapter,
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

    // Memory optimization: Clean up image state when navigating away from a chapter
    useEffect(() => {
      // If we have a previous chapter and it's different from current, clean it up
      if (previousChapterIdRef.current && previousChapterIdRef.current !== currentChapterId) {
        const { clearImageState } = useAppStore.getState();
        clearImageState(previousChapterIdRef.current);
      }

      // Update the ref to current chapter
      previousChapterIdRef.current = currentChapterId;
    }, [currentChapterId]);

    if (!isInitialized) {
      return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
          <Loader text="Initializing Session..." />
        </div>
      );
    }

    // Show landing page if no session is loaded
    if (!hasSession) {
      return (
        <>
          <LandingPage />
          <SettingsModal
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
          />
          {import.meta.env.PROD && <Analytics />}
        </>
      );
    }

    // Show main app when session is loaded
    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans p-4 sm:p-6">
            <main className="container mx-auto">
                <header className="text-center mb-6">
                    <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 dark:text-white">Lexicon Forge</h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">Read web novels with AI-powered, user-refined translations.</p>
                </header>
                <DefaultKeyBanner />
                <InputBar />
                <SessionInfo />
                <ChapterView />
                <SettingsModal
                  isOpen={showSettingsModal}
                  onClose={() => setShowSettingsModal(false)}
                />
                {amendmentProposals.length > 0 && (
                    <AmendmentModal
                        proposals={amendmentProposals}
                        currentIndex={currentProposalIndex}
                        onAccept={(index) => {
                          acceptProposal(index);
                          // After accepting, reset to first proposal if queue still has items
                          setCurrentProposalIndex(0);
                        }}
                        onReject={(index) => {
                          rejectProposal(index);
                          // After rejecting, reset to first proposal if queue still has items
                          setCurrentProposalIndex(0);
                        }}
                        onEdit={(modifiedChange, index) => {
                          editAndAcceptProposal(modifiedChange, index);
                          // After editing and accepting, reset to first proposal if queue still has items
                          setCurrentProposalIndex(0);
                        }}
                        onNavigate={setCurrentProposalIndex}
                    />
                )}
            </main>
            {import.meta.env.PROD && <Analytics />}
        </div>
    );
};

export default App;
