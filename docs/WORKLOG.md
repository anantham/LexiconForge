### [2026-01-07 05:04] [Agent: Codex]
**Status:** Starting
**Task:** Add structured EPUB export warnings (missing translations, cache misses) and package validation logs without changing output.
**Worktree:** ../LexiconForge.worktrees/codex-epub-diagnostics/
**Branch:** feat/codex-epub-diagnostics
**Files likely affected:** store/slices/exportSlice.ts; services/epubService/packagers/epubPackager.ts; tests/services/epubPackager.diagnostics.test.ts; docs/WORKLOG.md

### [2026-01-07 12:21] [Agent: Codex]
**Status:** Complete
**Progress:** Added structured export warnings for missing translations/cache misses, added EPUB package validation warnings, and added diagnostics test coverage.
**Files modified (line numbers + why):**
- store/slices/exportSlice.ts:31,270,342,405,442,587 - track/export structured warnings, log to telemetry, surface warning counts in progress + performance telemetry.
- services/epubService/packagers/epubPackager.ts:15,21,27,33,146,307 - emit package validation warnings (missing title/identifier, no chapters, invalid cover image, XHTML parse errors).
- tests/services/epubPackager.diagnostics.test.ts:1,4,32 - verify structured warnings for missing title and invalid cover image.
- docs/WORKLOG.md:1 - session log updates.
**Tests:** npx vitest run tests/services/epubPackager.diagnostics.test.ts

2025-12-26 20:31 UTC - Provider contract VCR replay tests
- Files: tests/contracts/provider.contract.test.ts; tests/contracts/vcr/loadCassette.ts; tests/contracts/vcr/types.ts; tests/contracts/cassettes/*.json; docs/WORKLOG.md
- Why: Provider contract tests were a skipped scaffold; we need deterministic replay tests to validate real adapter behavior without network calls and without placeholder assertions.
- Details: Adds replay-only VCR cassettes that drive real `OpenAIAdapter.translate()` and `GeminiAdapter.translate()` while mocking only provider SDK boundaries; asserts JSON parsing, token accounting, cost wiring, and OpenAI metrics recording.
- Tests: `npm test`

2025-12-24 11:23 UTC - Migration recovery UI gate
- Files: App.tsx; components/MigrationRecovery.tsx; tests/components/MigrationRecovery.test.tsx; docs/WORKLOG.md
- Why: When the DB is newer/corrupted/blocked or a migration failed, users need a clear recovery path (restore from backup, upload backup, or start fresh) instead of a silent failure.
- Details: `App.tsx` calls `prepareConnection()` before store init and blocks into a full-screen `MigrationRecovery` overlay when `shouldBlockApp()` is true.
- Tests: `npx tsc --noEmit`; `npx vitest run tests/components/MigrationRecovery.test.tsx`

2025-12-24 11:15 UTC - Fix diffResults import + test hardening
- Files: services/db/operations/imports.ts; tests/current-system/export-import.test.ts; tests/services/comparisonService.test.ts; tests/adapters/providers/OpenAIAdapter.test.ts; tests/contracts/provider.contract.test.ts; tests/hooks/useChapterTelemetry.test.tsx; docs/WORKLOG.md
- Why: Imported diffResults could throw `DataError` because export emits `fanVersionId: null` but IndexedDB keys must be valid strings; plus expand coverage for provider/adversarial parsing paths.
- Details:
  - Normalized diffResults records during full-session import (coerce `fanVersionId` to `''`, fill hash nulls) so composite keys remain valid.
  - Strengthened tests around diffResults export/import, OpenAI adapter error paths, comparison JSON extraction, and chapter telemetry perf/logging.
- Tests: `npx tsc --noEmit`; `npx vitest run tests/current-system/export-import.test.ts`; `npx vitest run tests/services/comparisonService.test.ts`; `npx vitest run tests/adapters/providers/OpenAIAdapter.test.ts`; `npx vitest run tests/hooks/useChapterTelemetry.test.tsx`

--- Archived entries available at docs/archive/WORKLOG-2025-11-and-earlier.md ---
