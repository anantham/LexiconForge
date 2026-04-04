# Decomposition Plan: `services/epubService.ts`

**Status:** Draft
**Target:** Decompose the 1,778-line `epubService.ts` monolith into focused, testable modules.

## 1. Problem Analysis
The current `services/epubService.ts` violates the Single Responsibility Principle and Agent-First file size limits (200 LOC). It mixes:
- Low-level XML/XHTML sanitization and DOM manipulation.
- Business logic for statistics calculation and cost tracking.
- Template string generation for EPUB pages.
- ZIP file binary packaging.
- Data collection from the Redux/Zustand store format.

## 2. Target Architecture

We will create a `services/epub/` directory with the following structure:

```
services/epub/
├── index.ts                  # Main entry point (orchestrator)
├── types.ts                  # Shared interfaces (ChapterForEpub, EpubExportOptions)
├── sanitizers/
│   └── xhtmlSanitizer.ts     # XML namespaces, sanitization, strict XHTML conversion
├── data/
│   ├── collector.ts          # collectActiveVersions (Data gathering)
│   └── stats.ts              # calculateTranslationStats (Business logic)
├── templates/
│   ├── defaults.ts           # Default templates and text
│   └── novelConfig.ts        # Novel metadata inference logic
├── generators/
│   ├── titlePage.ts          # Title page HTML generation
│   ├── toc.ts                # Table of Contents HTML generation
│   ├── statsPage.ts          # Statistics & Acknowledgments HTML generation
│   └── chapter.ts            # Chapter content XHTML generation
└── packagers/
    └── epubPackager.ts       # JSZip logic, OEBPS structure, binary output
```

## 3. Interfaces & Boundaries

### `types.ts`
Will contain all exported interfaces currently in `epubService.ts`:
- `ChapterForEpub`
- `TranslationStats`
- `EpubExportOptions`
- `EpubTemplate`
- `NovelConfig`

### `sanitizers/xhtmlSanitizer.ts`
**Exports:**
- `sanitizeHtmlAllowlist(html: string): string`
- `htmlFragmentToXhtml(fragment: string): string`
- `escapeXml(text: string): string`

### `generators/chapter.ts`
**Exports:**
- `buildChapterXhtml(chapter: ChapterForEpub): string`

### `packagers/epubPackager.ts`
**Exports:**
- `generateEpub3WithJSZip(meta: EpubMeta, chapters: EpubChapter[]): Promise<ArrayBuffer>`

## 4. Execution Plan

### Step 1: Scaffold & Types (Safe)
1. Create `services/epub/types.ts` and move all interfaces there.
2. Update `epubService.ts` to import these types locally to ensure no breakage.

### Step 2: Extract Utilities (Low Risk)
1. Extract `sanitizers/xhtmlSanitizer.ts`. Move `sanitizeHtmlAllowlist`, `htmlFragmentToXhtml`, `cloneIntoXhtml`, and XML constants.
2. Extract `templates/defaults.ts` and `templates/novelConfig.ts`.
3. Update `epubService.ts` to use these new modules.

### Step 3: Extract Business Logic (Medium Risk)
1. Extract `data/stats.ts` (`calculateTranslationStats`).
2. Extract `data/collector.ts` (`collectActiveVersions`, `createChapterForEpub`).
3. Update `epubService.ts`.

### Step 4: Extract Generators (Medium Risk)
1. Extract `generators/titlePage.ts`, `generators/toc.ts`, `generators/statsPage.ts`.
2. Extract `generators/chapter.ts` (`buildChapterXhtml`). This is complex due to the dependency on `sanitizeHtmlAllowlist`. Ensure imports work.

### Step 5: Extract Packager (High Risk)
1. Extract `packagers/epubPackager.ts`. This contains the heavy `JSZip` logic and the `generateEpub3WithJSZip` function.
2. This module will need `escapeXml` from the sanitizer module.

### Step 6: Orchestrator & Cleanup
1. Rewrite `services/epub/index.ts` (formerly `epubService.ts`) to be a pure orchestrator that calls the above modules.
2. It should be < 200 lines, handling only the flow: Data -> Stats -> Generators -> Packager.

## 5. Verification Strategy

1. **Manual Export Test**:
   - Before starting, generate an EPUB from the app and save it.
   - After each step, generate a new EPUB and bitwise compare (or visually compare if timestamps differ) to ensure content is identical.
2. **Unit Tests**:
   - Run `npm test services/epubService` if exists.
   - If not, create a smoke test `tests/services/epub/smoke.test.ts` that imports the service and runs a mock export.

## 6. Rollback Plan
Since we are creating new files and importing them into the old one, we can revert by simply checking out the original `services/epubService.ts` and deleting the `services/epub/` directory.
