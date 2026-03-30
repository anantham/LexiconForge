import React, { useState } from 'react';
import { useAppStore } from '../store';
import { SUPPORTED_WEBSITES_CONFIG } from '../config/constants';
import { ImportService, ImportProgress } from '../services/importService';
import { loadAllIntoStore } from '../services/readerHydrationService';

/**
 * Detect if URL points to a session JSON file
 */
const isSessionJsonUrl = (url: string): boolean => {
  const lowerUrl = url.toLowerCase();
  return (
    lowerUrl.endsWith('.json') ||
    lowerUrl.includes('/session') ||
    lowerUrl.includes('lexiconforge') ||
    lowerUrl.includes('session-files/')
  );
};

const InputBar: React.FC = () => {
  const [url, setUrl] = useState('');
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFetch = useAppStore(state => state.handleFetch);
  const activeNovelId = useAppStore(state => state.activeNovelId);
  const openLibrary = useAppStore(state => state.openLibrary);
  const shelveActiveNovel = useAppStore(state => state.shelveActiveNovel);
  const setReaderLoading = useAppStore(state => state.setReaderLoading);
  const setReaderReady = useAppStore(state => state.setReaderReady);
  const isLoading = useAppStore(state => state.isLoading.fetching);
  const error = useAppStore(state => state.error);
  const setError = useAppStore(state => state.setError);

  const shelveActiveLibraryNovel = () => {
    if (activeNovelId) {
      shelveActiveNovel();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    // Detect if this is a session JSON URL
    if (isSessionJsonUrl(trimmedUrl)) {
      console.log('[InputBar] Detected session JSON URL, using streaming import...');
      shelveActiveLibraryNovel();
      setIsImporting(true);
      setImportProgress(null);
      setError(null);
      setReaderLoading(null);

      try {
        let hasNavigatedToFirstChapter = false;

        await ImportService.streamImportFromUrl(
          trimmedUrl,
          (progress) => {
            setImportProgress(progress);
          },
          // Callback when first 10 chapters are ready
          async () => {
            if (hasNavigatedToFirstChapter) return;
            hasNavigatedToFirstChapter = true;

            console.log('[InputBar] First 10 chapters ready, navigating...');

            const { useAppStore } = await import('../store');
            const firstChapterId = await loadAllIntoStore(useAppStore.setState, { limit: 10 });

            useAppStore.setState({
              currentChapterId: firstChapterId,
              appScreen: 'reader',
              error: null,
            });
            setReaderReady();

            // Clear the input
            setUrl('');
            console.log('[InputBar] Session import successful - user can start reading');
          }
        );

        console.log('[InputBar] All chapters loaded successfully');
      } catch (err: any) {
        console.error('[InputBar] Session import failed:', err);
        openLibrary();
        setError(`Failed to import session: ${err.message}`);
      } finally {
        setIsImporting(false);
        setImportProgress(null);
      }
    } else {
      // Regular chapter URL
      console.log('[InputBar] Detected chapter URL, fetching...');
      shelveActiveLibraryNovel();
      handleFetch(trimmedUrl);
    }
  };

  const handleExampleClick = (exampleUrl: string) => {
    setUrl(exampleUrl);
    shelveActiveLibraryNovel();
    handleFetch(exampleUrl);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('[InputBar] File selected:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(1), 'MB');

    setIsImporting(true);
    setImportProgress(null);
    setError(null);

    try {
      // For local files, always use regular import
      // Streaming from Blob URL doesn't help (file already in memory) and hits buffer limits
      console.log('[InputBar] Importing file:', file.name, `(${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      shelveActiveLibraryNovel();
      setReaderLoading(null);

      setImportProgress({
        stage: 'importing',
        progress: 50,
        message: 'Importing from file...',
      });

      await ImportService.importFromFile(file);

      // Navigate to first chapter
      const { useAppStore } = await import('../store');
      const chapters = useAppStore.getState().chapters;
      const sortedChapters = Array.from(chapters.entries()).sort((a, b) => {
        const numA = a[1].chapterNumber || 0;
        const numB = b[1].chapterNumber || 0;
        return numA - numB;
      });
      const firstChapterId = sortedChapters[0]?.[0];
      if (firstChapterId) {
        useAppStore.setState({ currentChapterId: firstChapterId, appScreen: 'reader' });
        setReaderReady();
      }

      console.log('[InputBar] File import successful');

      // Clear input
      setUrl('');
    } catch (err: any) {
      console.error('[InputBar] File import failed:', err);
      openLibrary();
      setError(`Failed to import file: ${err.message}`);
    } finally {
      setIsImporting(false);
      setImportProgress(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const isAnyLoading = isLoading || isImporting;

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste chapter URL or session JSON file URL to start reading..."
            className="flex-grow w-full px-4 py-2 text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border-2 border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition placeholder:text-gray-400 dark:placeholder:text-gray-500"
            disabled={isAnyLoading}
          />
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnyLoading}
              className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-md shadow-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:focus:ring-offset-gray-800 disabled:bg-gray-400 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition duration-300 ease-in-out"
              title="Import session from a JSON file on your computer"
            >
              📁 Import
            </button>
            <button
              type="submit"
              disabled={isAnyLoading || !url.trim()}
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition duration-300 ease-in-out"
              title={url.trim() ? 'Fetch chapter or session from URL' : 'Enter a URL first'}
            >
              {isImporting ? 'Importing...' : isLoading ? 'Fetching...' : '🔗 Fetch'}
            </button>
          </div>
        </div>
      </form>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Import Progress Bar */}
      {importProgress && (
        <div className="mt-3 bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {importProgress.stage === 'downloading' && '📥 Downloading'}
              {importProgress.stage === 'parsing' && '📋 Parsing'}
              {importProgress.stage === 'importing' && '💾 Importing'}
              {importProgress.stage === 'streaming' && '🌊 Streaming'}
              {importProgress.stage === 'complete' && '✅ Complete'}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {importProgress.stage === 'streaming' && importProgress.chaptersLoaded !== undefined
                ? `${importProgress.chaptersLoaded}${importProgress.totalChapters ? `/${importProgress.totalChapters}` : ''} chapters`
                : `${importProgress.progress.toFixed(0)}%`
              }
            </span>
          </div>
          <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${importProgress.progress}%` }}
            />
          </div>
          {importProgress.message && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              {importProgress.message}
            </p>
          )}
          {importProgress.canStartReading && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-semibold">
              ✓ You can start reading now! Remaining chapters loading in background...
            </p>
          )}
        </div>
      )}
       <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
        <span className="font-semibold">Find the novel you want to read from these supported websites:</span>
        {' '}
        {/* Group websites by category */}
        {Object.entries(
          SUPPORTED_WEBSITES_CONFIG.reduce((acc, site) => {
            if (!acc[site.category]) acc[site.category] = [];
            acc[site.category].push(site);
            return acc;
          }, {} as Record<string, typeof SUPPORTED_WEBSITES_CONFIG>)
        ).map(([category, sites], categoryIndex, categories) => (
          <React.Fragment key={category}>
            {sites.map((site, siteIndex) => (
              <React.Fragment key={site.domain}>
                <a
                  href={site.homeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                  title={`Visit ${site.name} - ${category}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleExampleClick(site.exampleUrl);
                  }}
                >
                  {site.name}
                </a>
                {siteIndex < sites.length - 1 && ', '}
              </React.Fragment>
            ))}
            {' '}
            <span className="text-gray-500">({category})</span>
            {categoryIndex < categories.length - 1 && '; '}
          </React.Fragment>
        ))}
        {' and you can '}
        <a
          href="https://t.me/webnovels"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          request for us to add support for your fav website here!
        </a>
      </div>
      {error && <p className="mt-3 text-red-500 dark:text-red-400 text-center font-medium">{error}</p>}
    </div>
  );
};

export default InputBar;
