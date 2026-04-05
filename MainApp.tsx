import React, { useEffect } from 'react';
import { useAppStore } from './store';
import InputBar from './components/InputBar';
import ChapterView from './components/ChapterView';
import AmendmentModal from './components/AmendmentModal';
import SessionInfo from './components/SessionInfo';
import SettingsModal from './components/SettingsModal';
import Loader from './components/Loader';
import MigrationRecovery from './components/MigrationRecovery';
import { LandingPage } from './components/LandingPage';
import { DefaultKeyBanner } from './components/DefaultKeyBanner';
import OscilloscopePanel from './components/oscilloscope/OscilloscopePanel';
import NotificationToast from './components/NotificationToast';
import { clientTelemetry } from './services/clientTelemetry';

import { validateApiKey } from './services/aiService';
import { prepareConnection } from './services/db/core/connection';
import { debugLog, debugWarn } from './utils/debug';
import { shouldBlockApp, type VersionCheckResult } from './services/db/core/versionGate';
import { Analytics } from '@vercel/analytics/react';

// Initialize diff trigger service for automatic semantic diff analysis
import './services/diff/DiffTriggerService';

// Import diff colors CSS
import './styles/diff-colors.css';

export const MainApp: React.FC = () => {
const [dbGate, setDbGate] = React.useState<{
  status: 'checking' | 'blocked' | 'ready';
  result: VersionCheckResult | null;
}>({ status: 'checking', result: null });

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
const appScreen = useAppStore((s) => s.appScreen);
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
const isInitialized = useAppStore((s) => s.isInitialized);
debugLog('ui', 'full', '[App:init] isInitialized selector', { isInitialized });
const initializeStore = useAppStore((s) => s.initializeStore);

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

// Warn user before page refresh/close if translation or image generation is in progress
const hasImagesInProgress = useAppStore((s) => s.hasImagesInProgress);
useEffect(() => {
  const isWorking = isTranslationActive(currentChapterId ?? '') || hasImagesInProgress();
  if (!isWorking) return;

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    // Modern browsers ignore custom messages, but returnValue is required
    e.returnValue = 'Translation or image generation in progress. Changes may be lost.';
    return e.returnValue;
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [currentChapterId, isTranslationActive, hasImagesInProgress]);

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
        const versionCheck = await prepareConnection();
        if (shouldBlockApp(versionCheck)) {
          setDbGate({ status: 'blocked', result: versionCheck });
          return;
        }

        setDbGate({ status: 'ready', result: versionCheck });

        await initializeStore();
      };
      init();
    }, [initializeStore]);

    // Boot-time hydration is now handled automatically by the store initialization

    // Auto-translate is now handled in chaptersSlice.loadChapterFromIDB —
    // it fires AFTER hydration completes, so it knows whether a translation
    // already exists in IDB. The old useEffect here was racy: it fired before
    // hydration finished, saw no translation, and wasted API credits on
    // duplicate translations. See chaptersSlice.ts loadChapterFromIDB.

    // (requestedRef cleanup effect removed — auto-translate moved to store)

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

    let content: React.ReactNode;

    if (dbGate.status === 'checking') {
      content = (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
          <Loader text="Checking database..." />
        </div>
      );
    } else if (dbGate.status === 'blocked' && dbGate.result) {
      content = (
        <MigrationRecovery
          versionCheck={dbGate.result}
          onRetry={() => window.location.reload()}
        />
      );
    } else if (!isInitialized) {
      content = (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
          <Loader text="Initializing Session..." />
        </div>
      );
    } else if (appScreen === 'reader-loading') {
      content = (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
          <Loader text="Opening Reader..." />
        </div>
      );
    } else if (appScreen === 'library') {
      content = (
        <>
          <LandingPage />
          <SettingsModal
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
          />
          {import.meta.env.PROD && <Analytics />}
        </>
      );
    } else {
      content = (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans p-4 sm:p-6">
          <main className="container mx-auto">
            <DefaultKeyBanner />
            <SessionInfo />
            <OscilloscopePanel />
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
    }

    return (
      <>
        <NotificationToast />
        {content}
      </>
    );
};

export default MainApp;
