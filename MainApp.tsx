import React, { useEffect } from 'react';
import { useAppStore } from './store';
import ChapterView from './components/ChapterView';
import AmendmentModal from './components/AmendmentModal';
import SessionInfo from './components/SessionInfo';
import SettingsModal from './components/SettingsModal';
import Loader from './components/Loader';
import MigrationRecovery from './components/MigrationRecovery';
import { LandingPage } from './components/LandingPage';
import OscilloscopePanel from './components/oscilloscope/OscilloscopePanel';
import NotificationToast from './components/NotificationToast';
import BackgroundWorkBanner from './components/BackgroundWorkBanner';
import ImageJobsBanner from './components/ImageJobsBanner';

import { prepareConnection } from './services/db/core/connection';
import { debugLog } from './utils/debug';
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

// Individual primitive selectors to avoid fresh object creation
const currentChapterId = useAppStore((s) => s.currentChapterId);
const appScreen = useAppStore((s) => s.appScreen);
const settings = useAppStore((s) => s.settings);
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
const isInitialized = useAppStore((s) => s.isInitialized);
debugLog('ui', 'full', '[App:init] isInitialized selector', { isInitialized });
const initializeStore = useAppStore((s) => s.initializeStore);
const resumeInterruptedImageJobs = useAppStore((s) => s.resumeInterruptedImageJobs);

// Warn user before page refresh/close if ANY translation or image generation is in flight.
// Per CORE-012: after Phase 1, translations can be running for chapters other than the
// current one (background work survives navigation). We watch the global pending set,
// not just the current chapter's flag. The warning is honest: tab close kills the
// in-tab promise, and durable-queue tab-close survival is out of scope.
const hasImagesInProgress = useAppStore((s) => s.hasImagesInProgress);
const activeImageJobsCount = useAppStore((s) => Object.values(s.imageJobs ?? {})
  .filter((job) => job.status === 'queued' || job.status === 'submitted' || job.status === 'running').length);
const pendingTranslationsCount = useAppStore((s) => s.pendingTranslations?.size ?? 0);
useEffect(() => {
  const isWorking = pendingTranslationsCount > 0 || activeImageJobsCount > 0 || hasImagesInProgress();
  if (!isWorking) return;

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    // Modern browsers ignore custom messages, but returnValue is required
    e.returnValue = 'Translation or image generation in progress. Changes may be lost.';
    return e.returnValue;
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [pendingTranslationsCount, activeImageJobsCount, hasImagesInProgress]);

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

    useEffect(() => {
      if (!isInitialized) return;
      void resumeInterruptedImageJobs();
    }, [isInitialized, resumeInterruptedImageJobs]);

    // Proactive Cache Worker effect
    useEffect(() => {
      // The worker logic is now in the chaptersSlice.
      // This effect simply triggers it when the user or settings change.
      const { preloadNextChapters } = useAppStore.getState();
      preloadNextChapters();
    }, [currentChapterId, settings.preloadCount, settings.provider, settings.model, settings.temperature]);

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
        <BackgroundWorkBanner />
        <ImageJobsBanner />
        {content}
      </>
    );
};

export default MainApp;
