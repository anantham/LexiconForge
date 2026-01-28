2026-01-28 08:25 UTC - Stale-build invalidation for Sutta Studio (in progress)
- Files: components/sutta-studio/SuttaStudioApp.tsx:214-289; services/suttaStudioCompiler.ts:724-879; types/suttaStudio.ts:106-118; docs/WORKLOG.md
- Why: Prevent cached packets stuck in `building` from blocking new compiles after refresh.
- Details:
  - Added `lastProgressAt` to packet progress and update it on skeleton/phase/error/complete.
  - Compile gate treats `building` packets as stale if no progress within 3 minutes, and triggers a recompile.
- Tests: Not run (local).

2026-01-28 09:13 UTC - Route compiler calls through provider adapters (in progress)
- Files: adapters/providers/OpenAIAdapter.ts:1-260; adapters/providers/GeminiAdapter.ts:1-210; adapters/providers/ClaudeAdapter.ts:1-150; adapters/providers/Provider.ts:1-40; adapters/providers/index.ts:1-30; services/apiMetricsService.ts:12-120; services/suttaStudioCompiler.ts:1-520; docs/WORKLOG.md
- Why: Unify compiler LLM calls with the shared provider adapter layer so cost/usage metrics match translation accounting.
- Details:
  - Added chatJSON support to OpenAI/Gemini/Claude adapters with apiMetrics recording under `sutta_studio`.
  - Compiler now resolves providers through adapter registry and uses adapter chatJSON (no direct OpenAI SDK calls).
  - ApiMetrics now includes `sutta_studio` type for aggregation.
- Tests: Not run (local).

2026-01-28 08:17 UTC - Bootstrap ETA with historical EMA (in progress)
- Files: services/suttaStudioTelemetry.ts:1-92; services/suttaStudioCompiler.ts:715-733; docs/WORKLOG.md
- Why: Provide a Phase 1 estimate from prior runs and smooth ETA updates with EMA.
- Details:
  - Telemetry now persists EMA (per uid + global) and derives EMA from existing samples for backward compatibility.
  - Compiler seeds avgPhaseMs/etaMs after skeleton using stored EMA; ETA continues to update per phase.
- Tests: Not run (local).

2026-01-28 02:34 UTC - Simplify hover tooltips and move relation hooks to arrows (in progress)
- Files: components/sutta-studio/PaliWord.tsx:1-88; components/sutta-studio/SuttaStudioView.tsx:11-142; docs/WORKLOG.md
- Why: Reduce tooltip clutter and make relation cues appear only on intended hover targets.
- Details:
  - Segment hover now prioritizes relation labels (e.g., “Agent of hearing”) over morph jargon.
  - Removed inline relation hook bubble from segments; arrow hover shows relation hook (BY/WITH, etc.).
  - Suppressed the “Hover: segment details” hint while a segment tooltip is active.
- Tests: Not run (not requested).

2026-01-28 02:25 UTC - Allow negative ETA countdown with overdue styling (in progress)
- Files: components/sutta-studio/hooks/useEtaCountdown.ts:1-33; components/sutta-studio/utils.ts:40-52; components/sutta-studio/SuttaStudioView.tsx:32-55; components/sutta-studio/StudioHeader.tsx:4-36; components/sutta-studio/StudioProgress.tsx:1-22; components/sutta-studio/SuttaStudioFallback.tsx:19-127; docs/WORKLOG.md
- Why: Let ETA count past zero to reflect overdue phases, and highlight overdue status visually.
- Details:
  - Countdown now returns negative values once ETA elapses (no clamping).
  - Duration formatting preserves a leading “-” for overdue time.
  - Progress chips switch to red styling when ETA is negative.
- Tests: Not run (not requested).

2026-01-28 02:16 UTC - Prevent compile abort on render churn (in progress)
- Files: components/sutta-studio/SuttaStudioApp.tsx:55-342; docs/WORKLOG.md
- Why: StrictMode/effect churn was aborting compiler fetches, causing proxy errors and stalled builds.
- Details:
  - Added a stable route key + abort ref so compiles only abort on route changes.
  - Removed effect cleanup abort; compiler now finishes unless the route changes.
- Tests: Not run (not requested).

2026-01-28 02:08 UTC - Subscribe to chapter map for Studio hydration (in progress)
- Files: components/sutta-studio/SuttaStudioApp.tsx:44-64; docs/REFACTOR_CANDIDATES.md:12-17; docs/WORKLOG.md
- Why: Fix Loading... stall caused by using a non-reactive getter; ensure re-render when chapters map updates.
- Details:
  - Replaced `getChapter(currentChapterId)` with a store selector that reads `chapters` directly.
  - Keeps `currentChapterId` reactive so Studio updates after IDB hydration.
- Tests: Not run (not requested).

2026-01-28 01:50 UTC - Add Sutta Studio flow debug gating + control-path logs (in progress)
- Files: services/suttaStudioDebug.ts:1-30; components/sutta-studio/SuttaStudioApp.tsx:1-422; components/sutta-studio/SuttaStudioFallback.tsx:1-89; services/navigationService.ts:12-825; docs/REFACTOR_CANDIDATES.md:14-16; docs/WORKLOG.md
- Why: Provide reason-coded, sutta-specific logging to trace gating decisions and URL normalization without flooding general logs.
- Details:
  - Added `LF_SUTTA_DEBUG_FLOW` gate + helpers to emit `[SuttaStudioFlow]` logs on demand.
  - Logged resolve/navigate/compile/render gate reasons + snapshot state to pinpoint where Loading stalls.
  - Logged fallback render state when blocks are empty and when updateBrowserHistory rewrites `/sutta` URLs.
  - Noted oversized view/navigation files in refactor candidates list.
- Tests: Not run (not requested).

2026-01-28 01:41 UTC - Soft-cap phase size via prompt guidance (in progress)
- Files: config/suttaStudioPromptContext.ts:10-17; services/suttaStudioCompiler.ts:37; docs/WORKLOG.md
- Why: Encourage smaller per-phase word counts (soft cap at 8) without hard enforcement.
- Details:
  - Added a soft-cap instruction in skeleton prompt context to bias splitting when >8 words.
  - Bumped prompt version to v5 to invalidate cached packets and apply the new guidance.
- Tests: Not run (not requested).

2026-01-28 01:35 UTC - Curve relation edges + plain-language morph examples (in progress)
- Files: components/sutta-studio/SuttaStudioView.tsx:3-266; config/suttaStudioExamples.ts:44-103; docs/WORKLOG.md
- Why: Make relation arcs visibly curved and avoid arrow clipping; remove jargon from prompt examples.
- Details:
  - Relation arrows now curve more, extend SVG canvas, and end at the bottom of the target when it sits above the source.
  - Morph example tooltips/notes now use plain language (“marks belonging”) instead of “genitive plural.”
- Tests: Not run (not requested).

2026-01-28 01:27 UTC - Add pre-flight exception for single-agent small fixes (in progress)
- Files: AGENTS.md:32-50; docs/WORKLOG.md
- Why: Allow skipping full pre-flight for trivial single-agent edits while keeping minimal safeguards.
- Details:
  - Added a PRE-FLIGHT_EXCEPTION block with small-fix criteria and minimum requirements.
- Tests: Not run (not requested).

2026-01-28 01:23 UTC - Ownership graph arcs extended + unclipped (in progress)
- Files: components/sutta-studio/SuttaStudioView.tsx:225-252; docs/WORKLOG.md
- Why: Ownership relation arrows felt cramped/clipped; extend canvas + curvature for aesthetic arc length.
- Details:
  - Increased ownership curveness and added `_extendSVGcanvas` + `SVGcanvasStyle` overflow visible for ownership edges only.
- Tests: Not run (not requested).

2026-01-27 23:09 UTC - Sutta Studio stitching + retrieval + validator + grammar graph toggle (in progress)
- Files: services/suttaStudioRetrieval.ts:1-55; services/suttaStudioValidator.ts:1-146; services/suttaStudioCompiler.ts:29-881; components/sutta-studio/SuttaStudioApp.tsx:13-167; components/sutta-studio/SuttaStudioView.tsx:219-259; types/suttaStudio.ts:12-129; config/suttaStudioPromptContext.ts:10-16; docs/sutta-studio/IR.md:110-146; docs/WORKLOG.md
- Why: Support stitched multi-chapter compilation with boundary-aware phases, add retrieval context + validator pass, and show grammar graphs only when the study toggle is on.
- Details:
  - Compiler now accepts stitched uid lists, tracks boundaries, and avoids cross-chapter chunking unless allowed.
  - Retrieval context adds nearby segments into phase + morph prompts without overriding ambiguity.
  - Validator cleans missing relations/links, patches empty segments/senses, and records issues in compiler metadata.
  - Studio renders relation graph edges for all segments when study mode is enabled, with labels only on hover.
  - Bumped prompt version to v4 to invalidate cached packets with new prompts.
- Tests: Not run (not requested).

2026-01-27 22:28 UTC - Preserve /sutta query params when updating chapter URL (in progress)
- Files: services/navigationService.ts:790-814; docs/WORKLOG.md
- Why: Keep `lang`, `author`, and `recompile` in the Studio URL while still adding `chapter=...`.
- Details:
  - `updateBrowserHistory` now merges a small whitelist of params when the current pathname starts with `/sutta`.
  - The chapter param is still set from `chapter.canonicalUrl`, but the query no longer clobbers Studio-specific flags.
- Tests: Not run (not requested).

2026-01-27 22:11 UTC - Sutta Studio progress countdown + phase-only labels (in progress)
- Files: components/sutta-studio/hooks/useEtaCountdown.ts:1-32; components/sutta-studio/utils.ts:40-63; components/sutta-studio/SuttaStudioView.tsx:1-53; components/sutta-studio/SuttaStudioFallback.tsx:1-78; components/sutta-studio/SuttaStudioApp.tsx:184-212; docs/WORKLOG.md
- Why: Replace “Building/Compiler” copy with live phase + countdown display per request.
- Details:
  - Added an ETA countdown hook to tick between compiler phase updates.
  - Added duration/phase helpers to keep labels consistent across views.
  - Updated studio header + fallback progress UI to show “Phase X/Y · <countdown>” with no compiler/status text.
- Tests: Not run (not requested).

2026-01-27 05:49 UTC - Sutta Studio ADR + IR schema (proposed)
- Files: docs/adr/003-sutta-studio-mvp.md; docs/sutta-studio/IR.md; docs/WORKLOG.md
- Why: Define the MVP architecture, data model, and LLM pipeline for Sutta Studio before implementation.
- Details:
  - ADR-003 formalizes the dedicated `/sutta/:uid` route, SuttaCentral-only scope, hybrid IR (canonical segments + derived phases), CSP-style pipeline, and citations registry.
  - IR schema doc captures canonical segments, phase view types, citation registry, and embedding inside Chapter records.
- Tests: Not run (docs only).

2026-01-26 21:49 UTC - SuttaCentral early API routing + Tailwind import order (in progress)
- Files: services/adapters.ts; tests/services/adapters.suttacentral.test.ts; index.css; docs/WORKLOG.md
- Why: Bypass HTML proxy failures for SuttaCentral navigation and fix Tailwind PostCSS @import ordering error.
- Details:
  - fetchAndParseUrl routes SuttaCentral URLs directly to API fetchers before HTML proxy attempts.
  - Added test to assert SuttaCentral fetch uses API endpoints without HTML proxy usage.
  - Reordered Tailwind directives to satisfy PostCSS @import rule.
- Tests: Not run (local).

2026-01-26 13:31 UTC - SuttaCentral adapter fixes + metadata + tests (complete)
- Files: AGENTS.md:41-55, 78-83, 319-326; types.ts:2-16; services/adapters.ts:218-414, 398-405, 685-711, 744-785; services/navigationService.ts:20-39, 582-607, 728-777; tests/services/adapters.suttacentral.test.ts:1-106; docs/WORKLOG.md
- Why: Preserve fan translation, support SuttaCentral API fallback, improve URL parsing, and add adapter tests; align repo coordination rules for single-agent small fixes.
- Details:
  - SuttaCentral adapter now parses query/path lang + author, supports dotted UID navigation, avoids injecting blurb into content, and returns blurb/locale metadata.
  - SuttaCentral fetch updates proxy health on success and uses API fetcher in direct fallback.
  - NavigationService stores SuttaCentral blurb into novel metadata (only when description is empty/placeholder) and passes fanTranslation into imports.
  - Added SuttaCentral adapter tests for support listing, lang override, and dotted UID navigation.
- Tests: Not run (local).
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
2026-01-27 01:28 UTC - Sutta Studio MVP scaffolding + chapter IR wiring (in progress)
- Files: App.tsx (router split); MainApp.tsx (full app logic moved); components/sutta-studio/* (new modular studio UI); types/suttaStudio.ts (new IR types); types.ts (Chapter/ImportedChapter embed); services/db/types.ts (ChapterRecord embed); services/db/operations/chapters.ts (persist IR); services/db/operations/imports.ts (import IR); services/db/operations/export.ts (export IR); services/stableIdService.ts (propagate IR); services/navigationService.ts (propagate IR + hydrate); interfaceIdea.tsx (now a small preview wrapper); index.css (tailwind directives reset); package.json (add studio deps); docs/WORKLOG.md
- Why: Split the monolithic InterfaceIdea into reusable components, add a dedicated /sutta/:uid route, embed Sutta Studio IR inside chapter records for persistence, and keep the UI minimal with a single study toggle.
- Details:
  - Created Sutta Studio components (Pali/English engines, LensPanel, arrows, palette) and a demo packet for MN10.
  - Added SuttaStudioApp route handler and moved the original App logic into MainApp.
  - Embedded suttaStudio packets into Chapter/ChapterRecord and persisted through import/export + IDB hydration.
  - Reset Tailwind CSS to base/components/utilities directives to avoid @import ordering errors.
- Tests: Not run (local).

2026-01-27 01:32 UTC - Reader -> Sutta Studio entry point (in progress)
- Files: components/ChapterView.tsx; components/chapter/ChapterHeader.tsx; docs/WORKLOG.md
- Why: Add a minimal in-reader navigation path into the Sutta Studio route for SuttaCentral chapters.
- Details:
  - Compute `/sutta/:uid?lang=&author=` from the chapter’s SuttaCentral URL.
  - Show a subtle “Studio” link next to Source (desktop) and near the language toggle (mobile).
- Tests: Not run (local).

2026-01-27 01:36 UTC - Studio/Reader icon navigation polish (in progress)
- Files: components/chapter/ChapterHeader.tsx; components/sutta-studio/SuttaStudioView.tsx; components/sutta-studio/SuttaStudioApp.tsx; docs/WORKLOG.md
- Why: Make the Studio entry/exit feel like a mode switch with icon-only controls.
- Details:
  - Replace “Studio” text with a minimal icon button in the reader header (desktop + mobile).
  - Add a top-left back icon in Sutta Studio that returns to reader via `?chapter=` URL.
- Tests: Not run (local).

2026-01-27 01:41 UTC - Studio progressive loading rules (in progress)
- Files: components/sutta-studio/SuttaStudioApp.tsx; components/sutta-studio/SuttaStudioView.tsx; components/sutta-studio/SuttaStudioFallback.tsx; types/suttaStudio.ts; components/sutta-studio/demoPacket.ts; docs/WORKLOG.md
- Why: Show Pāli + fan translation while compiler runs and only reveal completed phases with a subtle progress chip when incomplete.
- Details:
  - Added packet progress metadata (total/ready/state) and demo marks complete.
  - Studio renders only ready phases; navigation clamps to completed range.
  - Fallback view shows Pāli + fan translation with a “Building” chip only while incomplete.
- Tests: Not run (local).

2026-01-27 02:12 UTC - Sutta Studio compiler pipeline wired (in progress)
- Files: services/suttaStudioCompiler.ts (new); services/adapters.ts (export PROXIES); components/sutta-studio/SuttaStudioApp.tsx (auto-run compiler + persist); docs/WORKLOG.md
- Why: Run the Sutta Studio compiler automatically on /sutta/:uid load, log progress, and persist packet updates.
- Details:
  - Added compiler service with proxy-backed SuttaCentral API fetch, skeleton pass + per-phase compile calls, progress updates, and error logging.
  - Auto-runs compiler in SuttaStudioApp once chapter is loaded, persists intermediate packets to IndexedDB via ChapterOps, and shows progress in UI.
  - Reset demo packet usage to only show when no fetched chapter matches (so compiler progress isn’t masked).
- Tests: Not run (local).

2026-01-27 02:26 UTC - Studio compiler ETA panel + telemetry (in progress)
- Files: services/suttaStudioTelemetry.ts (new); services/suttaStudioCompiler.ts; types/suttaStudio.ts; components/sutta-studio/SuttaStudioView.tsx; components/sutta-studio/SuttaStudioFallback.tsx; components/sutta-studio/SuttaStudioApp.tsx; docs/WORKLOG.md
- Why: Give users a clear sense of compilation progress with a simple status panel and an ETA based on observed phase timings.
- Details:
  - Telemetry stores last 12 phase durations (per sutta + global) in localStorage to compute average phase time.
  - Compiler records per-phase timings and updates packet.progress with avgPhaseMs, lastPhaseMs, etaMs, and currentPhaseId.
  - Studio + fallback views render a minimal top-right status card (hidden on mobile) with phase + ETA while building.
- Tests: Not run (local).

2026-01-27 02:41 UTC - Studio fallback interleaving + header extraction (in progress)
- Files: components/sutta-studio/SuttaStudioView.tsx; components/sutta-studio/SuttaStudioFallback.tsx; components/sutta-studio/SuttaStudioApp.tsx; components/sutta-studio/StudioHeader.tsx (new); components/sutta-studio/StudioProgress.tsx (new); components/sutta-studio/hooks/usePhaseNavigation.ts (new); docs/WORKLOG.md
- Why: Interleave Pāli + English segments while compiler runs, simplify progress messaging to “Building X/Y”, and split large view file to respect modularity rules.
- Details:
  - Fallback now renders interleaved segments from canonicalSegments when available, else zips chapter content + fan translation.
  - Progress chip shows “Building X/Y”; removed extra status card.
  - Extracted header + progress chip + navigation hook to keep SuttaStudioView under 300 LOC.
- Tests: Not run (local).

2026-01-27 06:02 UTC - Update agent size rule + refactor candidate log (complete)
- Files: AGENTS.md; docs/REFACTOR_CANDIDATES.md; docs/WORKLOG.md
- Why: Allow reading large files without warning while preserving maintainability via explicit refactor tracking.
- Details:
  - Replaced the >300 LOC warning rule with a requirement to log refactor-worthy files.
  - Added `docs/REFACTOR_CANDIDATES.md` and logged `services/suttaStudioCompiler.ts` as a split candidate.
  - Added WORKLOG bloat control note for `./scripts/cycle-worklog.sh` in AGENTS.
- Tests: Not run (docs only).

2026-01-27 06:12 UTC - Sutta Studio compiler structured outputs (in progress)
- Files: services/suttaStudioCompiler.ts; docs/WORKLOG.md
- Why: Fix truncated JSON by using strict JSON schema outputs for skeleton + phase compile calls.
- Details:
  - Added JSON schemas for skeleton and phase responses.
  - Compiler now checks structured output support and sends `response_format: json_schema` when available.
  - Added fallback retry without schema if provider rejects response_format.
- Tests: Not run (local).

2026-01-27 06:21 UTC - Add Sutta Studio golden examples for prompts (in progress)
- Files: config/suttaStudioExamples.ts; services/suttaStudioCompiler.ts; docs/WORKLOG.md
- Why: Provide concrete few-shot examples so compiler output matches expected IR shape.
- Details:
  - Added skeleton + phase examples from demo-style data (full fields) and injected into prompts.
  - Examples are always included and labeled “do NOT copy ids”.
- Tests: Not run (local).

2026-01-27 06:33 UTC - Add Sutta Studio prompt context blocks (in progress)
- Files: config/suttaStudioPromptContext.ts; config/suttaStudioExamples.ts; services/suttaStudioCompiler.ts; docs/WORKLOG.md
- Why: Provide the LLM with the translation ethos + grammar/polysemy guidance per pipeline stage.
- Details:
  - Added base, skeleton, and phase context blocks (Pali vs English, zero copula, polysemy, relations, morph hints).
  - Injected context blocks into skeleton + phase prompts.
  - Enriched golden example with morph hint + relation status.
- Tests: Not run (local).

2026-01-27 06:45 UTC - Add full compiler request/response debug logs (in progress)
- Files: services/suttaStudioCompiler.ts; docs/WORKLOG.md
- Why: Enable full visibility into compiler model calls (params, request, response).
- Details:
  - Added debug logs for model/params and full request/response bodies gated by LF_AI_DEBUG_FULL.
  - Logs exclude API keys (SDK handles keys out-of-band).
- Tests: Not run (local).

2026-01-27 06:58 UTC - Fix Sutta Studio progress display + partial fallback (in progress)
- Files: types/suttaStudio.ts; services/suttaStudioCompiler.ts; components/sutta-studio/SuttaStudioApp.tsx; components/sutta-studio/SuttaStudioFallback.tsx; docs/WORKLOG.md
- Why: Progress chip wasn’t showing counts and fallback showed all segments instead of only completed phases.
- Details:
  - Added totalSegments/readySegments to packet.progress and updated compiler to track them.
  - Progress label now uses the active packet (not only resolved demo) so counts render in fallback.
  - Fallback now shows only segments corresponding to completed phases when progress counts exist.
- Tests: Not run (local).

2026-01-27 07:14 UTC - Sutta Studio interaction + alignment visuals (in progress)
- Files: components/sutta-studio/SuttaStudioView.tsx; components/sutta-studio/PaliWord.tsx; components/sutta-studio/EnglishWord.tsx; docs/WORKLOG.md
- Why: Remove the lens drawer, make word click only rotate, and keep faint alignment edges always visible.
- Details:
  - Disabled pin/drawer behavior and removed LensPanel rendering.
  - Word clicks now only cycle meanings; hover tooltips remain in study mode.
  - Alignment arrows are always drawn as faint dotted lines, with a brighter line on hover.
  - Added subtle segment underline/hover cursor so morphology segmentation is visible.
- Tests: Not run (local).

2026-01-27 07:24 UTC - Remove phase title label from studio view (in progress)
- Files: components/sutta-studio/SuttaStudioView.tsx; docs/WORKLOG.md
- Why: Keep UI minimal; back arrow alone indicates navigation, no phase title text.
- Details: Removed rendering of `currentPhase.title` label in the studio view header area.
- Tests: Not run (local).

2026-01-27 07:38 UTC - Recompile invalidation + adaptive layout blocks (in progress)
- Files: components/sutta-studio/SuttaStudioApp.tsx; components/sutta-studio/SuttaStudioView.tsx; types/suttaStudio.ts; services/suttaStudioCompiler.ts; config/suttaStudioPromptContext.ts; config/suttaStudioExamples.ts; docs/WORKLOG.md
- Why: Allow iterative recompiles and reduce edge crossings with adaptive block layout.
- Details:
  - Added `?recompile=1` and prompt-version mismatch invalidation to trigger recompiles without clearing existing packet.
  - Phase schema now allows `layoutBlocks`; prompts request max-5 word blocks.
  - Studio view renders Pali/English in blocks (<=5 words) and assigns ghost tokens to nearest linked word.
  - Added dedupe for adjacent English tokens using first-sense text.
- Tests: Not run (local).

2026-01-27 07:40 UTC - Bump Sutta Studio prompt version (in progress)
- Files: services/suttaStudioCompiler.ts; docs/WORKLOG.md
- Why: Force auto-recompile after prompt/context changes.
- Details: Updated SUTTA_STUDIO_PROMPT_VERSION to v2.
- Tests: Not run (local).

2026-01-27 07:58 UTC - Add Morphology pass to Sutta Studio compiler (in progress)
- Files: services/suttaStudioCompiler.ts; config/suttaStudioPromptContext.ts; config/suttaStudioExamples.ts; types/suttaStudio.ts; docs/WORKLOG.md
- Why: Ensure word segmentation + morph hints exist even when the phase pass returns a single stem per word.
- Details:
  - Added a dedicated morphology pass that returns updated segments only.
  - Added morph JSON schema + prompt context + golden example.
  - Bumped prompt version to v3 to auto-recompile.
- Tests: Not run (local).

2026-01-28 08:07 UTC - Align phase label with readyPhases/totalPhases
- Files: components/sutta-studio/SuttaStudioFallback.tsx:19-27; components/sutta-studio/SuttaStudioView.tsx:9
- Why: Keep top progress label consistent with ready/total counts and remove unused phase resolver import.
- Details: Fallback now renders "Phase {readyPhases}/{totalPhases}" directly with clamped ready count; cleaned unused import in studio view.
- Tests: Not run (local).
