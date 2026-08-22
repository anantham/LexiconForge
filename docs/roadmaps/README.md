# Roadmaps & Tracking

Plans, status tracking, and tech debt management.

| Doc | Purpose | Status |
|-----|---------|--------|
| [CHANGELOG.md](./CHANGELOG.md) | Version history | ✅ Active |
| [TECH-DEBT-STATUS.md](./TECH-DEBT-STATUS.md) | Current tech debt overview | ✅ Active |
| ~~REFACTOR_CANDIDATES.md~~ | Superseded → see [ARCHITECTURE.md §7](../architecture/ARCHITECTURE.md) | 📦 Archived |
| [REMEDIATION-ROADMAP.md](./REMEDIATION-ROADMAP.md) | Phased tech debt remediation | ⚠️ Stale — targets deleted `services/indexeddb.ts`; see ADDITIONAL-ARCHITECTURAL-ISSUES banner |
| [FUTURE-FEATURES.md](./FUTURE-FEATURES.md) | Feature backlog | ✅ Active |
| ~~COMPONENT-DECOMPOSITION-PLAN.md~~ | Split large components | ✅ Complete (archived) |
| [MEMORY_OPTIMIZATION_ROADMAP.md](./MEMORY_OPTIMIZATION_ROADMAP.md) | Image memory → Cache API | ⏳ Mostly implemented (per its own header) |
| [NOVEL_LIBRARY_STATUS.md](./NOVEL_LIBRARY_STATUS.md) | Novel library data hosting | ⏳ Blocked |
| [ADDITIONAL-ARCHITECTURAL-ISSUES.md](./ADDITIONAL-ARCHITECTURAL-ISSUES.md) | Comprehensive audit (P0-P2) | ⚠️ Has stale refs |

> Additional audit/scan docs in this folder not individually indexed:
> TECH-DEBT-INBOX, TECH-DEBT-FIX-PRIORITY-2026-07-07, TECH-DEBT-DEEP-AUDIT-2026-07-07,
> JANE-STREET-STYLE-RECON-2026-07-19, GOLDEN-CONTRACT-REPAIR, INTEGRITY-SCAN-2026-07-26.
> (`DESPRAWL-ROADMAP-2026-08-16.md` exists locally but is not yet committed.)
> `TECH-DEBT-STATUS.md` is the curated overview.

## Missing Documentation

- [ ] **Performance benchmarks**: Baseline metrics for translation speed, memory, load time
- [ ] **CI/CD pipeline plan**: GitHub Actions setup for test gates
