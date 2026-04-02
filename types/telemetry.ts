export type TelemetryEventType =
  | 'known_limit_reached'
  | 'translation_failed'
  | 'client_uncaught_error'
  | 'client_unhandled_rejection'
  | 'ui_error_rendered';

export type TelemetryFailureType =
  | 'trial_limit'
  | 'missing_api_key'
  | 'timeout'
  | 'provider_malformed_response'
  | 'uncaught_exception'
  | 'unhandled_rejection'
  | 'unknown';

export type TelemetrySurface =
  | 'auto_translate'
  | 'manual_translate'
  | 'ui_render'
  | 'global';

export type TelemetrySeverity = 'warning' | 'error' | 'critical';

export type TelemetryRoute =
  | 'reader'
  | 'library'
  | 'bootstrap'
  | 'settings'
  | 'unknown';

export type TelemetryProvider =
  | 'OpenRouter'
  | 'OpenAI'
  | 'Gemini'
  | 'Claude'
  | 'DeepSeek'
  | null;

export interface LoadingStateSnapshot {
  fetching: boolean;
  translating: boolean;
  hydrating: boolean;
}

export interface ClientTelemetryErrorPayload {
  name: string | null;
  message: string;
  stack_truncated: string | null;
}

export interface ClientTelemetryEventV1 {
  schema_version: '1.0';
  event_id: string;
  event_type: TelemetryEventType;
  failure_type: TelemetryFailureType;
  surface: TelemetrySurface;
  severity: TelemetrySeverity;
  expected: boolean;
  user_visible: boolean | null;
  timestamp: string;
  session_id: string;
  fingerprint: string;
  route: TelemetryRoute;
  provider: TelemetryProvider;
  model: string | null;
  chapter_id_hash: string | null;
  build_id: string | null;
  loading_state: LoadingStateSnapshot;
  error: ClientTelemetryErrorPayload | null;
}

export interface AnalyticsFailureEventV1 {
  failure_type: TelemetryFailureType;
  surface: TelemetrySurface;
  expected: boolean;
  user_visible: boolean | null;
  provider: Exclude<TelemetryProvider, null> | 'none';
  route: TelemetryRoute;
}

export interface TelemetryErrorContext {
  sourceEventType?: Extract<TelemetryEventType, 'known_limit_reached' | 'translation_failed'>;
  failureType: TelemetryFailureType;
  surface: Exclude<TelemetrySurface, 'ui_render' | 'global'>;
  expected: boolean;
  provider?: TelemetryProvider;
  model?: string | null;
  chapterId?: string | null;
}

export type TranslationOrigin = Extract<TelemetrySurface, 'auto_translate' | 'manual_translate'>;

export interface EmitClientTelemetryInput {
  eventType: TelemetryEventType;
  failureType: TelemetryFailureType;
  surface: TelemetrySurface;
  severity: TelemetrySeverity;
  expected: boolean;
  userVisible: boolean | null;
  provider?: TelemetryProvider;
  model?: string | null;
  chapterId?: string | null;
  error?: unknown;
  errorMessage?: string;
  route?: TelemetryRoute;
  dedupeAll?: boolean;
  dedupeCallback?: boolean;
}
