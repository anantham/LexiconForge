# LexiconForge Project Structure (January 2026)

## Root Files
- `App.tsx` - Main React application component
- `index.tsx` - Entry point
- `types.ts` - Shared TypeScript type definitions
- `vite.config.ts` - Vite configuration
- `vitest.config.ts` - Vitest test configuration
- `playwright.config.ts` - Playwright E2E config
- `tsconfig.json` - TypeScript configuration

## Key Directories

### `config/`
Configuration and constants:
- `app.json` - Default models, AI parameters, image settings
- `costs.ts` - Model pricing for cost estimation
- `constants.ts` - Available models, websites, abbreviations
- `prompts.json` - AI system prompts and translation instructions

### `components/`
React UI components (decomposed architecture):
- `ChapterView.tsx` (414 LOC) - Main reader/translation view
- `SettingsModal.tsx` (205 LOC) - Settings UI shell
- `InputBar.tsx` - URL input with website suggestions
- `NovelLibrary.tsx` - Library view
- `SessionInfo.tsx` - Session info with export progress
- `settings/` - Settings panel components (ProvidersPanel, AudioPanel, GalleryPanel, etc.)
- `chapter/` - Chapter-related components
- `icons/` - SVG icon components

### `services/`
Business logic and integrations:
- `translationService.ts` - Translation orchestration
- `imageService.ts` - Image generation
- `adapters.ts` - Website content extractors
- `db/` - Modular IndexedDB operations layer
  - `core/` - connection.ts, schema.ts, txn.ts, errors.ts
  - `operations/` - ChapterOps, TranslationOps, FeedbackOps, ImageCacheOps, SummaryOps, NovelMetadataOps (~3,073 LOC total)
- `epub/` - EPUB export (Templates.ts, XhtmlSerializer.ts, exportService.ts)
- `audio/` - Audio generation services
- `translate/` - Translation utilities

Note: The legacy monolithic `services/indexeddb.ts` (3,938 LOC) was fully decomposed and deleted.

### `store/`
Zustand state management (composed slices):
- `index.ts` (69 LOC) - Main store setup
- `slices/` - Feature-specific state slices
  - `settingsSlice.ts` - App settings & prompt templates
  - `translationsSlice.ts` (1,059 LOC) - Translation state & history
  - `chaptersSlice.ts` (825 LOC) - Chapter data & navigation
  - `imageSlice.ts` (1,081 LOC) - Image generation & caching
  - `exportSlice.ts` (525 LOC) - Export with progress tracking

### `adapters/`
Translation provider adapters:
- `providers/` - Provider implementations (OpenAI, Gemini, Claude, DeepSeek, OpenRouter)

### `docs/`
Documentation:
- `adr/` - Architecture Decision Records
- `archive/` - Archived historical docs
- `WORKLOG.md` - Development log
- Various feature documentation (Settings.md, Providers.md, etc.)

### `tests/`
Test files:
- Unit tests (Vitest) - 646 tests
- E2E tests in `tests/e2e/` (Playwright)

### `hooks/`
Custom React hooks (useBlobUrl, useNovelMetadata, etc.)

### `utils/`
Helper functions and utilities

### `workers/`
Web workers for background tasks:
- `translate.worker.ts` - Batch translation
- `epub.worker.ts` - EPUB generation
