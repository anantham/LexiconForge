# LexiconForge Architecture (November 2025)

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
                           IndexedDB + dual write
```

- **UI layer** lives under `components/` (e.g., `components/SettingsModal.tsx`, `components/ChapterView.tsx`).
- **Store layer** is a composed Zustand store (`store/index.ts:24-30`) with slices that import services directly (translations, audio, export, etc.).
- **Services layer** is a grab bag under `services/` (audio, translation, EPUB, DB). Several services still exceed 700 lines and contain multiple responsibilities, but the old 3,900‑line `services/indexeddb.ts` was retired in favor of the modular ops layer.
- **Workers** (`workers/translate.worker.ts`, `workers/epub.worker.ts`) offload heavy tasks but still pull in large services via `importScripts`.
- **Persistence** now relies on the modular operations/repository stack (`services/db/operations/*`, `services/db/repositories/*`). The monolithic `services/indexeddb.ts` was removed on 2025‑11‑16; the `LF_DB_V2_DOMAINS` flag now primarily controls the memory fallback.


## 2. Data & Control Flow

1. **User action** (e.g., translate chapter) → UI components dispatch to Zustand slices.
2. **Store slice** orchestrates:
   - `translationsSlice` imports `TranslationService`, `ExplanationService`, `TranslationPersistenceService`, and `indexedDBService`.
   - `chaptersSlice` composes `NavigationService`, `indexedDBService`, and Stable ID helpers.
   - `imageSlice` coordinates `ImageGenerationService`, `ImageCacheService`, and persistence.
3. **Services** fan out to provider adapters, workers, telemetry, and persistence.
4. **Persistence**:
   - Legacy path: `indexedDBService` (monolithic) manages schemas, migrations, caching.
   - Modern path: Repository factory in `services/db/index.ts` routes to `ChapterOps`, `TranslationOps`, etc., when feature flag is enabled.
5. **Workers** call back into services (e.g., `workers/epub.worker.ts` delegates to `services/epub/exportService.ts`).


## 3. Persistence Stack Details

| Layer | Location | Notes |
|-------|----------|-------|
| Legacy IndexedDB service | *(historical) `services/indexeddb.ts`* | Former 3,938 LOC file handling schema, migrations, URL mappings, exports, feedback, image cache, telemetry hooks (deleted). |
| Modern operations | `services/db/operations/*.ts` | ChapterOps, TranslationOps, FeedbackOps, etc. talk directly to IndexedDB via typed transactions. |
| Repository factory | `services/db/index.ts:1-200` | Selects backend (`legacy`, `modern`, `memory`, `shadow`) via env + feature flags; exposes repo-like API used by `adapters/repo`. |
| Dual-write feature control | `services/db/utils/featureFlags.ts` | Reads `LF_DB_V2_DOMAINS` & `localStorage` to decide whether modern backend handles each domain. |
| Store consumers | `adapters/repo/*.ts`, `store/slices/*` | Repos mostly pass through to `indexedDBService` today; modern ops still guarded. |

### Current Pain Points
1. **Single entry point** (`indexedDBService`) imported by 20+ modules (translations, navigation, export, import, stable IDs, telemetry) resulting in tight coupling and large bundle impact.
2. **Mixed responsibilities**: schema/migration logic, caching, image asset management, export/import, telemetry instrumentation all share one class.
3. **Testing**: no isolated tests for persistence layer; new `tests/services/db/indexedDBService.interface.test.ts` provides only a high-level contract.


## 4. State & Service Dependencies

### Zustand Store

| Slice | Key Imports | Responsibilities |
|-------|-------------|------------------|
| `store/index.ts` | `SessionManagementService`, `indexedDBService`, audio worker registration | Bootstraps slices, rehydrates session from persistence. |
| `store/slices/translationsSlice.ts` | `TranslationService`, `ExplanationService`, `TranslationPersistenceService`, `indexedDBService` | Translation queueing, persistence, footnotes, explanation requests. |
| `store/slices/chaptersSlice.ts` | `NavigationService`, `stableIdService`, `indexedDBService`, `aiService` | Chapter navigation, canonical URL mapping, translation heatmap toggles. |
| `store/slices/imageSlice.ts` | `ImageGenerationService`, `ImageCacheService`, `TranslationPersistenceService` | Handles generation jobs, image caching, association with chapters. |
| `store/slices/exportSlice.ts` | `indexedDBService`, `telemetryService`, `imageUtils` | EPUB/export orchestration. |

Because slices import services directly, components often indirectly depend on IndexedDB and provider logic, complicating testing and code splitting.


### Services & Adapters

- **AI/Translation**: `services/translationService.ts` orchestrates translation requests, context building, and persistence; `services/aiService.ts` plus provider adapters (`adapters/providers/*.ts`) talk to OpenAI/Gemini/Claude.
- **EPUB**: `services/epubService.ts`, `services/epub/exportService.ts`, and worker counterpart handle DOM cloning, sanitization, packaging, and asset streaming.
- **Audio**: `services/audio/*.ts` manage generation providers and in-browser storage via OPFS/service workers.
- **Telemetry**: `services/telemetryService.ts` instrumented via store slices/components, capturing memory pressure and custom events.
- **Import/Export**: `services/importService.ts`, `services/importTransformationService.ts` rely on Stable ID helpers to normalize incoming chapters.


## 5. Feature Flags & Environment

| Flag/Env | Location | Purpose |
|----------|----------|---------|
| `DB_BACKEND`, `LF_DB_V2_DOMAINS` | `services/db/index.ts`, `services/db/utils/featureFlags.ts` | Selects backend (legacy vs modern vs shadow). |
| Provider API keys (`OPENAI_API_KEY`, etc.) | `services/env.ts`, `services/explanationService.ts`, `services/illustrationService.ts` | Determine provider availability and fallback order. |
| Debug toggles (`debugPipelineEnabled`, `dbDebugEnabled`) | `utils/debug.ts` | Control verbosity for services like `indexeddb.ts`. |


## 6. Known Hotspots

| File | LOC | Issue |
|------|-----|-------|
| `services/indexeddb.ts` | 3,938 | Monolith mixing schema, repos, exports, telemetry. |
| `components/SettingsModal.tsx` | 2,745 | One component handles provider, audio, export, diff, telemetry settings. |
| `components/ChapterView.tsx` | 1,969 | Rendering + tokenization + audio/diff overlays all intertwined. |
| `store/slices/imageSlice.ts` | 1,055 | Mixes API orchestration, cache state, job queue. |
| `store/index.ts` | 485 | Central store wiring plus side effects (audio worker setup, telemetry). |

These files are priority targets for decomposition (documented in `docs/COMPONENT-DECOMPOSITION-PLAN.md` and `docs/INDEXEDDB-DECOMPOSITION-PLAN.md`).


## 7. Next Architecture Steps

1. **Documented Decomposition** (this file + decomposition plans) → ensures shared understanding.
2. **Repository Extraction** from `services/indexeddb.ts` using new `IIndexedDBService` contract and mock harness.
3. **Store/Service boundary cleanup**: move service instantiation behind dependency injection container once repos are isolated.
4. **Component splitting** for SettingsModal/ChapterView to enable code splitting and targeted memoization.
5. **CI Guardrails**: integrate `npm run check:loc`, `tsc --noEmit`, and interface tests into pre-PR checks once refactors land.

This document should be updated whenever architecture decisions change (e.g., after ChapterRepository extraction or new worker flows).***
