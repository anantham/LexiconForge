const storeDebugEnabled = () =>
  typeof window !== 'undefined' && window.localStorage?.getItem('store-debug') === 'true';

export const slog = (...args: any[]) => { if (storeDebugEnabled()) console.log(...args); };
export const swarn = (...args: any[]) => { if (storeDebugEnabled()) console.warn(...args); };
