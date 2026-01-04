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

| File | LOC | Status |
|------|-----|--------|
| `store/slices/imageSlice.ts` | 1,081 | Mixes API orchestration, cache state, job queue |
| `store/slices/translationsSlice.ts` | 1,059 | Complex translation pipeline |
| `store/slices/chaptersSlice.ts` | 825 | Navigation + state management |
| `store/slices/exportSlice.ts` | 525 | Export orchestration |

These slices exceed the 300 LOC guideline but contain related functionality. Further decomposition may be considered if complexity increases.


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
