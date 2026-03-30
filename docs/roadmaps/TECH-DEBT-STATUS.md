# Tech Debt Status

**Last Updated:** March 29, 2026
**Last Surface Scan:** March 29, 2026 (v1.1.0, post-review corrected)

## Completed Milestones ✅

### IndexedDB Decomposition (Nov 2025)
- Monolithic `services/indexeddb.ts` (2000+ LOC) → Modular services
- 40+ call sites migrated
- Legacy facade deleted
- See: [ADR DB-001](../adr/DB-001-decompose-monolithic-indexeddb.md)

### TypeScript Error Remediation (Nov 2024 - Mar 2026)
- 172 errors → 0 errors (100% reduction)
- See: [TypeScript Health](../infrastructure/TYPESCRIPT-HEALTH.md)

### Legacy Repository Retirement (Nov 2025)
- `adapters/repo/Repo.ts` compatibility shim removed
- Modern/memory backends only
- See: [Archive: Retirement Plan](../archive/completed/LEGACY_REPO_RETIREMENT_PLAN.md)

### Component Decomposition (Jan–Mar 2026)
- `components/SettingsModal.tsx` 2745 LOC → 205 LOC orchestrator + `components/settings/` modules
- `components/ChapterView.tsx` 1969 LOC → 433 LOC
- `services/navigationService.ts` 1109 LOC → 4-line shim + `services/navigation/` (8 modules)
- `services/suttaStudioCompiler.ts` 2280 LOC → 3-line shim + `services/compiler/` (8 modules)
- `components/sutta-studio/demoPacket.ts` 4390 LOC → 3-line shim + JSON file
- `services/adapters.ts` → `services/scraping/` modules

---

## Scan Methodology

```
Scope:      services/ store/ components/ hooks/ scripts/ utils/
Excluded:   node_modules/ dist/ coverage/ archive/ .superpowers/
Coverage:   Test file presence only (no vitest --coverage instrumentation)
Stack:      TypeScript, React, Zustand (state), Vitest (tests), Vite (build)
Commit:     5d18e77
```

**LOC by directory (live code, .ts/.tsx):**

| Directory | LOC |
|-----------|-----|
| `services/` | 34,821 |
| `components/` | 19,724 |
| `scripts/` | 7,937 |
| `store/` | 5,542 |
| `hooks/` | 1,807 |
| `utils/` | 469 |
| **Total live code** | **70,300** |
| `tests/` | 21,069 |

**Test files:** 108 (across `tests/`)

---

## Active Tech Debt Items

### 🔴 Critical (Fix This Sprint)

| Item | Location | Issue | Status |
|------|----------|-------|--------|
| Security: API keys in build | `vite.config.ts:96-117` | 6 API keys bundled into client JS via `define:` — remove build-time secret injection (local-first app, not a backend proxy issue) | NEW |
| `as any` casts (systemic) | Live code (scoped) | 296 `as any` in live code — see breakdown below | NEW |
| Silent error swallowing | `services/navigation/index.ts` (4), `store/slices/chaptersSlice.ts` (4) | 8 truly empty `.catch(() => {})` blocks hiding DB/navigation failures | NEW |
| Async anti-pattern | `rateLimitService.ts:30`, `importService.ts:201` | `new Promise(async ...)` — 2 instances, swallows errors escaping the promise chain | NEW |

**`as any` breakdown (296 total, scope: services/ store/ components/ hooks/ scripts/ utils/):**

| Directory | Count | Primary cause |
|-----------|-------|---------------|
| `services/` | 106 | Untyped API responses (PiAPI, Gemini), DB migration code |
| `store/slices/` | 94 | Cross-slice state access — Zustand composition lacks type inference |
| `components/` | 62 | Props/event handler typing gaps |
| `hooks/` | 16 | Store accessor typing |
| `scripts/` | 14 | CLI/benchmark typing |
| `utils/` | 1 | — |

### 🔴 High Priority

| Item | Location | Issue | Status |
|------|----------|-------|--------|
| Test: compiler orchestrator | `services/compiler/index.ts` (618 LOC) | No tests for orchestrator, schemas (401), prompts (347), LLM (123), dictionary (137). Only `utils.test.ts` (284 LOC) exists. | ⏳ Planned |
| Test: untested services >500 LOC | See table below | 9 services >500 LOC with no test files found | NEW |
| Test: Zustand slices | `store/slices/` | 2 of 8 slices have no tests: `translationsSlice` (1,059 LOC), `audioSlice` (434 LOC). Other 6 have tests of varying depth. | NEW |
| npm vulnerabilities | `package.json` | 8 total: 6 high (flatted, happy-dom, minimatch, picomatch, rollup, tar) + 2 moderate (brace-expansion, yaml) | NEW |
| No selector layer | `store/slices/*.ts` | Cross-slice state access duplicated 13 times via `(state as any).chapters \|\| new Map()` pattern | NEW |

**Services >500 LOC with no tests found:**

| Service | LOC |
|---------|-----|
| `imageService.ts` | 857 |
| `suttaStudioPassPrompts.ts` | 725 |
| `translationService.ts` | 721 |
| `suttaStudioPassRunners.ts` | 586 |
| `imageGenerationService.ts` | 574 |
| `telemetryService.ts` | 506 |
| `suttaStudioPipelineCache.ts` | 472 |
| `sessionManagementService.ts` | 458 |
| `suttaStudioRehydrator.ts` | 437 |

**Services >500 LOC with partial tests (depth unknown):**

| Service | LOC | Test file(s) |
|---------|-----|-------------|
| `exportService.ts` | 1,054 | `exportService.test.ts` (178 LOC), `epub/exportService.test.ts` |
| `importService.ts` | 852 | `importService.test.ts` (176 LOC) |
| `navigation/index.ts` | 405 | `navigationService.test.ts` (743 LOC), `converters.test.ts` |
| `compiler/index.ts` | 618 | `compiler/utils.test.ts` (284 LOC) — covers utils only |

### 🟡 Medium Priority

| Item | Location | Issue | Status |
|------|----------|-------|--------|
| Type Safety | `services/imageService.ts` | 30+ `as any` casts (untyped PiAPI/Gemini API responses) | Watchlist |
| Component Size | `components/bench/SuttaStudioBenchmarkView.tsx` | 1,272 LOC (largest file in repo) | Watchlist |
| Service patterns | 7+ services | 3 conflicting instantiation patterns (static class / singleton / object literal) | NEW |
| CORS proxy exposure | `services/scraping/proxy.ts` | User content routed through 10 third-party proxies (3 tiers) | NEW |
| Security: keys in localStorage | `sessionManagementService.ts` | API keys stored unencrypted — XSS-exfiltrable (lower severity: local-first app) | NEW |
| Unsafe URL handling | `SuttaStudioPipelineLoader.tsx:36-48` | User-supplied `path` param used in `fetch()` without validation | NEW |
| Stale roadmap doc | `docs/roadmaps/ADDITIONAL-ARCHITECTURAL-ISSUES.md` | References deleted `services/indexeddb.ts` — live doc with dead code refs | NEW |

See: [ARCHITECTURE.md §7 Hotspots](../architecture/ARCHITECTURE.md) (formerly tracked in REFACTOR_CANDIDATES.md, now archived)

### 🟢 Low Priority

| Item | Issue | Notes |
|------|-------|-------|
| Import paths | `@/` alias used in 3 files (20 import lines) | Localized to `services/ai/providers/` — not systemic |
| Naming inconsistency | `get` vs `fetch` vs `load` across services | Cognitive load, discoverability |
| Magic numbers | 10+ hardcoded timeouts without constants | `fetcher.ts`, `importService.ts`, `ChapterView.tsx` |
| PascalCase naming | 24 PascalCase files in services/ | 16 tolerated (repositories 9, providers/adapters 7); 8 are violations per CONVENTIONS.md §11 |
| Stale plans | 5 plans from 2025 with unknown status | Needs archive pass |

---

## Catch Handler Inventory

**Scope:** services/ store/ components/ hooks/ (.ts/.tsx)

| Tier | Count | Risk | Description |
|------|-------|------|-------------|
| **Silent** | 8 | HIGH | `.catch(() => {})` — failures vanish (navigation/index.ts ×4, chaptersSlice.ts ×4) |
| **Log-only** | 3 | MEDIUM | `.catch(console.error/warn)` — visible but unhandled |
| **Fallback** | 28 | LOW | `.catch(() => null/[])` — explicit degradation, often intentional |
| **Handled** | 18 | NONE | `.catch(e => { ... })` with recovery logic |
| **Total `.catch()`** | **57** | — | — |
| **`try/catch` blocks** | **431** | — | Separate accounting (most have proper handling) |

---

## Zustand Slice Test Coverage

| Slice | LOC | Tests Found | Evidence |
|-------|-----|-------------|----------|
| `imageSlice` | 1,081 | `imageMigrationService.test.ts` | Inferred (migration only, not slice actions) |
| `translationsSlice` | 1,059 | None | Absent |
| `chaptersSlice` | 825 | `chaptersSlice.test.ts` (189 LOC) | Inferred |
| `exportSlice` | 605 | `exportSlice.test.ts` (47 LOC), `export-import.test.ts`, `exportService.test.ts` | Inferred |
| `settingsSlice` | 503 | `settings.test.ts` | Inferred |
| `audioSlice` | 434 | None | Absent |
| `jobsSlice` | 291 | `jobsSlice.test.ts` (307 LOC) | Inferred |
| `uiSlice` | 204 | Indirect via epub tests | Inferred (indirect) |

---

## Metrics

| Metric | Nov 2024 | Jan 2026 | Mar 5 | Mar 29 | Target |
|--------|----------|----------|-------|--------|--------|
| TS Errors | 172 | 7 | 0 | **0** | 0 ✅ |
| Test Coverage | ~10% | 21% | ~21% | unmeasured | 60% |
| Largest File | 2800 | 2745 | 1,272 | **1,272** | < 500 LOC |
| Services >1000 LOC | many | 3 | 0 | **0** | 0 ✅ |
| `as any` (live code) | ��� | — | — | **296** | < 50 |
| Empty `.catch(() => {})` | — | — | — | **8** | 0 |
| npm audit high | — | — | — | **6** | 0 |
| npm audit moderate | — | ��� | — | **2** | 0 |
| `\|\| new Map()` fallbacks | — | — | — | **13** | 0 |
| `new Promise(async)` | — | — | — | **2** | 0 |
| Test files | — | — | — | **108** | — |
| Test LOC | — | — | — | **21,069** | — |
| Live code LOC | — | — | — | **70,300** | — |
| Test:code ratio | — | — | — | **0.30** | > 0.80 |

---

## Related Docs

- [Remediation Roadmap](./REMEDIATION-ROADMAP.md) - Detailed phases
- [Archive: Original Plan (Nov 2024)](../archive/stale-docs/TECH-DEBT-REDUCTION-PLAN.md)
