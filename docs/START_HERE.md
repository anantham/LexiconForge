# Start Here: LexiconForge Documentation Index

Welcome to LexiconForge! This document is your map to the codebase.

## What is LexiconForge?

LexiconForge is a React-based web application for reading and translating web novels using AI. It supports 8 source sites, multiple AI providers (Gemini, Claude, DeepSeek, OpenAI, OpenRouter), and features like inline illustrations, footnotes, fan translation comparison, and EPUB export.

**Live app:** [lexicon-forge.vercel.app](https://lexicon-forge.vercel.app/)

---

## Quick Start

```bash
git clone https://github.com/anantham/LexiconForge.git
cd LexiconForge
npm install
cp .env.example .env.local  # Add your API keys
npm run dev
```

---

## Documentation by Role

### New Contributor
| Doc | Purpose |
|-----|---------|
| [ONBOARDING.md](./ONBOARDING.md) | Step-by-step guide to your first contribution |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Code style, PR process, testing requirements |
| [../AGENTS.md](../AGENTS.md) | How to work with AI agents on this codebase |

### Understanding the Architecture
| Doc | Purpose |
|-----|---------|
| [ARCHITECTURE.md](./architecture/ARCHITECTURE.md) | High-level system design |
| [adr/](./adr/) | Architecture Decision Records (why we built things this way) |
| [Schemas.md](./guides/Schemas.md) | Data models for translations, sessions, chapters |

### Feature-Specific Guides
| Feature | Doc |
|---------|-----|
| Translation pipeline | [Workers.md](./guides/Workers.md) |
| AI providers | [Providers.md](./guides/Providers.md) |
| Image generation | [ImageGeneration.md](./features/ImageGeneration.md) |
| Audio generation | [Audio.md](./features/Audio.md) |
| EPUB export | [EPUB.md](./features/EPUB.md) |
| Fan translations | [FanTranslations.md](./features/FanTranslations.md) |
| Settings UI | [Settings.md](./guides/Settings.md) |

### Operations & Debugging
| Doc | Purpose |
|-----|---------|
| [EnvVars.md](./guides/EnvVars.md) | Environment variable reference |
| [DEPLOYMENT.md](./guides/DEPLOYMENT.md) | Deploy to Vercel or self-host |
| [Debugging.md](./guides/Debugging.md) | Debug flags and logging |
| [E2E-TESTING.md](./infrastructure/E2E-TESTING.md) | End-to-end test setup |

### Roadmaps & Tech Debt
| Doc | Purpose |
|-----|---------|
| [CHANGELOG.md](./roadmaps/CHANGELOG.md) | Version history and notable changes |
| [TECH-DEBT-STATUS.md](./roadmaps/TECH-DEBT-STATUS.md) | Current tech debt items and progress |
| [REFACTOR_CANDIDATES.md](./roadmaps/REFACTOR_CANDIDATES.md) | Files on the refactoring watchlist |
| [TypeScript Health](./infrastructure/TYPESCRIPT-HEALTH.md) | Current TS error status |

---

## Documentation Structure

```
docs/
├── START_HERE.md          # You are here
├── ONBOARDING.md          # Newcomer guided tour
├── WORKLOG.md             # Daily work log (multi-agent)
├── Vision.md              # Product vision
│
├── features/              # User-facing feature docs
│   ├── Audio.md, EPUB.md, FanTranslations.md
│   ├── ImageGeneration.md, NOVEL_LIBRARY.md
│   └── COMMUNITY_LIBRARY.md (vision only)
│
├── guides/                # How-to & reference
│   ├── Debugging.md, DEPLOYMENT.md, EnvVars.md
│   ├── META_ADAPTER.md, Providers.md
│   ├── Schemas.md, Settings.md, Workers.md
│   └── (adding new sites, configuring providers, etc.)
│
├── architecture/          # System design
│   └── ARCHITECTURE.md
│
├── adr/                   # Architecture Decision Records
│   ├── DB-001..DB-007     # Database layer
│   ├── CORE-004..CORE-006 # Core architecture
│   ├── FEAT-001..FEAT-002 # Feature design
│   └── SUTTA-003          # Sutta Studio
│
├── infrastructure/        # Testing & tooling
│   ├── E2E-TESTING.md, TEST_MANIFEST.md
│   ├── TYPESCRIPT-HEALTH.md
│   └── CLAUDE-CODE-SCRIPTS.md
│
├── roadmaps/              # Plans & tracking
│   ├── CHANGELOG.md, TECH-DEBT-STATUS.md
│   ├── REMEDIATION-ROADMAP.md
│   ├── MEMORY_OPTIMIZATION_ROADMAP.md
│   ├── COMPONENT-DECOMPOSITION-PLAN.md
│   └── REFACTOR_CANDIDATES.md
│
└── archive/               # Historical docs
    ├── completed/         # Finished plans (IndexedDB, legacy repo)
    ├── stale-docs/        # Outdated (superseded-by headers)
    ├── testing-evolution/  # Test infrastructure journey
    └── diagnostics/       # Old diagnostic artifacts
```

---

## Architecture Decision Records (ADRs)

ADRs explain *why* we made key design decisions. They're organized by domain:

| Prefix | Domain | Example |
|--------|--------|---------|
| `DB-` | Database/IndexedDB | [DB-001](./adr/DB-001-decompose-monolithic-indexeddb.md) - Service decomposition |
| `CORE-` | Core architecture | [CORE-005](./adr/CORE-005-agent-first-code-organization.md) - Agent-first code organization |
| `FEAT-` | Feature design | [FEAT-001](./adr/FEAT-001-preloader-strategy.md) - Preloader strategy |
| `SUTTA-` | Sutta Studio | [SUTTA-003](./adr/SUTTA-003-sutta-studio-mvp.md) - Sutta Studio MVP |

---

## Key Design Principles

1. **Agent-First**: Files stay small (<300 LOC) so both humans and AI can reason about them
2. **Privacy-First**: API keys and data stay on-device (IndexedDB)
3. **Provider-Agnostic**: Adapters abstract AI providers; easy to add new ones
4. **Offline-Capable**: Sessions persist across browser restarts

---

## Getting Help

- **Telegram:** [@webnovels](https://t.me/webnovels)
- **Issues:** Check [GitHub Issues](https://github.com/anantham/LexiconForge/issues)
- **WORKLOG:** See [WORKLOG.md](./WORKLOG.md) for recent changes

---

## What's Next?

1. Read [ONBOARDING.md](./ONBOARDING.md) for a guided tour
2. Pick a [good first issue](https://github.com/anantham/LexiconForge/issues?q=is%3Aopen+label%3A%22good+first+issue%22)
3. Check [WORKLOG.md](./WORKLOG.md) to see what's in progress
