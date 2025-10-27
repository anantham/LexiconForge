const isLocalStorageAvailable = (): boolean => {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
};

export const aiDebugEnabled = (): boolean => {
  try {
    return isLocalStorageAvailable() && localStorage.getItem('LF_AI_DEBUG') === '1';
  } catch {
    return false;
  }
};

export const aiDebugFullEnabled = (): boolean => {
  try {
    return isLocalStorageAvailable() && localStorage.getItem('LF_AI_DEBUG_FULL') === '1';
  } catch {
    return false;
  }
};

export const dlog = (...args: any[]) => {
  if (aiDebugEnabled()) console.log(...args);
};

export const dlogFull = (...args: any[]) => {
  if (aiDebugFullEnabled()) console.log(...args);
};
