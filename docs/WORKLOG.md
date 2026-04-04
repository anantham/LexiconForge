2026-04-04 00:00 EDT - [Agent: Codex] Merge-main catch-up for custom-text PR
- Files:
  - components/InputBar.tsx:34-40,120-132
  - store/slices/chaptersSlice.ts:14-18,528-605
- Why:
  - PR #25 was blocked as non-mergeable after `main` added reader/library state selectors and chapter-slice bookshelf plumbing while the branch still carried the custom-text import flow.
- Details:
  - Resolved the `InputBar` selector conflict by keeping the newer library/session selectors from `main` and the branch's `importCustomText` action hookup.
  - Resolved the `chaptersSlice` import conflict by keeping `BookshelfStateService` from `main` and the branch's `transformImportedChapters` + `ImportOps` imports so the manual-text import path still compiles.
  - Verified `store/slices/chaptersSlice.ts` is already tracked as a hotspot in `docs/architecture/ARCHITECTURE.md`; no duplicate hotspot entry added.
- Tests:
  - `./node_modules/.bin/vitest run tests/components/InputBar.test.tsx` ✅
  - `npm run -s build` ✅

2026-03-30 05:17 PDT - [Agent: Codex] /metaupdate debt capture workflow
- Files:
  - AGENTS.md:274-292
  - docs/WORKLOG.md:1-8
- Why:
  - The repo had chronology in `WORKLOG` and curated debt in `TECH-DEBT-STATUS`, but no formal inbox for organic maintainability findings discovered during feature work.
- Details:
  - Added `DEBT_CAPTURE_PROTOCOL` to `AGENTS.md`.
  - Standardized the split between `docs/WORKLOG.md` for chronology, `docs/roadmaps/TECH-DEBT-INBOX.md` for append-only raw debt receipts, `docs/roadmaps/TECH-DEBT-STATUS.md` for curated debt, and `docs/architecture/ARCHITECTURE.md` §7 for structural hotspots only.
  - Added grep-friendly `[DEBT]`-style prefixes so actionable findings can be filtered later instead of disappearing into rotated logs.
- Tests: Not run (docs/process update only).

2026-03-29 22:35 PDT - [Agent: Codex] FMC partial artifact finalized for publication
- Files:
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/forty-millenniums-of-cultivation/metadata.json
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/forty-millenniums-of-cultivation/session.json
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/forty-millenniums-of-cultivation/build-report.json
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/forty-millenniums-of-cultivation/recovery/alignment-maps/hole-766.json
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/forty-millenniums-of-cultivation/recovery/alignment-maps/hole-1911.json
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/forty-millenniums-of-cultivation/recovery/alignment-maps/hole-2187.json
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/forty-millenniums-of-cultivation/recovery/alignment-maps/hole-2348.json
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/novels/forty-millenniums-of-cultivation/cover.jpg
  - external repo: /Users/aditya/Documents/Ongoing Local/lexiconforge-novels/registry.json
- Why:
  - The FMC partial release needed honest runtime metadata, a local cover asset, and the four verified hole recoveries before any attempt to extend the translation past chapter 2387.
- Details:
  - Rebuilt the hosted-library artifact from the GB18030 raw TXT plus the PDF-backed English range and the four manually verified NovelHi recoveries.
  - Verified chapters 766, 1911, 2187, and 2348 now carry English fan translation, while chapter 2388 remains raw-only.
  - Added richer title/tag/source metadata and switched the provided cover image to an optimized derived JPEG for publication rather than a 10 MB raw PNG.
  - Confirmed the build report now shows `translatedChapterCount = 2387` with missing fan-translation warnings beginning at chapter 2388.
- Tests:
  - `npx tsx scripts/build-library-session.ts /tmp/fmc-hole-recovery-manifest.json` ✅
  - targeted JSON inspection of chapters `766`, `1911`, `2187`, `2348`, and `2388` ✅

2026-03-29 21:50 PDT - [Agent: Codex] Hole-resolution prep: adapter-spec aware alignment CLI
- Files:
  - scripts/lib/source-input.ts
  - scripts/discover-chapter-alignment.ts
  - tests/scripts/source-input.test.ts
- Why:
  - The alignment discovery CLI incorrectly treated all source inputs as filesystem paths, which broke `novelhi://...` range specs even though the adapter itself supported them.
  - FMC hole recovery needs the existing binary-search alignment pipeline to work directly against NovelHi candidate windows.
- Details:
  - Added a small source-input helper that preserves URL/custom-scheme adapter specs and only resolves real filesystem paths.
  - Updated `discover-chapter-alignment.ts` to use the helper for `--raw` and `--fan`.
  - Added focused tests for URL/spec preservation vs. filesystem path resolution.
- Tests:
  - `npx vitest run tests/scripts/source-input.test.ts tests/scripts/novelhi-adapter.test.ts tests/scripts/chapter-alignment-discovery.test.ts tests/scripts/library-session-builder.test.ts` ✅

2026-03-29 17:28 PDT - [Agent: Codex] Starting principled novel import pipeline
- Status: Starting
- Task: Build a reusable source-import pipeline for monolithic TXT, PDF, and EPUB inputs that can emit hosted-library `metadata.json + session.json` artifacts, then use it to generate Forty Millenniums of Cultivation with PDF chapters 1-2387 and `@NovelsZaraki.epub` for 2388+.
- Worktree: ../LexiconForge.worktrees/codex-book-switching-shelf/
- Branch: feat/codex-book-switching-shelf
- Files likely affected:
  - scripts/lib/translation-sources.ts
  - scripts/lib/*.ts (new importer helpers)
  - scripts/polyglot-merge.ts or successor builder script
  - tests/scripts/* or adjacent vitest coverage
  - docs/WORKLOG.md
- Why:
  - Existing importer foundation supports EPUB, TXT directories, and Polyglotta JSON only.
  - Hosted library artifacts use `lexiconforge-session`, not the richer `lexiconforge-full-1` payload emitted by `polyglot-merge`.
  - This title needs principled range-based source selection: raw Chinese TXT for `content`, PDF for English `fanTranslation` chapters 1-2387, and `@NovelsZaraki.epub` after that.

2026-03-29 17:04 PDT - Planned future feature: raw source discovery and library search
- Files:
  - docs/superpowers/specs/2026-03-29-raw-source-discovery-library-search-design.md
  - docs/superpowers/plans/2026-03-29-raw-source-discovery-library-search.md
- Why: Capture the approved future feature for searching fan titles, resolving canonical Chinese novel identity, finding likely raw sources, and adding books to the library without manually hunting for raw sites.
- Details:
  - Recorded the approved design direction as a metadata-first resolver: `Novel Updates -> canonical Chinese identity -> official-platform search -> mirror fallback`.
  - Explicitly classified UUkanshu, Piaotian, Dxmwx, and Kanunu as discovery/fallback sources rather than canonical identity sources.
  - Marked the feature as approved and waiting for implementation in both the spec and plan docs.
- Tests: Not run (docs only).

2026-03-29 16:42 PDT - Principled deep links + principled public/developer error split
- Files:
  - services/appError.ts:1-54
  - services/scraping/fetcher.ts:18-34, 199-231
  - services/navigation/fetcher.ts:11, 175-184
  - services/navigation/history.ts:4-59
  - services/navigation/index.ts:393-400
  - store/slices/chaptersSlice.ts:410-416, 497-504, 522-525
  - services/registryService.ts:51-63
  - store/bootstrap/initializeStore.ts:23-35, 137-267
  - MainApp.tsx:148-165
  - tests/store/bootstrap/bootstrapHelpers.test.ts
  - tests/services/navigationService.test.ts
  - tests/services/registryService.test.ts
- Why: Shared links only carried `?chapter=...`, so incognito/device-open flows lost the library novel/version context and landed on the library first. Separately, scraper diagnostics were crossing the boundary into UI state, exposing proxy health internals directly to readers.
- Details:
  - Added `AppError` so failures can keep a short `userMessage` alongside verbose `developerMessage` and diagnostics.
  - Updated the scraper fetch path to throw typed public-vs-debug errors instead of one giant user-visible blob.
  - Updated navigation fetch handling to surface only the public message to UI state while preserving console diagnostics.
  - Extended reader browser history to preserve `novel`, optional `version`, and `chapter` so links can reconstruct the reading target.
  - Moved `?chapter` handling fully into bootstrap so `?novel + ?version + ?chapter` composes as import/hydrate first, then navigate, without a library-first flash.
  - Added registry lookup by `novel.id` so bootstrap can resolve principled shared links from canonical library identity.
- Tests:
  - `npx vitest run tests/store/bootstrap/bootstrapHelpers.test.ts tests/services/navigationService.test.ts tests/services/registryService.test.ts tests/current-system/navigation.test.ts tests/components/InputBar.test.tsx tests/store/appScreen.integration.test.tsx` ✅
  - `npx tsc --noEmit --pretty false` ⚠️ pre-existing failures only in `scripts/sutta-studio/*`

2026-01-31 14:40 UTC - Ripple examples empirically validated
- Files: services/suttaStudioPassPrompts.ts, config/suttaStudioExamples.ts, scripts/sutta-studio/benchmark-config.ts
- Why: Fix "was dwells" grammatical issue where ghost words don't match selected verb tense.
- Details:
  - Added ripple example to lexicographer prompt showing how to adjust ghost words based on sense selection
  - Pre-ripple: trinity-large/minimax-m2 generated 0 ripples for viharati (p5)
  - Post-ripple: trinity-large generates 3 proper ripples:
    - "dwells" (habitual) → `ripples: { "e10": "" }` (removes "was")
    - "stays" (temporary) → `ripples: { "e10": "was" }` (keeps "was")
    - "abides" (spiritual) → `ripples: { "e10": "" }` (removes "was")
  - Models now understand when/how to use ripples for grammatical English
- Tests: Benchmark phase-b with trinity-large confirmed ripple generation.

2026-01-28 13:00 UTC - Full docs/ reorganization into subfolders
- Files: 38 docs moved from docs/ root into docs/features/, docs/guides/, docs/architecture/, docs/roadmaps/, docs/infrastructure/
- Why: Flat structure with 41 files was hard to navigate; organize by domain for discoverability.
- Details:
  - Created 5 new folders: features/ (9 docs), guides/ (8 docs), roadmaps/ (7+3 new docs), infrastructure/ (3+2 new docs), architecture/ (1 doc)
  - Archived 4 stale docs (TECH-DEBT-REDUCTION-PLAN, TYPESCRIPT-ERROR-ANALYSIS, TYPESCRIPT-FIX-PLAN, RELEASE_NOTES) with superseded-by headers
  - Archived 3 completed plans (INDEXEDDB-DECOMPOSITION-PLAN, INDEXEDDB-FACADE-MIGRATION, LEGACY_REPO_RETIREMENT_PLAN) to archive/completed/
  - Created 3 new replacement docs: TYPESCRIPT-HEALTH.md, TECH-DEBT-STATUS.md, CHANGELOG.md
  - Added status banners to 4 incomplete docs (NOVEL_LIBRARY_STATUS, MEMORY_OPTIMIZATION, COMPONENT-DECOMPOSITION, COMMUNITY_LIBRARY)
  - Created README.md with content index and "Missing Documentation" checklist in each folder
  - Updated START_HERE.md with new folder structure and links
  - docs/ root now has only 4 files: START_HERE.md, ONBOARDING.md, WORKLOG.md, Vision.md
- Tests: Not run (docs only).

2026-01-28 12:30 UTC - Archive stale root docs with superseded-by headers
- Files: DIAGNOSTIC_LOGGING.md → docs/archive/; TEST_QUALITY_AUDIT.md → docs/archive/testing-evolution/; TEST_IMPROVEMENTS_IMPLEMENTED.md → docs/archive/testing-evolution/; PHASE_2_GOLDEN_TEST_LEARNINGS.md → docs/archive/testing-evolution/; NEXT_STEPS_DETAILED.md → docs/archive/testing-evolution/; Vision.md → docs/Vision.md
- Why: Clean up root directory by archiving stale docs while preserving historical context.
- Details:
  - Created docs/archive/testing-evolution/ folder to preserve test infrastructure evolution journey.
  - Added "superseded by" headers to each archived file pointing to current reference docs.
  - DIAGNOSTIC_LOGGING.md → superseded by docs/Debugging.md
  - TEST_*.md files → superseded by docs/TEST_MANIFEST.md (historical records preserved)
  - Moved Vision.md to docs/ (not stale, just misplaced).
- Tests: Not run (docs only).

2026-01-28 12:13 UTC - Create START_HERE.md as newcomer documentation index
- Files: docs/START_HERE.md (new)
- Why: Provide a single entry point for newcomers to navigate the codebase documentation.
- Details:
  - Created comprehensive TOC linking to all key docs organized by role (contributor, architect, feature dev, ops).
  - Includes directory structure overview, ADR index with domain prefixes, and key design principles.
  - Links to ONBOARDING.md for detailed walkthrough.
- Tests: Not run (docs only).

2026-01-28 12:00 UTC - Unify ADR files under docs/adr/ with domain prefixes
- Files: docs/ADR-001-Decompose-Monolithic-IndexedDB-Service.md → docs/adr/DB-001-decompose-monolithic-indexeddb.md; docs/ADR-002-Atomic-Transaction-Boundaries.md → docs/adr/DB-002-atomic-transaction-boundaries.md; docs/ADR-003-Version-Centric-Data-Model.md → docs/adr/DB-003-version-centric-data-model.md; docs/ADR-004-Service-Layer-Architecture.md → docs/adr/CORE-004-service-layer-architecture.md; docs/ADR-005-Agent-First-Code-Organization.md → docs/adr/CORE-005-agent-first-code-organization.md; docs/ADR-006-Tree-Shakeable-Service-Architecture.md → docs/adr/CORE-006-tree-shakeable-service-architecture.md; docs/ADR-007-Schema-Evolution-And-Migrations.md → docs/adr/DB-007-schema-evolution-and-migrations.md; docs/adr/001-preloader-strategy.md → docs/adr/FEAT-001-preloader-strategy.md; docs/adr/002-typescript-debt-remediation.md → docs/adr/FEAT-002-typescript-debt-remediation.md; docs/adr/003-sutta-studio-mvp.md → docs/adr/SUTTA-003-sutta-studio-mvp.md
- Why: Fix ADR numbering collision between docs/ and docs/adr/; consolidate all ADRs under single directory with domain prefixes (DB, CORE, FEAT, SUTTA).
- Details:
  - Moved 7 ADR files from docs/ root to docs/adr/ with domain prefixes.
  - Renamed 3 existing docs/adr/ files to use domain prefixes.
  - Updated all internal cross-references (ADR-001→DB-001, ADR-002→DB-002, etc.).
  - Updated document headers to match new naming scheme.
- Tests: Not run (file organization only).

2026-01-28 12:00 UTC - Archive diagnostic artifacts and stale files
- Files: ts-prune-output.txt → docs/archive/diagnostics/ts-prune-output-2025.txt; diagnostics/*.txt → docs/archive/diagnostics/; formattingIssues.md → docs/archive/formattingIssues.md; ISSUES.md → docs/archive/ISSUES.md; COVERAGE_REPORT.md → docs/archive/quality/COVERAGE_REPORT.md
- Why: Clean up root directory by moving stale diagnostic artifacts and outdated backlog files to archive.
- Details:
  - Moved ts-prune-output.txt with year suffix to diagnostics archive.
  - Moved 4 TSC diagnostic files from diagnostics/ folder to archive/diagnostics/.
  - Moved formattingIssues.md and ISSUES.md (stale backlog) to archive root.
  - Moved COVERAGE_REPORT.md to archive/quality/ subfolder.
  - Removed empty diagnostics/ directory.
- Tests: Not run (file organization only).

2026-01-28 12:00 UTC - Fix outdated statements in README.md
- Files: README.md:42-50, 57, 125, 149, 163
- Why: README had stale info about site count, OpenAI support, and broken/inconsistent links.
- Details:
  - Updated site list from 5 to 8 (added BookToki Korean, SuttaCentral Pali/Suttas).
  - Changed "Coming Soon: Direct OpenAI integration" to reflect that OpenAI is now supported.
  - Added VITE_OPENAI_API_KEY to .env.local example.
  - Fixed broken link to PROJECT_STRUCTURE.md, now points to docs/adr/.
  - Simplified ADR path from "docs/ and docs/adr/" to just "docs/adr/".
- Tests: Not run (docs only).

2026-01-28 08:04 UTC - Untrack .serena files from git index
- Files: .serena/.gitignore; .serena/memories/project_overview.md; .serena/memories/project_structure.md; .serena/memories/style_and_conventions.md; .serena/memories/suggested_commands.md; .serena/memories/task_completion.md; .serena/project.yml; docs/WORKLOG.md
- Why: Keep local assistant memory out of version control while preserving local functionality.
- Details:
  - Removed .serena files from git index using update-index; files remain on disk and are ignored.
- Tests: Not run (git hygiene only).

2026-01-28 07:59 UTC - Docs hygiene: options-first response format + ignore .serena + remove cookie file
- Files: AGENTS.md:25-37; .gitignore:91-94; data/Novels/booktoki468.com_cookies.txt (removed); docs/WORKLOG.md
- Why: Enforce options-first response framing and prevent assistant artifacts/sensitive cookies from entering git.
- Details:
  - Updated Prime Directive #11 to include decision dimensions and added RESPONSE_FORMAT section.
  - Added `.serena/` to .gitignore; removed local Booktoki cookie file.
- Tests: Not run (docs/git hygiene only).

2026-01-28 04:56 UTC - Add options-first directive to AGENTS
- Files: AGENTS.md:25; docs/WORKLOG.md
- Why: Enforce presenting options with open questions, tradeoffs, and uncertainties before proceeding.
- Details:
  - Added Prime Directive #11 requiring options-first framing.
- Tests: Not run (docs only).

2026-01-28 04:43 UTC - ADR-003 amendment: assembly-line compiler pipeline + phase state envelope (proposed)
- Files: docs/adr/003-sutta-studio-mvp.md:151-194; docs/WORKLOG.md
- Why: Align architecture doc with the quality-first assembly-line compiler plan and prompt contracts.
- Details:
  - Added an ADR amendment describing chunked skeleton, anatomist/lexicographer/weaver/typesetter passes, phase state envelope, flattened schema, polysemy contract, layout hints + UI fallback, and staged validation.
- Tests: Not run (docs only).

2026-01-28 04:53 UTC - Accept ADR-003 and enable chunked skeleton pass (in progress)
- Files: docs/adr/003-sutta-studio-mvp.md:1-4, 151-155; services/suttaStudioCompiler.ts:37, 380-494, 730-753; docs/WORKLOG.md
- Why: Mark the assembly-line amendment as accepted and prevent skeleton truncation by chunking inputs.
- Details:
  - Updated ADR-003 status to Accepted (including the assembly-line amendment block).
  - Added chunked skeleton helper to run per-50 segment windows with per-chunk fallback.
  - Bumped prompt version to v6 to invalidate cached packets.
- Tests: Not run (not requested).

2026-01-28 04:50 UTC - Add assembly-line pipeline implementation roadmap (accepted)
- Files: docs/plans/2026-01-28-sutta-studio-assembly-line-roadmap.md; docs/WORKLOG.md
- Why: Capture the detailed implementation plan (rehydrator, throttling, error handling, tokenization, golden set) so it survives across sessions.
- Details:
  - Added a step-by-step roadmap covering chunked skeleton, throttled queue, flattened anatomist pass, rehydration utility, lexicographer/weaver/typesetter passes, degraded-state fallback, and benchmarking.
- Tests: Not run (docs only).

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
2026-01-30 07:36 UTC - Sutta Studio pass runner + benchmark harness (complete)
- Files: services/suttaStudioPromptVersion.ts:1; services/suttaStudioLLM.ts:1-149; services/suttaStudioPassPrompts.ts:1-706; services/suttaStudioPassRunners.ts:1-584; services/suttaStudioCompiler.ts:56,65; scripts/sutta-studio/benchmark.ts:1-594; scripts/sutta-studio/benchmark-config.ts:1-74; docs/benchmarks/sutta-studio.md:1-77; docs/roadmaps/REFACTOR_CANDIDATES.md:18-20; docs/WORKLOG.md
- Why: Provide per-pass benchmarking with JSON/CSV telemetry plus reusable pass runners and prompt helpers.
- Details:
  - Added shared prompt+schema module and LLM caller helper for pass-level benchmarking.
  - Added per-pass runner module (skeleton/anatomist/lexicographer/weaver/typesetter/morphology) with injectable LLM caller.
  - Added benchmark script + config to run passes and write `reports/sutta-studio/<timestamp>/metrics.json|csv`.
  - Documented benchmark usage/fields and logged new >300 LOC files as refactor candidates.
- Tests: Not run (not requested).
2026-01-28 10:18 UTC - Add compiler throttling between LLM calls (in progress)
- Files: services/suttaStudioCompiler.ts:38, 278-311, 448-498, 714-879; docs/WORKLOG.md
- Why: Reduce bursty LLM traffic and lower the chance of 429s during multi-phase compilation.
- Details:
  - Added a compiler throttle helper with abort-aware delay and a 1s minimum gap between calls.
  - Applied throttling to skeleton chunk calls, phase compile, and morphology pass.
- Tests: Not run (not requested).
2026-01-28 07:51 UTC - Phase 2 anatomist pass (assembly-line) wired into compiler (in progress)
- Files: services/suttaStudioCompiler.ts:42, 69-139, 318-407, 821-883, 1027-1157; types/suttaStudio.ts:65-104; config/suttaStudioPromptContext.ts:30-38; config/suttaStudioExamples.ts:1-124; docs/WORKLOG.md
- Why: Introduce the Anatomist pass with a flattened schema to reduce LLM overload and make segmentation authoritative.
- Details:
  - Added Anatomist types, prompt context, and a golden example JSON.
  - Added Anatomist JSON schema, phase state envelope, prompt builder, and compiler call (structured outputs).
  - Use anatomist segments to override phase output and skip morphology when anatomist succeeds.
  - Bumped prompt version to v7 to invalidate cached packets.
- Tests: Not run (not requested).
2026-01-30 10:45 UTC - Sutta Studio pass runner + benchmark harness (starting)
- Status: Starting
- Task: Add per-pass runners (skeleton/anatomist/lexico/weaver/typesetter/morph) with injectable LLM caller, plus JSON/CSV benchmark outputs.
- Files likely: services/suttaStudioCompiler.ts; services/suttaStudioPassRunners.ts (new); scripts/sutta-studio/benchmark.ts (new); scripts/sutta-studio/benchmark-config.ts (new); tests/sutta-studio/* (new); test-fixtures/sutta-studio/* (new); docs/benchmarks/sutta-studio.md (new); docs/WORKLOG.md
- Notes: Will add line-number details once edits land.
2026-01-30 10:45 UTC - Sutta Studio pass runner + benchmark harness (starting)
- Status: Starting
- Task: Add per-pass runners (skeleton/anatomist/lexico/weaver/typesetter/morph) with injectable LLM caller, plus JSON/CSV benchmark outputs.
- Files likely: services/suttaStudioCompiler.ts; services/suttaStudioPassRunners.ts (new); scripts/sutta-studio/benchmark.ts (new); scripts/sutta-studio/benchmark-config.ts (new); tests/sutta-studio/* (new); test-fixtures/sutta-studio/* (new); docs/benchmarks/sutta-studio.md (new); docs/WORKLOG.md
- Notes: Will add line-number details once edits land.
2026-01-30 08:03 UTC - Skeleton-only benchmark outputs + repeat runs
- Files: scripts/sutta-studio/benchmark.ts:13-739; test-fixtures/sutta-studio-golden-data.json:6-40; docs/benchmarks/sutta-studio.md:30-75; docs/WORKLOG.md
- Why: Capture skeleton outputs for manual diffing and enable repeated runs per model.
- Details:
  - Added skeleton fixture parsing with fallback to phase1+phase2 segments and recorded skeleton source metadata.
  - Wrote skeleton golden baseline + per-run chunk/aggregate outputs under `reports/sutta-studio/<timestamp>/outputs/`.
  - Added repeatRuns and captureOutputs metadata to metrics payload.
  - Documented new config knobs and output folder layout.
- Tests: Not run (not requested).
2026-01-30 09:03 UTC - Skeleton benchmark run (OpenRouter models) + script fixes
- Files: scripts/sutta-studio/benchmark.ts:1-746; scripts/sutta-studio/benchmark-config.ts:1-145; services/suttaStudioPassRunners.ts:1-60; docs/WORKLOG.md
- Why: Run manual-diff benchmark against multiple OpenRouter models without Vite-only imports.
- Details:
  - Added direct OpenRouter LLM caller in benchmark script and injected it into all pass runners to avoid loading translator prompt dependencies.
  - Added a missing loop-closing brace before metrics write to fix a parse error.
  - Removed session default settings import; added minimal BASE_SETTINGS to avoid `.md` import chain.
  - Updated benchmark config with OpenRouter model list (Gemini 3 Flash, Gemini 2.5 Flash, Kimi K2/K2.5, GLM 4.7/4.7 Flash, DeepSeek v3.2).
  - Benchmark output written to `reports/sutta-studio/2026-01-30T08-56-47-761Z/` (metrics + outputs).
- Tests: `./node_modules/.bin/tsx scripts/sutta-studio/benchmark.ts`
2026-01-30 09:43 UTC - Add Sutta Studio benchmark viewer route
- Files: App.tsx:1-22; components/bench/SuttaStudioBenchmarkView.tsx:1-203; docs/WORKLOG.md
- Why: Provide a minimal side-by-side viewer for skeleton aggregate outputs with golden baseline.
- Details:
  - Added `/bench/sutta-studio` route in App to render the benchmark viewer.
  - Viewer loads `reports/sutta-studio/**/outputs/**/skeleton-aggregate.json` plus `skeleton-golden.json` via `import.meta.glob`.
  - Minimal UI with two dropdowns and plain cards listing phases/segments.
- Tests: Not run (UI route only).
2026-01-30 15:40 UTC - Add benchmark index + runtime refresh for Sutta Studio bench
- Files: scripts/sutta-studio/benchmark.ts; components/bench/SuttaStudioBenchmarkView.tsx; docs/benchmarks/sutta-studio.md
- Why: Avoid Vite import.meta.glob cache; allow new benchmark runs to appear in /bench/sutta-studio without dev-server restart.
- Details:
  - Benchmark now writes reports/sutta-studio/index.json by scanning outputs for skeleton aggregates + golden baselines.
  - Bench view fetches the index at runtime with a Refresh button and lazy-loads selected outputs.
  - Docs updated to mention index.json and live refresh behavior.
- Tests: Not run (not requested).
2026-01-30 16:10 UTC - Add per-run cost/time summaries to benchmark index
- Files: scripts/sutta-studio/benchmark.ts; components/bench/SuttaStudioBenchmarkView.tsx; docs/benchmarks/sutta-studio.md
- Why: Provide run-level totals in reports/sutta-studio/index.json for future UI rollups.
- Details:
  - Index builder now reads metrics.json and aggregates duration/cost/token totals per run.
  - Summaries avoid double-counting by using skeleton chunk rows + pass rows (excluding aggregate rows).
  - Bench view index types updated; docs mention summary fields.
- Tests: Not run (not requested).

2026-01-30 16:35 UTC - Add live benchmark progress tracking
- Files: scripts/sutta-studio/benchmark.ts:150,358,625-1280; components/bench/SuttaStudioBenchmarkView.tsx:171,204,351; docs/benchmarks/sutta-studio.md:42-63
- Why: Surface per-model/pass/chunk progress during long benchmark runs.
- Details:
  - Benchmark writes progress snapshots to reports/sutta-studio/<timestamp>/progress.json and a root active-run.json pointer.
  - Bench UI polls active-run.json and renders a live progress bar with current run/pass/chunk.
  - Progress totals include per-chunk skeleton steps to reflect chunk-level work.
- Tests: Not run (not requested).
2026-01-30 16:48 UTC - Limit benchmark models to two for cheaper runs
- Files: scripts/sutta-studio/benchmark-config.ts:36-90
- Why: Reduce token spend while iterating on benchmark workflow.
- Details:
  - Kept only openrouter-gemini-3-flash and openrouter-kimi-k2.5 in BENCHMARK_CONFIG.runs.
  - Temporarily removed other OpenRouter models from the run list.
- Tests: Not run (not requested).
2026-01-30 16:12 UTC - Fix benchmark runner try/catch block
- Files: scripts/sutta-studio/benchmark.ts:1274-1276
- Why: tsx build failed with “Unexpected catch” due to missing try block closure.
- Details:
  - Added missing closing brace before the catch block in runBenchmark().
- Tests: Running benchmark (in progress).

2026-01-30 16:52 UTC - Incrementally refresh benchmark index during runs
- Files: scripts/sutta-studio/benchmark.ts:659,842
- Why: Allow /bench/sutta-studio to show partial results while a run is still executing.
- Details:
  - Write index.json after skeleton-golden is created and after each skeleton-aggregate output.
- Tests: Not run (not requested).

2026-01-30 16:58 UTC - Fast benchmark mode (skeleton-only, single repeat)
- Files: scripts/sutta-studio/benchmark-config.ts:24-33
- Why: Speed up experimental loops while keeping 2-model coverage.
- Details:
  - repeatRuns set to 1
  - passes limited to ['skeleton']
- Tests: Not run (not requested).
2026-01-30 17:02 UTC - Fix bench dropdown labels for index-driven options
- Files: components/bench/SuttaStudioBenchmarkView.tsx:72-117,388-389
- Why: Dropdown options were blank because BenchCard expected BenchEntry labels while receiving index entries.
- Details:
  - BenchCard now accepts BenchIndexEntry options and uses buildLabel() for option text.
- Tests: Not run (not requested).

2026-01-30 17:10 UTC - Sort benchmark dropdown by newest timestamp
- Files: components/bench/SuttaStudioBenchmarkView.tsx:45-51
- Why: Make recent runs easier to select in the bench dropdowns.
- Details:
  - Sorting now prioritizes newest timestamps, then golden entries, then runId.
- Tests: Not run (not requested).

2026-01-30 17:28 UTC - Add demo-based skeleton map + generator
- Files: test-fixtures/sutta-studio-demo-map.json; scripts/sutta-studio/generate-golden-from-demo.ts; test-fixtures/sutta-studio-golden-from-demo.json
- Why: Create a golden skeleton fixture derived from the demo packet with explicit phase-to-segment mapping.
- Details:
  - Added demo→segment mapping for mn10:1.1–2.6 (merging demo sub-phases that share a single canonical segment).
  - Generator reads the mapping + base fixture and writes a filtered golden file.
- Tests: Ran `./node_modules/.bin/tsx scripts/sutta-studio/generate-golden-from-demo.ts`.

2026-01-30 17:34 UTC - Point benchmark fixture to demo-derived golden
- Files: scripts/sutta-studio/benchmark-config.ts:18-23
- Why: Use demo-derived golden fixture for skeleton benchmarking.
- Details:
  - fixture.path now points to test-fixtures/sutta-studio-golden-from-demo.json
- Tests: Not run (not requested).

2026-01-30 17:42 UTC - Align skeleton prompt + example to demo-derived golden
- Files: config/suttaStudioPromptContext.ts:8-27; config/suttaStudioExamples.ts:6-64
- Why: Reduce over-grouping and match demo-derived golden expectations (mostly one segment per phase).
- Details:
  - Skeleton guidance now defaults to one segment per phase and explicitly avoids merging response/transition and benefit lines.
  - Skeleton example updated to show separate phases for 1.3/1.4/1.5/1.6 and 2.2–2.6.
- Tests: Not run (not requested).
2026-01-30 12:57 UTC - Add retries + stacked errors for Sutta Studio benchmark (in progress)
- Files: scripts/sutta-studio/benchmark.ts:367-568, 706-903, 1002-1315, 1348-1358; components/bench/SuttaStudioBenchmarkView.tsx:53-84, 361-421
- Why: Retry transient 429/5xx failures and surface all errors in the bench UI without digging into files.
- Details:
  - Added retry/backoff with Retry-After support for OpenRouter calls; network/timeouts retry once.
  - Progress state now accumulates per-chunk/pass errors and writes them to active-run.json.
  - Bench UI shows a stacked error list with timestamps/run/pass/chunk context.
- Tests: Not run (not requested).
2026-03-29 10:32 PDT - Patch book-switching shelf implementation plan before coding
- Files: docs/superpowers/plans/2026-03-29-book-switching-shelf.md:9,95,274,367,490,663,802,854,968,1277,1425; docs/WORKLOG.md
- Why: Remove implementation blockers and paper over fewer ambiguities before any code changes for the shelf feature.
- Details:
  - Added a Phase 1 scope gate so legacy cached novels without persisted `novelId` are treated as requiring one re-import instead of being silently misclassified as shelf-ready library novels.
  - Corrected Task 2/4 surface details by removing direct `store/storeTypes.ts` edits, making steady-state DB `novelId` fields `string | null`, and requiring fresh-DB index parity in `services/db/core/connection.ts` alongside the schema upgrade.
  - Reworked Task 5/6 so canonical `registryNovelId` is threaded through `ImportService` callers, `ensureChapterUrlMappings(...)` preserves mapping `novelId`, and legacy backfill only normalizes `undefined -> null` instead of pretending to recover ambiguous historical identity.
  - Split hydration planning into `loadNovelIntoStore(novelId)` for library novels and `loadAllIntoStore()` for ephemeral/full-session flows, updated Task 9 replacements accordingly, and clarified that consolidation must preserve caller-owned reader state like `currentChapterId` and `navigationHistory`.
  - Tightened bootstrap/navigation/new-book tasks so `?novel` imports pass canonical `novel.id`, reader transitions explicitly call `setReaderReady()`, and store-owned navigation sets active novel context after successful deep-link navigation.
  - Fixed remaining plan nits: corrected `ChapterHeader` test command to `.test.tsx` and expanded verification to include the legacy-cache re-import limitation.
- Tests: Not run (documentation-only plan patch).
2026-03-29 21:14 PDT - Conservative git cleanup: preserve live WIP, remove only stale merged local state
- Files: docs/WORKLOG.md
- Why: Clean up merged local branches/worktrees without discarding active work or replaying old stashes onto `main`.
- Details:
  - Re-read `docs/WORKLOG.md`, inspected local branches/worktrees/stashes, and confirmed `main` is still dirty.
  - Moved the dirty merged worktrees onto `codex/wip-book-switching-shelf-2026-03-29` and `codex/wip-roadmap-docs-2026-03-29`, then deleted the stale local branches `feat/codex-book-switching-shelf` and `feat/codex-roadmap-docs`.
  - Preserved `stash@{1}` on `codex/stash-epub-export-modal-2026-03-29` and `stash@{0}` on `codex/stash-gemini-pre-lfs-migrate-2026-03-29`, removed the temporary stash worktrees, and cleared the stash list.
  - Removed the clean merged `feat/codex-epub-diagnostics` worktree and local branch, and intentionally left dirty `main` plus the unmerged `feat/opus-library-search` worktree/branch untouched.
- Tests: Not run (git hygiene only).
### [2026-03-29 10:39 PDT] [Agent: Codex]
**Status:** Starting
**Task:** Implement book-switching shelf Phase 0/1 from patched plan, beginning with explicit appScreen routing and novel identity groundwork.
**Worktree:** ../LexiconForge.worktrees/codex-book-switching-shelf/
**Branch:** feat/codex-book-switching-shelf
**Files likely affected:** store/slices/uiSlice.ts; MainApp.tsx; store/bootstrap/initializeStore.ts; services/db/types.ts; services/db/core/schema.ts; services/db/core/connection.ts; services/stableIdService.ts; services/importService.ts; services/db/operations/imports.ts; services/db/operations/chapters.ts; services/db/operations/maintenance.ts; services/navigation/hydration.ts; services/navigation/index.ts; components/NovelLibrary.tsx; components/InputBar.tsx; store/slices/chaptersSlice.ts; components/ChapterView.tsx; components/chapter/ChapterHeader.tsx; tests/store/*; tests/components/*; docs/adr/*; docs/WORKLOG.md
### [2026-03-29 11:12 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Landed the first feature slice: explicit app shell routing via `appScreen`, with reader entry points now driving library/loading/reader state instead of `MainApp` inferring it from loaded chapters.
**Files modified (line numbers + why):**
- MainApp.tsx:51,308-330 - replace derived `hasSession` routing with `appScreen` and add explicit `reader-loading` shell loader.
- store/slices/uiSlice.ts:14-18,54-60,116-155 - add `appScreen`, `activeNovelId`, and shell transition actions (`openLibrary`, `setReaderLoading`, `openNovel`, `setReaderReady`, `shelveActiveNovel`).
- store/bootstrap/initializeStore.ts:26,75-116 - initialize boot into library mode, set loading/ready shell state for `?novel` and `?import` deep-link imports, and return to library on failure.
- store/bootstrap/importSessionData.ts:20,55-56 - set `appScreen` to `reader` when a restored session resolves a current chapter.
- store/bootstrap/clearSession.ts:7-8 - reset shell routing to library and clear `activeNovelId` on clear-session.
- store/slices/chaptersSlice.ts:146-152,355-356,442,476 - mark successful chapter selection/navigation/fetch as reader mode.
- components/InputBar.tsx:27-29,45,97-111,143,163,173 - drive ephemeral import flows through reader loading/ready state and return to library on failures.
- components/NovelLibrary.tsx:25-27,69,122-125,222-224,266 - mark library-started reads as novel-scoped reader transitions and restore library mode on errors.
- tests/store/bootstrap/bootstrapHelpers.test.ts:112-113,148-166,239-367 - extend bootstrap test harness/state with shell actions and assert initialize/clear flows keep library as the default shell.
- tests/store/appScreen.integration.test.tsx (new) - add regression coverage proving `MainApp` renders library vs reader from `appScreen`, not from loaded chapter presence.
**Tests:** `npx vitest run tests/store/bootstrap/bootstrapHelpers.test.ts tests/store/appScreen.integration.test.tsx` ✅; `npx tsc --noEmit` ⚠️ fails in pre-existing unrelated `scripts/sutta-studio/*` files, not in this slice.
### [2026-03-29 11:35 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Finished the novel-identity groundwork and consolidated the duplicated reader hydration paths behind a new `readerHydrationService`, while keeping `currentChapterId` and `navigationHistory` caller-owned.
**Files modified (line numbers + why):**
- services/db/types.ts:4-17,148-154 - make `novelId` first-class on persisted chapter and URL-mapping records.
- services/stableIdService.ts:48-58,111-160,200-251 - add `novelId` to runtime `EnhancedChapter` and thread canonical `registryNovelId` through transformed imports.
- services/db/core/schema.ts:24-25,365-377 - bump schema to v14 and restore missing `novelId` / `novelChapter` indexes as an explicit migration.
- services/db/core/connection.ts:237-278 - create the same `novelId` and compound mapping indexes on fresh installs.
- services/db/operations/imports.ts:101-169,237-253,349-374 - persist `novelId` and `chapterNumber` through both full-session and stable-session import paths.
- services/db/operations/chapters.ts:11-39,124-154,243-266,376-464 - preserve mapping `novelId`, store chapter membership, and make chapter-number lookup optionally novel-scoped.
- services/db/operations/maintenance.ts:15,36-49,128-145,304-325 - normalize legacy `undefined` `novelId` fields to `null` without pretending to recover ambiguous old library identity.
- services/db/operations/rendering.ts:30-57,88-127,247-275 - expose `novelId` in rendering records and add `fetchChaptersForNovel(novelId)`.
- services/db/core/stable-ids.ts:32-36 - stop URL-mapping rewrites from stripping `novelId` / `chapterNumber`.
- services/importService.ts:18-23,54-58,152-161,700-778 - thread canonical `registryNovelId` through imports and replace inline post-import hydration with `readerHydrationService`.
- services/readerHydrationService.ts (new) - centralize map/index reconstruction for `loadNovelIntoStore()` and `loadAllIntoStore()` without importing the Zustand store directly.
- components/NovelLibrary.tsx:11-12,67-98,131-206 - replace both inline hydration branches with `loadNovelIntoStore(novel.id, useAppStore.setState)` and make the cache path novel-scoped instead of global.
- components/InputBar.tsx:5,61-82 - replace ephemeral streaming hydration with `loadAllIntoStore(useAppStore.setState, { limit: 10 })`.
- store/bootstrap/importSessionData.ts:1-28 - replace full-session inline hydration with `loadAllIntoStore(...)` and keep navigation/current-chapter restore logic local.
- services/navigation/hydration.ts:52-80; services/navigation/index.ts:306-313 - propagate `novelId` back into runtime chapters loaded from IDB.
- services/db/index.ts:153-180,228-242,382-402,429-439; services/db/repositories/ChapterRepository.ts:27-62 - update legacy/memory repo compatibility paths for required persisted `novelId`.
- tests/db/migrations/fresh-install.test.ts:143-214 - verify fresh installs get the new chapter and URL-mapping indexes.
- tests/services/importService.test.ts:123-151 - assert `registryNovelId` is threaded into imported session payloads.
- tests/services/readerHydrationService.test.ts (new) - assert novel-scoped hydration, `novelId` preservation, and `loadAllIntoStore()` behavior.
- tests/current-system/*.test.ts; tests/services/navigationService.test.ts; tests/store/nullSafety.test.ts; tests/utils/test-data.ts - update helpers/builders to construct `EnhancedChapter` with explicit `novelId`.
**Tests:** `npx vitest run tests/db/migrations/fresh-install.test.ts tests/store/appScreen.integration.test.tsx tests/services/importService.test.ts tests/store/bootstrap/bootstrapHelpers.test.ts` ✅; `npx vitest run tests/current-system/export-import.test.ts tests/current-system/feedback.test.ts tests/current-system/navigation.test.ts tests/current-system/settings.test.ts tests/current-system/translation.test.ts tests/services/navigationService.test.ts tests/store/nullSafety.test.ts` ✅; `npx vitest run tests/services/readerHydrationService.test.ts tests/services/importService.test.ts tests/store/bootstrap/bootstrapHelpers.test.ts tests/store/appScreen.integration.test.tsx` ✅; `npx tsc --noEmit --pretty false` ⚠️ still fails only in pre-existing unrelated `scripts/sutta-studio/*` files.
### [2026-03-29 11:38 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Split `initializeStore` into explicit phases and added a bootstrap regression so explicit startup intent (`?novel`, `?import`) no longer competes with passive last-active restoration.
**Files modified (line numbers + why):**
- store/bootstrap/initializeStore.ts:1-309 - replace the monolithic bootstrap body with named phase functions (`loadPromptTemplateState`, `runBootRepairs`, `handleBootstrapIntents`, `hydratePersistedState`, `initializeAudioServices`) and gate passive bookmark restoration behind `restoreReaderState`.
- tests/store/bootstrap/bootstrapHelpers.test.ts:6-57,184-209,357-384 - mock `NavigationOps`, `novelCatalog`, and `ImportService`, then add a deep-link regression proving `?novel` intent is honored without restoring an unrelated last-active chapter.
**Tests:** `npx vitest run tests/store/bootstrap/bootstrapHelpers.test.ts tests/services/readerHydrationService.test.ts tests/services/importService.test.ts tests/store/appScreen.integration.test.tsx` ✅; `npx tsc --noEmit --pretty false` ⚠️ still fails only in pre-existing unrelated `scripts/sutta-studio/*` files.
### [2026-03-29 11:46 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Added the first end-to-end shelf layer: persisted `bookshelf-state`, debounced bookmark autosave, explicit shelf flush on “Library”, resume-point resolution, and a “Continue Reading” section in the library.
**Files modified (line numbers + why):**
- services/bookshelfStateService.ts (new) - define the `bookshelf-state` settings record, normalize persisted entries, upsert/list bookmarks, and resolve stale resume points by `lastChapterId` then `lastChapterNumber`.
- store/slices/uiSlice.ts:12,137-161 - flush the active novel’s bookmark immediately when shelving the reader before clearing `activeNovelId`.
- store/slices/chaptersSlice.ts:15,94-124,159-160,380-381,467-468,494-495 - add debounced bookmark autosave keyed by `activeNovelId` so chapter changes persist reading position without synchronous writes on every navigation.
- components/chapter/ChapterHeader.tsx:12,43,93-101,161-168 - add a reader-visible `Library` action on desktop and mobile.
- components/ChapterView.tsx:54,334 - wire the new header action to `shelveActiveNovel()`.
- components/InputBar.tsx:24-27,102-105 - treat pasted one-off chapter URLs as ephemeral by shelving any active library novel before fetching them.
- components/NovelCard.tsx:7-15,35-66 - support optional progress badge/label rendering for in-progress shelf cards.
- components/NovelLibrary.tsx:3-14,18-37,72-151,220-272 - load bookshelf entries on mount, resume cached novels from saved position with stale-bookmark fallback, and render a `Continue Reading` shelf section above the main catalog.
- tests/services/bookshelfStateService.test.ts (new) - verify bookshelf-state normalization, upsert behavior, and stale-resume fallback.
- tests/store/bookshelfPersistence.test.ts (new) - verify debounced autosave and immediate shelf flush both write the expected bookmark.
- tests/components/NovelLibrary.test.tsx:1-163 - mock bookshelf state and assert `Continue Reading` renders with resume metadata.
- tests/components/chapter/ChapterHeader.test.tsx:6-58 - cover the new library button.
**Tests:** `npx vitest run tests/services/bookshelfStateService.test.ts tests/components/NovelLibrary.test.tsx tests/components/chapter/ChapterHeader.test.tsx tests/store/bootstrap/bootstrapHelpers.test.ts tests/services/readerHydrationService.test.ts tests/services/importService.test.ts tests/store/appScreen.integration.test.tsx` ✅; `npx vitest run tests/store/bookshelfPersistence.test.ts tests/services/bookshelfStateService.test.ts tests/components/NovelLibrary.test.tsx tests/components/chapter/ChapterHeader.test.tsx tests/store/bootstrap/bootstrapHelpers.test.ts tests/services/readerHydrationService.test.ts tests/services/importService.test.ts tests/store/appScreen.integration.test.tsx` ✅; `npx tsc --noEmit --pretty false` ⚠️ still fails only in pre-existing unrelated `scripts/sutta-studio/*` files.
### [2026-03-29 13:57 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Refined the shelf UX to remember the last-read library version per novel and resume it directly from shelf cards, while keeping the current IDB model honest by bypassing cache only when the user explicitly switches to a different version.
**Files modified (line numbers + why):**
- store/slices/uiSlice.ts:17-21,55-61,118-121,136-181 - add `activeVersionId` to shell state, thread it through `openNovel`/`setReaderLoading`, and persist/clear it when shelving back to the library.
- store/slices/chaptersSlice.ts:109-127 - include `activeVersionId` in debounced bookshelf autosaves so saved bookmarks know which library version was last read.
- store/bootstrap/clearSession.ts:5-10 - reset `activeVersionId` alongside `activeNovelId` on full session clears.
- components/NovelCard.tsx:5-26 - add an optional `onSelect` override so Continue Reading cards can resume directly while the main grid still opens the detail sheet.
- components/NovelLibrary.tsx:35-70,100-139,153-204,255-330 - persist version-aware resume entries, skip stale cache when the user chooses a different version than the saved one, and turn Continue Reading cards into one-tap resume actions with version labels.
- tests/components/NovelLibrary.test.tsx:1-258 - replace the shelf test harness with a real mocked store/service boundary, then cover version labels and direct shelf resume into the saved version.
- tests/services/bookshelfStateService.test.ts:30-71 - verify `versionId` survives bookshelf normalization/upsert.
- tests/store/bookshelfPersistence.test.ts:17-66 - verify immediate shelf flush and debounced autosave both persist the active version identifier.
**Tests:** `npx vitest run tests/components/NovelLibrary.test.tsx tests/services/bookshelfStateService.test.ts tests/store/bookshelfPersistence.test.ts tests/components/chapter/ChapterHeader.test.tsx` ✅; `npx vitest run tests/store/appScreen.integration.test.tsx tests/store/bootstrap/bootstrapHelpers.test.ts tests/store/chaptersSlice.test.ts tests/current-system/navigation.test.ts tests/current-system/translation.test.ts tests/services/navigationService.test.ts tests/services/importService.test.ts` ✅; `npx tsc --noEmit --pretty false` ⚠️ still fails only in pre-existing unrelated `scripts/sutta-studio/*` files.
### [2026-03-29 14:10 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Patched the two confirmed bug families before manual QA: preload now stays novel-scoped, and every reader-switching InputBar import/fetch variant shelves the active library novel before proceeding.
**Files modified (line numbers + why):**
- store/slices/chaptersSlice.ts:730-766 - thread `activeNovelId` into the preload worker and pass it to `ChapterOps.findByNumber(...)` so preloading cannot cross into another cached novel.
- components/InputBar.tsx:26-40,47-55,96-107,120-125 - add a shared `shelveActiveLibraryNovel()` guard and call it for session JSON URL imports, regular chapter fetches, example-site clicks, and local file imports.
- tests/store/chaptersSlice.test.ts:7-20,196-230 - add a fake-timer preload regression proving the worker calls `findByNumber(…, activeNovelId)`.
- tests/components/InputBar.test.tsx (new) - add guardrail regressions proving session JSON URL imports, local file imports, and example-link fetches all shelve first when a library novel is active.
**Tests:** `npx vitest run tests/components/InputBar.test.tsx tests/store/chaptersSlice.test.ts` ✅; `npx vitest run tests/components/InputBar.test.tsx tests/store/chaptersSlice.test.ts tests/store/appScreen.integration.test.tsx tests/store/bootstrap/bootstrapHelpers.test.ts tests/current-system/navigation.test.ts tests/current-system/translation.test.ts tests/services/navigationService.test.ts tests/services/importService.test.ts tests/store/bookshelfPersistence.test.ts tests/components/NovelLibrary.test.tsx` ✅; `npx tsc --noEmit --pretty false` ⚠️ still fails only in pre-existing unrelated `scripts/sutta-studio/*` files.
### [2026-03-29 14:28 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Investigated broken library/detail-sheet cover images and fixed the actual transport issue instead of masking it. Root cause: some remote hosts, including Imgur, reject direct image requests when the browser sends the local app URL as the `Referer`. Verified with `curl`: the same image returned `200 image/jpeg` with no referer, `403` with `Referer: http://127.0.0.1:4173/`, and `200 image/jpeg` with `Referer: https://imgur.com/`.
**Files modified (line numbers + why):**
- components/NovelCoverImage.tsx:1-46 (new) - centralize cover rendering so remote images are requested with `referrerPolicy="no-referrer"`, reset error state when the source changes, and render a consistent placeholder on load failure.
- components/NovelCard.tsx:4,28-37 - replace the inline cover `<img>` with the shared `NovelCoverImage` component so the library grid uses the same transport-safe behavior.
- components/NovelDetailSheet.tsx:6,175-185 - replace the inline cover `<img>` with the shared `NovelCoverImage` component so the detail sheet does not regress independently.
- tests/components/NovelCoverImage.test.tsx:1-69 (new) - verify the `no-referrer` policy, the fallback placeholder on error, and resetting error state when a new image URL arrives.
**Tests:** `npx vitest run tests/components/NovelCoverImage.test.tsx tests/components/NovelLibrary.test.tsx tests/components/VersionPicker.test.tsx` ✅; `npx vitest run tests/components/NovelCoverImage.test.tsx tests/components/NovelLibrary.test.tsx tests/components/InputBar.test.tsx tests/store/appScreen.integration.test.tsx` ✅; `npx tsc --noEmit --pretty false` ⚠️ still fails only in pre-existing unrelated `scripts/sutta-studio/*` files.
### [2026-03-29 21:24 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Added a narrow NovelHi chapter adapter so the importer can ingest specific missing fan-translation chapters by URL without broadening into a generic crawler. Verified the real FMC hole URLs (`766`, `1911`, `2187`, `2348`) all return structured chapter bodies with usable paragraph counts, which is enough to support principled hole recovery after raw/PDF cross-checking.
**Files modified (line numbers + why):**
- scripts/lib/adapters/novelhi-adapter.ts:1-136 (new) - add a URL-based `NovelHiAdapter`, parse real chapter HTML with `jsdom`, strip ad/script noise from `#showReading`, preserve paragraph boundaries, and return importer-compatible `TranslationSourceOutput`.
- scripts/lib/translation-sources.ts:12-35 - register/export the new adapter so manifests can point directly at `https://novelhi.com/s/.../<chapter>` URLs.
- tests/scripts/novelhi-adapter.test.ts:1-66 (new) - cover HTML parsing and adapter extraction with mocked fetch so the behavior stays stable without relying on live network during tests.
**Tests:** `npx vitest run tests/scripts/novelhi-adapter.test.ts tests/scripts/library-session-builder.test.ts` ✅; `npx tsx -e "import { NovelHiAdapter } from './scripts/lib/adapters/novelhi-adapter.ts'; const run = async () => { const adapter = new NovelHiAdapter(); const urls = ['https://novelhi.com/s/Forty-Millenniums-of-Cultivation/766','https://novelhi.com/s/Forty-Millenniums-of-Cultivation/1911','https://novelhi.com/s/Forty-Millenniums-of-Cultivation/2187','https://novelhi.com/s/Forty-Millenniums-of-Cultivation/2348']; for (const url of urls) { const result = await adapter.extract(url); console.log(JSON.stringify({ url, title: result.chapters[0]?.title, paragraphs: result.chapters[0]?.paragraphs.length, first: result.chapters[0]?.paragraphs[0]?.text.slice(0, 120) }, null, 2)); } }; run().catch((error) => { console.error(error); process.exit(1); });"` ✅
### [2026-03-29 21:44 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Broadened the NovelHi adapter into a range-capable batch source without turning it into a full crawler. The importer can now fetch local candidate windows like `novelhi://Forty-Millenniums-of-Cultivation?from=765&to=767`, which is exactly what the FMC hole resolver needs for widened local search around drift points.
**Files modified (line numbers + why):**
- scripts/lib/adapters/novelhi-adapter.ts:10-25,32-76,159-223 - add explicit range-spec parsing, reuse a single chapter-fetch path for both single and batched inputs, and return multi-chapter outputs for local candidate windows.
- tests/scripts/novelhi-adapter.test.ts:33-112 - add parser coverage for the custom range input and a mocked multi-fetch regression proving the adapter returns a batch of chapters from a `novelhi://...?...` spec.
**Tests:** `npx vitest run tests/scripts/novelhi-adapter.test.ts tests/scripts/library-session-builder.test.ts` ✅; `npx tsx -e "import { NovelHiAdapter } from './scripts/lib/adapters/novelhi-adapter.ts'; const run = async () => { const adapter = new NovelHiAdapter(); const out = await adapter.extract('novelhi://Forty-Millenniums-of-Cultivation?from=765&to=767'); console.log(JSON.stringify({ chapterCount: out.chapters.length, numbers: out.chapters.map((ch) => ch.chapterNumber), titles: out.chapters.map((ch) => ch.title) }, null, 2)); }; run().catch((error) => { console.error(error); process.exit(1); });"` ✅
### [2026-03-29 22:55 PDT] [Agent: Codex]
**Status:** In Progress
**Task:** Principled split for book-switching before merge: make version-aware shelf state truthful all the way down to persistence and live navigation.
**Worktree:** `/Users/aditya/Documents/Ongoing Local/LexiconForge.worktrees/codex-book-switching-shelf`
**Branch:** `codex/wip-book-switching-shelf-2026-03-29`
**Hypothesis:** The shelf/version UX is only partially real today because version scope is threaded through library import and hydration, but live chapter fetch/navigation plus some DB summary/mapping paths still operate at novel-only scope. If true, switching versions can still cross-contaminate cached chapters or resume behavior whenever the app fetches new chapters beyond the already-imported set.
**Files under investigation (line numbers + why):**
- services/libraryScope.ts:1-40 - define the canonical scoped identity helpers for version-aware bookshelf keys, stable IDs, and synthetic storage URLs.
- services/stableIdService.ts:190-260 - ensure imported library chapters carry `libraryVersionId` and receive scoped stable IDs.
- services/importService.ts:150-240,520-610 - keep library imports and streaming imports version-aware at the session payload and per-chapter persistence layers.
- services/db/core/schema.ts:25-40,360-392 - add compound chapter/url-mapping indexes for `(novelId, libraryVersionId, chapterNumber)` lookups.
- services/db/operations/imports.ts:60-120,140-240,285-460 - normalize imported full/stable sessions into scoped storage URLs and scoped URL mappings.
- services/db/operations/chapters.ts:12-95,108-165,257-298,399-505 - persist `libraryVersionId` on chapter records, recompute summaries, and make chapter-number lookups version-aware.
- services/db/operations/rendering.ts:31-121,252-296 - hydrate only the requested library version and keep rendered `sourceUrls` honest when chapter URLs are synthetic storage keys.
- services/bookshelfStateService.ts:1-94 - make persisted resume entries version-aware and retain compatibility with older novel-only keys.
- services/readerHydrationService.ts:12-95,139-193 - hydrate only the requested novel/version slice into the reader store.
- services/navigation/fetcher.ts:1-210; services/navigation/index.ts:20-40,380-382 - propagate `{ novelId, versionId }` through live chapter fetches so on-demand navigation stores fetched chapters in the correct scoped namespace.
- store/slices/chaptersSlice.ts:96-124,318-477,730-813 - persist bookshelf positions with version IDs and pass version scope into preload/fetch flows.
- components/NovelLibrary.tsx:40-230 - continue reading and version-picker flows should use the same version-aware import/hydration contract as the lower layers.
- tests/services/bookshelfStateService.test.ts, tests/services/readerHydrationService.test.ts, tests/components/NovelLibrary.test.tsx, tests/store/bookshelfPersistence.test.ts, tests/services/navigationService.test.ts, tests/store/chaptersSlice.test.ts, tests/store/appScreen.integration.test.tsx - cover version-aware resume/fetch behavior and catch remaining novel-only assumptions.
**Diagnostics so far:** `npx vitest run tests/store/appScreen.integration.test.tsx --reporter=verbose` ✅ standalone; earlier mixed-suite timeout appears to be test interaction, not a confirmed shell regression. No version-aware fetch coverage has been run yet after the current storage changes.
### [2026-03-29 23:07 PDT] [Agent: Codex]
**Status:** In Progress
**Progress:** Completed the first principled version-awareness slice. Runtime scope is now threaded through library resume keys, reader hydration, live chapter fetches, scoped cache lookup, and preload. The key corrective change was refusing to fall back to global URL mappings when a library-scoped lookup misses; scoped reads now either resolve inside the requested `(novelId, versionId)` namespace or honestly fetch.
**Files modified (line numbers + why):**
- services/bookshelfStateService.ts:13-36,42-74 - preserve the persisted composite key while keeping `entry.novelId` truthful, so `orv::alice-v1` no longer normalizes into a fake novel id.
- services/navigation/types.ts:17-27 - add explicit optional library fetch scope to the navigation contract.
- services/navigation/fetcher.ts:9,67-79 - thread scope into fetch-time cache lookup and stable-id transformation.
- services/navigation/hydration.ts:11,66-89,217-246 - hydrate versioned chapters with real `sourceUrls` instead of synthetic storage URLs and make cache lookup scoped when a library novel/version is active.
- services/navigation/index.ts:13,40-81,205-243,274-303,404-405 - add scoped IDB lookup before global fallbacks and forbid cross-version global mapping reuse during scoped navigation.
- services/db/operations/chapters.ts:12-15,72-131,206-262,471-478 - persist summary `libraryVersionId`, add scoped source-url lookup, and expose it through `ChapterOps`.
- services/db/operations/rendering.ts:31-57,99-118 - retain `novelId`/`libraryVersionId` in hydrated rendering packets so versioned reader hydration remains lossless.
- store/slices/chaptersSlice.ts:320-329,447-450,803-806 - pass active `(novelId, versionId)` into navigation and preload fetches.
- tests/services/bookshelfStateService.test.ts:24-50 - lock in composite-key normalization without corrupting `novelId`.
- tests/store/nullSafety.test.ts:19-34,90-106 - assert `chaptersSlice.handleFetch()` forwards the active version scope.
- tests/store/chaptersSlice.test.ts:194-231 - assert preload chapter-number lookup is version-aware.
- tests/current-system/navigation.test.ts:7-15,61-76 - align runtime expectations with scoped `handleFetch` calls.
- tests/services/readerHydrationService.test.ts:15-79 - assert hydrated chapters preserve `libraryVersionId`.
- tests/db/migrations/fresh-install.test.ts:357-360; tests/store/bootstrap/bootstrapHelpers.test.ts:420-529; tests/current-system/export-import.test.ts:27-54; tests/current-system/feedback.test.ts:12-37; tests/current-system/settings.test.ts:21-46; tests/current-system/translation.test.ts:21-32; tests/services/navigationService.test.ts:109-121 - update assertions/fixtures to match the now-explicit version-aware contract and `EnhancedChapter` shape.
- scripts/lib/adapters/novelhi-adapter.ts:131-136 - tighten DOM typing so the branch returns to the pre-existing TypeScript baseline after `EnhancedChapter`/navigation changes.
**Tests:** `npx vitest run tests/services/bookshelfStateService.test.ts tests/services/readerHydrationService.test.ts tests/store/bookshelfPersistence.test.ts tests/store/nullSafety.test.ts tests/store/chaptersSlice.test.ts tests/current-system/navigation.test.ts tests/services/navigationService.test.ts tests/components/NovelLibrary.test.tsx tests/store/bootstrap/bootstrapHelpers.test.ts tests/store/appScreen.integration.test.tsx tests/db/migrations/fresh-install.test.ts` ✅; `npx vitest run tests/current-system/export-import.test.ts tests/current-system/feedback.test.ts tests/current-system/settings.test.ts tests/current-system/translation.test.ts tests/services/importService.test.ts` ✅; `npx tsc --noEmit --pretty false` ⚠️ only pre-existing `scripts/sutta-studio/*` errors remain.
