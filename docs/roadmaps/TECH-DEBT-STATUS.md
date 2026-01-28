# Tech Debt Status

**Last Updated:** January 28, 2026

## Completed Milestones ✅

### IndexedDB Decomposition (Nov 2025)
- Monolithic `services/indexeddb.ts` (2000+ LOC) → Modular services
- 40+ call sites migrated
- Legacy facade deleted
- See: [ADR DB-001](../adr/DB-001-decompose-monolithic-indexeddb.md)

### TypeScript Error Remediation (Nov 2024 - Jan 2026)
- 172 errors → 7 errors (96% reduction)
- Remaining errors in active development areas (Sutta Studio)
- See: [TypeScript Health](../infrastructure/TYPESCRIPT-HEALTH.md)

### Legacy Repository Retirement (Nov 2025)
- `adapters/repo/Repo.ts` compatibility shim removed
- Modern/memory backends only
- See: [Archive: Retirement Plan](../archive/completed/LEGACY_REPO_RETIREMENT_PLAN.md)

---

## Active Tech Debt Items

### 🔴 High Priority

| Item | Location | Issue | Status |
|------|----------|-------|--------|
| Component Size | `components/SettingsModal.tsx` | 2745 LOC, needs decomposition | ⏳ Planned |
| Component Size | `components/ChapterView.tsx` | 1969 LOC, needs decomposition | ⏳ Planned |

See: [Component Decomposition Plan](./COMPONENT-DECOMPOSITION-PLAN.md)

### 🟡 Medium Priority

| Item | Location | Issue | Status |
|------|----------|-------|--------|
| Service Size | `services/navigationService.ts` | >1000 LOC | Watchlist |
| Component Size | `components/sutta-studio/SuttaStudioView.tsx` | >350 LOC | Watchlist |

See: [Refactor Candidates](./REFACTOR_CANDIDATES.md)

### 🟢 Low Priority

| Item | Issue | Notes |
|------|-------|-------|
| Dual Provider Paths | Some services have legacy/modern code paths | Cleanup after stability confirmed |
| Test Coverage | 21% overall | Improving via golden tests |

---

## Metrics

| Metric | Nov 2024 | Jan 2026 | Target |
|--------|----------|----------|--------|
| TS Errors | 172 | 7 | < 10 |
| Test Coverage | ~10% | 21% | 60% |
| Largest File | 2800 LOC | 2745 LOC | < 500 LOC |

---

## Related Docs

- [Remediation Roadmap](./REMEDIATION-ROADMAP.md) - Detailed phases
- [Refactor Candidates](./REFACTOR_CANDIDATES.md) - Watchlist
- [Archive: Original Plan (Nov 2024)](../archive/stale-docs/TECH-DEBT-REDUCTION-PLAN.md)
