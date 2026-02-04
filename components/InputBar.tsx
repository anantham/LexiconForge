import React, { useState } from 'react';
import { useAppStore } from '../store';
import { SUPPORTED_WEBSITES_CONFIG } from '../config/constants';
import { ImportService, ImportProgress } from '../services/importService';
import { fetchChaptersForReactRendering } from '../services/db/operations/rendering';

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

type InputMode = 'url' | 'paste';

const InputBar: React.FC = () => {
  const [mode, setMode] = useState<InputMode>('url');
  const [url, setUrl] = useState('');
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Paste text state
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [pasteLanguage, setPasteLanguage] = useState('');

  const handleFetch = useAppStore(state => state.handleFetch);
  const importCustomText = useAppStore(state => state.importCustomText);
  const isLoading = useAppStore(state => state.isLoading.fetching);
  const error = useAppStore(state => state.error);
  const setError = useAppStore(state => state.setError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    // Detect if this is a session JSON URL
    if (isSessionJsonUrl(trimmedUrl)) {
      console.log('[InputBar] Detected session JSON URL, using streaming import...');
      setIsImporting(true);
      setImportProgress(null);
      setError(null);

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
            const chapters = await fetchChaptersForReactRendering();

            // Hydrate store with first chapters
            const firstChapters = chapters.slice(0, Math.min(10, chapters.length));
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

            // Sort and navigate to first
            const sortedChapters = Array.from(newChapters.entries()).sort((a, b) => {
              const numA = a[1].chapterNumber || 0;
              const numB = b[1].chapterNumber || 0;
              return numA - numB;
            });
            const firstChapterId = sortedChapters[0]?.[0];

            useAppStore.setState({
              chapters: newChapters,
              currentChapterId: firstChapterId,
              error: null,
            });

            // Clear the input
            setUrl('');
            console.log('[InputBar] Session import successful - user can start reading');
          }
        );

        console.log('[InputBar] All chapters loaded successfully');
      } catch (err: any) {
        console.error('[InputBar] Session import failed:', err);
        setError(`Failed to import session: ${err.message}`);
      } finally {
        setIsImporting(false);
        setImportProgress(null);
      }
    } else {
      // Regular chapter URL
      console.log('[InputBar] Detected chapter URL, fetching...');
      handleFetch(trimmedUrl);
    }
  };

  const handleExampleClick = (exampleUrl: string) => {
    setMode('url');
    setUrl(exampleUrl);
    handleFetch(exampleUrl);
  };

  const handlePasteSubmit = async () => {
    if (!pasteContent.trim()) return;
    await importCustomText(
      pasteTitle.trim() || 'Custom Text',
      pasteContent,
      pasteLanguage.trim() || undefined,
    );
    setPasteTitle('');
    setPasteContent('');
    setPasteLanguage('');
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
        useAppStore.setState({ currentChapterId: firstChapterId });
      }

      console.log('[InputBar] File import successful');

      // Clear input
      setUrl('');
    } catch (err: any) {
      console.error('[InputBar] File import failed:', err);
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

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-t-lg transition ${
      active
        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-b-2 border-blue-500'
        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
    }`;

  return (
    <div className="w-full max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 px-4 pt-3 gap-1">
        <button
          type="button"
          className={tabClass(mode === 'url')}
          onClick={() => setMode('url')}
          disabled={isAnyLoading}
        >
          From URL
        </button>
        <button
          type="button"
          className={tabClass(mode === 'paste')}
          onClick={() => setMode('paste')}
          disabled={isAnyLoading}
        >
          Paste Text
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="p-4">
        {/* URL Mode */}
        {mode === 'url' && (
          <>
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
          </>
        )}

        {/* Paste Text Mode */}
        {mode === 'paste' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-grow">
                <label
                  htmlFor="paste-title"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Title
                </label>
                <input
                  id="paste-title"
                  type="text"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  placeholder="Custom Text"
                  className="w-full px-3 py-2 text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  disabled={isAnyLoading}
                />
              </div>
              <div className="sm:w-48">
                <label
                  htmlFor="paste-language"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Source Language
                </label>
                <input
                  id="paste-language"
                  type="text"
                  value={pasteLanguage}
                  onChange={(e) => setPasteLanguage(e.target.value)}
                  placeholder="e.g., Chinese"
                  className="w-full px-3 py-2 text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  disabled={isAnyLoading}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="paste-content"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Content
              </label>
              <textarea
                id="paste-content"
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                placeholder="Paste your text here..."
                rows={8}
                className="w-full px-3 py-2 text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-y"
                disabled={isAnyLoading}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handlePasteSubmit}
                disabled={isAnyLoading || !pasteContent.trim()}
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition duration-300 ease-in-out"
              >
                {isLoading ? 'Importing...' : 'Import Text'}
              </button>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Paste any text for reading and translation. No URL required.
            </p>
          </div>
        )}

        {error && <p className="mt-3 text-red-500 dark:text-red-400 text-center font-medium">{error}</p>}
      </div>
    </div>
  );
};

export default InputBar;
