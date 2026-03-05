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

The Sutta Studio compiler is the largest service subsystem (~5,000 LOC across 8 files).
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

| File | LOC | Responsibility |
|------|-----|----------------|
| `services/suttaStudioCompiler.ts` | 2,280 | Pipeline orchestration, JSON schemas, packet assembly |
| `services/suttaStudioPassPrompts.ts` | 723 | Prompt contracts for all 5 passes |
| `services/suttaStudioPassRunners.ts` | 586 | Per-pass execution and retry logic |
| `services/suttaStudioPipelineCache.ts` | 472 | L2 morphology cache + L5 segment cache |
| `services/suttaStudioRehydrator.ts` | 437 | Reconstructs packets from DB for UI rendering |
| `services/suttaStudioValidator.ts` | — | Schema validation between passes |
| `services/suttaStudioLLM.ts` | — | LLM call wrapper with structured outputs |
| `services/suttaStudioTokenizer.ts` | — | English tokenization standard |

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
- `ExportPanel.tsx` - Export configuration
- `MetadataPanel.tsx` - Novel metadata editing
- `TemplatesPanel.tsx` - Prompt template management

### Chapter Components (`components/chapter/`)
- `ChapterContent.tsx` - Rendered chapter content
- `ChapterHeader.tsx` - Navigation and controls
- `ParagraphRenderer.tsx` - Individual paragraph display
- `IllustrationPlaceholder.tsx` - Image placement markers


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
| `services/suttaStudioCompiler.ts` | 2,280 | Split candidate | Orchestration + schemas + prompt-builders + assembly — multiple change cadences |
| `services/adapters.ts` | 914 | Split candidate | 4 provider adapters that change independently |
| `services/exportService.ts` | 1,054 | Split candidate | EPUB export and session export are unrelated concerns |
| `components/sutta-studio/demoPacket.ts` | 4,390 | Migrate to JSON | It's data, not logic — should be a `.json` file |
| `store/slices/imageSlice.ts` | 1,081 | Keep | Single domain, all parts change together |
| `store/slices/translationsSlice.ts` | 1,059 | Keep | Single domain, complex but cohesive |
| `store/slices/chaptersSlice.ts` | 825 | Keep | Single domain |
| `services/navigationService.ts` | 1,109 | Investigate | Decomposition plan exists (`docs/plans/NAVIGATION-SERVICE-DECOMPOSITION.md`) but not yet executed |


## 8. Testing Strategy

- **Unit tests**: Vitest with React Testing Library (`*.test.tsx`)
- **E2E tests**: Playwright (`tests/e2e/`)
- **LOC checks**: `npm run check:loc` enforces file size limits

## 9. Documentation

- `docs/adr/` - Architecture Decision Records
- `docs/plans/` - Implementation plans (archive completed ones)
- `docs/WORKLOG.md` - Development log
- `AGENTS.md` - Multi-agent coordination rules

---

*Last updated: January 2026*
*Previous major update: November 2025 (pre-decomposition)*
