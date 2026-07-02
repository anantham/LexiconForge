import React, { useEffect, useState } from 'react';
import MainApp from './MainApp';
import { SuttaStudioBenchmarkView } from './components/bench/SuttaStudioBenchmarkView';
import { SuttaStudioApp } from './components/sutta-studio/SuttaStudioApp';
import { SuttaStudioView } from './components/sutta-studio/SuttaStudioView';
import { SuttaStudioPipelineLoader } from './components/sutta-studio/SuttaStudioPipelineLoader';
import { SuttaStudioCompareView } from './components/sutta-studio/SuttaStudioCompareView';
import { DEMO_PACKET_MN10 } from './components/sutta-studio/demoPacket';
import type { DeepLoomPacket } from './types/suttaStudio';
import { LiturgyApp } from './components/liturgy/LiturgyApp';

// Published local suttas — real IDs, rendered from bundled packets (no API calls).
// Add an entry here to publish a sutta at a real, linkable URL like /sutta/mn10.
const LOCAL_SUTTA_PACKETS: Record<string, DeepLoomPacket> = {
  mn10: DEMO_PACKET_MN10,
};

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

  // Published local suttas by REAL id (/sutta/mn10, …) — bundled packet, no API calls.
  // /sutta/demo is a legacy alias handled here (the effect above rewrites its URL to mn10).
  if (pathname === '/sutta/demo') {
    return <SuttaStudioView packet={DEMO_PACKET_MN10} />;
  }
  const localSuttaMatch = pathname.match(/^\/sutta\/([a-z0-9-]+)$/i);
  if (localSuttaMatch) {
    const packet = LOCAL_SUTTA_PACKETS[localSuttaMatch[1].toLowerCase()];
    if (packet) return <SuttaStudioView packet={packet} />;
  }

  // Any other /sutta/* (SuttaCentral uids, /sutta/fojin/…) → live compile.
  if (pathname.startsWith('/sutta')) {
    return <SuttaStudioApp />;
  }

  if (pathname === '/liturgy' || pathname.startsWith('/liturgy/')) {
    return <LiturgyApp pathname={pathname} />;
  }

  return <MainApp />;
};

export default App;
