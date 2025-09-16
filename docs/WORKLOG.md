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

2025-08-30 18:30 UTC - Diagnostic logging for illustration insertion
- File modified: store/slices/translationsSlice.ts
- Change: Add console logs after updating chapter to print `suggestedIllustrations` and whether the placement marker was inserted; log persistence results (stored id or update confirmation) and merge persisted translationResult into state.
- Reason: Quickly surface whether markers/prompts are present in-memory and whether persistence succeeded.
