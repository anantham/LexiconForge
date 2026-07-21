# Contributing to LexiconForge

👋 **Welcome!** We're thrilled you want to help improve LexiconForge.

**🚀 New to the project?** Read these three, in order:

1. [**Newcomer Onboarding Guide**](docs/ONBOARDING.md) — a step-by-step walkthrough of the codebase and your first contribution.
2. [**Architecture overview**](docs/architecture/ARCHITECTURE.md) — how the pieces fit together (and [PROVIDER_ARCHITECTURE.md](docs/architecture/PROVIDER_ARCHITECTURE.md) for the translation-provider layer).
3. The map below — where each folder lives and what it's for.

---

## Setup

- Node 18+ recommended
- `npm install`
- `npm run dev` (Vite)

See the [environment variable reference](docs/guides/EnvVars.md) and [provider guide](docs/guides/Providers.md) for API-key names; add only the keys for providers you actually use to `.env.local`.

## Project Structure

LexiconForge is a Vite + React + TypeScript single-page app. It is **one protocol behind several
reader interfaces** (web-novel translation, the Pāli Sutta Studio, the liturgy reader, and an early
Classical-Chinese reader); most infrastructure is shared, and each reader adds only the lenses its
language needs. The app entry chain is `index.html` → `index.tsx` → `App.tsx` → `MainApp.tsx`.

```
LexiconForge/
├── index.html / index.tsx / App.tsx / MainApp.tsx   # App entry chain (Vite → React root)
├── types.ts                                          # Top-level shared TypeScript types
│
├── config/            # 📋 Edit here to change defaults
│   ├── app.json               # Default models, AI parameters, image settings
│   ├── constants.ts           # Available models, supported websites, abbreviations
│   ├── costs.ts               # Model pricing for cost estimation
│   ├── prompts.json           # AI system prompts / translation instructions
│   └── novelCatalog.ts        # Featured novels served in the reader
│
├── components/        # 🎨 React UI (one folder per surface)
│   ├── sutta-studio/          # Pāli reader UI (morphemes, senses, alignment, grounding)
│   ├── liturgy/               # Multilingual liturgy reader UI
│   ├── settings/              # Settings panels (SettingsSidebar is the live nav)
│   ├── session-info/          # Import / export / publish wizard
│   └── icons/                 # SVG icon components
│
├── services/          # 🔧 Business logic & external integrations (the largest layer)
│   ├── ai/                    # Translation orchestration
│   ├── providers/             # Per-provider request/response handling
│   ├── db/                    # IndexedDB data model, operations, migrations
│   ├── scraping/              # Website content extractors (siteAdapters.ts) + fetch proxy
│   ├── epubService/           # EPUB export (the live implementation)
│   ├── audio/                 # Audio (TTS) generation & storage
│   ├── sutta-studio/          # Pāli pipeline: passes, retrieval, tokenizer, grounding
│   ├── liturgy-generator/     # Liturgy draft pipeline
│   ├── compiler/ · navigation/ · diff/ · translate/ · italian/   # Supporting subsystems
│   ├── aiService.ts · imageService.ts · translationService.ts    # Top-level service facades
│   └── ...
│
├── adapters/providers/  # 🔌 Translation provider adapters (Claude / Gemini / OpenAI + registry)
├── store/               # 📦 Zustand state management (index.ts + slices/)
├── hooks/               # ⚛️ Custom React hooks
├── utils/               # 🛠️ Helper functions
├── types/               # 📝 Domain-specific type modules
│
├── scripts/           # 🧰 Build / pipeline / grounding CLIs (run via `npm run <name>` or tsx)
├── api/               # ☁️ Vercel serverless functions (fetch-proxy, client-telemetry)
├── chrome_extension/  # 🧩 Companion browser extension
├── data/              # 📊 Datasets (dpd/, malayalam/, benchmark inputs); large user data gitignored
├── public/            # 🌐 Static assets, benchmark packets, covers
├── content/ · books/  # Reference sutta JSON and book manifests
│
├── tests/             # 🧪 Vitest suite (mirrors the source tree)  ·  test-fixtures/
├── docs/              # 📚 Documentation home
│   ├── ONBOARDING.md · START_HERE.md · CONVENTIONS.md · WORKLOG.md
│   ├── architecture/  # ARCHITECTURE.md, PROVIDER_ARCHITECTURE.md
│   ├── adr/           # Architecture Decision Records (CORE-*, DB-*, SUTTA-*, …)
│   ├── guides/        # META_ADAPTER, Providers, EnvVars, Settings, Debugging, …
│   └── features/      # Per-feature docs (Audio, EPUB, …)
│
├── issues/            # 🐛 Numbered issue investigations with repro traces
├── Marketing/         # Feature screenshots (intentionally tracked)
└── archive/           # 🗄️ Deprecated code, kept for reference (not part of the build)
```

### Quick Navigation Guide

**Want to add custom emojis to the toolbar?**
1. Add your SVG icon component to `components/icons/`
2. Import and use it in the relevant feedback/selection control

**Want to change default models or AI parameters?**
- Edit `config/app.json` → `defaultModels` section

**Want to add a new translation provider?**
1. Create an adapter in `adapters/providers/` implementing the `TranslationProvider` interface
2. Register it in `adapters/providers/index.ts` (see [`docs/guides/META_ADAPTER.md`](docs/guides/META_ADAPTER.md))

**Want to add support for a new website?**
1. Add an extractor in `services/scraping/siteAdapters.ts`
2. Add the website config to `config/constants.ts` → `SUPPORTED_WEBSITES_CONFIG`
3. Follow [`docs/guides/META_ADAPTER.md`](docs/guides/META_ADAPTER.md) for structure

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
- Update `docs/WORKLOG.md` with a timestamped summary for non-trivial changes.

## Commit Style

- Conventional commits (e.g., `feat:`, `fix:`, `docs:`, `refactor:`)
- One logical change per commit; keep diffs focused.

## File Size Limits (Agent-First)

- Services ≤ 200 LOC; Components ≤ 250 LOC (see [ADR CORE-005](docs/adr/CORE-005-agent-first-code-organization.md))
- Prefer extracting helpers and modules instead of growing files

## Adding Site Adapters / Providers

- Website adapters: follow [`docs/guides/META_ADAPTER.md`](docs/guides/META_ADAPTER.md)
- Translation providers: implement `TranslationProvider` and register in `adapters/providers/index.ts`

## Working Alongside AI Agents

This repo is developed by both humans and multiple AI coding agents. If you use one, see
[`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md) for the coordination protocol (main stays on
`main`, agents use prefixed worktrees/branches, no stashing, WORKLOG on start/end).

## Debugging

- See [`docs/guides/Debugging.md`](docs/guides/Debugging.md) for flags and safety notes
