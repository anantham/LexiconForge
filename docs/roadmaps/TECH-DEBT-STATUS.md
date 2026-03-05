# Tech Debt Status

**Last Updated:** March 5, 2026

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

## Active Tech Debt Items

### 🔴 High Priority

| Item | Location | Issue | Status |
|------|----------|-------|--------|
| Test Coverage | `services/compiler/` | 0% coverage on 2027 LOC core pipeline | ⏳ Planned |
| Test Coverage | `services/navigation/` | 0% coverage on 1104 LOC core infra | ⏳ Planned |

### 🟡 Medium Priority

| Item | Location | Issue | Status |
|------|----------|-------|--------|
| Type Safety | `services/imageService.ts` | 30+ `as any` casts (untyped API responses) | Watchlist |
| Service Size | `services/suttaStudioPassPrompts.ts` | 723 LOC, no ADR, no tests | Watchlist |
| Service Size | `services/suttaStudioPassRunners.ts` | 586 LOC, no ADR, no tests | Watchlist |
| Component Size | `components/bench/SuttaStudioBenchmarkView.tsx` | 1272 LOC | Watchlist |

See: [Refactor Candidates](./REFACTOR_CANDIDATES.md)

### 🟢 Low Priority

| Item | Issue | Notes |
|------|-------|-------|
| Test Coverage | ~19% overall (services root 19%) | Core pipeline modules at 0% |
| Stale Plans | 5 plans from 2025 with unknown status | Needs archive pass |

---

## Metrics

| Metric | Nov 2024 | Jan 2026 | Mar 2026 | Target |
|--------|----------|----------|----------|--------|
| TS Errors | 172 | 7 | **0** | 0 |
| Test Coverage | ~10% | 21% | ~21% | 60% |
| Largest File | 2800 LOC | 2745 LOC | **1272 LOC** | < 500 LOC |
| Services >1000 LOC | many | 3 | **0** | 0 |

---

## Related Docs

- [Remediation Roadmap](./REMEDIATION-ROADMAP.md) - Detailed phases
- [Refactor Candidates](./REFACTOR_CANDIDATES.md) - Watchlist
- [Archive: Original Plan (Nov 2024)](../archive/stale-docs/TECH-DEBT-REDUCTION-PLAN.md)
