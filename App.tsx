import React, { useEffect, useState } from 'react';
import MainApp from './MainApp';
import { SuttaStudioBenchmarkView } from './components/bench/SuttaStudioBenchmarkView';
import { SuttaStudioApp } from './components/sutta-studio/SuttaStudioApp';
import { SuttaStudioView } from './components/sutta-studio/SuttaStudioView';
import { SuttaStudioPipelineLoader } from './components/sutta-studio/SuttaStudioPipelineLoader';
import { DEMO_PACKET_MN10 } from './components/sutta-studio/demoPacket';

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

  if (pathname === '/bench/sutta-studio') {
    return <SuttaStudioBenchmarkView />;
  }

  // Direct demo route - renders curated mock data without any API calls
  if (pathname === '/sutta/demo') {
    return <SuttaStudioView packet={DEMO_PACKET_MN10} />;
  }

  // Pipeline output viewer - loads assembled packet from benchmark runs
  if (pathname === '/sutta/pipeline') {
    return <SuttaStudioPipelineLoader />;
  }

  if (pathname.startsWith('/sutta')) {
    return <SuttaStudioApp />;
  }
  return <MainApp />;
};

export default App;
