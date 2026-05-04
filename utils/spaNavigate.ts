/**
 * Client-side navigation helper that updates the URL without a full page
 * reload. Triggers a synthetic `popstate` so route-aware components (App.tsx)
 * re-render against the new pathname.
 *
 * Why this exists: the Sutta Studio button used to be a plain
 * `<a href="/sutta/...">` element. The browser handled it as a normal link,
 * which causes a full page reload. That tears down the in-memory Zustand
 * store and rebuilds it from IDB, which silently drops any in-memory-only
 * fields (e.g. a fanTranslation the user just attached but isn't yet
 * persisted). SPA-style navigation keeps the store alive and avoids the
 * rebuild round-trip.
 *
 * Right-click "open in new tab" still works on `<a>` tags that wire onClick
 * to this helper; the original href is preserved as the anchor target so
 * middle-click / cmd-click open in a new tab as the user expects.
 */
export function spaNavigate(url: string): void {
  if (typeof window === 'undefined') return;
  // Allow same-origin URLs only — defence against accidental external links.
  try {
    const target = new URL(url, window.location.origin);
    if (target.origin !== window.location.origin) {
      // External URL — use a real navigation, no SPA shortcut.
      window.location.href = url;
      return;
    }
    window.history.pushState({}, '', target.pathname + target.search + target.hash);
  } catch {
    window.history.pushState({}, '', url);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * onClick handler factory for `<a>` tags that should navigate via SPA on a
 * regular left-click but allow the browser's normal behaviour for
 * modifier-clicks (cmd-click / ctrl-click → new tab, middle-click, etc.).
 */
export function makeSpaClickHandler(
  url: string
): (e: React.MouseEvent<HTMLAnchorElement>) => void {
  return (e) => {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return; // not a primary-button click
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // modifier → browser handles
    e.preventDefault();
    spaNavigate(url);
  };
}
