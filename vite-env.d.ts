/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DB_BACKEND?: string;
  readonly VITE_APP_BUILD_ID?: string;
  readonly VITE_ENABLE_CLIENT_TELEMETRY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
