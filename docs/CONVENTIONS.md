# LexiconForge Conventions

> Single source of truth for coding conventions, naming, and process rules.
> When this file conflicts with an ADR, this file wins (it's newer).
> When this file conflicts with `~/.claude/CLAUDE.md`, CLAUDE.md wins (it's the agent protocol).
>
> Last updated: 2026-03-19

---

## 1. Language & Tooling

- **TypeScript everywhere.** No `.js` files in `services/`, `components/`, `hooks/`, `store/`, `types/`, `utils/`.
- **Strict mode.** `tsconfig.json` strict is on. No `// @ts-ignore` without a comment explaining why and an owner.
- **No `any` without justification.** Use `unknown` + type guard instead. If `any` is unavoidable, add a `// TODO(ts): reason` comment.
- **ESM only.** No CommonJS (`require`, `module.exports`) in any service or component file.
- **Named exports only** in service files — no default exports, no barrel re-exports (`export * from`). This enables tree-shaking.
- **Test runner:** Vitest for unit/integration, Playwright for E2E.

---

## 2. File & Directory Naming

| Category | Convention | Example |
|----------|-----------|---------|
| Services | `camelCase.ts` | `translationService.ts` |
| DB operations | `camelCase.ts` | `chapters.ts` (in `services/db/operations/`) |
| Components | `PascalCase.tsx` | `ChapterView.tsx` |
| Hooks | `use*.ts` | `useChapterDiffs.ts` |
| Store slices | `*Slice.ts` | `imageSlice.ts` |
| Types | `camelCase.ts` | `suttaStudio.ts` (in `types/`) |
| Tests | `*.test.ts` / `*.test.tsx` | `suttaStudioRehydrator.test.ts` |
| ADRs | `DOMAIN-NNN-kebab-title.md` | `SUTTA-006-pipeline-caching-architecture.md` |

**Directories:** `kebab-case` for feature directories (`sutta-studio/`, `session-info/`), `camelCase` for service subdirectories (`services/db/`, `services/epubService/`).

---

## 3. Code Structure

### Services

Services are **plain functions or factory functions** — not classes with `new`. The `withTxn` pattern is used for all DB work:

```typescript
// ✅ Factory function
export const createChapterService = (db: IDBDatabase) => ({ ... });

// ✅ Pure function with optional transaction
export async function getChapter(id: string, tx?: IDBTransaction): Promise<Chapter | undefined> { ... }

// ❌ No class instantiation at module level
export const chapterService = new ChapterService(); // don't do this
```

### DB Operations

All database operations accept an optional `tx?` parameter to support multi-store transactions:

```typescript
export async function saveChapter(chapter: Chapter, tx?: IDBTransaction): Promise<void>
```

Multi-store transactions use `withTxn(storeNames, mode, operation)` from `services/db/core/txn.ts`.

### Components

React components use `React.FC<Props>` with explicit prop interfaces. Props interface lives in the same file unless shared across multiple components (then in `types.ts` in the same directory).

### Hooks

Custom hooks own their own state and side effects. A hook that wraps a service call should handle loading/error states locally — don't return raw Promises from hooks.

---

## 4. File Size (Friction-Based)

> **Rule:** A file is a problem when it has more than one reason to change, more than one concept to hold in mind, or when "where does X live?" always points here.

LOC is a signal to investigate, not a hard limit. See `~/.claude/CLAUDE.md` "File Size Management" for the full decision framework and current codebase examples.

**Note:** AGENTS.md §FILE_SIZE_MANAGEMENT references a 300 LOC hard limit and `docs/REFACTOR_CANDIDATES.md`. Both are superseded by the friction-based policy above. The refactor candidates list is now maintained in `docs/architecture/ARCHITECTURE.md` §7 (Hotspots).

---

## 5. Error Handling

- **Never silent failures.** Every `catch` block must either rethrow, log with context, or explicitly handle with a comment explaining why swallowing is safe.
- **DB errors** use `DbError` and `mapDomError` from `services/db/core/errors.ts`. Don't create new error types for DB operations.
- **Services throw, UI catches.** Services throw typed errors; store slices and components catch and map to UI state.
- **Descriptive messages.** Error messages include the operation name, relevant IDs, and what was expected vs. what happened.

```typescript
// ✅
throw new Error(`saveChapter: chapter ${chapter.url} failed to persist — ${err.message}`);

// ❌
throw new Error('Failed');
```

---

## 6. Naming

| Concept | Convention |
|---------|-----------|
| Variables / functions | `camelCase` |
| Types / interfaces / enums | `PascalCase` |
| Constants (module-level) | `UPPER_SNAKE_CASE` |
| React components | `PascalCase` |
| IndexedDB store names | `snake_case` (e.g., `prompt_templates`) |
| IndexedDB field names | `snake_case` |
| API / JSON payloads | `camelCase` |
| Branch names | `feat/<agent>-<topic>`, `fix/<agent>-<topic>` |

**Intentional divergence:** IndexedDB uses `snake_case` for store/field names (DB convention); TypeScript types for those records use `camelCase` properties. This is documented and expected — not a naming conflict.

### 6a. Verb-prefix semantics (added 2026-07-26, integrity scan)

These rules were already true de facto; the defect was that they were
unwritten, so each reader reverse-engineered them and fresh sessions invented
synonyms. Where a distinction is real, the fix is writing it down, not merging.

| Prefix | Contract |
|--------|----------|
| `fetch*` | Crosses the network. |
| `get*` | Memory/cache/DB read — no network, no durable writes. |
| `load*` | Read + hydrate into runtime state. |
| `find*` | Search that may miss — returns null/undefined. |
| `lookup*` | Dictionary-domain resolution (DPD, glossaries). |
| `ensure*` | Idempotent postcondition-establisher; **errors propagate** (an ensure that resolves after failing leaves callers on a false postcondition). Best-effort variants are named `repair*`/`persist*` and log what they swallow. |
| `validate*`/`verify*` | Must be able to REJECT (throw, or return a value callers gate on). A validator that only logs is a no-op wearing a safety name. |
| `is*`/`has*`/`can*` | Pure predicates — mutating on read disqualifies the name. |
| `acquire*` | Consumes/holds a resource; backpressure is the wait, not a boolean. |

Known collapse candidate: `getChaptersForReactRendering` vs
`fetchChaptersForReactRendering` (`services/db/operations/rendering.ts`) are
the same IndexedDB read.

### 6b. Noun clusters — real distinctions, do not merge

- **chapter** = the text unit; `*Section` identifiers are UI panels only.
- **translation / version / rendering** — model output (`TranslationResult`) /
  stored variant per chapter (`version`, `activeVersion`) / read-model
  projection for React (`ChapterRenderingRecord`).
- **URL family** — `originalUrl` (as-scraped) · `canonicalUrl` (normalized
  identity via `normalizeUrlAggressively`, the single normalizer) ·
  `sourceUrls` (all variants) · `prevUrl`/`nextUrl` (adjacency, never
  identity). Identity-first lookup with adjacency as explicit fallback is
  load-bearing (`findByUrlInMemory`).
- **novel / work** — `novel`/`novelId` is the web-novel entity; `work`/`workId`
  is the Buddhist-corpus text (84000/SuttaCentral term). `Bookshelf*` is a UI
  feature; `BookToki` is a site.
- **settings / config / options** — `AppSettings` (user runtime) · `appConfig`
  (static `config/app.json`) · `NovelConfig` (per-novel) ·
  `translationSettingsSnapshot` (per-version provenance) · `*Options`
  (per-call args). No `prefs`.
- **provider** has three referents — vendor string (`ProviderName`), chat
  capability (`adapters/providers/Provider.ts`), data-source loaders
  (`services/providers/`). Qualify in prose.
- **session** = the import/export artifact, not the zustand store, not an app run.
- **image / illustration / steering** — generated asset with versions /
  in-text placement concept (markers) / img2img reference inputs.

### 6c. Single-source grammars (import, never copy)

- Illustration markers: `services/ai/illustrationMarkers.ts`
  (`ILLUSTRATION_MARKER_PATTERN` / `ILLUSTRATION_MARKER_INNER`) — the reader
  tokenizer, HTML repair, and EPUB generator compose from it.
- Prompt placeholders: double-brace `{{name}}`, expanded only by
  `services/ai/textUtils.replacePlaceholders`.
- Chapter identity: `generateStableChapterId`/`simpleHash` from
  `services/stableIdService` — scripts import it; a copied hash guarded by a
  comment silently orphans every session it builds.
- Fetch-proxy allowlist: `services/scraping/allowedDomains.cjs` (the two
  in-repo proxies).

---

## 7. Imports

- **Absolute imports** for cross-domain references (`services/`, `types/`, `hooks/`).
- **Relative imports** within the same subdirectory.
- **No circular imports.** If A imports B and B imports A, extract shared types to a `types.ts`.
- **Import order:** external packages → internal services → types → relative.

---

## 8. Testing

- Every bug fix ships with a regression test.
- Unit tests for pure functions and DB operations (use `test-fixtures/`).
- Integration tests for multi-step flows (Playwright).
- **Never comment out or skip a failing test.** If a test is wrong, delete it and write a correct one.
- Test files live next to the code they test (e.g., `suttaStudioRehydrator.test.ts` alongside `suttaStudioRehydrator.ts`).

---

## 9. ADR Lifecycle

- **Write an ADR** for any decision that affects architecture, data model, or cross-cutting conventions. Prefer short ADRs over long ones.
- **Status values:** `Proposed` → `Accepted` → `Implemented` → `Superseded`.
- **When a PR ships the thing an ADR proposed:** update the ADR status to `Implemented` and add an Implementation Notes section pointing to the actual files. Keep it in the same commit as the feature, or as a follow-up doc commit.
- **Don't alter existing ADR content** — amend by adding sections (Amendment, Implementation Notes). The original decision text is immutable.
- **ADR IDs are unique per domain.** Domain prefixes: `CORE`, `DB`, `FEAT`, `SUTTA`. Resolve conflicts immediately (see SUTTA-006 rename as example).

---

## 10. Commits & Branches

See `AGENTS.md` §COMMIT_MESSAGE_TEMPLATES and `~/.claude/CLAUDE.md` §GIT COMMIT REQUIREMENTS for commit message format.

Key rules:
- One logical change per commit.
- Conventional commit types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.
- Branch names include agent prefix when multiple agents are active: `feat/opus-<topic>`.
- Doc-only changes use `docs:` type.
- Never commit directly to `main` for non-trivial changes — see `AGENTS.md` §PULL_REQUEST_WORKFLOW.

### Public documentation and configuration

This repository, including branches, WORKLOG, issues, PR descriptions and review
comments, is public. Record source changes, reproducible checks and product
acceptance here. Keep private deployment inventories, owner logins, hostnames,
machine paths, incident details and backend runtime state outside this repository.
Use reserved example domains/addresses in fixtures and operator-provided
configuration at runtime. Never paste private audit evidence into a public handoff.

---

## 11. Intentional Divergences

These are places where you might expect a convention and find something different — documented here so they're not flagged as violations:

| Pattern | Expected | Actual | Reason |
|---------|----------|--------|--------|
| IndexedDB field names | `camelCase` | `snake_case` | DB convention; TS types use camelCase |
| `demoPacket.ts` size | Small file | 3-line shim (was 4,390 LOC) | Migrated to `demoPacket.json`; shim re-exports typed data (March 2026) |
| `suttaStudioCompiler.ts` size | Single concern | 3-line shim (was 2,280 LOC) | Decomposed into `services/compiler/` (8 modules); shim re-exports (March 2026) |
| ADRs dated 2025-01-13 status | `Proposed` | Now `Implemented` | Updated 2026-03-05 in doc audit |
| Repository file names | `camelCase.ts` | `PascalCase.ts` | Class-like semantics; `services/db/repositories/*.ts` (5 files) |
| Provider/Adapter file names | `camelCase.ts` | `PascalCase.ts` | Pattern-based naming; `services/audio/*Provider.ts`, `services/diff/SimpleLLMAdapter.ts`, `services/translate/Translator.ts` |
| `*Service.ts` file names | `camelCase.ts` | `PascalCase.ts` | **Violation** — 6 files (`AudioService.ts`, `OSTLibraryService.ts`, `DiffAnalysisService.ts`, `DiffTriggerService.ts`, `HtmlRepairService.ts`, `HtmlSanitizer.ts`) should be renamed to camelCase in a future cleanup PR |
