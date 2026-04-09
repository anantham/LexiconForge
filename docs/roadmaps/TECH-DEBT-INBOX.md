# TECH-DEBT-INBOX

Append-only raw debt receipts discovered during implementation.

[DEBT][COMPAT][2026-04-09 10:26 EDT] Temporary novel-library migration compatibility layer
- Files:
  - `services/registryService.ts`
  - `services/importService.ts`
  - `store/bootstrap/initializeStore.ts`
  - `components/NovelLibrary.tsx`
  - `types/novel.ts`
- Symptom:
  - Legacy deep links/bookshelf entries still referenced removed version ids such as `v1-composite`.
  - Some library `session.json` assets resolved through `raw.githubusercontent.com`, which returned Git LFS pointer text instead of the real JSON payload.
- Temporary compatibility added:
  - Legacy version resolution via `legacyVersionIds` plus single-version fallback.
  - Session artifact normalization from raw GitHub to media GitHub.
  - Explicit Git LFS pointer detection in import.
- Follow-up:
  - Remove version-id fallback logic once all active library metadata and saved links/bookmarks have been migrated to canonical version ids.
  - Re-evaluate whether raw→media session URL rewriting is still needed once all published metadata uses canonical artifact URLs directly.
  - Keep or remove the Git LFS pointer guard intentionally; it may still be worth keeping as a defensive diagnostic even after migration cleanup.
- Suggested exit criteria:
  - All registry novels use canonical version ids with no remaining legacy aliases needed.
  - Existing user-facing deep links/bookmarks have either been migrated or are no longer supported by policy.
  - Published metadata points directly at final session artifact URLs without importer-side rewriting.
