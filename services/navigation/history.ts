import type { EnhancedChapter } from '../stableIdService';
import { isSuttaFlowDebug, logSuttaFlow } from '../suttaStudioDebug';

export interface ReaderHistoryOptions {
  novelId?: string | null;
  versionId?: string | null;
}

export function updateBrowserHistory(
  chapter: EnhancedChapter,
  chapterId: string,
  options: ReaderHistoryOptions = {}
): void {
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

    if (options.novelId) {
      params.set('novel', options.novelId);
    }

    if (options.versionId) {
      params.set('version', options.versionId);
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
      {
        chapterId,
        novelId: options.novelId ?? null,
        versionId: options.versionId ?? null,
      },
      '',
      nextUrl
    );
  }
}
