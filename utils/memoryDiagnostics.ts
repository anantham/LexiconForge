import { debugLog } from './debug';

type MemoryLogLevel = 'summary' | 'full';

type LogPayload = Record<string, unknown> | undefined;

const memoryPrefix = (message: string): string => `[Memory] ${message}`;

const emit = (level: MemoryLogLevel, message: string, payload?: LogPayload): void => {
  if (payload === undefined) {
    debugLog('memory', level, memoryPrefix(message));
    return;
  }
  debugLog('memory', level, memoryPrefix(message), payload);
};

export const memorySummary = (message: string, payload?: LogPayload): void => {
  emit('summary', message, payload);
};

export const memoryDetail = (message: string, payload?: LogPayload): void => {
  emit('full', message, payload);
};

export const memoryTimestamp = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

export const memoryTiming = (
  label: string,
  start: number,
  extra?: Record<string, unknown>
): number => {
  const end = memoryTimestamp();
  const durationMs = end - start;
  const payload = {
    durationMs: Number.isFinite(durationMs) ? Number(durationMs.toFixed(2)) : durationMs,
    ...(extra || {}),
  };
  memoryDetail(`${label} completed`, payload);
  return durationMs;
};

export const memoryCacheSnapshot = (
  context: string,
  data: { size: number; pinned?: number; hydrated?: number; windowSize?: number; note?: string }
): void => {
  memoryDetail(`${context} cache state`, data);
};
