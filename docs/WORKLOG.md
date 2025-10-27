2025-10-27 08:15 UTC - Backfill comparison workflow coverage & refresh manifest
- Files modified: tests/services/comparisonService.test.ts; docs/TEST_MANIFEST.md
- Purpose: Add focused comparison service regression coverage and update the coverage manifest after rerunning the EPUB + hook suites flagged as unknown.
- Notes: Vitest OpenAI client mocked with hoisted helpers to assert prompt payload + error handling; manifest rows now reflect fresh runs against schema v11 fixtures.
- Tests: `npx vitest run tests/services/comparisonService.test.ts`; `npx vitest run tests/services/HtmlSanitizer.test.ts`; `npx vitest run tests/epub/assetResolver.test.ts`; `npx vitest run tests/epub/contentBuilder.test.ts`; `npx vitest run tests/epub/dataCollector.test.ts`; `npx vitest run tests/epub/exportService.test.ts`; `npx vitest run tests/epub/packageBuilder.test.ts`; `npx vitest run tests/hooks/usePersistentState.test.tsx`; `npx vitest run tests/hooks/useTextSelection.test.tsx`

2025-10-27 01:32 UTC - Replace oboe importer with native streaming parser & improve UX telemetry
- Files modified: services/importService.ts; components/NovelLibrary.tsx
- Purpose: Drop the oboe/clarinet dependency so large translations no longer trip the 64 KB buffer cap; stream metadata + chapters via Fetch while preserving progressive hydration; log telemetry for first-batch/complete timings and surface quick-start toasts.
- Notes: Custom brace-aware parser feeds existing storage logic, new `FIRST_BATCH_THRESHOLD` reduces wait to 4 chapters, and completion toast now signals when everything is cached. TypeScript still flags legacy DTO shape mismatches (pre-existing).
- Tests: `npx tsc --noEmit | rg "importService"` *(fails: longstanding DTO typing issues unrelated to this change)*

2025-10-27 01:55 UTC - Guard image retries when model is disabled
- Files modified: store/slices/imageSlice.ts
- Purpose: Prevent illustration retries from calling providers when the selected model is `none`, surfacing a warning toast instead of logging errors.
- Notes: Skips API metrics/log spam and preserves existing image data; ImageGenerationService guard still handles legacy `'None'` casing.
- Tests: `npx tsc --noEmit | rg "imageSlice"` *(fails: pre-existing DTO typing warnings elsewhere)*

2025-10-27 00:48 UTC - Fix streaming hydration TDZ regression
- Files modified: components/NovelLibrary.tsx
- Purpose: Remove dynamic `useAppStore` re-import that triggered TDZ exceptions during `onFirstChaptersReady`, wrap initial hydration in try/catch, and surface warnings when the fast-path fails so readers aren’t blocked.
- Notes: Streaming import now proceeds to open the first chapters once threshold is reached; fallback notification appears if hydration still throws. TypeScript run still reports legacy NovelLibrary shape mismatches (pre-existing).
- Tests: `npx tsc --noEmit | rg "NovelLibrary"` *(fails: longstanding NovelLibrary DTO typing issues unrelated to this patch)*

2025-10-27 00:26 UTC - Automate Codex PR reviews
- Files modified: .github/workflows/codex-review.yml
- Purpose: Request Codex code reviews automatically for every non-draft PR unless labeled `skip-codex`.
- Notes: Workflow relies on repository secret `OPENAI_API_KEY`; optional label can suppress the run when needed. Trigger fires on open, reopen, synchronize, and ready_for_review events.
- Tests: GitHub Actions syntax validation pending (requires push to remote).

2025-10-27 00:09 UTC - Stabilize atomic translation writes & streaming import buffer
- Files modified: services/indexeddb.ts:1397-1520; services/importService.ts:368-438
- Purpose: Ensure `storeTranslationAtomic` always resolves a stableId before persisting new versions and expand streamed import buffer configuration to mitigate Clarinet’s 64KB string cap.
- Notes: Atomic path now mirrors legacy stableId derivation with a fallback hash on translation payloads; streaming importer hydrates oboe via options object (`cachedBufferSize` guard) and feeds ChapterOps with explicitly typed payloads to silence TS complaints.
- Tests: `npx tsc --noEmit` *(fails: longstanding repo-wide TS errors; verified no new diagnostics for indexeddb/importService via targeted grep)*

2025-10-19 06:18 UTC - Fix diff heatmap stylistic marker crash
- Files modified: .worktrees/semantic-diff-heatmap/components/ChapterView.tsx:1270-1285
- Purpose: Replaced stale `markerVisibility` guard with `markerVisibilitySettings` so grey-only markers no longer throw a ReferenceError when diff analysis completes.
- Notes: Runtime crash occurred after the diff prompt refactor when JSX retained the old variable name while visibility logic moved into `resolveMarkerVisibility`.
- Tests: `npx tsc --noEmit` *(fails: legacy audio storage + archived fixtures already contain invalid characters; unrelated to this change)*

2025-10-18 14:05 UTC - Add export options UI and telemetry-aware EPUB stats
- Files modified: components/SessionInfo.tsx; store/slices/exportSlice.ts; services/indexeddb.ts; services/epubService.ts; docs/EPUB.md; tests/current-system/export-import.test.ts; tests/store/nullSafety.test.ts
- Purpose: Let users choose which data (chapters, telemetry, illustrations) to include in JSON exports, surface size estimates, capture export timings, embed Cache API images when requested, and surface session telemetry aggregates inside the EPUB acknowledgments page.
- Notes: JSON export now waits for the IndexedDB snapshot, records `ux:export:*` telemetry, attaches image assets via `assets.images` when enabled, and the EPUB stats page highlights navigation/hydration/export durations recorded by telemetry. Modal UI disables illustration export unless chapters are included.
- Tests: `npm run test -- tests/current-system/export-import.test.ts --run`; `npm run test -- tests/store/nullSafety.test.ts --run`

2025-10-18 13:20 UTC - Instrument UX performance telemetry
- Files modified: services/navigationService.ts; services/indexeddb.ts; services/telemetryService.ts; components/ChapterView.tsx; components/SessionInfo.tsx
- Purpose: Captured navigation, hydration, fetch, and key UI readiness timings via `telemetryService`, persisted events into session exports for downstream analysis.
- Notes: Emitted `ux:*` performance events for chapter hydration, fetch, component mount/ready states, and initial IndexedDB hydration; export JSON now includes telemetry snapshot.
- Tests: Manual navigation + export in dev build to verify events appear in `window.exportTelemetry()` and JSON payload

2025-10-18 12:30 UTC - Build telemetry export dashboard scaffold
- Files modified: tools/telemetry-dashboard/index.html (new)
- Purpose: Added standalone HTML/JS viewer that ingests `lexiconforge-full-1` export JSON, aggregates chapter/provider metrics, and flags duplicate translation runs for cost investigations.
- Notes: Computes per-provider totals, per-chapter version tables, and duplicate fingerprints hashed on text+settings—all client-side with no build step.
- Tests: Manual browser load (Chrome) with sample export payload

2025-10-18 11:45 UTC - Diff heatmap alignment & model parity
- Files modified: services/diff/DiffAnalysisService.ts; services/diff/DiffTriggerService.ts; services/diff/types.ts; services/diff/constants.ts (new); services/diff/hash.ts (new); adapters/repo/DiffResultsRepo.ts; tests/services/diff/DiffAnalysisService.test.ts; tests/adapters/repo/DiffResultsRepo.test.ts; tests/db/diffResults.test.ts; hooks/useDiffMarkers.ts; components/diff/DiffGutter.tsx; components/ChapterView.tsx; services/navigationService.ts; services/translationService.ts; store/slices/translationsSlice.ts; tests/hooks/useDiffMarkers.test.tsx; docs updated.
- Purpose: Normalize paragraph chunking for diff markers, respect user-selected translation models with JSON fallback, allow manual diff reruns even when translation settings are unchanged, and add instrumentation for future diagnostics.
- Notes: Diff analysis now hashes HTML paragraphs, falls back to `gpt-4o-mini` on parse failure, and caches both IDs and hashes to prevent stale hits. UI gutter positions markers proportionally and retranslate button stays available when a translation exists.
- Tests: `npm run test -- --run`

2025-10-18 09:30 UTC - Finalize image version system QA
- Files modified: store/slices/exportSlice.ts:40-90, 186-246; tests/services/export/exportSlice.test.ts (new); docs/manual-tests/image-versioning.md (new)
- Purpose: Added caption helper tests, recorded manual QA checklist, and exported `buildImageCaption` for verification so the versioned illustration workflow has documented coverage.
- Notes: Manual checklist captures generate/retry/delete/export scenarios; helper test exercises metadata formatting.
- Tests: `npm run test -- tests/services/export/exportSlice.test.ts`

2025-10-18 13:32 UTC - Diff fallback explanation cleanup
- Files modified: services/diff/DiffAnalysisService.ts (lines ~30-320, ~420-480); components/ChapterView.tsx (lines ~140-200, ~1270-1290, export tail); services/diff/types.ts (lines ~15-25); tests/services/diff/DiffAnalysisService.test.ts (new fallback/explanation assertions); tests/components/diff/ChapterView.mapMarker.test.tsx (new); docs/WORKLOG.md.
- Purpose: Stop injecting the “No differences reported” text into every fallback marker, trim explanation strings, salvage freeform reason text or single-field explanations when the model deviates from the schema, and block inline grey copy unless there’s a meaningful explanation.
- Notes: Grey fallback markers now omit confidence values; hover tooltips continue to show “No explanation provided.” when empty. Added test exposure hook for mapMarkerForVisibility to assert trimming logic, service tests covering schema slip + single explanation field, wider LLM preview (2k chars), and a runtime warning when non-grey markers are missing explanations.
- Tests: `npm run test -- tests/services/diff/DiffAnalysisService.test.ts --run`; `npm run test -- tests/components/diff/ChapterView.mapMarker.test.tsx --run`; `npm run test`

2025-10-18 21:34 UTC - Diff prompt customization & color taxonomy overhaul
- Files modified: config/prompts.json; services/diff/DiffAnalysisService.ts; services/diff/DiffTriggerService.ts; services/diff/types.ts; services/sessionManagementService.ts; components/ChapterView.tsx; components/SettingsModal.tsx; components/diff/DiffPip.tsx; styles/diff-colors.css; tests/components/diff/DiffPip.test.tsx; docs/WORKLOG.md.
- Purpose: Encode the new red/orange/blue/purple schema, add grey fallbacks for every paragraph, surface the diff-analysis prompt in Settings with editing + reset controls, and ensure runtime honors customized prompts.
- Notes: LLM now omits grey chunks; service fills them locally, logs coverage gaps, and persists normalized markers. Settings migrate legacy visibility flags and expose legend + manual rerun.
- Tests: `npm run test -- tests/components/diff/DiffPip.test.tsx --run`; `npm run test -- tests/services/diff/DiffAnalysisService.test.ts --run`

2025-10-18 21:12 UTC - Diff heatmap settings relocation & manual refresh
- Files modified: components/SettingsModal.tsx (lines ~40-750); components/ChapterView.tsx (lines ~1030-1040); docs/WORKLOG.md.
- Purpose: Move diff heatmap controls into a dedicated Settings “Features” tab, add a manual diff cache invalidation/re-run button, and remove paragraph highlight flashes when clicking markers.
- Notes: Manual refresh deletes stored diff results then replays the `translation:complete` event so the trigger service recomputes markers.
- Tests: Pending (UI change only; manual verification recommended)

2025-10-18 20:57 UTC - Block unsupported fetch attempts
- Files modified: services/navigationService.ts (guard added at line 403); docs/WORKLOG.md
- Purpose: Reintroduce the supported-site check so `handleFetch` short-circuits on domains without adapters instead of hammering the proxy rotation.
- Notes: Aligns worktree behaviour with mainline navigation flow; unsupported URLs now throw immediately.
- Tests: `npm run test -- tests/current-system/navigation.test.ts --run`

2025-10-18 20:34 UTC - Diff heatmap UI rail refactor
- Files modified: components/ChapterView.tsx (paragraph layout & marker rail); components/diff/DiffPip.tsx (color normalization); styles/diff-colors.css (blue variable); docs/WORKLOG.md.
- Purpose: Relocate diff markers to a right-aligned rail, add vertical spacing between paragraphs, and remove hover-based highlighting so the reading experience stays uncluttered.
- Notes: Paragraph wrappers now provide padding and an absolute marker column; invisible placeholders maintain alignment when no markers are present.
- Tests: `npm run test -- tests/components/diff/DiffPip.test.tsx --run`

2025-10-18 20:26 UTC - Diff heatmap visibility controls & palette refresh
- Files modified: types.ts (AppSettings + visibility type); services/sessionManagementService.ts (default settings); components/SettingsModal.tsx (new toggles); components/ChapterView.tsx (visibility filtering & new colors); components/diff/DiffPip.tsx, components/diff/DiffPip.module.css (color normalization); styles/diff-colors.css (blue palette); tests/components/diff/DiffPip.test.tsx.
- Purpose: Add per-category visibility toggles (fan/raw/stylistic) defaulting grey off, remap raw differences to blue, and filter hidden categories ahead of rendering/navigation.
- Notes: Visible markers now derive colors from reasons, ensuring cached results adopt the new orange/blue scheme even if stored colors differ.
- Tests: `npm run test -- tests/components/diff/DiffPip.test.tsx --run`

2025-10-18 20:12 UTC - Diff analysis logging instrumentation
- Files modified: services/diff/DiffAnalysisService.ts (diagnostic helpers added around lines 20-120); docs/WORKLOG.md
- Purpose: Gate prompt/response previews behind the diff debug pipeline, surface chunk/marker coverage summaries, and warn when markers reference missing or out-of-range chunks.
- Notes: New logs emit start/end previews alongside payload length without altering existing console summaries.
- Tests: `npm run test -- tests/services/diff/DiffAnalysisService.test.ts --run`

2025-10-15 08:07 UTC - Enforce structured Gemini JSON responses
- Files modified: services/translate/translationResponseSchema.ts:1-150, adapters/providers/GeminiAdapter.ts:1-240, adapters/providers/OpenAIAdapter.ts:1-360, services/translate/Translator.ts:70-140
- Purpose: Shared the translation response schema across adapters, required Gemini to emit `application/json` with the schema, and stopped retrying after schema parse failures.
- Notes: Gemini adapter now mirrors OpenAI’s usage metrics fields and keeps legacy aliases (`illustrations`/`amendments`) for downstream compatibility.
- Tests: Not run (manual validation required for SDK calls)

2025-10-15 01:58 UTC - Add Gemini raw response debug logging
- Files modified: adapters/providers/GeminiAdapter.ts:17-60, 125-180
- Purpose: Gate Gemini adapter debug output on `LF_AI_DEBUG_LEVEL` and emit raw response previews/full dumps when JSON parsing fails so we can inspect malformed payloads.
- Notes: Preview logs print first 500–800 chars by default; full body requires setting `LF_AI_DEBUG_LEVEL=full`.
- Tests: Not run (logging only)

2025-10-14 06:00 UTC - Archive legacy amendment proposal diagnostics
- Files modified: archive/tests/store/amendmentProposal.legacy.test.ts:1-199, tests/store/amendmentProposal.test.ts:33-86
- Purpose: Preserved the eight skipped legacy diagnostics in an archived suite while trimming the active amendment proposal tests down to the current slice-based coverage.
- Notes: Archived suite sits behind `describe.skip` to keep history without polluting the run; active suite now focuses on accept/reject/edit plus IndexedDB logging behaviour.
- Tests: Not run (legacy archive remains skipped)

2025-10-13 17:59 UTC - Restore amendment logging test harness stability
- Files modified: services/indexeddb.ts:482-493, tests/store/amendmentProposal.test.ts:1-14, 340-414
- Purpose: Reinstated the `hasTranslation` index while wiring tests to use an in-memory fake IndexedDB so migration v11 can be exercised without schema drift blocking the suite.
- Notes: Test setup now clears the fake database via `indexedDBService.clearAllData()` before each run to keep action logs isolated.
- Tests: `npm run test -- tests/store/amendmentProposal.test.ts --run`

2025-10-13 18:10 UTC - Refresh README marketing copy
- Files modified: README.md:4-107
- Purpose: Surface live hosted app link, Patreon concierge program, numbered feedback workflow, and inline feature imagery pulled from `Marketing/Features/`.
- Notes: Added CTA block, image gallery (emoji toolbar, models, comparison, art), and consolidated Patreon references in community/support sections.
- Tests: Not applicable

2025-10-13 18:45 UTC - Test suite census groundwork
- Files modified: docs/TEST_MANIFEST.md
- Purpose: Catalogued every suite under `tests/`, annotated current health (pass/fail/unknown/obsolete), and flagged legacy specs tied to the pre-split store or deleted prompt helpers.
- Notes: Marked critical failures (nullSafety, jobsSlice, translator, templates, cost-calculation, navigation) for rewrite; `tests/store/useAppStore.test.ts` and prompt builder suites recorded as obsolete.
- Tests: Not applicable

2025-10-13 19:05 UTC - Rewrite null safety regression suite
- Files modified: tests/store/nullSafety.test.ts, docs/TEST_MANIFEST.md
- Purpose: Ported the null-safety tests to the slice-based store, verifying chaptersSlice/error handling, translation history filters, and export snapshots without relying on legacy `sessionData`.
- Notes: Mocked NavigationService to exercise error paths; history expectations now require numbered chapters; manifest updated to reflect passing status.
- Tests: `npm run test -- tests/store/nullSafety.test.ts --run`

2025-10-13 19:20 UTC - Modernise jobs slice tests
- Files modified: tests/store/slices/jobsSlice.test.ts, docs/TEST_MANIFEST.md
- Purpose: Replaced the legacy worker-heavy spec with coverage that matches the current slice (add/update/remove, clear helpers, control flow, selectors, and placeholder worker hooks).
- Notes: Added a lightweight slice harness without mocking zustand internals; worker APIs now asserted to be no-ops rather than fabricating fake workers.
- Tests: `npm run test -- tests/store/slices/jobsSlice.test.ts --run`

2025-10-13 19:30 UTC - Align Translator tests with abort & retry behaviour
- Files modified: tests/services/translate/Translator.test.ts, docs/TEST_MANIFEST.md
- Purpose: Updated the translator spec to match the current abort message and confirmed sanitization/retry flows with the new orchestrator.
- Notes: The mock provider now respects the “Translation was aborted by user” contract while keeping sanitizer assertions intact.
- Tests: `npm run test -- tests/services/translate/Translator.test.ts --run`

2025-10-13 19:40 UTC - Refresh EPUB template expectations
- Files modified: tests/services/epub/Templates.test.ts, docs/TEST_MANIFEST.md
- Purpose: Relaxed numeric assertions to tolerate locale-specific formatting and verified the modern footer/stats layout.
- Notes: Added helper to accept `Intl` variations (en-US, en-IN, fr-FR, de-DE, ja-JP).
- Tests: `npm run test -- tests/services/epub/Templates.test.ts --run`

2025-10-13 19:42 UTC - Confirm structured-output schema coverage
- Files modified: docs/TEST_MANIFEST.md
- Purpose: Verified that the structured output tests still align with the generated prompt schema and marked the manifest entry as passing.
- Notes: No code changes required; updated manifest only.
- Tests: `npm run test -- tests/services/structured-outputs.test.ts --run`

2025-10-13 19:55 UTC - Rebuild cost-calculation integration suite
- Files modified: tests/current-system/cost-calculation.test.ts, docs/TEST_MANIFEST.md
- Purpose: Ported cost tests to the async `calculateCost` API, covering Gemini/OpenAI/DeepSeek pricing, OpenRouter dynamic rates, and image model pricing.
- Notes: Added helper to reuse expected formulas and removed stale references to legacy pricing helpers.
- Tests: `npm run test -- tests/current-system/cost-calculation.test.ts --run`

2025-10-13 20:05 UTC - Simplify navigation integration tests
- Files modified: tests/current-system/navigation.test.ts, docs/TEST_MANIFEST.md
- Purpose: Replaced brittle mocks with targeted assertions around `NavigationService.isValidUrl` and the store’s `handleFetch` integration (success/error cases).
- Notes: Enhanced chapters are fabricated via helpers; error paths now assert on the UI slice state instead of expecting old logs.
- Tests: `npm run test -- tests/current-system/navigation.test.ts --run`

2025-10-13 20:15 UTC - Add HTML repair regression tests
- Files modified: services/translate/HtmlRepairService.ts, tests/services/HtmlRepairService.test.ts
- Purpose: Ensured the HTML repair pipeline covers the documented formatting issues (capital `<I>` tags, `<hr>` variants, illustration markers, scene breaks, and dangling closing italics).
- Notes: Introduced a helper to fix leading closing tags before the existing unclosed-tag repair.
- Tests: `npm run test -- tests/services/HtmlRepairService.test.ts --run`

2025-10-14 07:13 UTC - Refresh settings persistence suite
- Files modified: tests/current-system/settings.test.ts, docs/TEST_MANIFEST.md
- Purpose: Rebuilt the settings tests around the slice-based store, covering persistence, load, defaults, translation-change detection, and localStorage failure handling.
- Notes: Added helper to fabricate chapters with snapshot metadata; storage mocks now applied per-test.
- Tests: `npm run test -- tests/current-system/settings.test.ts --run`

2025-10-14 07:17 UTC - Modernize translation flow tests
- Files modified: tests/current-system/translation.test.ts, docs/TEST_MANIFEST.md
- Purpose: Stubbed `TranslationService` and IndexedDB calls to validate successful translations, early exits when versions exist, error reporting, and abort handling.
- Notes: Simplified fixtures by injecting enhanced chapters into the store; translation progress assertions now follow slice behaviour.
- Tests: `npm run test -- tests/current-system/translation.test.ts --run`

2025-10-14 07:19 UTC - Rebuild export/import tests
- Files modified: tests/current-system/export-import.test.ts, docs/TEST_MANIFEST.md
- Purpose: Covered JSON snapshot export and full-session import using mocked IndexedDB services; verified error handling for malformed payloads.
- Notes: Export tests operate on the in-memory chapters map; import tests assert navigation history hydration.
- Tests: `npm run test -- tests/current-system/export-import.test.ts --run`

2025-10-14 07:21 UTC - Verify provider initialization
- Files modified: tests/current-system/providers.test.ts, docs/TEST_MANIFEST.md
- Purpose: Added a lightweight check ensuring `initializeProviders` registers all adapters with the translator singleton.
- Notes: Keeps provider coverage aligned with the refactored adapter architecture.
- Tests: `npm run test -- tests/current-system/providers.test.ts --run`

2025-10-14 07:23 UTC - Retire legacy DB contract suites
- Files modified: docs/TEST_MANIFEST.md
- Purpose: Marked the legacy IndexedDB contract tests as obsolete—they exercise the deprecated monolithic repo interface and no longer reflect the slice/IDB architecture.
- Notes: Future persistence coverage will focus on the new schema/migration tooling instead.
- Tests: Not applicable

2025-10-14 07:28 UTC - Rewrite feedback integration tests
- Files modified: tests/current-system/feedback.test.ts, docs/TEST_MANIFEST.md
- Purpose: Simplified feedback tests to assert the modern slice API (submit/update/delete) against the chapters map and feedback history.
- Notes: Removed dependencies on legacy `sessionData` and inline selectors.
- Tests: `npm run test -- --run`

2025-10-13 14:12 UTC - Switch comparison flow to contextual excerpts
- Files modified: config/prompts.json:38-74, services/comparisonService.ts:1-177, components/ChapterView.tsx:1-1390, services/translationService.ts:133-150, services/navigationService.ts:26-95, services/indexeddb.ts:17-110, types.ts:124-142
- Purpose: Replace chunk-based alignment caching with a focused compare API that returns fan translation context + raw snippet, simplifying the UI and avoiding brittle chunk maps.
- Notes: Added markdown-fence stripping in the service, removed all `fanAlignment` plumbing, reworked the comparison UI into an inline collapsible card with raw/fan toggle, and left a persistent reopen affordance instead of a transient overlay.
- Tests: Not run (API + UI wiring change)

2025-10-13 13:24 UTC - Restore translation metadata during hydration
- Files modified: services/navigationService.ts:26-85, services/navigationService.ts:154-176, services/navigationService.ts:520-572
- Purpose: Ensure chapters loaded from IndexedDB keep their translation IDs/versions so comparison and versioned workflows can identify the active translation. Adds a helper to adapt `TranslationRecord` → `translationResult` while preserving metadata and providing a deterministic fallback ID if legacy data lacks one.
- Notes: Console warns when relying on the fallback key, signaling legacy records that still need persistence repair.
- Tests: Not run (logic wiring only)

2025-10-13 12:19 UTC - Quiet ChapterView footnote diagnostics
- Files modified: components/ChapterView.tsx:129-137, components/ChapterView.tsx:865-872
- Purpose: Commented noisy footnote tokenization/render logs to keep the console readable during normal navigation while preserving the code for future diagnostics.
- Notes: Enable by uncommenting the existing `console.log` calls if deeper tracing is required.
- Tests: Not run (log-only change)

2025-10-13 06:15 UTC - Normalize illustration marker handling
- Files modified: components/Illustration.tsx:1-520
- Purpose: Allow illustration components to reconcile `[ILLUSTRATION-*]` markers stored in translations with marker tokens rendered in the reader. Adds marker normalization, fallback key matching for cached image state, and ensures retry/edit actions use the canonical placement marker.
- Notes: Cache-backed images now hydrate in ChapterView without requiring regeneration; retry/edit flows reuse the original placement marker to avoid mismatches.
- Tests: `npx tsc --noEmit` *(blocked by sandbox, manual run recommended)*

2025-10-13 05:24 UTC - Extend provider credit summaries
- Files modified: services/providerCreditCacheService.ts:1-180, store/slices/settingsSlice.ts:1-360, components/SettingsModal.tsx:1-1740, components/SettingsModal.test.tsx:1-240
- Purpose: Persist DeepSeek and PiAPI balances (IndexedDB cache) and surface them alongside OpenRouter credits. Hide OpenAI usage controls until a backend proxy exists.
- Behavior: Added shared credit fetchers (DeepSeek `/user/balance`, PiAPI `/account/info`), cached summaries in IndexedDB, manual refresh buttons + formatted readouts under each key, static guidance for OpenAI.
- Tests: `npx vitest run components/SettingsModal.test.tsx`

2025-10-13 04:58 UTC - Align SettingsModal tests with modular store
- Files modified: components/SettingsModal.test.tsx:1-140
- Purpose: Mock the aggregated `../store` module (post-monolith split) so SettingsModal tests see configured API keys and remain deterministic after the OpenRouter credit UI changes.
- Behavior: Tests construct a reusable store mock factory, expose the mocked `useAppStore` for per-spec overrides, and unmount rendered components to avoid bleed-over.
- Notes: happy-dom dev dependency bumped to ^20 via npm install (user-applied) ahead of addressing upstream security advisory; retesting needed once mocks settle.
- Tests: `npx vitest run components/SettingsModal.test.tsx` (pass)

2025-10-13 04:30 UTC - Show OpenRouter credit balance
- Files modified: services/openrouterService.ts:23-141, store/slices/settingsSlice.ts:1-60, components/SettingsModal.tsx:1-920
- Purpose: Switch OpenRouter credit refresh to the documented `/api/v1/credits` endpoint and surface remaining purchased credits in the settings modal instead of the legacy rate-limit limit field. Added a legacy fallback if the new endpoint fails.
- Behavior: UI now reports `Credits remaining` with optional total purchased amount and timestamp; service caches unified credit data while mirroring legacy fields for backward compatibility.
- Tests: `npx vitest run components/SettingsModal.test.tsx` *(fails: missing @testing-library/react dependency in node_modules)*

2025-08-30 16:40 UTC - Diagnostic silence edits
- Files modified: components/ChapterView.tsx, services/navigationService.ts, services/importTransformationService.ts
- Purpose: Reduce console noise by muting verbose informational `console.log` statements. Kept `console.error`/`console.warn` intact for visibility of real problems. No behavioral changes intended.

Next: After running with reduced logs, gather traces for 'Chapter not found' and decide where to add targeted diagnostics.


2025-08-30 17:10 UTC - Hydration tracing and UI guard
- Files modified: services/navigationService.ts (timestamped logs), store/slices/chaptersSlice.ts (timestamped setCurrentChapter log), components/ChapterView.tsx (UI guard while hydrating)
- Purpose: Add lightweight diagnostics to trace navigation → setCurrentChapter → IDB hydration ordering, and mute noisy missing-chapter error while hydration is in-flight.
- Behavior: No functional change to navigation/hydration; ChapterView suppresses console.error when `hydratingChapters[currentChapterId]` is truthy. Diagnostic logs are plain console.logs (visible in dev) to allow quick reproduction.
- Next: Reproduce and collect ordered traces. If confirmed, consider propagating a single `navTraceId` for richer correlation.


2025-08-30 17:40 UTC - Increase explanation max tokens
- File modified: services/explanationService.ts
- Change: Increased `max_tokens` from 500 to 1000 to allow more detailed generated explanation footnotes.
- Reason: 500 was too small for some explanatory footnotes; aligning with higher token budgets improves quality.

2025-08-30 17:55 UTC - Fix client-side require usage
- File modified: store/slices/translationsSlice.ts
- Change: Replaced `require('../../adapters/repo')` with dynamic ESM `import('../../adapters/repo')` to avoid `ReferenceError: require is not defined` in browser environments.
- Reason: `require` is CommonJS and not available in browser bundles; dynamic import defers loading the module and keeps behavior identical in Node and browser.

2025-08-30 18:05 UTC - Align explanation max tokens with global setting
- File modified: services/explanationService.ts
- Change: Use `settings.maxOutputTokens` as an upper bound for explanation `max_tokens`; keep a default per-call cap of 1000 but allow higher when global setting allows.
- Reason: Some footnotes were truncated; this change allows the explanation service to use the global token budget when configured.

2025-08-30 18:18 UTC - Explanation service now uses full global max tokens
- File modified: services/explanationService.ts
- Change: `max_tokens` now set to `settings.maxOutputTokens` (clamped) for full-length footnotes.
- Reason: User requested full global token budget for elaborate footnotes.

2025-08-30 19:05 UTC - Centralize translation persistence
- Files modified: services/translationPersistenceService.ts (new), store/slices/translationsSlice.ts:12,303-366,624-707
- Purpose: Replace browser-only `require` usage with a service that handles repo loading and logs persistence results, ensuring footnote/illustration updates persist without runtime errors.

2025-08-30 19:20 UTC - Ensure auto-translate triggers after hydration
- Files modified: App.tsx:20-113
- Purpose: Added a store selector tracking whether the current chapter is loaded so the translation effect runs once hydration completes instead of requiring manual retry.

2025-08-30 19:28 UTC - Replace CommonJS requires in DB repo
- Files modified: services/db/index.ts:9-93,204-238
- Purpose: Hoisted operations imports to module scope so the IDB repo works in Vite’s ESM bundle instead of throwing `require is not defined` during persistence calls.

2025-08-30 19:40 UTC - Keep translation versions stable for metadata edits
- Files modified: services/translationService.ts:123-142, store/slices/imageSlice.ts:11,478-511, services/imageGenerationService.ts:15,189-214
- Purpose: Capture stored translation IDs immediately and route footnote/image updates through the persistence helper so metadata changes mutate in place instead of spawning new versions.

2025-08-30 20:10 UTC - Inline edit reaction for translations
- Files modified: components/ChapterView.tsx:1-870, components/FeedbackPopover.tsx:1-52, components/SessionInfo.tsx:220-332, services/translationPersistenceService.ts:1-118, services/indexeddb.ts:73-1040, services/translationService.ts:120-142, store/slices/imageSlice.ts:1-520, services/imageGenerationService.ts:1-330
- Purpose: Tokenize rendered translations into editable chunks, add an inline edit option in the reaction tray with save/new-version controls, and surface custom version labels across the UI.

2025-08-30 20:25 UTC - Guard duplicate translations
- Files modified: store/slices/translationsSlice.ts:80-220, store/slices/chaptersSlice.ts:520-620, App.tsx:70-140
- Purpose: Track pending translation requests and short-circuit both the auto-translate effect and prefetch worker when a job or persisted version already exists, avoiding duplicate API calls.

2025-08-30 20:35 UTC - Fix inline edit chunk resolution
- Files modified: components/ChapterView.tsx:400-430
- Purpose: Ensure text-node selections resolve to their enclosing chunk spans so inline editing activates correctly.

2025-08-30 22:05 UTC - Memory telemetry scaffolding
- Files modified: utils/debug.ts, utils/memoryDiagnostics.ts (new), services/indexeddb.ts, services/navigationService.ts, store/slices/chaptersSlice.ts, components/SettingsModal.tsx
- Purpose: Introduce dedicated memory debug pipeline with helper utilities, wrap heavy chapter hydration paths with gated timing logs, and surface chapter cache size changes so upcoming eviction logic has observability.
- Notes: Memory logs remain silent unless the new "Memory / cache" pipeline is enabled alongside Summary/Full logging.

2025-08-30 22:40 UTC - Chapter summary API for lightweight hydration
- Files modified: services/indexeddb.ts, services/importTransformationService.ts, components/SessionInfo.tsx, types.ts
- Purpose: Added a dedicated chapter summaries store with automatic backfill/write-through updates, exposed `getChapterSummaries()` for list rendering, and migrated SessionInfo’s dropdown to the metadata slice with a loading state.
- Notes: Summary records track canonical URL, translation/image flags, and timestamps; cache writes trigger recomputation after chapter/translation mutations.

2025-08-30 22:55 UTC - Context hydration fallback fixes
- Files modified: services/indexeddb.ts, services/translationService.ts
- Purpose: Hardened summary initialization for legacy data, added `ensureActiveTranslationByStableId`, and taught the translation history builder to hydrate missing context chapters from IndexedDB (promoting the latest version when no active flag exists).
- Notes: History diagnostics now rely on the new helpers, avoiding bulk `getAllChapters()` scans and preventing redundant re-translation calls.

2025-08-30 23:05 UTC - Image diagnostics logging
- Files modified: store/slices/imageSlice.ts, services/imageGenerationService.ts
- Purpose: Added gated debug logs for image hydration, prompt payloads, and retry/generation flows so we can verify Phase 1 didn’t regress image features.
- Notes: Logs emit under the existing `image` pipeline (Summary/Full levels) and avoid dumping base64 payloads.

2025-08-30 23:15 UTC - Steering image list fallback
- File modified: scripts/generate-steering-image-list.cjs
- Purpose: Guarded the steering image script so builds succeed even when `public/steering` is absent (writes an empty list instead of throwing).

2025-08-30 23:20 UTC - Debug logging introspection
- Files modified: utils/debug.ts, components/SettingsModal.tsx
- Purpose: Added a helper to print the current logging level/pipelines whenever developer logging settings change so it’s obvious which gates are active.

2025-08-30 21:15 UTC - Granular debug pipeline toggles
- Files modified: utils/debug.ts (new), components/SettingsModal.tsx, services/indexeddb.ts, services/comparisonService.ts
- Purpose: Replace the single logging gate with pipeline-specific checkboxes and shared helpers so developers can enable IndexedDB, comparison, worker, audio, or translation logs individually without dumping massive payloads by default.

2025-08-30 20:55 UTC - Add fan translation comparison flow
- Files modified: components/ChapterView.tsx, components/FeedbackPopover.tsx, components/icons/CompareIcon.tsx (new), services/comparisonService.ts (new), services/indexeddb.ts, services/translationPersistenceService.ts, services/translationService.ts, store/slices/translationsSlice.ts, store/slices/chaptersSlice.ts, types.ts, App.tsx
- Purpose: Tokenize and cache chunk metadata for both translation and fan text, provide a toolbar action to fetch a single alignment map per chapter, cache/persist the results, and render a collapsible inline panel showing matching fan sentences with guards against duplicate requests.

2025-08-30 18:30 UTC - Diagnostic logging for illustration insertion
- File modified: store/slices/translationsSlice.ts
- Change: Add console logs after updating chapter to print `suggestedIllustrations` and whether the placement marker was inserted; log persistence results (stored id or update confirmation) and merge persisted translationResult into state.
- Reason: Quickly surface whether markers/prompts are present in-memory and whether persistence succeeded.

2025-09-25 18:40 UTC - Session wrap-up / investigation parking lot
- Phase coverage: Completed Phase 0 telemetry plumbing and Phase 1 summary API rollout; validated sequential translation queue + IDB hydration fixes during long session.
- Logging state: Developer logging panel now prints the active level/pipelines on change (`DebugConfig` log). Current run used level=full with all pipelines (indexeddb, comparison, worker, translation, image, audio, memory) enabled.
- Memory diagnostics: Observed `chapters.loadFromIDB` cache events while paging through chapters; sequential translate queue prevented duplicate jobs. No eviction logic implemented yet—Phase 2 will introduce window-size slider + pinning.
- Image investigation: Added gated logs (`image` pipeline) around hydration/generation. Need to revisit hydrated chapters after import to confirm `suggestedIllustrations` -> `generatedImages` handshake still renders. Chapter selection is manual post-import (session does not auto-focus a chapter).
- Import workflow: JSON import pushes chapters/translations straight into IDB, but translations + media hydrate lazily on first navigation. Summaries API populates SessionInfo with metadata only.
- Build health: `scripts/generate-steering-image-list.cjs` now handles missing `public/steering/` by emitting an empty list, unblocking Vercel builds without checking in sensitive assets.
- Tailwind note: Still warning about CDN usage; migrate to PostCSS/CLI in a later pass.
- Next resume checklist:
  1. Re-open a chapter with known illustrations, confirm hydration logs + UI render stored art.
  2. Design Phase 2 UI (cache window slider + pin toggle) and wire eviction bookkeeping.
  3. Consider auto-selecting a chapter post-import or surfacing a prompt so users immediately load content.
  4. (Optional) Plan Tailwind build migration and finalize instrumentation for image latency/cost tracking.


2025-10-12 15:22 UTC - Formalize IndexedDB schema to v9
- Files modified: services/db/core/schema.ts, services/db/core/connection.ts, services/indexeddb.ts, utils/debug.ts
- Summary: Codified schema versions 7–9 (canonical stores + index backfills + no-op legacy cap), aligned SCHEMA_VERSIONS.CURRENT with the highest legacy auto-migrated version (9), routed DB version constants through the shared schema module, and restored the IndexedDB debug helper.
- Notes: Existing browsers auto-migrate on next load; if someone somehow landed above v9 in earlier dev builds, have them reload or clear the `lexicon-forge` DB once. Follow-up: revisit legacy store-based tests that still assume pre-refactor APIs.

2025-10-13 09:30 UTC - Golden test harness cassette replay
- Files modified: tests/gold/diff/diff-golden.test.ts, tests/gold/diff/SimpleLLMAdapter.ts
- Purpose: Allow golden tests to run in replay mode without `OPENROUTER_API_KEY` by always wiring the SimpleLLMAdapter (with placeholder key) and removing the skip guards. Added a protective check so live recording (`LIVE_API_TEST=1`) still demands a real API key.
- Next steps: Record cassettes for cases 002–007 with `LIVE_API_TEST=1 OPENROUTER_API_KEY=…`, regenerate diagnostics, and rerun the suite in replay mode to confirm the aggregate F1 gate.

2025-10-13 09:40 UTC - Golden dataset live run + replay verification
- Files modified: tests/gold/diff/diff-golden.test.ts (timeouts), PHASE_2_GOLDEN_TEST_LEARNINGS.md
- Purpose: Recorded OpenRouter cassettes for cases 001–007, regenerated diagnostics, expanded the learnings doc with per-case metrics, and raised golden test timeouts to accommodate live calls (aggregate gate now 60s).
- Validation: `LIVE_API_TEST=1 OPENROUTER_API_KEY=… npm test tests/gold/diff/diff-golden.test.ts -- --run` (records) followed by `npm test tests/gold/diff/diff-golden.test.ts -- --run` (replay) both succeed; aggregate F1 = 1.0.

2025-10-13 10:00 UTC - aiService + adapter coverage lift
- Files modified: services/aiService.ts, tests/services/aiService.internal.test.ts (new), tests/services/aiService.translateChapter.test.ts (new), tests/services/aiService.providers.test.ts (new), tests/adapters/providers/{ClaudeAdapter,GeminiAdapter,OpenAIAdapter}.test.ts (new)
- Purpose: Exposed internal helpers for focused testing, added unit suites covering illustration/footnote reconciliation, translateChapter default-key accounting, and legacy provider flows. Added adapter-level mocks to exercise JSON parsing, parameter retry, and metrics recording.
- Result: `npm test -- --coverage --run` now passes provider thresholds (aiService lines 43% vs. 16% prior; each adapter ≥50% lines / ≥40% funcs).

2025-10-13 11:30 UTC - aiService decomposition kickoff
- Files modified: services/aiService.ts (refactored to aggregator), services/ai/* (new modules), services/ai/providers/{gemini,openai}.ts (new), services/ai/translatorRouter.ts (new), tests/services/aiService.* (updated via aggregator)
- Purpose: Split aiService into modular helpers (debug, params, text utils, cost), provider-specific translators, and a dedicated translation router; align with refactoring plan thresholds (<200 LOC per service).
- Tests: `npm test -- --coverage --run`

2025-10-13 12:05 UTC - ChapterOps IndexedDB path (feature-flagged)
- Files modified: services/db/operations/chapters.ts (rewritten), services/db/utils/featureFlags.ts (new)
- Purpose: Implement direct IndexedDB reads/writes for chapter operations while keeping legacy `indexedDBService` path behind a runtime flag (`LF_DB_V2_DOMAINS`, localStorage overrides). Writes canonical URL mappings and chapter summaries in the new path.
- Tests: `npm test -- --coverage --run`

2025-10-13 12:40 UTC - TranslationOps IndexedDB path (feature-flagged)
- Files modified: services/db/operations/translations.ts (rewritten), services/db/operations/chapters.ts (exports for shared helpers)
- Purpose: Add modern translation persistence (versioning, active flag) using direct IndexedDB transactions with capability flag gating; summary recalculation and URL mapping updates now run without touching legacy pathways unless flag disabled.
- Tests: `npm test -- --coverage --run`

2025-10-13 13:05 UTC - Stream importer loads exported translations
- Files modified: services/importService.ts
- Purpose: Recognize the v2 export format (`chapters[].translations`) during streamed imports, store chapters via ChapterOps, persist each translation via TranslationOps, and reactivate the original active version so English text populates after loading GitHub sessions.
- Tests: `npm test -- --coverage --run`
