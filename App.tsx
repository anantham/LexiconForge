import React from 'react';
import MainApp from './MainApp';
import { SuttaStudioApp } from './components/sutta-studio/SuttaStudioApp';

const App: React.FC = () => {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  if (pathname.startsWith('/sutta')) {
    return <SuttaStudioApp />;
  }
  return <MainApp />;
};

export default App;
