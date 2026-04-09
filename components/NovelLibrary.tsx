import React, { useState, useEffect } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { LibrarySearch } from './LibrarySearch';
import type { SourceCandidate } from '../services/librarySearch/types';
import { NovelGrid } from './NovelGrid';
import { NovelCard } from './NovelCard';
import { NovelDetailSheet } from './NovelDetailSheet';
import {
  BookshelfStateService,
  type BookshelfEntry,
  type BookshelfState,
} from '../services/bookshelfStateService';
import { RegistryService } from '../services/registryService';
import { ImportService, ImportProgress } from '../services/importService';
import { useAppStore } from '../store';
import type { NovelEntry, NovelVersion } from '../types/novel';
import { debugLog } from '../utils/debug';
import { SettingsOps } from '../services/db/operations';
import { loadNovelIntoStore } from '../services/readerHydrationService';
import { fetchAndMergeGlossary, mergeGlossaryEntries } from '../services/glossaryService';

interface NovelLibraryProps {
  onSessionLoaded?: () => void;
}

export function NovelLibrary({ onSessionLoaded }: NovelLibraryProps) {
  const [selectedNovel, setSelectedNovel] = useState<NovelEntry | null>(null);
  const [novels, setNovels] = useState<NovelEntry[]>([]);
  const [bookshelfState, setBookshelfState] = useState<BookshelfState>({});
  const [isLoadingRegistry, setIsLoadingRegistry] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const showNotification = useAppStore(s => s.showNotification);
  const openNovel = useAppStore(s => s.openNovel);
  const openLibrary = useAppStore(s => s.openLibrary);
  const setReaderReady = useAppStore(s => s.setReaderReady);
  const handleFetch = useAppStore(s => s.handleFetch);

  const refreshBookshelfState = async () => {
    try {
      const nextState = await BookshelfStateService.getState();
      setBookshelfState(nextState);
    } catch (error) {
      console.warn('[NovelLibrary] Failed to load bookshelf state:', error);
    }
  };

  const resolveSavedVersion = (
    novel: NovelEntry,
    versionId?: string
  ): { version?: NovelVersion; warning?: string | null } => {
    if (!versionId) {
      return {};
    }

    const resolution = RegistryService.resolveCompatibleVersion(novel, versionId);
    return {
      version: (resolution.version as NovelVersion | null) ?? undefined,
      warning: resolution.warning,
    };
  };

  const persistResumeEntry = async (
    novelId: string,
    chapterId: string | null,
    versionId?: string | null
  ) => {
    if (!chapterId) {
      return;
    }

    const chapter = useAppStore.getState().chapters.get(chapterId);
    await BookshelfStateService.upsertEntry({
      novelId,
      ...(versionId ? { versionId } : {}),
      lastChapterId: chapterId,
      lastChapterNumber: chapter?.chapterNumber ?? undefined,
      lastReadAtIso: new Date().toISOString(),
    });
    await refreshBookshelfState();
  };

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
    void refreshBookshelfState();
  }, [showNotification]);

  const handleViewDetails = (novel: NovelEntry) => {
    // Skip the detail sheet when there's only one novel — go straight to reading
    if (novels.length === 1) {
      void handleStartReading(novel);
      return;
    }
    setSelectedNovel(novel);
  };

  const handleCloseDetails = () => {
    setSelectedNovel(null);
  };

  const handleStartReading = async (novel: NovelEntry, version?: NovelVersion) => {
    // Special routing for built-in study entries (e.g., Sutta Studio)
    if (novel.id === 'sutta-mn10') {
      window.location.href = '/sutta/demo';
      return;
    }

    // Determine which session URL to use
    const sessionJsonUrl = version?.sessionJsonUrl || novel.sessionJsonUrl;
    const requestedVersionId = version?.versionId ?? null;
    const versionLabel = version ? ` (${version.displayName})` : '';

    setIsLoading(true);
      setImportProgress(null);
      openNovel(novel.id, requestedVersionId);

      // Load glossary layers if the version defines them
      if (version?.glossaryLayers?.length) {
        fetchAndMergeGlossary(version.glossaryLayers)
          .then(glossary => {
            if (glossary.length > 0) {
              const currentSettings = useAppStore.getState().settings;
              const glossaryOverrides = currentSettings.glossaryOverrides ?? [];
              useAppStore.getState().updateSettings({
                glossaryBase: glossary,
                glossary: mergeGlossaryEntries(glossary, glossaryOverrides),
              });
              console.log(`[NovelLibrary] Loaded ${glossary.length} glossary entries for ${novel.title}`);
            }
          })
          .catch(err => console.warn('[NovelLibrary] Glossary fetch failed (non-blocking):', err));
      }

      try {
      const bookshelfEntry = await BookshelfStateService.getEntry(novel.id, requestedVersionId);
      const firstCachedChapterId = await loadNovelIntoStore(novel.id, useAppStore.setState, {
        versionId: requestedVersionId,
      });

      if (firstCachedChapterId) {
        setImportProgress({ stage: 'importing', progress: 50, message: 'Loading from cache...' });
        const nav = await SettingsOps.getKey<any>('navigation-history').catch(() => null);
        const resumeChapterId = BookshelfStateService.resolveResumeChapterId(
          bookshelfEntry,
          useAppStore.getState().chapters,
          firstCachedChapterId
        );
        useAppStore.setState(state => ({
          navigationHistory: nav?.stableIds || [],
          currentChapterId: resumeChapterId,
          appScreen: resumeChapterId ? 'reader' : state.appScreen,
        }));
        if (resumeChapterId) {
          setReaderReady();
          await persistResumeEntry(novel.id, resumeChapterId, requestedVersionId);
        }

        const hydratedCount = useAppStore.getState().chapters.size;
        debugLog('navigation', 'summary', `Loaded ${novel.title}${versionLabel} from cache - ${hydratedCount} chapters`);

        // Close the detail sheet
        setSelectedNovel(null);

        // Notify parent that session is loaded
        onSessionLoaded?.();
      } else if (sessionJsonUrl) {
        // No cached data — stream from session URL
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

              const firstChapterId = await loadNovelIntoStore(
                novel.id,
                useAppStore.setState,
                { limit: 10, versionId: requestedVersionId }
              );
              const bookshelfEntry = await BookshelfStateService.getEntry(novel.id, requestedVersionId);
              const resumeChapterId = BookshelfStateService.resolveResumeChapterId(
                bookshelfEntry,
                useAppStore.getState().chapters,
                firstChapterId
              );

              debugLog(
                'import',
                'summary',
                '[NovelLibrary] Hydrating initial chapters from stream',
                {
                  hydratedCount: useAppStore.getState().chapters.size,
                }
              );

              useAppStore.setState({
                currentChapterId: resumeChapterId,
                appScreen: resumeChapterId ? 'reader' : useAppStore.getState().appScreen,
              });
              if (resumeChapterId) {
                setReaderReady();
                await persistResumeEntry(novel.id, resumeChapterId, requestedVersionId);
              }

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
          },
          {
            registryNovelId: novel.id,
            registryVersionId: requestedVersionId,
          }
        );

        showNotification(`All chapters are now cached and ready to read.${versionLabel}`, 'info');
      } else {
        // No cache and no session URL — nothing to load
        openLibrary();
        showNotification(`${novel.title}${versionLabel} is not yet available. Check back soon!`, 'error');
      }
    } catch (error: any) {
      console.error('[NovelLibrary] Failed to load novel:', error);
      openLibrary();
      showNotification(`Failed to load ${novel.title}${versionLabel}: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
      setImportProgress(null);
    }
  };

  const handleResumeFromShelf = async (novel: NovelEntry, entry: BookshelfEntry) => {
    const { version: savedVersion, warning } = resolveSavedVersion(novel, entry.versionId);

    if (warning) {
      showNotification(warning, 'warning');
    }

    if (entry.versionId && novel.versions?.length && !savedVersion) {
      showNotification(
        `The saved version for ${novel.title} is no longer available. Pick a version to continue.`,
        'warning'
      );
      setSelectedNovel(novel);
      return;
    }

    await handleStartReading(novel, savedVersion);
  };

  const continueReadingEntries = (Object.values(bookshelfState) as BookshelfEntry[])
    .map((entry) => {
      const registryNovel = novels.find((novel) => novel.id === entry.novelId);
      
      // If not in registry, try to find it in the store's novels map (imported/custom)
      // We can't access store directly here easily in the map, but we can synthesize
      // basic info if registryNovel is missing.
      const novel: NovelEntry = registryNovel || {
        id: entry.novelId,
        title: entry.novelId.split('_').pop()?.replace(/-/g, ' ') || 'Untitled Novel',
        sessionJsonUrl: '',
        metadata: {
          originalLanguage: 'Unknown',
          chapterCount: 0,
          genres: [],
          description: 'Manually imported novel',
          publicationStatus: 'Ongoing' as const,
          lastUpdated: new Date(entry.lastReadAtIso).toLocaleDateString(),
        }
      };

      return {
        entry,
        novel,
        version: registryNovel ? resolveSavedVersion(registryNovel, entry.versionId).version ?? null : null,
      };
    })
    .sort((a, b) => b.entry.lastReadAtIso.localeCompare(a.entry.lastReadAtIso));

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

      {continueReadingEntries.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Continue Reading
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Pick up where you left off. Resume points are saved automatically.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 md:gap-6 lg:gap-8">
            {continueReadingEntries.map(({ entry, novel, version }) => (
              <NovelCard
                key={`continue-${novel.id}-${entry.versionId ?? 'default'}`}
                novel={novel}
                onViewDetails={handleViewDetails}
                onSelect={() => {
                  void handleResumeFromShelf(novel, entry);
                }}
                badgeLabel="In Progress"
                progressLabel={
                  [
                    version?.displayName ?? null,
                    typeof entry.lastChapterNumber === 'number'
                      ? `Resume at chapter ${entry.lastChapterNumber}`
                      : 'Resume reading',
                  ]
                    .filter(Boolean)
                    .join(' • ')
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Novel Search */}
      <LibrarySearch
        onSourceSelected={(raw, fan) => {
          if (raw) {
            showNotification(
              `Source selected: ${raw.site} — ${raw.matchedTitle}. Fetching chapters...`,
              'info'
            );
            // Use the existing fetch flow to import from the selected URL
            handleFetch(raw.url);
          }
          if (fan) {
            showNotification(
              `Fan translation: ${fan.site} — ${fan.matchedTitle}`,
              'info'
            );
          }
        }}
      />

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
