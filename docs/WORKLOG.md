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
