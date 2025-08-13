import React, { useEffect } from 'react';
import useAppStore from './store/useAppStore';
import InputBar from './components/InputBar';
import ChapterView from './components/ChapterView';
import AmendmentModal from './components/AmendmentModal';
import SessionInfo from './components/SessionInfo';
import SettingsModal from './components/SettingsModal';
import { useShallow } from 'zustand/react/shallow';
import { Analytics } from '@vercel/analytics/react';

const App: React.FC = () => {
    // Select state and actions needed for orchestration and conditional rendering
    const { 
      currentUrl, sessionData, showEnglish, isLoading, settings,
      handleTranslate, handleFetch, amendmentProposal, acceptProposal, rejectProposal, showSettingsModal, setShowSettingsModal,
      initializeIndexedDB
    } = useAppStore(useShallow(state => ({
        currentUrl: state.currentUrl,
        sessionData: state.sessionData,
        showEnglish: state.showEnglish,
        isLoading: state.isLoading,
        settings: state.settings,
        handleTranslate: state.handleTranslate,
        handleFetch: state.handleFetch,
        amendmentProposal: state.amendmentProposal,
        acceptProposal: state.acceptProposal,
        rejectProposal: state.rejectProposal,
        showSettingsModal: state.showSettingsModal,
        setShowSettingsModal: state.setShowSettingsModal,
        initializeIndexedDB: state.initializeIndexedDB,
    })));

    // Initialize IndexedDB on app start
    useEffect(() => {
        initializeIndexedDB();
    }, [initializeIndexedDB]);

    // Main translation trigger effect remains here to orchestrate store actions
    useEffect(() => {
        if (showEnglish && currentUrl && sessionData[currentUrl] && !sessionData[currentUrl].translationResult && !isLoading.translating) {
            handleTranslate(currentUrl);
        }
    }, [showEnglish, currentUrl, sessionData, isLoading.translating, handleTranslate]);

    // Proactive Cache Worker effect also remains to orchestrate silent fetches/translations
    useEffect(() => {
        if (!currentUrl || settings.preloadCount === 0) return;

        const worker = async () => {
            let nextUrlToPreload = sessionData[currentUrl]?.chapter.nextUrl;
            
            for (let i = 0; i < settings.preloadCount && nextUrlToPreload; i++) {
                const url = nextUrlToPreload;
                const currentSessionData = useAppStore.getState().sessionData;

                if (currentSessionData[url]?.translationResult) {
                    console.log(`[Worker] Skipping already pre-loaded chapter: ${url}`);
                    nextUrlToPreload = currentSessionData[url]?.chapter.nextUrl;
                    continue;
                }
                
                const chapter = currentSessionData[url]?.chapter || await handleFetch(url, true);

                if (!chapter) {
                    console.warn(`[Worker] Halting preload chain due to fetch failure for: ${url}`);
                    break;
                }
                
                if (!useAppStore.getState().sessionData[url]?.translationResult) {
                    console.log(`[Worker] Pre-translating chapter: ${url}`);
                    await handleTranslate(url, true);
                }

                nextUrlToPreload = chapter.nextUrl;
            }
        };
        
        const timeoutId = setTimeout(worker, 1500);
        return () => clearTimeout(timeoutId);

    }, [currentUrl, sessionData, settings.preloadCount, handleFetch, handleTranslate]);
    
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