# 🚀 Newcomer Onboarding Guide

Welcome to LexiconForge! This guide is designed to get you from "zero" to "ready to contribute" as quickly as possible.

## 1. The Big Picture

LexiconForge is a React-based web application that helps users read and translate web novels. It's built with:
- **React 19** for the UI.
- **Zustand** for state management (think Redux, but simpler).
- **IndexedDB** for storing large amounts of novel data offline.
- **Vite** for fast development.

We have a strict "Agent-First" philosophy: keep files small and single-purpose so both humans and AI agents can understand them easily.

## 2. Setting Up Your Environment

1.  **Node.js**: Ensure you have Node 18+ installed.
2.  **Clone the Repo**:
    ```bash
    git clone https://github.com/anantham/LexiconForge.git
    cd LexiconForge
    ```
3.  **Install Dependencies**:
    ```bash
    npm install
    ```
4.  **Environment Variables**:
    Copy `.env.example` to `.env.local` and add at least one API key (e.g., Google Gemini is free/cheap to start).
    ```bash
    cp .env.example .env.local
    ```

## 3. Your First Contribution: "The Walkthrough"

Let's walk through the codebase by following two user actions: **Load a chapter** and then **Translate it**.

### A) Load a chapter

1. **UI Trigger**: The URL/session loader lives in `components/InputBar.tsx`. On submit, it calls the store’s `handleFetch(url)`.
2. **State Logic**: `store/slices/chaptersSlice.ts` defines `handleFetch`, which delegates to `NavigationService.handleFetch`.
3. **Core Service**: `services/navigationService.ts` handles cache/hydration from IndexedDB and (if needed) fetching/parsing via `services/adapters.ts`.
4. **Persistence**: Reads/writes go through `services/db/operations/*` (e.g. `services/db/operations/translations.ts`).

### B) Translate a chapter

1. **UI Trigger**: In the reader, the retranslate button is rendered by `components/chapter/ChapterHeader.tsx` (wired up in `components/ChapterView.tsx`).
2. **State Logic**: `store/slices/translationsSlice.ts` orchestrates the translation workflow and calls `TranslationService.translateChapterSequential(...)`.
3. **Core Service**: `services/translationService.ts` builds history/context and calls `services/aiService.ts` (`translateChapter`).
4. **Routing + Adapters**: `services/ai/translatorRouter.ts` routes requests into `services/translate/Translator.ts`, using registered adapters from `adapters/providers/*`.

## 4. Key "Do's and Don'ts"

### ✅ DO
- **Check File Sizes**: Keep services under 200 lines and components under 250 lines.
- **Use "Ops" for DB**: Always use `services/db/operations/` to talk to the database. Never import `indexedDB` directly in components.
- **Run Tests**: `npm test` runs the unit tests. We value tests highly!

### ❌ DON'T
- **Create Monoliths**: If a file gets too big, split it.
- **Bypass the Store**: Components should read from Zustand stores, not fetch data directly from services (mostly).

## 5. Where to Start?

Check out `ISSUES.md` or look for "Good First Issue" tags on GitHub. Here are some safe areas to explore:

- **Icons**: Add a new icon to `components/icons/` and use it.
- **Prompts**: Tweak translation instructions in `config/prompts.json`.
- **CSS**: We use Tailwind. Adjust styling in `components/` to improve the look.

## 6. Need Help?

- Check `docs/PROJECT_STRUCTURE.md` for a map of the folders.
- Read `docs/ARCHITECTURE.md` for deep dives.
- Ask in our Telegram group or open a GitHub Discussion!
