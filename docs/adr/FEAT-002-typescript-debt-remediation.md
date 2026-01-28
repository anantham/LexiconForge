# FEAT-002: TypeScript Debt Remediation Strategy

**Date:** 2025-10-27
**Status:** Proposed
**Authors:** Engineering Team
**Supersedes:** None
**References:** `docs/TypeScript-Debt-Inventory-2025-10-27.md`, `diagnostics/tsc-errors-2025-10-27.txt`

## Context
The repository currently fails `npx tsc --noEmit` with 301 diagnostics spanning translators, IndexedDB DTOs, worker pipelines, and slice-based UI state. Past attempts to quiet the compiler relied on ad-hoc `any` casts or broad `exclude` lists, making it difficult to measure real progress. We need a disciplined remediation plan that:

- establishes canonical data-transfer object (DTO) definitions so services, workers, and tests share the same contracts;
- localizes fixes per domain to avoid cross-cutting regressions;
- prevents regressions once an area is clean; and
- keeps progress visible to humans through documentation and automation.

## Decision
Adopt a domain-driven remediation program anchored on a shared error inventory, canonical DTO modules, per-domain compilation gates, and an allow-listed exception tracker.

### Program Pillars
1. **Inventory First:** Capture compiler diagnostics (`diagnostics/tsc-errors-2025-10-27.txt`) and keep the aggregate tables up to date in `docs/TypeScript-Debt-Inventory-2025-10-27.md`. Every remediation pass begins by refreshing this log so new errors are obvious.
2. **Canonical Types:** Introduce shared DTO/type definitions (e.g., `types/db/records.ts`, `types/translation.ts`) that encode the source of truth for chapters, translations, worker messages, and provider payloads. Runtime helpers (codecs, asserts) should live alongside the types.
3. **Domain Isolation:** Tackle one domain at a time (DB operations, translator pipeline, workers, store slices, UI) by updating code + tests to consume the canonical types. No patch should span multiple domains without explicit human sign-off.
4. **Guardrails:** When a domain compiles cleanly, wire a focused TypeScript command into CI (`npm run tscheck:db`, `npm run tscheck:translator`, etc.) plus add path-based ESLint overrides so future changes must pass the relevant `tsconfig`.
5. **Exception Ledger:** Track remaining TypeScript exceptions in a curated `types/ts-errors-allowlist.json` keyed by `file:line`. Entries must include a justification and owner. As files are cleaned, their entries are removed.
6. **Documentation:** Log every sweep in `docs/WORKLOG.md` (timestamp, files, scope, commands). Material architectural changes get their own ADRs referencing this strategy.

## Status & Rollout Plan
- **Phase 0 (complete):** Initial compiler snapshot + error inventory (this change).
- **Phase 1:** Canonicalize IndexedDB DTOs (`types/db/records.ts`, `services/db/**/*`, fixtures) and add `npm run tscheck:db` to CI.
- **Phase 2:** Translator contract cleanup (`services/translationService.ts`, `services/translate/*`, provider adapters, translator tests).
- **Phase 3:** Worker & EPUB typings (`workers/epub.worker.ts`, `services/epub/**/*`, worker message schema).
- **Phase 4:** Store/UI alignment (`store/slices/**/*`, `components/NovelLibrary.tsx`, UI fixtures/tests).
- **Phase 5:** Remove any remaining allowlist entries and enable full `npx tsc --noEmit` in CI.

Each phase concludes with a refreshed inventory, updated WORKLOG entry, and—where needed—follow-on ADRs to document specific domain decisions (e.g., IndexedDB schema codecs).

## Consequences
- **Positive:**
  - Clear visibility into outstanding TypeScript debt and the rate of burn-down.
  - Consistent DTO definitions reduce duplication and runtime drift between services, workers, and tests.
  - Focused CI gates prevent regressions after each domain is stabilized.
- **Negative:**
  - Upfront overhead in maintaining the inventory document and allowlist.
  - Short-term duplication while canonical DTO modules coexist with legacy inline types.
- **Follow-up Work:**
  - Create the allowlist file and supporting lint rule/script.
  - Add domain-specific `tsconfig` fragments and `npm` scripts referenced above.
  - Draft ADRs for DTO canonicalization and worker messaging once those domains are addressed.

## Alternatives Considered
- **Global `tsconfig` excludes:** Rejected; hides debt and offers no path to convergence.
- **Per-file `// @ts-ignore` pragmas:** Rejected; too easy to forget and lacks centralized tracking.
- **Big-bang fix:** Rejected; high risk of regressions and context loss without incremental guardrails.

## Decision Log
- 2025-10-27: Proposed and ratified inventory-first remediation approach (this document).
