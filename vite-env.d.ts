/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_OPENAI_API_KEY: string;
  readonly VITE_DEEPSEEK_API_KEY: string;
  readonly VITE_CLAUDE_API_KEY: string;
  readonly VITE_OPENROUTER_API_KEY: string;
  readonly VITE_PIAPI_API_KEY: string;
  readonly VITE_GOOGLE_DRIVE_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
