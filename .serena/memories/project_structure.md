# LexiconForge Project Structure

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
React UI components:
- `ChapterView.tsx` - Main reader/translation view
- `InputBar.tsx` - URL input with website suggestions
- `SettingsModal.tsx` - Settings UI
- `NovelLibrary.tsx` - Library view
- `FeedbackPopover.tsx` - Selection feedback controls
- `icons/` - SVG icon components
- `settings/` - Settings panel components
- `chapter/` - Chapter-related components

### `services/`
Business logic and integrations:
- `aiService.ts` - Translation API calls
- `imageService.ts` - Image generation
- `adapters.ts` - Website content extractors
- `db/` - IndexedDB operations
- `epub/` - EPUB export functionality
- `audio/` - Audio generation services
- `translate/` - Translation utilities

### `store/`
Zustand state management:
- `index.ts` - Main store setup
- `slices/` - Feature-specific state slices
  - `settingsSlice.ts` - App settings & prompt templates
  - `translationsSlice.ts` - Translation state & history
  - `chaptersSlice.ts` - Chapter data & navigation

### `adapters/`
Translation provider adapters:
- `providers/` - Provider implementations (OpenAI, Gemini, Claude, etc.)

### `docs/`
Documentation:
- `adr/` - Architecture Decision Records
- `WORKLOG.md` - Development log
- `PROJECT_STRUCTURE.md` - Detailed structure docs
- Various feature documentation

### `tests/`
Test files:
- Unit tests (Vitest)
- E2E tests in `tests/e2e/` (Playwright)

### `archive/`
Deprecated code kept for reference

### `hooks/`
Custom React hooks

### `utils/`
Helper functions and utilities

### `public/`
Static assets

### `styles/`
CSS and styling files
