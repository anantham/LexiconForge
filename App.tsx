import React from 'react';
import MainApp from './MainApp';
import { SuttaStudioApp } from './components/sutta-studio/SuttaStudioApp';
import { SuttaStudioView } from './components/sutta-studio/SuttaStudioView';
import { DEMO_PACKET_MN10 } from './components/sutta-studio/demoPacket';

const App: React.FC = () => {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

  // Direct demo route - renders curated mock data without any API calls
  if (pathname === '/sutta/demo') {
    return <SuttaStudioView packet={DEMO_PACKET_MN10} />;
  }

  if (pathname.startsWith('/sutta')) {
    return <SuttaStudioApp />;
  }
  return <MainApp />;
};

export default App;
