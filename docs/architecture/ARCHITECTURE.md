# LexiconForge Architecture (January 2026)

## 1. System Overview

```
┌──────────────┐   ┌───────────────┐   ┌───────────────┐
│ UI (React)   │ → │ Zustand Store │ → │ Services Layer │
└──────────────┘   └───────────────┘   └───────────────┘
        ↑                    ↓                    ↓
        │            workers/epub|translate       │
        └────────────► background tasks ◄─────────┘
                                      │
                           providers / adapters
                                      │
                              IndexedDB (modular ops)
```

- **UI layer** lives under `components/` with feature-specific subdirectories (`components/settings/`, `components/chapter/`, `components/icons/`).
- **Store layer** is a composed Zustand store (`store/index.ts`) with feature slices (`store/slices/*`) that import services directly.
- **Services layer** under `services/` contains audio, translation, EPUB, and database modules.
- **Workers** (`workers/translate.worker.ts`, `workers/epub.worker.ts`) offload heavy tasks.
- **Persistence** uses the modular operations stack (`services/db/operations/*`). The legacy monolithic `services/indexeddb.ts` was fully removed.


## 2. Data & Control Flow

1. **User action** (e.g., translate chapter) → UI components dispatch to Zustand slices.
2. **Store slice** orchestrates:
   - `translationsSlice` imports `TranslationService`, `ExplanationService`, `TranslationPersistenceService`.
   - `chaptersSlice` composes `NavigationService`, `stableIdService`, chapter operations.
   - `imageSlice` coordinates `ImageGenerationService`, `ImageCacheService`, and persistence.
3. **Services** fan out to provider adapters, workers, telemetry, and persistence.
4. **Persistence**:
   - All persistence now uses the modular ops layer: `ChapterOps`, `TranslationOps`, `FeedbackOps`, `ImageCacheOps`, `SummaryOps`, `NovelMetadataOps`.
   - Connection managed via `services/db/core/connection.ts`.
5. **Workers** call back into services (e.g., `workers/epub.worker.ts` delegates to `services/epub/exportService.ts`).


## 3. Persistence Stack

| Layer | Location | Notes |
|-------|----------|-------|
| Operations | `services/db/operations/*.ts` | ChapterOps, TranslationOps, FeedbackOps, ImageCacheOps, SummaryOps, NovelMetadataOps (~3,073 LOC total) |
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
| `imageSlice.ts` | 1,081 | ImageGenerationService, ImageCacheService | Generation jobs, image caching |
| `exportSlice.ts` | 525 | Export utilities, imageUtils | EPUB/session export with progress tracking |

### Services & Adapters

- **AI/Translation**: `services/translationService.ts` orchestrates requests; provider adapters in `adapters/providers/*.ts` talk to OpenAI/Gemini/Claude/DeepSeek.
- **EPUB**: `services/epub/exportService.ts` and worker handle DOM cloning, sanitization, packaging.
- **Audio**: `services/audio/*.ts` manage generation providers and OPFS storage.
- **Images**: `services/imageService.ts` with `ImageCacheService` for blob storage.
- **Sutta Studio Pipeline**: See Section 4.5 below.


## 4.5 Sutta Studio Pipeline Services

The Sutta Studio compiler is the largest service subsystem (~4,200 LOC across 12 files).
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

The compiler was decomposed from a 2,280 LOC monolith into `services/compiler/` (8 modules).
A backward-compatible shim at `services/suttaStudioCompiler.ts` re-exports from the new location.

| File | LOC | Responsibility |
|------|-----|----------------|
| `services/compiler/index.ts` | 618 | Pipeline orchestration and packet assembly |
| `services/compiler/schemas.ts` | 401 | JSON schemas for all passes |
| `services/compiler/prompts.ts` | 347 | Prompt builders for each pass |
| `services/compiler/utils.ts` | 218 | Shared compiler utilities |
| `services/compiler/dictionary.ts` | 137 | Dictionary lookup helpers |
| `services/compiler/skeleton.ts` | 124 | Skeleton pass logic |
| `services/compiler/llm.ts` | 123 | LLM call wrapper with structured outputs |
| `services/compiler/segments.ts` | 51 | Segment processing utilities |
| `services/suttaStudioPassPrompts.ts` | 725 | Prompt contracts for all 5 passes |
| `services/suttaStudioPassRunners.ts` | 586 | Per-pass execution and retry logic |
| `services/suttaStudioPipelineCache.ts` | 472 | L2 morphology cache + L5 segment cache |
| `services/suttaStudioRehydrator.ts` | 437 | Reconstructs packets from DB for UI rendering |

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
| `ChapterView.tsx` | 414 | `components/chapter/` | Core reader; helpers extracted |

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
| `services/exportService.ts` | ~1,054 | Split candidate | EPUB export and session export are unrelated concerns |
| `components/bench/SuttaStudioBenchmarkView.tsx` | 1,272 | Split candidate | Fixture loading + runner orchestration + metrics display |
| `services/suttaStudioPassPrompts.ts` | 725 | Watchlist | Prompt builders + schemas + parsing in one file; no tests |
| `services/suttaStudioPassRunners.ts` | 586 | Watchlist | All per-pass runners in one file; no tests |
| `components/sutta-studio/SuttaStudioApp.tsx` | ~498 | Watchlist | Store wiring, navigation, compilation, and render gating |
| `adapters/providers/OpenAIAdapter.ts` | 717 | Monitor | Largest single adapter; manageable but growing |
| `store/slices/imageSlice.ts` | 1,081 | Keep | Single domain, all parts change together |
| `store/slices/translationsSlice.ts` | 1,059 | Keep | Single domain, complex but cohesive |
| `store/slices/chaptersSlice.ts` | 825 | Keep | Single domain |
| `store/slices/exportSlice.ts` | 605 | Keep | Single domain |

### Completed Decompositions (formerly on this list)

| File | Was | Now |
|------|-----|-----|
| `services/suttaStudioCompiler.ts` | 2,280 LOC monolith | 3-line shim → `services/compiler/` (8 modules, ~2,019 LOC) |
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

*Last updated: March 2026*
*Previous major update: January 2026*
