import React, { useEffect, useState } from 'react';
import Loader from './components/Loader';
import MainApp from './MainApp';
import { SuttaStudioBenchmarkView } from './components/bench/SuttaStudioBenchmarkView';
import { SuttaStudioApp } from './components/sutta-studio/SuttaStudioApp';
import { SuttaStudioView } from './components/sutta-studio/SuttaStudioView';
import { SuttaStudioPipelineLoader } from './components/sutta-studio/SuttaStudioPipelineLoader';
import { SuttaStudioCompareView } from './components/sutta-studio/SuttaStudioCompareView';
import { DEMO_PACKET_MN10 } from './components/sutta-studio/demoPacket';
import type { DeepLoomPacket } from './types/suttaStudio';
import { LiturgyApp } from './components/liturgy/LiturgyApp';
import { CalvinoReader } from './components/calvino/CalvinoReader';

// Published local suttas — real IDs, rendered from bundled packets (no API calls).
// Add an entry here to publish a sutta at a real, linkable URL like /sutta/mn10.
const LOCAL_SUTTA_PACKETS: Record<string, DeepLoomPacket> = {
  mn10: DEMO_PACKET_MN10,
};

// Larger packets load as their own chunk on route hit instead of riding in the
// main bundle (mn117 is ~1.1MB minified; mn10's 0.5MB stays sync for now).
const LAZY_SUTTA_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  mn117: () => import('./content/references/sutta/mn117.json'),
};

function LazyLocalSutta({ uid }: { uid: string }) {
  const [packet, setPacket] = useState<DeepLoomPacket | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    LAZY_SUTTA_LOADERS[uid]()
      .then((m) => {
        if (!cancelled) setPacket(m.default as DeepLoomPacket);
      })
      .catch((e) => {
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
  if (!packet) return <Loader />;
  return <SuttaStudioView packet={packet} />;
}

const App: React.FC = () => {
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

  // Bake-off resolved 2026-07-03: gemini-3-flash won (100% word coverage vs
  // 32-40% for deepseek-v4-flash / gemini-3.5-flash); its surface-repaired
  // compile is now the canonical bundled packet, lazy-loaded below via
  // LAZY_SUTTA_LOADERS. The compare lab stays at /sutta/compare.

  // Published local suttas by REAL id (/sutta/mn10, …) — bundled packet, no API calls.
  // /sutta/demo is a legacy alias handled here (the effect above rewrites its URL to mn10).
  if (pathname === '/sutta/demo') {
    return <SuttaStudioView packet={DEMO_PACKET_MN10} />;
  }
  const localSuttaMatch = pathname.match(/^\/sutta\/([a-z0-9-]+)$/i);
  if (localSuttaMatch) {
    const uid = localSuttaMatch[1].toLowerCase();
    const packet = LOCAL_SUTTA_PACKETS[uid];
    if (packet) return <SuttaStudioView packet={packet} />;
    if (LAZY_SUTTA_LOADERS[uid]) return <LazyLocalSutta uid={uid} />;
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

  return <MainApp />;
};

export default App;
