/**
 * Diagnostic script for Chapter 2 loading issue.
 * Paste in browser console or load via <script> tag.
 * Tests 4 hypotheses about why chapter content shows "Welcome!" instead of data.
 */
(function debugChapter2() {
  const store = window.__ZUSTAND_STORE__ || document.querySelector('[data-zustand]')?.__store;

  // Try to get store from React internals
  let state;
  try {
    // The store is typically available via useAppStore
    const root = document.getElementById('root');
    const fiber = root?._reactRootContainer?._internalRoot?.current ||
                  root?.[Object.keys(root).find(k => k.startsWith('__reactFiber'))]
    // Walk fiber tree to find store
    state = null;

    // Store is exposed as useAppStore (Zustand hook with .getState())
    if (window.__APP_STORE__) {
      state = typeof window.__APP_STORE__.getState === 'function'
        ? window.__APP_STORE__.getState()
        : window.__APP_STORE__;
    }
  } catch(e) {}

  if (!state) {
    console.error('[DEBUG] Could not access store. Add this to MainApp.tsx: window.__APP_STORE__ = useAppStore;');
    console.log('[DEBUG] Trying alternative: checking DOM for clues...');

    // Check what the chapter dropdown shows
    const dropdown = document.querySelector('select');
    console.log('[DEBUG] Chapter dropdown value:', dropdown?.value);
    console.log('[DEBUG] Chapter dropdown text:', dropdown?.selectedOptions?.[0]?.textContent);

    // Check if "Welcome!" is visible
    const welcome = document.querySelector('h2');
    console.log('[DEBUG] H2 text:', welcome?.textContent);

    // Check appScreen from URL
    console.log('[DEBUG] URL:', window.location.href);

    console.log('\n[DEBUG] === INSTRUCTIONS ===');
    console.log('Run this in the console to expose the store, then re-run this script:');
    console.log('  window.__APP_STORE__ = { getState: () => document.querySelector("[data-zustand]")?.__store?.getState?.() }');
    return;
  }

  const { currentChapterId, chapters, appScreen, activeNovelId, activeVersionId, viewMode } = state;

  console.group('[DEBUG] === Chapter 2 Diagnostic ===');

  // H1: Is the chapter in the store Map?
  console.group('H1: Chapter in store Map?');
  console.log('currentChapterId:', currentChapterId);
  console.log('chapters Map size:', chapters?.size);
  const chapter = currentChapterId ? chapters?.get(currentChapterId) : null;
  console.log('chapters.get(currentChapterId):', chapter ? 'EXISTS' : 'UNDEFINED');
  if (chapter) {
    console.log('  title:', chapter.title);
    console.log('  content length:', chapter.content?.length ?? 'NO CONTENT');
    console.log('  translationResult:', chapter.translationResult ? 'EXISTS' : 'null');
  }
  console.groupEnd();

  // H2: ID mismatch — check what IDs exist near chapter 2
  console.group('H2: ID mismatch check');
  const allIds = chapters ? Array.from(chapters.keys()) : [];
  const ch2Candidates = allIds.filter(id => id.includes('ch2') || id.includes('ch50') || id.includes('chapter-2'));
  console.log('Total chapter IDs in Map:', allIds.length);
  console.log('Chapter 2 candidates:', ch2Candidates);
  console.log('First 5 IDs:', allIds.slice(0, 5));
  if (currentChapterId) {
    console.log('currentChapterId exact:', JSON.stringify(currentChapterId));
    const exactMatch = allIds.find(id => id === currentChapterId);
    console.log('Exact match in Map:', exactMatch ? 'YES' : 'NO');
    // Check for near-misses
    const nearMisses = allIds.filter(id => {
      const norm = id.toLowerCase().replace(/[^a-z0-9]/g, '');
      const target = currentChapterId.toLowerCase().replace(/[^a-z0-9]/g, '');
      return norm.includes('ch2') || (norm !== target && norm.startsWith(target.slice(0, 20)));
    });
    console.log('Near-miss IDs:', nearMisses.slice(0, 5));
  }
  console.groupEnd();

  // H3: appScreen state
  console.group('H3: appScreen state');
  console.log('appScreen:', appScreen);
  console.log('activeNovelId:', activeNovelId);
  console.log('activeVersionId:', activeVersionId);
  console.log('viewMode:', viewMode);
  console.groupEnd();

  // H4: Chapter exists but empty content
  console.group('H4: Content check');
  if (chapter) {
    console.log('chapter.content:', typeof chapter.content, 'length:', chapter.content?.length);
    console.log('chapter.content preview:', chapter.content?.slice(0, 200));
    console.log('chapter.translationResult?.translation length:', chapter.translationResult?.translation?.length);
  } else {
    console.log('No chapter object to inspect');
  }
  console.groupEnd();

  // Hydration state
  console.group('Hydration state');
  console.log('hydratingChapters:', state.hydratingChapters);
  console.log('isLoading:', state.isLoading);
  console.groupEnd();

  console.groupEnd();
})();
