import React, { useEffect, useState } from 'react';
import Loader from './components/Loader';
import type { DeepLoomPacket } from './types/suttaStudio';

// Handle failed downloads once, without adding retry state or a routing framework.
function lazyPage<Props>(load: () => Promise<{ default: React.ComponentType<Props> }>) {
  return React.lazy(() => load().catch((error: unknown) => {
    console.error('[App] Failed to download page:', error);
    const message = error instanceof Error ? error.message : String(error);
    return { default: () => (
      <div role="alert" className="p-8 text-slate-200">
        <p>Unable to open this page: {message}</p>
        <button type="button" className="mt-4 underline" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </div>
    ) };
  }));
}

// Load each feature only when its route is opened. Keep its data out of other readers.
const MainApp = lazyPage(() => import('./MainApp'));
const SuttaStudioBenchmarkView = lazyPage(() => import('./components/bench/SuttaStudioBenchmarkView').then(m => ({ default: m.SuttaStudioBenchmarkView })));
const SuttaStudioApp = lazyPage(() => import('./components/sutta-studio/SuttaStudioApp').then(m => ({ default: m.SuttaStudioApp })));
const SuttaStudioPipelineLoader = lazyPage(() => import('./components/sutta-studio/SuttaStudioPipelineLoader').then(m => ({ default: m.SuttaStudioPipelineLoader })));
const SuttaStudioCompareView = lazyPage(() => import('./components/sutta-studio/SuttaStudioCompareView').then(m => ({ default: m.SuttaStudioCompareView })));
const LiturgyApp = lazyPage(() => import('./components/liturgy/LiturgyApp').then(m => ({ default: m.LiturgyApp })));
const CalvinoReader = lazyPage(() => import('./components/calvino/CalvinoReader').then(m => ({ default: m.CalvinoReader })));
const UrakamProtoPage = lazyPage(() => import('./components/malayalam/UrakamProtoPage').then(m => ({ default: m.UrakamProtoPage })));
const MalayalamLibraryPage = lazyPage(() => import('./components/malayalam/MalayalamLibraryPage').then(m => ({ default: m.MalayalamLibraryPage })));
const GitaIndexPage = lazyPage(() => import('./components/gita/GitaIndexPage').then(m => ({ default: m.GitaIndexPage })));
const GitaSthitaprajnaPage = lazyPage(() => import('./components/gita/GitaSthitaprajnaPage').then(m => ({ default: m.GitaSthitaprajnaPage })));
const GitaChapter2Page = lazyPage(() => import('./components/gita/GitaChapter2Page'));

// Published packets use one loading path; no packet is needed by the app shell.
const LOCAL_SUTTA_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  mn10: () => import('./content/references/sutta/mn10.json'),
  mn117: () => import('./content/references/sutta/mn117.json'),
};

const LazyLocalSutta: React.FC<{ uid: string }> = ({ uid }) => {
  const [content, setContent] = useState<React.ReactNode>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([LOCAL_SUTTA_LOADERS[uid](), import('./components/sutta-studio/SuttaStudioView')])
      .then(([m, { SuttaStudioView }]) => {
        if (!cancelled) setContent(<SuttaStudioView packet={m.default as DeepLoomPacket} />);
      })
      .catch((e) => {
        console.error(`[App] Failed to load local sutta ${uid}:`, e);
        if (!cancelled) setError(e?.message || String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);
  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center text-sm">
        Failed to load {uid.toUpperCase()}: {error}
      </div>
    );
  }
  return content ?? <Loader text={`Loading ${uid.toUpperCase()}…`} />;
};

const AppRoutes: React.FC = () => {
  // Track pathname in state so client-side navigation (history.pushState +
  // synthetic popstate) re-renders the right route handler. Previously the
  // pathname was read once at mount, so the Sutta Studio button (a plain
  // <a href="/sutta/...">) caused a full page reload — which rebuilt the
  // store from IDB and dropped any in-memory-only chapter fields.
  const [pathname, setPathname] = useState<string>(
    typeof window !== 'undefined' ? window.location.pathname : ''
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Canonicalize the legacy /sutta/demo alias to the real id /sutta/mn10, preserving
  // any ?query and #word-deep-link. The packet is identical; this just gives the page a
  // real, shareable URL instead of "demo".
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname === '/sutta/demo') {
      window.history.replaceState(null, '', '/sutta/mn10' + window.location.search + window.location.hash);
      setPathname('/sutta/mn10');
    }
  }, []);

  if (pathname === '/bench/sutta-studio') {
    return <SuttaStudioBenchmarkView />;
  }

  // Pipeline output viewer - loads assembled packet from benchmark runs
  if (pathname === '/sutta/pipeline') {
    return <SuttaStudioPipelineLoader />;
  }

  // Two compiles of the same sutta, side by side (production-model bake-offs).
  // Must precede the localSuttaMatch regex, which would swallow "compare" as a sutta id.
  if (pathname === '/sutta/compare') {
    return <SuttaStudioCompareView />;
  }

  const localSuttaMatch = (pathname === '/sutta/demo' ? '/sutta/mn10' : pathname)
    .match(/^\/sutta\/([a-z0-9-]+)$/i);
  if (localSuttaMatch) {
    const uid = localSuttaMatch[1].toLowerCase();
    if (Object.hasOwn(LOCAL_SUTTA_LOADERS, uid)) return <LazyLocalSutta key={uid} uid={uid} />;
  }

  // Any other /sutta/* (SuttaCentral uids, /sutta/fojin/…) → live compile.
  if (pathname.startsWith('/sutta')) {
    return <SuttaStudioApp />;
  }

  if (pathname === '/liturgy' || pathname.startsWith('/liturgy/')) {
    return <LiturgyApp pathname={pathname} />;
  }

  // Source-grounded bilingual reader (Calvino, Italian original + Weaver English).
  if (pathname === '/calvino' || pathname.startsWith('/calvino/')) {
    return <CalvinoReader pathname={pathname} />;
  }

  if (pathname === '/malayalam' || pathname === '/malayalam/') {
    return <MalayalamLibraryPage />;
  }
  if (pathname.startsWith('/malayalam/')) {
    return <UrakamProtoPage />;
  }

  // Gītā deep reader (Sanskrit, sa.wikisource mūla) — the Malayalam pattern.
  if (pathname === '/gita' || pathname === '/gita/') {
    return <GitaIndexPage />;
  }
  // Free Tier-1 chapters (mechanical: Devanāgarī + akshara sounds + MW glosses).
  if (pathname === '/gita/chapter/2' || pathname === '/gita/chapter/2/') {
    return <GitaChapter2Page />;
  }
  if (pathname.startsWith('/gita/')) {
    return <GitaSthitaprajnaPage />;
  }

  return <MainApp />;
};

const App: React.FC = () => (
  <React.Suspense fallback={<Loader text="Loading page…" />}>
    <AppRoutes />
  </React.Suspense>
);

export default App;
