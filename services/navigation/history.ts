import type { EnhancedChapter } from '../stableIdService';
import { isSuttaFlowDebug, logSuttaFlow } from '../suttaStudioDebug';

export function updateBrowserHistory(chapter: EnhancedChapter, chapterId: string): void {
  if (typeof history !== 'undefined' && history.pushState) {
    const currentUrl =
      typeof window !== 'undefined' ? new URL(window.location.href) : null;
    const flowDebug = isSuttaFlowDebug();
    const params = new URLSearchParams();
    const preserveKeys = ['lang', 'author', 'recompile'];

    if (currentUrl?.pathname.startsWith('/sutta')) {
      preserveKeys.forEach((key) => {
        const value = currentUrl.searchParams.get(key);
        if (value !== null && value !== '') {
          params.set(key, value);
        }
      });
    }

    params.set('chapter', chapter.canonicalUrl);
    const search = params.toString();
    const basePath = currentUrl?.pathname || '';
    const nextUrl = basePath ? `${basePath}?${search}` : `?${search}`;
    if (flowDebug && currentUrl?.pathname.startsWith('/sutta')) {
      logSuttaFlow('updateBrowserHistory', {
        chapterId,
        canonicalUrl: chapter.canonicalUrl,
        previousUrl: currentUrl.toString(),
        nextUrl,
        preservedParams: preserveKeys.filter((key) => currentUrl.searchParams.get(key)),
      });
    }
    history.pushState(
      { chapterId },
      '',
      nextUrl
    );
  }
}
