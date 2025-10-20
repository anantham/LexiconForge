import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { NovelGrid } from './NovelGrid';
import { NovelDetailSheet } from './NovelDetailSheet';
import { getAllNovels } from '../config/novelCatalog';
import { ImportService, ImportProgress } from '../services/importService';
import { useAppStore } from '../store';
import type { NovelEntry } from '../types/novel';

interface NovelLibraryProps {
  onSessionLoaded?: () => void;
}

export function NovelLibrary({ onSessionLoaded }: NovelLibraryProps) {
  const [selectedNovel, setSelectedNovel] = useState<NovelEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const showNotification = useAppStore(s => s.showNotification);

  const novels = getAllNovels();

  const handleViewDetails = (novel: NovelEntry) => {
    setSelectedNovel(novel);
  };

  const handleCloseDetails = () => {
    setSelectedNovel(null);
  };

  const handleStartReading = async (novel: NovelEntry) => {
    // Check if session URL exists
    if (!novel.sessionJsonUrl) {
      showNotification(`${novel.title} is not yet available. Check back soon!`, 'error');
      return;
    }

    setIsLoading(true);
    setImportProgress(null);

    try {
      // Check if novel is already loaded in IndexedDB (simple cache check)
      const { indexedDBService } = await import('../services/indexeddb');
      const existingChapters = await indexedDBService.getChaptersForReactRendering();

      if (existingChapters.length > 0) {
        // Chapters already exist, just load them into store
        setImportProgress({ stage: 'importing', progress: 50, message: 'Loading from cache...' });

        const { useAppStore } = await import('../store');
        const nav = await indexedDBService.getSetting<any>('navigation-history').catch(() => null);
        const lastActive = await indexedDBService.getSetting<any>('lastActiveChapter').catch(() => null);

        useAppStore.setState(state => {
          const newChapters = new Map<string, any>();
          for (const ch of existingChapters) {
            newChapters.set(ch.stableId, {
              stableId: ch.stableId,
              url: ch.url || ch.canonicalUrl,
              title: ch.data?.chapter?.title || ch.title,
              content: ch.data?.chapter?.content || ch.content,
              nextUrl: ch.data?.chapter?.nextUrl || ch.nextUrl,
              prevUrl: ch.data?.chapter?.prevUrl || ch.prevUrl,
              chapterNumber: ch.chapterNumber || 0,
              canonicalUrl: ch.url,
              originalUrl: ch.url,
              sourceUrls: [ch.url],
              fanTranslation: ch.data?.chapter?.fanTranslation ?? null,
              translationResult: ch.data?.translationResult || null,
              feedback: [],
            });
          }

          return {
            chapters: newChapters,
            navigationHistory: nav?.stableIds || [],
            // Always start at first chapter when loading from Novel Library (new reader)
            currentChapterId: existingChapters[0]?.stableId || null,
          };
        });

        showNotification(`✅ Loaded ${novel.title} from cache - ${existingChapters.length} chapters!`, 'success');

        // Close the detail sheet
        setSelectedNovel(null);

        // Notify parent that session is loaded
        onSessionLoaded?.();
      } else {
        // No cached data, use streaming import
        let hasNavigatedToFirstChapter = false;

        await ImportService.streamImportFromUrl(
          novel.sessionJsonUrl,
          (progress) => {
            setImportProgress(progress);
          },
          // Callback when first 10 chapters are ready
          async () => {
            if (hasNavigatedToFirstChapter) return;
            hasNavigatedToFirstChapter = true;

            // Navigate to first chapter after first 10 load
            const { useAppStore } = await import('../store');
            const chapters = await indexedDBService.getChaptersForReactRendering();

            // Hydrate store with first 10 chapters
            const firstChapters = chapters.slice(0, 10);
            const newChapters = new Map<string, any>();
            for (const ch of firstChapters) {
              newChapters.set(ch.stableId, {
                stableId: ch.stableId,
                url: ch.url || ch.canonicalUrl,
                title: ch.data?.chapter?.title || ch.title,
                content: ch.data?.chapter?.content || ch.content,
                nextUrl: ch.data?.chapter?.nextUrl || ch.nextUrl,
                prevUrl: ch.data?.chapter?.prevUrl || ch.prevUrl,
                chapterNumber: ch.chapterNumber || 0,
                canonicalUrl: ch.url,
                originalUrl: ch.url,
                sourceUrls: [ch.url],
                fanTranslation: ch.data?.chapter?.fanTranslation ?? null,
                translationResult: ch.data?.translationResult || null,
                feedback: [],
              });
            }

            // Sort by chapter number and navigate to first
            const sortedChapters = Array.from(newChapters.entries()).sort((a, b) => {
              const numA = a[1].chapterNumber || 0;
              const numB = b[1].chapterNumber || 0;
              return numA - numB;
            });
            const firstChapterId = sortedChapters[0]?.[0];

            useAppStore.setState({
              chapters: newChapters,
              currentChapterId: firstChapterId,
            });

            // Close the detail sheet and notify
            setSelectedNovel(null);
            onSessionLoaded?.();

            showNotification(`✅ First chapters ready! Loading ${novel.metadata.chapterCount} total chapters in background...`, 'success');
          }
        );

        showNotification(`✅ All ${novel.metadata.chapterCount} chapters loaded!`, 'success');
      }
    } catch (error: any) {
      console.error('[NovelLibrary] Failed to load novel:', error);
      showNotification(`Failed to load ${novel.title}: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
      setImportProgress(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <BookOpen className="h-12 w-12 text-blue-600 dark:text-blue-400 mr-3" />
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            Novel Library
          </h2>
        </div>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Browse our curated collection of web novels. Each novel comes pre-loaded with chapters
          ready for AI translation, illustration generation, and EPUB export.
        </p>
      </div>

      {/* Novel Grid */}
      <NovelGrid novels={novels} onViewDetails={handleViewDetails} />

      {/* Loading Overlay with Progress */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4">
            <div className="flex flex-col items-center">
              {/* Progress Bar */}
              {importProgress ? (
                <div className="w-full">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-gray-900 dark:text-gray-100 font-semibold">
                      {importProgress.stage === 'downloading' && '📥 Downloading'}
                      {importProgress.stage === 'parsing' && '📄 Parsing'}
                      {importProgress.stage === 'importing' && '💾 Importing'}
                      {importProgress.stage === 'complete' && '✅ Complete'}
                    </p>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {importProgress.progress.toFixed(0)}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-blue-700 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${importProgress.progress}%` }}
                    />
                  </div>

                  {/* Message */}
                  {importProgress.message && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                      {importProgress.message}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-900 dark:text-gray-100 font-semibold">
                    Loading novel session...
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    This may take a few moments
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Novel Detail Sheet */}
      <NovelDetailSheet
        novel={selectedNovel}
        isOpen={!!selectedNovel}
        onClose={handleCloseDetails}
        onStartReading={handleStartReading}
      />
    </div>
  );
}
