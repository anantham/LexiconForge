import { track } from '@vercel/analytics';
import type {
  AnalyticsFailureEventV1,
  ClientTelemetryErrorPayload,
  ClientTelemetryEventV1,
  EmitClientTelemetryInput,
  LoadingStateSnapshot,
  TelemetryProvider,
  TelemetryRoute,
} from '../types/telemetry';

interface StoreSnapshot {
  appScreen?: 'library' | 'reader-loading' | 'reader';
  currentChapterId?: string | null;
  settings?: {
    provider?: TelemetryProvider;
    model?: string | null;
  };
  isLoading?: {
    fetching?: boolean;
    translating?: boolean;
  };
  hydratingChapters?: Record<string, boolean>;
}

declare global {
  interface Window {
    __APP_STORE__?: {
      getState?: () => StoreSnapshot;
    };
  }
}

const CALLBACK_URL = '/api/client-telemetry';
const DEDUPE_WINDOW_MS = 60_000;
const MESSAGE_LIMIT = 512;
const STACK_LIMIT = 2_000;
const SESSION_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `sess_${Math.random().toString(36).slice(2, 10)}`;

const allEventDedupes = new Map<string, number>();
const callbackDedupes = new Map<string, number>();

const getStoreState = (): StoreSnapshot | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.__APP_STORE__?.getState?.();
};

interface RuntimeEnv {
  VERCEL_GIT_COMMIT_SHA?: string;
  VITE_APP_BUILD_ID?: string;
  VITE_ENABLE_CLIENT_TELEMETRY?: string;
  PROD?: boolean;
  NODE_ENV?: string;
}

const getRuntimeEnv = (): RuntimeEnv => {
  const viteEnv = (import.meta as any).env ?? {};
  return {
    VERCEL_GIT_COMMIT_SHA: viteEnv.VERCEL_GIT_COMMIT_SHA ?? (typeof process !== 'undefined' ? process.env?.VERCEL_GIT_COMMIT_SHA : undefined),
    VITE_APP_BUILD_ID: viteEnv.VITE_APP_BUILD_ID,
    VITE_ENABLE_CLIENT_TELEMETRY: viteEnv.VITE_ENABLE_CLIENT_TELEMETRY,
    PROD: viteEnv.PROD,
    NODE_ENV: viteEnv.MODE,
  };
};

const getRoute = (route?: TelemetryRoute): TelemetryRoute => {
  if (route) {
    return route;
  }

  const appScreen = getStoreState()?.appScreen;
  if (appScreen === 'library') {
    return 'library';
  }
  if (appScreen === 'reader' || appScreen === 'reader-loading') {
    return 'reader';
  }

  if (typeof window === 'undefined') {
    return 'unknown';
  }

  if (window.location.pathname.includes('/settings')) {
    return 'settings';
  }
  if (window.location.pathname.startsWith('/sutta')) {
    return 'reader';
  }

  return 'unknown';
};

const getLoadingState = (chapterId?: string | null): LoadingStateSnapshot => {
  const state = getStoreState();
  const hydratingChapters = state?.hydratingChapters ?? {};
  const activeChapterId = chapterId ?? state?.currentChapterId ?? null;

  return {
    fetching: Boolean(state?.isLoading?.fetching),
    translating: Boolean(state?.isLoading?.translating),
    hydrating: activeChapterId
      ? Boolean(hydratingChapters[activeChapterId])
      : Object.values(hydratingChapters).some(Boolean),
  };
};

const getBuildId = (): string | null => {
  const env = getRuntimeEnv();
  return env.VERCEL_GIT_COMMIT_SHA || env.VITE_APP_BUILD_ID || null;
};

const isCallbackEnabled = (): boolean => {
  const env = getRuntimeEnv();
  return env.PROD === true || env.NODE_ENV === 'production' || env.VITE_ENABLE_CLIENT_TELEMETRY === '1';
};

const hashString = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `h_${(hash >>> 0).toString(16)}`;
};

const redactString = (value: string, maxLength: number): string => {
  const sanitized = value
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:sk|rk|or)-[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_API_KEY]')
    .replace(/https?:\/\/\S+/gi, '[REDACTED_URL]');

  if (sanitized.length <= maxLength) {
    return sanitized;
  }

  return `${sanitized.slice(0, maxLength - 1)}…`;
};

const normalizeError = (error: unknown, fallbackMessage?: string): ClientTelemetryErrorPayload | null => {
  if (!error && !fallbackMessage) {
    return null;
  }

  if (error instanceof Error) {
    return {
      name: error.name || null,
      message: redactString(error.message || fallbackMessage || 'Unknown error', MESSAGE_LIMIT),
      stack_truncated: error.stack ? redactString(error.stack, STACK_LIMIT) : null,
    };
  }

  if (typeof error === 'string') {
    return {
      name: null,
      message: redactString(error, MESSAGE_LIMIT),
      stack_truncated: null,
    };
  }

  return {
    name: null,
    message: redactString(fallbackMessage || 'Unknown error', MESSAGE_LIMIT),
    stack_truncated: null,
  };
};

const pruneDedupes = (dedupeMap: Map<string, number>, now: number) => {
  for (const [fingerprint, timestamp] of dedupeMap.entries()) {
    if (now - timestamp > DEDUPE_WINDOW_MS) {
      dedupeMap.delete(fingerprint);
    }
  }
};

const isRecentlySeen = (dedupeMap: Map<string, number>, fingerprint: string, now: number): boolean => {
  pruneDedupes(dedupeMap, now);
  const previous = dedupeMap.get(fingerprint);
  if (previous && now - previous < DEDUPE_WINDOW_MS) {
    return true;
  }

  dedupeMap.set(fingerprint, now);
  return false;
};

const buildPayload = (input: EmitClientTelemetryInput): ClientTelemetryEventV1 => {
  const state = getStoreState();
  const provider = input.provider ?? state?.settings?.provider ?? null;
  const model = input.model ?? state?.settings?.model ?? null;
  const route = getRoute(input.route);
  const error = normalizeError(input.error, input.errorMessage);
  const chapterIdHash = input.chapterId ? hashString(input.chapterId) : null;
  const timestamp = new Date().toISOString();

  const fingerprint = hashString(
    [
      input.eventType,
      input.failureType,
      input.surface,
      route,
      provider ?? 'none',
      model ?? 'none',
      chapterIdHash ?? 'none',
      error?.message ?? 'no-message',
    ].join('|')
  );

  return {
    schema_version: '1.0',
    event_id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    event_type: input.eventType,
    failure_type: input.failureType,
    surface: input.surface,
    severity: input.severity,
    expected: input.expected,
    user_visible: input.userVisible,
    timestamp,
    session_id: SESSION_ID,
    fingerprint,
    route,
    provider,
    model,
    chapter_id_hash: chapterIdHash,
    build_id: getBuildId(),
    loading_state: getLoadingState(input.chapterId),
    error,
  };
};

const emitAnalytics = (payload: ClientTelemetryEventV1) => {
  if (typeof window === 'undefined') {
    return;
  }

  const analyticsPayload: AnalyticsFailureEventV1 = {
    failure_type: payload.failure_type,
    surface: payload.surface,
    expected: payload.expected,
    user_visible: payload.user_visible,
    provider: payload.provider ?? 'none',
    route: payload.route,
  };

  track(payload.event_type, { ...analyticsPayload });
};

const shouldSendCallback = (payload: ClientTelemetryEventV1): boolean => {
  if (!isCallbackEnabled() || typeof window === 'undefined') {
    return false;
  }

  if (payload.event_type === 'client_uncaught_error' || payload.event_type === 'client_unhandled_rejection') {
    return true;
  }

  return payload.event_type === 'translation_failed' && payload.expected === false;
};

const sendCallback = (payload: ClientTelemetryEventV1) => {
  void fetch(CALLBACK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Best-effort only: client telemetry must never degrade the UX.
  });
};

export const emitClientTelemetryEvent = (input: EmitClientTelemetryInput): ClientTelemetryEventV1 | null => {
  const payload = buildPayload(input);
  const now = Date.now();

  if (input.dedupeAll && isRecentlySeen(allEventDedupes, payload.fingerprint, now)) {
    return null;
  }

  emitAnalytics(payload);

  if (shouldSendCallback(payload)) {
    const skipCallback = input.dedupeCallback && isRecentlySeen(callbackDedupes, payload.fingerprint, now);
    if (!skipCallback) {
      sendCallback(payload);
    }
  }

  return payload;
};

export const clientTelemetry = {
  emit: emitClientTelemetryEvent,
};
