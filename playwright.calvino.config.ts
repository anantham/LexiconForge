// Throwaway config for the LOCAL-only Calvino completeness gate: no webServer
// (points at an already-running dev server; BASE env, default :5210).
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /calvino-completeness\.spec\.ts/,
  timeout: 60000,
  use: { headless: true },
});
