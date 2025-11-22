import { RefObject, useEffect } from 'react';

export const useFootnoteNavigation = (
  viewRef: RefObject<HTMLDivElement>,
  viewMode: 'original' | 'fan' | 'english',
  currentChapterId: string | null
) => {
  useEffect(() => {
    const container = viewRef.current;
    if (!container) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a') as HTMLAnchorElement | null;
      const href = anchor?.getAttribute('href') || '';
      if (anchor && href.startsWith('#footnote-')) {
        event.preventDefault();
        const id = href.slice(1);
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
          try {
            history.replaceState(null, '', `#${id}`);
          } catch {
            // ignore history errors
          }
        }
      }
    };

    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, [viewRef, viewMode, currentChapterId]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleHash = () => {
      const hash = typeof location !== 'undefined' ? location.hash : '';
      if (hash && hash.startsWith('#footnote-')) {
        const id = hash.slice(1);
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      }
    };

    window.addEventListener('hashchange', handleHash);
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, [currentChapterId, viewMode]);
};
