> **COMPLETED (Nov 2025)**: Legacy `Repo.ts` compatibility layer removed.
> Modern ops/repository stack is now the only persistence API.

# Legacy Repo Retirement Plan

**Owner:** Codex agent  
**Last updated:** 2025-11-15  
**Goal:** Remove the `Repo` compatibility layer (`adapters/repo/Repo.ts` + `legacy/indexeddb-compat.ts`) so the modern ops/repository stack is the only persistence API.  
**Status:** ✅ Completed (2025-11-15 – compatibility shim deleted, backend toggle now modern/memory only)

---

## Objectives

1. Preserve the three high-signal archived contracts by migrating them to the modern repositories (`ChapterRepository`, `TranslationOps`, etc.).
2. Retire the remaining legacy-focused contracts whose only purpose was documenting past bugs.
3. Delete the compatibility shim once no code loads `makeLegacyRepo`, and document the rollback strategy.
4. Update migration trackers/work logs so future work understands the removal timeline.

---

## Archived Contract Disposition

| File | Action | Rationale | Notes / Tests |
|------|--------|-----------|---------------|
| `archive/tests/db/contracts/translation-simple.legacy.ts` | **Migrate** to modern ops | Fast sanity suite that stores/retrieves translations; valuable regression guard once pointed at `TranslationOps`. | Rewire to use fake IndexedDB + Chapter/Translation repos; keep expectations identical. |
| `archive/tests/db/contracts/migration-validation-clean.legacy.ts` | **Migrate** (drop legacy half) | Structured comparison of stable-ID behaviors; new system assertions remain useful. | Keep modern assertions, replace legacy calls with repo helpers and note removal in docstring. |
| `archive/tests/db/contracts/actual-system-validation.legacy.ts` | **Migrate** | Confirms format-repair + mapping auto-repair; still relevant to ops layer. | Port to ops APIs; remove legacy seeding once ChapterOps handles setup. |
| `archive/tests/db/contracts/migration-validation.legacy.ts` | **Retire** | Superseded by the “clean” variant; no unique coverage. | Preserve takeaways in ADR; delete file. |
| `archive/tests/db/contracts/legacy-workaround.legacy.ts` | **Retire** | Sole purpose was documenting legacy bugs/workarounds; redundant once legacy backend is gone. | Fold insights into ADR; delete file. |
| `archive/tests/db/contracts/diagnostic-investigation.legacy.ts` | **Retire** | Console-heavy hypothesis logging only; no reusable assertions. | Summarize findings in docs, remove file. |
| `archive/tests/db/contracts/diagnostic-evidence.legacy.ts` | **Retire** | Duplicates `StableIdManager` investigation steps; modern tests already cover repairs. | Document results, delete file. |

---

## Execution Steps

1. **Prepare migration harness** ✅
   - Create shared fake-indexeddb test utilities (reuse prior `translation-contracts` helpers) for the suites that stay.
   - Decide on deterministic fixtures for migrated suites (stable IDs, translations, etc.).

2. **Migrate the three target suites** ✅
   - Update imports to point at `services/db/repositories/*` and `services/db/operations/*`.
   - Remove `makeLegacyRepo()` usage, ensuring setup uses `ChapterRepository` or ops.
   - Keep descriptive logging/comments explaining the behaviors we still need to guarantee.

3. **Retire the four redundant suites** ✅
   - Delete the files plus any unused helpers/types they exported.
   - Capture their “lessons learned” inside `docs/INDEXEDDB-FACADE-MIGRATION.md` (diagnostics section).

4. **Remove the compatibility layer** ✅
   - `'legacy'` backend option removed from `services/db/index.ts` (Backend now `'modern' | 'memory'`).
   - Deleted `legacy/indexeddb-compat.ts`, `adapters/repo/Repo.ts`, and `adapters/repo/index.ts`.
   - `dbUtils` now only toggles between modern + memory; attempts to pick `'legacy'` log a warning and default to modern.

5. **Documentation + tooling updates** ✅
   - Updated `docs/REFACTORING_PLAN.md`, `docs/INDEXEDDB-FACADE-MIGRATION.md`, `docs/WORKLOG.md`, and this plan with completion details.
   - Rollback note: without the legacy backend, manual recovery now means exporting sessions or falling back to the in-memory repo.

---

## Testing Strategy

| Step | Tests / Commands |
|------|------------------|
| Suite migrations | `npx tsc --noEmit`; targeted Vitest runs for each migrated suite (e.g., `npm run test -- archive/tests/db/contracts/translation-simple.modern.test.ts --run`). |
| Shim deletion | `npx tsc --noEmit`; smoke Vitest suites that touched DB (`tests/services/exportService.test.ts`, `tests/store/bootstrap/bootstrapHelpers.test.ts`); manual app boot to ensure backend preference resilience. |

---

## Risks & Mitigations

- **Risk:** Removing `'legacy'` backend breaks existing users with `lf:db-backend=legacy`.  
  **Mitigation:** During shim removal, add migration logic that maps stored preference to `'modern'` and log a warning once.

- **Risk:** Migrated suites might rely on behavior only exposed via the old `Repo`.  
  **Mitigation:** Provide helper functions that wrap the ops layer to replicate any tiny convenience (e.g., storing a chapter+translation in one go).

- **Risk:** Docs drift if lessons from retired suites disappear.  
  **Mitigation:** Fold their findings into the migration ADR before deleting the files.

---

## Definition of Done

1. No TypeScript file references `makeLegacyRepo`, `legacyRepo`, or `adapters/repo/Repo`.
2. `Backend` union in `services/db/index.ts` only includes `'modern' | 'memory'`.
3. Archived contract coverage exists solely for the modern stack.
4. Docs/WORKLOG entries describe the removal and residual rollback strategy.
