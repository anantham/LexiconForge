# LexiconForge Project Overview

## Purpose
LexiconForge is an AI-powered web novel translation application. It allows users to translate chapters from various web novel sources (Japanese, Chinese) into any language using multiple AI providers.

## Key Features
- Multi-provider AI translation (Gemini, Claude, DeepSeek, OpenRouter)
- Reader feedback loop (thumbs up/down to improve translations)
- AI illustration generation (Flux, Imagen models)
- EPUB export with embedded illustrations
- Fan translation comparison mode
- Real-time cost tracking
- IndexedDB-based persistent storage

## Tech Stack
- **Frontend Framework:** React 19.1.1 (with JSX)
- **Build Tool:** Vite 6.x
- **State Management:** Zustand 5.x
- **Styling:** Tailwind CSS 4.x
- **Testing:** Vitest (unit), Playwright (E2E)
- **Language:** TypeScript 5.8
- **Storage:** IndexedDB (via custom services)
- **Icons:** Lucide React

## AI Provider SDKs
- @anthropic-ai/sdk (Claude)
- @google/genai, @google/generative-ai (Gemini/Imagen)
- openai (OpenAI/OpenRouter)

## Deployment
- Hosted on Vercel
- Uses @vercel/analytics

## Key Directories
- `config/` - App configuration, costs, constants, prompts
- `components/` - React UI components
- `services/` - Business logic and external integrations
- `store/` - Zustand state management
- `adapters/` - Translation provider adapters
- `docs/` - Documentation and ADRs
