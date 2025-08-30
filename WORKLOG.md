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

2025-08-30 18:30 UTC - Diagnostic logging for illustration insertion
- File modified: store/slices/translationsSlice.ts
- Change: Add console logs after updating chapter to print `suggestedIllustrations` and whether the placement marker was inserted; log persistence results (stored id or update confirmation) and merge persisted translationResult into state.
- Reason: Quickly surface whether markers/prompts are present in-memory and whether persistence succeeded.
