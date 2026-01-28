const SUTTA_FLOW_DEBUG_KEY = 'LF_SUTTA_DEBUG_FLOW';

export const isSuttaFlowDebug = (): boolean => {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem(SUTTA_FLOW_DEBUG_KEY) === '1';
  } catch {
    return false;
  }
};

const hasPayload = (payload?: Record<string, unknown>) =>
  Boolean(payload && Object.keys(payload).length > 0);

export const logSuttaFlow = (message: string, payload?: Record<string, unknown>) => {
  if (!isSuttaFlowDebug()) return;
  if (hasPayload(payload)) {
    console.log(`[SuttaStudioFlow] ${message}`, payload);
  } else {
    console.log(`[SuttaStudioFlow] ${message}`);
  }
};

export const warnSuttaFlow = (message: string, payload?: Record<string, unknown>) => {
  if (!isSuttaFlowDebug()) return;
  if (hasPayload(payload)) {
    console.warn(`[SuttaStudioFlow] ${message}`, payload);
  } else {
    console.warn(`[SuttaStudioFlow] ${message}`);
  }
};

