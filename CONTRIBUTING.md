# Contributing

Thanks for improving LexiconForge! This guide keeps changes safe and easy to review.

## Setup

- Node 18+ recommended
- `npm install`
- `npm run dev` (Vite)

## Project Structure

Understanding where things live helps you contribute effectively. Here's the organized structure:

```
LexiconForge/
├── config/                    # 📋 Configuration files (edit here to change defaults!)
│   ├── app.json              # Main app config: default models, AI parameters, image settings
│   ├── costs.ts              # Model pricing data for cost estimation
│   ├── constants.ts          # Available models, websites, abbreviations
│   └── prompts.json          # AI system prompts and translation instructions
│
├── components/               # 🎨 React UI components
│   ├── icons/               # SVG icon components (add custom toolbar emojis here!)
│   │   ├── SettingsIcon.tsx
│   │   ├── TrashIcon.tsx
│   │   └── ...              # Add your custom emoji icons here
│   ├── ChapterDisplay.tsx   # Main translation display
│   ├── InputBar.tsx         # URL input with website suggestions
│   ├── SettingsModal.tsx    # Settings UI (model selection, API keys)
│   ├── Toolbar.tsx          # Feedback toolbar with emoji buttons
│   └── ...
│
├── services/                # 🔧 Business logic and external integrations
│   ├── aiService.ts         # Translation API calls (Gemini, OpenAI, DeepSeek, Claude)
│   ├── imageService.ts      # Image generation (Imagen, Flux)
│   ├── audio/              # Audio generation services
│   ├── db/                 # Database operations (IndexedDB)
│   ├── epub/               # EPUB export functionality
│   ├── adapters.ts         # Website content extractors
│   └── ...
│
├── store/                   # 📦 Zustand state management
│   ├── index.ts            # Main store setup
│   └── slices/             # Feature-specific state slices
│       ├── settingsSlice.ts      # App settings & prompt templates
│       ├── translationsSlice.ts  # Translation state & history
│       ├── chaptersSlice.ts      # Chapter data & navigation
│       └── ...
│
├── adapters/               # 🔌 Data layer adapters
│   ├── providers/         # Translation provider adapters
│   └── repo/              # Repository pattern for database access
│
├── types.ts               # 📝 TypeScript type definitions
├── utils/                 # 🛠️ Helper functions
├── hooks/                 # ⚛️ Custom React hooks
├── tests/                 # 🧪 Test files
├── docs/                  # 📚 Documentation
│   ├── adr/              # Architecture Decision Records
│   ├── WORKLOG.md        # Development log
│   └── ...
└── archive/              # 🗄️ Deprecated code (kept for reference)
```

### Quick Navigation Guide

**Want to add custom emojis to the toolbar?**
1. Add your SVG icon component to `components/icons/`
2. Import and use it in `components/Toolbar.tsx`

**Want to change default models or AI parameters?**
- Edit `config/app.json` → `defaultModels` section

**Want to add a new translation provider?**
1. Create adapter in `adapters/providers/`
2. Follow the `TranslationProvider` interface
3. Register in the `Translator` (see `docs/META_ADAPTER.md`)

**Want to add support for a new website?**
1. Create adapter class in `services/adapters.ts`
2. Add website config to `config/constants.ts` → `SUPPORTED_WEBSITES_CONFIG`
3. Follow `docs/META_ADAPTER.md` for structure

**Want to modify AI prompts?**
- Edit `config/prompts.json` (all translation instructions live here)

**Want to adjust pricing?**
- Edit `config/costs.ts` → `COSTS_PER_MILLION_TOKENS` or `IMAGE_COSTS`

## Tests

- Run all: `npm test`
- Coverage: `npm run test:coverage`
- UI runner: `npm run test:ui`

## Docs & ADRs

- See `docs/` and `docs/adr/` for architecture.
- Update `docs/WORKLOG.md` with a timestamped summary for non‑trivial changes.

## Commit Style

- Conventional commits (e.g., `feat:`, `fix:`, `docs:`, `refactor:`)
- One logical change per commit; keep diffs focused.

## File Size Limits (Agent‑First)

- Services ≤ 200 LOC; Components ≤ 250 LOC (see ADR‑005)
- Prefer extracting helpers and modules instead of growing files

## Adding Site Adapters / Providers

- Website adapters: follow `docs/META_ADAPTER.md`
- Translation providers: implement `TranslationProvider` and register with the `Translator`

## Debugging

- See `docs/Debugging.md` for flags and safety notes
