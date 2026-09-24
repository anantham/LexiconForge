# LexiconForge Architecture

## 1. System Overview

```
┌──────────────┐   ┌───────────────┐   ┌───────────────┐
│ UI (React)   │ → │ Zustand Store │ → │ Services Layer │
└──────────────┘   └───────────────┘   └───────────────┘
        ↑                                        │
        └──────────── state updates ─────────────┤
                                                 ↓
                                      providers / adapters
                                                 │
                                                 ↓
                                     IndexedDB (modular ops)
```

- **UI layer** lives under `components/` with feature-specific subdirectories (`components/settings/`, `components/chapter/`, `components/icons/`).
- **Store layer** is a composed Zustand store (`store/index.ts`) with feature slices (`store/slices/*`) that import services directly.
- **Services layer** under `services/` contains audio, translation, EPUB, and database modules.
- **No worker tier**: heavy tasks run on the main thread — translation is orchestrated in the store slices via `services/ai/translatorRouter.ts` (abortable via `AbortController`), and EPUB export runs via a dynamic `import()` of `services/epubService` from `store/slices/exportSlice.ts`.
- **Persistence** uses the modular operations stack (`services/db/operations/*`). The legacy monolithic `services/indexeddb.ts` was fully removed.


## 2. Data & Control Flow

1. **User action** (e.g., translate chapter) → UI components dispatch to Zustand slices.
2. **Store slice** orchestrates:
   - `translationsSlice` imports `TranslationService`, `ExplanationService`, `TranslationPersistenceService`.
   - `chaptersSlice` composes `NavigationService`, `stableIdService`, chapter operations.
   - `imageSlice` coordinates `ImageGenerationService`, `ImageCacheService`, and persistence.
3. **Services** fan out to provider adapters, telemetry, and persistence.
4. **Persistence**:
   - All persistence now uses the modular ops layer: `ChapterOps`, `TranslationOps`, `FeedbackOps`, `ImageOps`, `SettingsOps`, `TemplatesOps`, `AmendmentOps`, `DiffOps`, `ImportOps`, `MaintenanceOps`, `MappingsOps`, `NavigationOps`, `SchemaOps`, `SessionExportOps`.
   - Connection managed via `services/db/core/connection.ts`.
5. **EPUB export** is triggered from `exportSlice` via a dynamic `import()` of `services/epubService` and runs on the main thread (no worker).


## 3. Persistence Stack

| Layer | Location | Notes |
|-------|----------|-------|
| Operations | `services/db/operations/*.ts` | ChapterOps, TranslationOps, FeedbackOps, ImageOps, SettingsOps, TemplatesOps, AmendmentOps, DiffOps, ImportOps, MaintenanceOps, MappingsOps, NavigationOps, SchemaOps, SessionExportOps (~3,086 LOC total) |
| Connection | `services/db/core/connection.ts` | Manages IndexedDB connection, schema, migrations |
| Types | `services/db/types.ts` | Shared database record types |

### Architecture Benefits
- **Modular**: Each domain (chapters, translations, images) has its own operations file
- **Testable**: Operations are pure functions that work with IndexedDB transactions
- **Type-safe**: Full TypeScript coverage with shared types


## 4. State & Service Dependencies

### Zustand Store

| Slice | LOC | Key Imports | Responsibilities |
|-------|-----|-------------|------------------|
| `store/index.ts` | 69 | Slice composers | Bootstraps and composes all slices |
| `translationsSlice.ts` | 1,059 | TranslationService, ExplanationService | Translation queueing, persistence, footnotes |
| `chaptersSlice.ts` | 825 | NavigationService, stableIdService | Chapter navigation, URL mapping |
| `imageSlice.ts` | 1,580 | ImageGenerationService, ImageCacheService, imageJobsSlice | Applying generation results, image caching, version state, durable-job recovery |
| `exportSlice.ts` | 605 | Export utilities, imageUtils | EPUB/session export with progress tracking |

### Services & Adapters

- **AI/Translation**: `services/translationService.ts` orchestrates requests; provider adapters in `adapters/providers/*.ts` talk to OpenAI/Gemini/Claude/DeepSeek.
- **EPUB**: `services/epubService.ts` (facade over `services/epubService/{data,generators,sanitizers,packagers,templates}`) handles DOM cloning, sanitization, and packaging; invoked via dynamic import from `store/slices/exportSlice.ts`.
- **Audio**: `services/audio/*.ts` manage generation providers and OPFS storage.
- **Images**: `services/imageService.ts` with `ImageCacheService` for blob storage.
- **Sutta Studio Pipeline**: See Section 4.5 below.


## 4.5 Sutta Studio Pipeline Services

The Sutta Studio compiler spans the production orchestrator and canonical pass modules.
It transforms raw SuttaCentral segments into `DeepLoomPacket` IR for the `/sutta/:uid` route
via a sequential 5-pass assembly line. Each pass is a specialist — no parallelization.

### Pipeline Flow

```
SuttaCentral segments
        ↓
  Skeleton (chunked, 50-seg windows) — phase segmentation only
        ↓
  Anatomist — Pali morphology, word segmentation, grammar relations
        ↓
  Lexicographer — English senses (3 content / 1-2 function words)
        ↓
  Weaver — English token mapping, ghost word identification
        ↓
  Typesetter — layout blocks (max 5 words per block)
        ↓
  Validator — schema enforcement between passes
        ↓
  DeepLoomPacket → stored in chapters.suttaStudio (IndexedDB)
```

### Key Files

The production orchestrator remains in `services/compiler/`; canonical prompts,
schemas, LLM calls and pass runners live under `services/sutta-studio/`.
PR #186 removed six forwarding modules after migrating their callers. The
orchestrator rewrite remains a separate decision (D2); shim removal did not finish it.
`services/suttaStudioCompiler.ts` still re-exports the production entry point.

| File | Responsibility |
|------|----------------|
| `services/compiler/index.ts` | Production pipeline orchestration and packet assembly |
| `services/compiler/dictionary.ts` | Dictionary lookup and proxy helpers |
| `services/compiler/skeleton.ts` | Production skeleton pass |
| `services/compiler/segments.ts` | Canonical source acquisition |
| `services/sutta-studio/schemas.ts` | Canonical JSON schemas for all passes |
| `services/sutta-studio/prompts/` | Canonical prompt builders |
| `services/sutta-studio/passes/` | Canonical pass execution and retry logic |
| `services/sutta-studio/llm.ts` | LLM transport and structured outputs |
| `services/sutta-studio/utils.ts` | Shared compiler utilities |
| `services/suttaStudioPipelineCache.ts` | L2 morphology and L5 segment caches |
| `services/suttaStudioRehydrator.ts` | Joins pass outputs into a phase view |

### Caching (SUTTA-006)

- **L2 Morphology Cache** — persisted cross-sutta, keyed by surface word form. Avoids re-segmenting known Pali words across compilations.
- **L5 Segment Cache** — in-memory per compilation run. Deduplicates identical refrain segments within a single sutta (~15% of MN10 segments are exact duplicates).

### ADRs
- `SUTTA-003`: MVP architecture, IR schema, 5-pass pipeline decision
- `SUTTA-004`: Benchmark development phases
- `SUTTA-005`: Benchmark leaderboard
- `SUTTA-006`: Pipeline caching architecture (L2/L5)

### IR Types
Canonical types live in `types/suttaStudio.ts`. See `docs/sutta-studio/IR.md` for design rationale (note: types file is authoritative if they conflict).


## 5. Component Architecture

### Decomposed Components

| Component | LOC | Subdirectory | Notes |
|-----------|-----|--------------|-------|
| `SettingsModal.tsx` | 205 | `components/settings/` | Shell component; panels extracted |
| `ChapterView.tsx` | 433 | `components/chapter/` | Core reader; helpers extracted |

### Settings Panels (`components/settings/`)
- `ProvidersPanel.tsx` - AI provider configuration
- `PromptPanel.tsx` - Translation prompt customization
- `AudioPanel.tsx` - Audio generation settings
- `DisplayPanel.tsx` - Reading display preferences
- `DiffPanel.tsx` - Diff heatmap settings
- `GalleryPanel.tsx` - Image gallery with cover selection
- `SessionExportPanel.tsx` - Session export configuration
- `MetadataPanel.tsx` - Novel metadata editing
- `TemplatePanel.tsx` - Prompt template management
- `AdvancedPanel.tsx` - Advanced settings
- `ImageGenerationSection.tsx` - Image generation config
- `ApiKeysSection.tsx` - API key management
- `CoverCropModal.tsx` - Cover image cropping

### Chapter Components (`components/chapter/`)
- `ChapterContent.tsx` - Rendered chapter content
- `ChapterHeader.tsx` - Navigation and controls
- `ReaderBody.tsx` - Main reader layout
- `ReaderView.tsx` - Reader view wrapper
- `DiffParagraphs.tsx` - Diff-highlighted paragraphs
- `FooterNavigation.tsx` - Bottom navigation bar
- `FootnotesPanel.tsx` - Footnotes display panel
- `TranslationStatusPanel.tsx` - Translation progress
- `TranslationEditor.tsx` - Inline translation editing
- `InlineEditToolbar.tsx` - Edit toolbar
- `SelectionOverlay.tsx` - Text selection overlay
- `ComparisonPortal.tsx` - Fan translation comparison
- `DiffMarkersPanel.tsx` - Diff markers display
- `translationTokens.tsx` - Token-level rendering


## 6. Feature Flags & Environment

| Flag/Env | Location | Purpose |
|----------|----------|---------|
| Provider API keys | `services/env.ts` | Determine provider availability |
| Debug toggles | `utils/debug.ts` | Control logging verbosity |
| `enableAudio` | Settings slice | Toggle audio features |
| `enableDiffHeatmap` | Settings slice | Toggle diff visualization |


## 7. Current Hotspots

Files flagged for engineering friction (see `~/.claude/CLAUDE.md` for split criteria):

| File | LOC | Verdict | Reason |
|------|-----|---------|--------|
| `services/db/operations/maintenance.ts` | 2,992 | Split candidate | Many repair generations (scoped-id, chapter-number drift V4–V6, canonical-key repair) plus duplicate repair own direct writes to summaries/mappings — the concrete CAP-013 pressure point; boot-repair battery in `initializeStore` depends on it |
| `scripts/sutta-studio/benchmark.ts` | 2,493 | Split candidate | Run orchestration, pipeline execution, artifact indexing, metrics, and progress lifecycle share one module; completion-boundary testing required a main-module guard |
| `components/bench/SuttaStudioBenchmarkView.tsx` | 1,620 | Split candidate | Fixture loading + runner orchestration + metrics display |
| `services/imageService.ts` | 1,245 | Split candidate | Generation planning, Google SDK and other provider transports, cache/version handling in one module |
| `services/exportService.ts` | 1,072 | Split candidate | Three portable serializers duplicate chapter/image assembly; metadata/stat export uses separate scope decisions. Graph review required correcting each builder. |
| `services/importService.ts` | 1,152 | Split candidate | URL retry, two JSON parsers, persistence/reconciliation, reader hydration, and portable artifact hydration share one lifecycle; adding semantic graph streaming crossed every responsibility |
| `adapters/providers/OpenAIAdapter.ts` | 886 | Split candidate | Translation/chat request construction, adaptive fallbacks, metrics, and response parsing share one adapter |
| `components/sutta-studio/SuttaStudioApp.tsx` | ~498 | Watchlist | Store wiring, navigation, compilation, and render gating |
| `services/db/repositories/TranslationRepository.ts` | 405 | Watchlist | Translation versioning, active-version mutation, stableId fallback, and direct IDB write paths share one module |
| `services/imagePlanPlanner.ts` | 451 | Watchlist | Planner schema/prompt logic and three provider transports share one module |
| `components/liturgy/shapes/TripleScriptWitness.tsx` | 1,363 | Split candidate | Script tokenization, word tooltips, settings, witness controls, accent state, and alignment interaction remain coupled; semantic alignment geometry was extracted to `alignmentGeometry.ts`, but the component still has several independent reasons to change |
| `data/liturgy/morning-chants.ts` | 982 | Watchlist | Chant source data, shared vocabulary registries, semantic analyses, witness alignments, and commentary live together; the 2026-08-25 word-by-word curation required editing several distant regions in one file |

> Hotspot counts are the 2026-08-22 snapshot. Retired shim rows were removed on 2026-09-25.
| `services/imageGenerationService.ts` | 631 | Split candidate | Initial generation and retry duplicate provenance, persistence, versioning, and metrics assembly; fallback review found behavior drift between the two paths |
| `components/settings/ProvidersPanel.tsx` | 565 | Watchlist | Provider catalogue effects, credit state, capability checks, pricing assembly, and selection lifecycle remain coupled; PR #138 review found stale endpoint-owned workflow state |
| `components/NovelLibrary.tsx` | 727 | Split candidate | Registry display, bookshelf persistence, cache hydration, stream acquisition, glossary loading, source search, reader routing, and progress UI share one component; PR #166 review exposed failure-state coupling between acquisition and reader ownership |
| `components/Illustration.tsx` | 822 | Split candidate | Marker lookup, durable-job status, ETA lifecycle, prompt/plan editing, advanced controls, image rendering, generation actions, and version controls share one component; interrupted-state review exposed status/render drift |
| `store/slices/imageSlice.ts` | 1,580 | Split candidate | Job lifecycle is now separate, but result application, persistence, cache migration, controls, versioning, and recovery orchestration still give this file multiple reasons to change |
| `store/slices/translationsSlice.ts` | 1,059 | Keep | Single domain, complex but cohesive |
| `store/slices/chaptersSlice.ts` | 1,120 | Split candidate | Reader hydration, navigation, import, preload/budget policy and chapter mutation each write maps; graph invalidation must track multiple mutation paths. |
| `store/slices/exportSlice.ts` | 605 | Keep | Single domain |

### Completed Decompositions (formerly on this list)

| File | Was | Now |
|------|-----|-----|
| `services/suttaStudioCompiler.ts` | 2,280 LOC monolith | 3-line entry shim → `services/compiler/` (4 production modules), sharing canonical `services/sutta-studio/` modules |
| `services/adapters.ts` | 914 LOC, 4 adapters | Removed → `adapters/providers/` (6 files, ~1,306 LOC) |
| `services/navigationService.ts` | 1,109 LOC | 3-line shim → `services/navigation/` (8 modules, ~1,112 LOC) |
| `components/sutta-studio/demoPacket.ts` | 4,390 LOC data | 3-line shim → `demoPacket.json` (12,325 lines) |


## 8. Testing Strategy

- **Unit tests**: Vitest with React Testing Library (`*.test.tsx`)
- **E2E tests**: Playwright (`tests/e2e/`)
- **LOC checks**: `npm run check:loc` flags files exceeding guardrail thresholds (warning-only; see `docs/CONVENTIONS.md` §4 for authoritative policy)

## 9. Documentation

- `docs/adr/` - Architecture Decision Records
- `docs/plans/` - Implementation plans (archive completed ones)
- `docs/WORKLOG.md` - Development log
- `AGENTS.md` - Multi-agent coordination rules

---

*Sutta module ownership refreshed 2026-09-25 after PR #186; unrelated counts remain dated snapshots.*
*Previous major update: January 2026*
