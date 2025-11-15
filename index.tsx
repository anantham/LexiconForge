
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('[index.tsx] Starting application mount');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

console.log('[index.tsx] Root element found, creating React root');

const root = ReactDOM.createRoot(rootElement);

console.log('[index.tsx] React root created, about to render App');

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('[index.tsx] App render called');

