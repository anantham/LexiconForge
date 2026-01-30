import React from 'react';
import MainApp from './MainApp';
import { SuttaStudioBenchmarkView } from './components/bench/SuttaStudioBenchmarkView';
import { SuttaStudioApp } from './components/sutta-studio/SuttaStudioApp';
import { SuttaStudioView } from './components/sutta-studio/SuttaStudioView';
import { SuttaStudioPipelineLoader } from './components/sutta-studio/SuttaStudioPipelineLoader';
import { DEMO_PACKET_MN10 } from './components/sutta-studio/demoPacket';

const App: React.FC = () => {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

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
