import React, { useState, useEffect } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { NovelGrid } from './NovelGrid';
import { NovelDetailSheet } from './NovelDetailSheet';
import { RegistryService } from '../services/registryService';
import { ImportService, ImportProgress } from '../services/importService';
import { useAppStore } from '../store';
import type { NovelEntry, NovelVersion } from '../types/novel';
import { debugLog } from '../utils/debug';
import { normalizeUrlAggressively } from '../services/stableIdService';

interface NovelLibraryProps {
  onSessionLoaded?: () => void;
}

export function NovelLibrary({ onSessionLoaded }: NovelLibraryProps) {
  const [selectedNovel, setSelectedNovel] = useState<NovelEntry | null>(null);
  const [novels, setNovels] = useState<NovelEntry[]>([]);
  const [isLoadingRegistry, setIsLoadingRegistry] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const showNotification = useAppStore(s => s.showNotification);

  // Fetch novels from registry on mount
  useEffect(() => {
    const loadNovels = async () => {
      setIsLoadingRegistry(true);
      try {
        const fetchedNovels = await RegistryService.fetchAllNovelMetadata();
        setNovels(fetchedNovels);
      } catch (error: any) {
        console.error('[NovelLibrary] Failed to load registry:', error);
        showNotification('Failed to load novel library. Please try again later.', 'error');
        setNovels([]);
      } finally {
        setIsLoadingRegistry(false);
      }
    };

    loadNovels();
  }, [showNotification]);

  const handleViewDetails = (novel: NovelEntry) => {
    setSelectedNovel(novel);
  };

  const handleCloseDetails = () => {
    setSelectedNovel(null);
  };

  const handleStartReading = async (novel: NovelEntry, version?: NovelVersion) => {
    // Determine which session URL to use
    const sessionJsonUrl = version?.sessionJsonUrl || novel.sessionJsonUrl;
    const versionLabel = version ? ` (${version.displayName})` : '';

    // Check if session URL exists
    if (!sessionJsonUrl) {
      showNotification(`${novel.title}${versionLabel} is not yet available. Check back soon!`, 'error');
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
          const newUrlIndex = new Map<string, string>();
          const newRawUrlIndex = new Map<string, string>();

          for (const ch of existingChapters) {
            const sourceUrls = ch.sourceUrls ?? [ch.url];
            newChapters.set(ch.stableId, {
              id: ch.stableId,
              title: ch.title,
              content: ch.content,
              originalUrl: ch.originalUrl,
              nextUrl: ch.nextUrl ?? null,
              prevUrl: ch.prevUrl ?? null,
              chapterNumber: ch.chapterNumber ?? 0,
              canonicalUrl: ch.canonicalUrl ?? ch.url,
              sourceUrls,
              fanTranslation: ch.fanTranslation ?? null,
              translationResult: ch.translationResult || null,
              feedback: [],
            });

            for (const rawUrl of sourceUrls) {
              if (!rawUrl) continue;
              newRawUrlIndex.set(rawUrl, ch.stableId);
              const normalized = normalizeUrlAggressively(rawUrl);
              if (normalized) {
                newUrlIndex.set(normalized, ch.stableId);
              }
            }
          }

          return {
            chapters: newChapters,
            urlIndex: newUrlIndex,
            rawUrlIndex: newRawUrlIndex,
            navigationHistory: nav?.stableIds || [],
            // Always start at first chapter when loading from Novel Library (new reader)
            currentChapterId: existingChapters[0]?.stableId || null,
          };
        });

        showNotification(`✅ Loaded ${novel.title}${versionLabel} from cache - ${existingChapters.length} chapters!`, 'success');

        // Close the detail sheet
        setSelectedNovel(null);

        // Notify parent that session is loaded
        onSessionLoaded?.();
      } else {
        // No cached data, use streaming import
        let hasNavigatedToFirstChapter = false;

        await ImportService.streamImportFromUrl(
          sessionJsonUrl,
          (progress) => {
            setImportProgress(progress);
          },
          // Callback when first 10 chapters are ready
          async () => {
            if (hasNavigatedToFirstChapter) return;
            hasNavigatedToFirstChapter = true;

            try {
              const preHydrationState = useAppStore.getState();
              debugLog(
                'import',
                'summary',
                '[NovelLibrary] onFirstChaptersReady invoked',
                {
                  hasNavigatedToFirstChapter,
                  currentChapterId: preHydrationState.currentChapterId,
                  chaptersInStore: preHydrationState.chapters?.size ?? 0,
                }
              );

              const chapters = await indexedDBService.getChaptersForReactRendering();

              // Hydrate store with first 10 chapters
              const threshold = Math.min(chapters.length, 10);
              const firstChapters = chapters.slice(0, threshold);
              const newChapters = new Map<string, any>();
              const newUrlIndex = new Map<string, string>();
              const newRawUrlIndex = new Map<string, string>();

              for (const ch of firstChapters) {
                const sourceUrls = ch.sourceUrls ?? [ch.url];
                newChapters.set(ch.stableId, {
                  id: ch.stableId,
                  title: ch.title,
                  content: ch.content,
                  originalUrl: ch.originalUrl,
                  nextUrl: ch.nextUrl ?? null,
                  prevUrl: ch.prevUrl ?? null,
                  chapterNumber: ch.chapterNumber ?? 0,
                  canonicalUrl: ch.canonicalUrl ?? ch.url,
                  sourceUrls,
                  fanTranslation: ch.fanTranslation ?? null,
                  translationResult: ch.translationResult || null,
                  feedback: [],
                });

                for (const rawUrl of sourceUrls) {
                  if (!rawUrl) continue;
                  newRawUrlIndex.set(rawUrl, ch.stableId);
                  const normalized = normalizeUrlAggressively(rawUrl);
                  if (normalized) {
                    newUrlIndex.set(normalized, ch.stableId);
                  }
                }
              }

              debugLog(
                'import',
                'summary',
                '[NovelLibrary] Hydrating initial chapters from stream',
                {
                  hydratedCount: firstChapters.length,
                  availableTotal: chapters.length,
                }
              );

              // Sort by chapter number and navigate to first
              const sortedChapters = Array.from(newChapters.entries()).sort((a, b) => {
                const numA = a[1].chapterNumber || 0;
                const numB = b[1].chapterNumber || 0;
                return numA - numB;
              });
              const firstChapterId = sortedChapters[0]?.[0];

              useAppStore.setState({
                chapters: newChapters,
                urlIndex: newUrlIndex,
                rawUrlIndex: newRawUrlIndex,
                currentChapterId: firstChapterId,
              });

              const postHydrationState = useAppStore.getState();
              debugLog(
                'import',
                'summary',
                '[NovelLibrary] Post hydration state',
                {
                  hydratedChapters: postHydrationState.chapters?.size ?? 0,
                  currentChapterId: postHydrationState.currentChapterId,
                }
              );

              // Close the detail sheet and notify
              setSelectedNovel(null);
              onSessionLoaded?.();

              showNotification(`First chapters are ready. Loading the rest in the background…${versionLabel}`, 'info');
            } catch (error) {
              console.error('[NovelLibrary] Failed to hydrate initial chapters from stream:', error);
              debugLog(
                'import',
                'summary',
                '[NovelLibrary] Hydration failed',
                {
                  error: error instanceof Error ? error.message : String(error),
                }
              );
              showNotification(
                `First chapters are taking longer than expected to prepare. We'll keep loading in the background—please try opening the chapter list shortly.`,
                'warning'
              );
            }
          }
        );

        showNotification(`All chapters are now cached and ready to read.${versionLabel}`, 'info');
      }
    } catch (error: any) {
      console.error('[NovelLibrary] Failed to load novel:', error);
      showNotification(`Failed to load ${novel.title}${versionLabel}: ${error.message}`, 'error');
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
          Browse our community-driven collection of web novels. Each novel can have multiple versions
          with different translations, enhancements, and styles to choose from.
        </p>
      </div>

      {/* Loading State */}
      {isLoadingRegistry ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-12 w-12 text-blue-600 dark:text-blue-400 animate-spin mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading novel library...</p>
        </div>
      ) : novels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <BookOpen className="h-16 w-16 text-gray-400 dark:text-gray-600 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">No novels available at the moment.</p>
        </div>
      ) : (
        <NovelGrid novels={novels} onViewDetails={handleViewDetails} />
      )}

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
