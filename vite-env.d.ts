/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DB_BACKEND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
